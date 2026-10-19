from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import Category, Article
from app.schemas import CategoryResponse

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("/", response_model=list[CategoryResponse])
def list_categories(db: Session = Depends(get_db)):
    """List all categories with article counts."""
    categories = db.query(Category).order_by(Category.name).all()

    result = []
    for cat in categories:
        count = (
            db.query(func.count(Article.id))
            .filter(Article.category_model_id == cat.id, Article.is_published == True)
            .scalar()
        )
        result.append({
            "id": cat.id,
            "name": cat.name,
            "slug": cat.slug,
            "description": cat.description,
            "article_count": count or 0,
        })

    return result


@router.get("/{slug}", response_model=CategoryResponse)
def get_category(slug: str, db: Session = Depends(get_db)):
    """Get a single category by slug."""
    cat = db.query(Category).filter(Category.slug == slug).first()
    if not cat:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Category not found.")

    count = (
        db.query(func.count(Article.id))
        .filter(Article.category_model_id == cat.id, Article.is_published == True)
        .scalar()
    )

    return {
        "id": cat.id,
        "name": cat.name,
        "slug": cat.slug,
        "description": cat.description,
        "article_count": count or 0,
    }
