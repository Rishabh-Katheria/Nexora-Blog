from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Article
from app.schemas import AuthorResponse

router = APIRouter(prefix="/api/authors", tags=["authors"])


@router.get("/", response_model=list[AuthorResponse])
def list_authors(db: Session = Depends(get_db)):
    """List all users who have written articles (public fields only)."""
    authors = (
        db.query(User)
        .join(Article, User.id == Article.author_id)
        .distinct()
        .order_by(User.username)
        .all()
    )
    return authors


@router.get("/{author_id}", response_model=AuthorResponse)
def get_author(author_id: int, db: Session = Depends(get_db)):
    """Get a single author by ID (public fields only)."""
    author = db.query(User).filter(User.id == author_id).first()
    if not author:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Author not found.")
    return author
