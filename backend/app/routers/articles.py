import logging
import math
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, asc, func
from sqlalchemy.exc import IntegrityError
import cloudinary
import cloudinary.uploader

from app.config import get_settings
from app.database import get_db
from app.models import Article, ArticleLike, ArticleBookmark, Category, Tag, User
from app.media import resolve_image_url
from app.schemas import (
    ArticleCreate,
    ArticleUpdate,
    ArticleListResponse,
    ArticleDetailResponse,
    InteractionResponse,
    PaginatedResponse,
)
from app.auth import get_current_user, get_current_user_required
from app.dependencies import PaginationParams, ArticleFilterParams

settings = get_settings()

logger = logging.getLogger("nexora.articles")

# Configure Cloudinary
cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET or None,
)

# The only categories allowed for new/updated articles
ALLOWED_CATEGORY_SLUGS = {
    "generative-ai",
    "machine-learning",
    "deep-learning",
    "python",
    "data-science",
}

router = APIRouter(prefix="/api/articles", tags=["articles"])

# Fields allowed for client-controlled ordering (whitelist — never arbitrary getattr)
ORDERABLE_FIELDS = {"published_at", "created_at", "updated_at", "views_count", "title"}

# Allowed image types for the legacy in-request cover upload
ALLOWED_UPLOAD_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_UPLOAD_SIZE = 5 * 1024 * 1024  # 5 MB


def generate_slug(title: str) -> str:
    import re
    slug = re.sub(r'[^\w\s-]', '', title.lower())
    slug = re.sub(r'[-\s]+', '-', slug).strip('-')
    return slug


def get_or_create_tags(db: Session, tag_names: list[str]) -> list[Tag]:
    tags = []
    for name in tag_names:
        tag = db.query(Tag).filter(Tag.name == name.lower().strip()).first()
        if not tag:
            tag = Tag(name=name.lower().strip(), slug=generate_slug(name))
            db.add(tag)
            db.flush()
        tags.append(tag)
    return tags


def article_to_list_response(article: Article, like_count: int = 0) -> dict:
    return {
        "id": article.id,
        "title": article.title,
        "slug": article.slug,
        "excerpt": article.excerpt,
        "cover_image": article.cover_image,  # resolved URL (Cloudinary / media / full)
        "author": article.author,
        "category": article.category,
        "category_detail": article.category_model,
        "tags": article.tags,
        "published_at": article.published_at,
        "created_at": article.created_at,
        "updated_at": article.updated_at,
        "reading_time": article.reading_time,
        "views_count": article.views_count,
        "like_count": like_count,
        "is_featured": article.is_featured,
        "is_published": article.is_published,
    }


def bulk_like_counts(db: Session, articles: list[Article]) -> dict[int, int]:
    """One grouped query for like counts across a page of articles (no N+1)."""
    ids = [a.id for a in articles]
    if not ids:
        return {}
    rows = (
        db.query(ArticleLike.article_id, func.count(ArticleLike.id))
        .filter(ArticleLike.article_id.in_(ids))
        .group_by(ArticleLike.article_id)
        .all()
    )
    return {article_id: count for article_id, count in rows}


def article_list_responses(db: Session, articles: list[Article]) -> list[dict]:
    """Serialize a batch of articles with like counts from a single query."""
    counts = bulk_like_counts(db, articles)
    return [article_to_list_response(a, like_count=counts.get(a.id, 0)) for a in articles]


def interaction_state(db: Session, article: Article, current_user: Optional[User]) -> dict:
    """Like/bookmark state for one article — always computed from the database."""
    like_count = (
        db.query(func.count(ArticleLike.id))
        .filter(ArticleLike.article_id == article.id)
        .scalar()
        or 0
    )
    liked = False
    bookmarked = False
    if current_user is not None:
        liked = (
            db.query(ArticleLike.id)
            .filter(ArticleLike.article_id == article.id, ArticleLike.user_id == current_user.id)
            .first()
            is not None
        )
        bookmarked = (
            db.query(ArticleBookmark.id)
            .filter(ArticleBookmark.article_id == article.id, ArticleBookmark.user_id == current_user.id)
            .first()
            is not None
        )
    return {"liked": liked, "like_count": like_count, "bookmarked": bookmarked}


