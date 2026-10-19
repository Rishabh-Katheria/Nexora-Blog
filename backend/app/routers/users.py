from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_

from app.database import get_db
from app.models import User, Article, ArticleBookmark
from app.schemas import UserResponse, ProfileUpdate, PublicProfileResponse, BookmarksResponse
from app.auth import get_current_user_required
from app.storage import avatar_storage
from app.routers.articles import article_to_list_response, article_list_responses

router = APIRouter(prefix="/api/users", tags=["users"])

# Allowed MIME types mapped to their canonical extension (same as article uploads)
ALLOWED_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
MAX_BIO_LENGTH = 250


def _public_profile(db: Session, user: User) -> PublicProfileResponse:
    """Build a safe public profile with published article count + articles."""
    query = db.query(Article).filter(
        Article.author_id == user.id,
        Article.is_published == True,
    )
    count = query.count()
    articles = query.order_by(Article.published_at.desc()).all()
    return PublicProfileResponse(
        id=user.id,
        username=user.username,
        first_name=user.first_name or "",
        last_name=user.last_name or "",
        bio=user.bio or "",
        avatar=user.avatar,
        article_count=count,
        articles=article_list_responses(db, articles),  # includes real like counts
    )


@router.get("/me/", response_model=UserResponse)
def get_my_profile(current_user: User = Depends(get_current_user_required)):
    """Get the authenticated user's own profile."""
    return current_user


@router.patch("/me/", response_model=UserResponse)
def update_my_profile(
    payload: ProfileUpdate,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    """Update the authenticated user's profile (JWT-derived — never client-supplied user id)."""
    data = payload.model_dump(exclude_unset=True)

    bio = data.get("bio")
    if bio is not None:
        if len(bio) > MAX_BIO_LENGTH:
            raise HTTPException(
                status_code=400,
                detail=f"Bio is too long. Maximum length is {MAX_BIO_LENGTH} characters.",
            )
        current_user.bio = bio

    for field in ("first_name", "last_name", "avatar"):
        if field in data:
            setattr(current_user, field, data[field])

    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/avatar/", response_model=UserResponse)
async def upload_my_avatar(
    image: UploadFile = File(...),
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    """Upload a profile photo for the authenticated user (JPG/PNG/WEBP, max 5 MB)."""
    filename = image.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS or image.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Only JPG, PNG, and WEBP images are allowed.",
        )

    data = await image.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="File is too large. Maximum size is 5 MB.",
        )

    path = avatar_storage.save(data, ALLOWED_TYPES[image.content_type])
    current_user.avatar = path
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/me/bookmarks/", response_model=BookmarksResponse)
def get_my_bookmarks(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    """The current user's reading list — bookmarked articles, newest first.

    User is always derived from the JWT; no client-supplied user id.
    """
    rows = (
        db.query(ArticleBookmark, Article)
        .join(Article, ArticleBookmark.article_id == Article.id)
        .filter(
            ArticleBookmark.user_id == current_user.id,
            # A bookmarked article that the author unpublished must not stay
            # visible to other users (own drafts are fine).
            or_(
                Article.is_published == True,
                Article.author_id == current_user.id,
            ),
        )
        .order_by(desc(ArticleBookmark.created_at))
        .all()
    )
    articles = [article for (_bookmark, article) in rows]
    return {"count": len(articles), "articles": article_list_responses(db, articles)}


@router.get("/{username}", response_model=PublicProfileResponse)
def get_public_profile(username: str, db: Session = Depends(get_db)):
    """Public author profile by username. No authentication required."""
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Author not found.")
    return _public_profile(db, user)
