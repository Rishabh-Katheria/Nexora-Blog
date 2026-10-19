from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Tag
from app.schemas import TagResponse

router = APIRouter(prefix="/api/tags", tags=["tags"])


@router.get("/", response_model=list[TagResponse])
def list_tags(db: Session = Depends(get_db)):
    """List all tags."""
    tags = db.query(Tag).order_by(Tag.name).all()
    return tags