def article_detail_response(db: Session, article: Article, current_user: Optional[User]) -> dict:
    """Full detail payload including per-user interaction flags."""
    state = interaction_state(db, article, current_user)
    payload = article_to_list_response(article, like_count=state["like_count"])
    payload.update(
        {
            "content": article.content,
            "image": article.image,
            "liked_by_current_user": state["liked"],
            "bookmarked_by_current_user": state["bookmarked"],
        }
    )
    return payload


def validate_category(db: Session, category_model_id: Optional[int], category_str: str):
    """Validate a category for a new/updated article.

    Returns (slug, id). Raises 400 if the category is not one of the
    five allowed categories. Existing articles with legacy categories
    are unaffected — this only runs when a category is being set.
    """
    if category_model_id is not None:
        cat = db.query(Category).filter(Category.id == category_model_id).first()
        if not cat or cat.slug not in ALLOWED_CATEGORY_SLUGS:
            raise HTTPException(status_code=400, detail="Invalid category.")
        return cat.slug, cat.id
    if category_str:
        if category_str not in ALLOWED_CATEGORY_SLUGS:
            raise HTTPException(status_code=400, detail="Invalid category.")
        cat = db.query(Category).filter(Category.slug == category_str).first()
        return category_str, (cat.id if cat else None)
    return None, None


@router.get("/", response_model=PaginatedResponse)
def list_articles(
    pagination: PaginationParams = Depends(),
    filters: ArticleFilterParams = Depends(),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """List articles with filtering, search, and pagination."""
    query = db.query(Article)

    # Apply filters
    if filters.category:
        query = query.join(Category).filter(Category.slug == filters.category)
    if filters.tag:
        query = query.join(Article.tags).filter(Tag.slug == filters.tag)
    if filters.author:
        query = query.filter(Article.author_id == filters.author)
    if filters.featured is not None:
        query = query.filter(Article.is_featured == filters.featured)
    if filters.search:
        search_term = f"%{filters.search}%"
        query = query.outerjoin(User, Article.author_id == User.id).filter(
            or_(
                Article.title.ilike(search_term),
                Article.excerpt.ilike(search_term),
                Article.content.ilike(search_term),
                User.username.ilike(search_term),
                User.first_name.ilike(search_term),
                User.last_name.ilike(search_term),
            )
        )

    # Published articles are public; authenticated users additionally see their
    # own drafts — never another user's unpublished articles.
    if current_user is None:
        query = query.filter(Article.is_published == True)
    else:
        query = query.filter(
            or_(Article.is_published == True, Article.author_id == current_user.id)
        )

    # Apply ordering (whitelisted fields only)
    ordering = filters.ordering or "-published_at"
    desc_order = ordering.startswith("-")
    field = ordering[1:] if desc_order else ordering
    if field not in ORDERABLE_FIELDS:
        raise HTTPException(status_code=400, detail="Invalid ordering field.")
    query = query.order_by(desc(getattr(Article, field)) if desc_order else asc(getattr(Article, field)))

    # Pagination
    total = query.count()
    articles = query.offset(pagination.offset).limit(pagination.page_size).all()

    total_pages = math.ceil(total / pagination.page_size) if total > 0 else 1
    has_next = pagination.page < total_pages
    has_prev = pagination.page > 1

    return {
        "count": total,
        "next": f"/api/articles/?page={pagination.page + 1}&page_size={pagination.page_size}" if has_next else None,
        "previous": f"/api/articles/?page={pagination.page - 1}&page_size={pagination.page_size}" if has_prev else None,
        "results": article_list_responses(db, articles),
    }


@router.get("/featured/", response_model=list[ArticleListResponse])
def get_featured(db: Session = Depends(get_db)):
    """Get featured articles."""
    articles = (
        db.query(Article)
        .filter(Article.is_featured == True, Article.is_published == True)
        .order_by(desc(Article.published_at))
        .limit(5)
        .all()
    )
    return article_list_responses(db, articles)


@router.get("/latest/", response_model=list[ArticleListResponse])
def get_latest(db: Session = Depends(get_db)):
    """Get latest published articles."""
    articles = (
        db.query(Article)
        .filter(Article.is_published == True)
        .order_by(desc(Article.published_at))
        .limit(10)
        .all()
    )
    return article_list_responses(db, articles)


@router.get("/my_articles/", response_model=list[ArticleListResponse])
def get_my_articles(
    current_user: User = Depends(get_current_user_required),
    is_published: Optional[bool] = Query(None, description="Filter by publication status"),
    db: Session = Depends(get_db),
):
    """Get current user's articles, optionally filtered by publication status."""
    query = db.query(Article).filter(Article.author_id == current_user.id)
    if is_published is not None:
        query = query.filter(Article.is_published == is_published)
    articles = query.order_by(desc(Article.created_at)).all()
    return article_list_responses(db, articles)


@router.get("/my_articles/published/")
def get_my_published_articles(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    """Get current user's published articles with count."""
    query = db.query(Article).filter(
        Article.author_id == current_user.id,
        Article.is_published == True,
    )
    count = query.count()
    articles = query.order_by(desc(Article.published_at)).all()
    return {
        "count": count,
        "articles": article_list_responses(db, articles),
    }


@router.post("/", response_model=ArticleDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_article(
    title: str = Form(""),
    excerpt: str = Form(""),
    content: str = Form(""),
    category: str = Form("AI"),
    category_model_id: Optional[int] = Form(None),
    tags: str = Form(""),
    is_published: bool = Form(True),
    is_featured: bool = Form(False),
    image: Optional[UploadFile] = File(None),
    image_url: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    """Create a new article. Drafts may be incomplete; publishing requires title + content."""
    # Validate + normalize category (only the five allowed categories)
    category_slug, category_model_id = validate_category(db, category_model_id, category)
    if category_slug is None:
        raise HTTPException(status_code=400, detail="Category is required.")

    # Publishing requires a title and content; drafts may be incomplete
    if is_published and not title.strip():
        raise HTTPException(status_code=400, detail="Title is required to publish.")
    if is_published and not content.strip():
        raise HTTPException(status_code=400, detail="Content is required to publish.")

    # Featured status is a curation decision — staff/superuser only
    if is_featured and not (current_user.is_staff or current_user.is_superuser):
        is_featured = False

    # Handle image: an explicit cover URL takes precedence over file upload
    final_image_url = image_url
    if not final_image_url and image and image.filename:
        if image.content_type not in ALLOWED_UPLOAD_TYPES:
            raise HTTPException(
                status_code=400,
                detail="Unsupported file type. Only JPG, PNG, and WEBP images are allowed.",
            )
        data = await image.read()
        if len(data) > MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=400,
                detail="File is too large. Maximum size is 5 MB.",
            )
        try:
            import io
            result = cloudinary.uploader.upload(
                io.BytesIO(data),
                folder="articles",
                resource_type="image",
            )
            final_image_url = result.get("secure_url")
        except Exception as exc:
            logger.warning("Cloudinary upload failed, article saved without image: %s", exc)

    # Parse tags
    tag_names = [t.strip() for t in tags.split(",") if t.strip()]

    # Create article (slug assigned after flush so empty-title drafts get a unique slug)
    article = Article(
        title=title,
        slug="",
        excerpt=excerpt,
        content=content,
        category=category_slug,
        category_model_id=category_model_id,
        is_published=is_published,
        is_featured=is_featured,
        image=final_image_url,
        author_id=current_user.id,
        published_at=datetime.utcnow() if is_published else None,
    )

    if tag_names:
        article.tags = get_or_create_tags(db, tag_names)

    db.add(article)
    db.flush()  # assign ID

    if title.strip():
        base_slug = generate_slug(title)
        slug = base_slug
        counter = 2
        while db.query(Article).filter(Article.slug == slug).first():
            slug = f"{base_slug}-{counter}"
            counter += 1
        article.slug = slug
    else:
        article.slug = f"draft-{article.id}"

    db.commit()
    db.refresh(article)

    return article


@router.get("/{slug}", response_model=ArticleDetailResponse)
def get_article(
    slug: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Retrieve a single article by slug."""
    article = db.query(Article).filter(Article.slug == slug).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found.")

    # Check permissions
    if not article.is_published and (current_user is None or article.author_id != current_user.id):
        raise HTTPException(status_code=404, detail="Article not found.")

    # Increment view count
    article.views_count += 1
    db.commit()

    return article_detail_response(db, article, current_user)


@router.patch("/{slug}", response_model=ArticleDetailResponse)
async def update_article(
    slug: str,
    payload: ArticleUpdate,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    """Update an article (author only)."""
    article = db.query(Article).filter(Article.slug == slug).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found.")

    if article.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own articles.")

    # Update fields
    update_data = payload.model_dump(exclude_unset=True)

    # Featured status is staff-only — strip it for regular users
    if "is_featured" in update_data and not (current_user.is_staff or current_user.is_superuser):
        update_data.pop("is_featured")

    # Handle tags separately
    if "tags" in update_data:
        tag_names = update_data.pop("tags")
        if tag_names is not None:
            article.tags = get_or_create_tags(db, tag_names)

    # Handle category separately (validate against the five allowed categories)
    if "category" in update_data or "category_model_id" in update_data:
        new_cat_id = update_data.pop("category_model_id", None)
        new_cat_str = update_data.pop("category", None)
        cat_slug, cat_id = validate_category(db, new_cat_id, new_cat_str or "")
        if cat_slug:
            article.category = cat_slug
            article.category_model_id = cat_id

    for field, value in update_data.items():
        setattr(article, field, value)

    # Publishing requires title + content; set/clear the published timestamp
    if article.is_published:
        if not (article.title or "").strip():
            raise HTTPException(status_code=400, detail="Title is required to publish.")
        if not (article.content or "").strip():
            raise HTTPException(status_code=400, detail="Content is required to publish.")
        if article.published_at is None:
            article.published_at = datetime.utcnow()
    else:
        article.published_at = None

    db.commit()
    db.refresh(article)
    return article_detail_response(db, article, current_user)


def _visible_article(db: Session, slug: str, current_user: Optional[User]) -> Article:
    """Fetch an article the current user is allowed to see (same rules as GET)."""
    article = db.query(Article).filter(Article.slug == slug).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found.")
    if not article.is_published and (current_user is None or article.author_id != current_user.id):
        raise HTTPException(status_code=404, detail="Article not found.")
    return article


@router.get("/{slug}/like", response_model=InteractionResponse)
def get_like_state(
    slug: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Current user's like/bookmark state for an article (anonymous → all false)."""
    article = _visible_article(db, slug, current_user)
    return interaction_state(db, article, current_user)


@router.post("/{slug}/like", response_model=InteractionResponse)
def like_article(
    slug: str,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    """Like an article (authenticated user from JWT; one like per user)."""
    article = _visible_article(db, slug, current_user)
    existing = (
        db.query(ArticleLike)
        .filter(ArticleLike.article_id == article.id, ArticleLike.user_id == current_user.id)
        .first()
    )
    if existing is None:
        try:
            db.add(ArticleLike(user_id=current_user.id, article_id=article.id))
            db.commit()
        except IntegrityError:
            # Unique constraint — a concurrent request already added the like
            db.rollback()
    return interaction_state(db, article, current_user)


@router.delete("/{slug}/like", response_model=InteractionResponse)
def unlike_article(
    slug: str,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    """Remove the current user's like (JWT-derived; never accepts a user id)."""
    article = _visible_article(db, slug, current_user)
    like = (
        db.query(ArticleLike)
        .filter(ArticleLike.article_id == article.id, ArticleLike.user_id == current_user.id)
        .first()
    )
    if like is not None:
        db.delete(like)
        db.commit()
    return interaction_state(db, article, current_user)


@router.get("/{slug}/bookmark", response_model=InteractionResponse)
def get_bookmark_state(
    slug: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Current user's bookmark state for an article (anonymous → all false)."""
    article = _visible_article(db, slug, current_user)
    return interaction_state(db, article, current_user)


@router.post("/{slug}/bookmark", response_model=InteractionResponse)
def bookmark_article(
    slug: str,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    """Bookmark an article for the current user's reading list."""
    article = _visible_article(db, slug, current_user)
    existing = (
        db.query(ArticleBookmark)
        .filter(ArticleBookmark.article_id == article.id, ArticleBookmark.user_id == current_user.id)
        .first()
    )
    if existing is None:
        try:
            db.add(ArticleBookmark(user_id=current_user.id, article_id=article.id))
            db.commit()
        except IntegrityError:
            db.rollback()
    return interaction_state(db, article, current_user)


@router.delete("/{slug}/bookmark", response_model=InteractionResponse)
def unbookmark_article(
    slug: str,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    """Remove the current user's bookmark."""
    article = _visible_article(db, slug, current_user)
    bookmark = (
        db.query(ArticleBookmark)
        .filter(ArticleBookmark.article_id == article.id, ArticleBookmark.user_id == current_user.id)
        .first()
    )
    if bookmark is not None:
        db.delete(bookmark)
        db.commit()
    return interaction_state(db, article, current_user)


@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_article(
    slug: str,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    """Delete an article (author only)."""
    article = db.query(Article).filter(Article.slug == slug).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found.")

    if article.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own articles.")

    db.delete(article)
    db.commit()
