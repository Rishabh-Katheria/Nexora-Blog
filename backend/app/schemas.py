from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional


# ─── User Schemas ────────────────────────────────────────────────────────────

class UserBase(BaseModel):
    username: str
    email: EmailStr
    first_name: str = ""
    last_name: str = ""


class UserCreate(UserBase):
    password: str
    password2: str


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None


class UserResponse(UserBase):
    id: int
    # Legacy accounts may have an empty email — EmailStr would reject it and
    # 500 any response that embeds an author (e.g. article listings).
    email: str = ""
    bio: str = ""
    avatar: Optional[str] = None
    date_joined: datetime

    class Config:
        from_attributes = True


class ProfileUpdate(BaseModel):
    """Editable profile fields (username/email are intentionally excluded)."""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    bio: Optional[str] = None
    avatar: Optional[str] = None


class AuthorResponse(BaseModel):
    """Safe public author info embedded in article payloads — no email/private fields."""
    id: int
    username: str
    first_name: str = ""
    last_name: str = ""
    bio: str = ""
    avatar: Optional[str] = None

    class Config:
        from_attributes = True


class PublicProfileResponse(BaseModel):
    """Safe public profile — never exposes password/JWT/internal fields."""
    id: int
    username: str
    first_name: str = ""
    last_name: str = ""
    bio: str = ""
    avatar: Optional[str] = None
    article_count: int = 0
    articles: list[ArticleListResponse] = []

    class Config:
        from_attributes = True


# ─── Category Schemas ────────────────────────────────────────────────────────

class CategoryBase(BaseModel):
    name: str
    description: str = ""


class CategoryCreate(CategoryBase):
    pass


class CategoryResponse(CategoryBase):
    id: int
    slug: str
    article_count: int = 0

    class Config:
        from_attributes = True


# ─── Tag Schemas ─────────────────────────────────────────────────────────────

class TagBase(BaseModel):
    name: str


class TagCreate(TagBase):
    pass


class TagResponse(TagBase):
    id: int
    slug: str

    class Config:
        from_attributes = True


# ─── Article Schemas ─────────────────────────────────────────────────────────

class ArticleBase(BaseModel):
    title: str
    excerpt: str
    content: str
    category: str = "AI"
    is_published: bool = True
    is_featured: bool = False


class ArticleCreate(ArticleBase):
    category_model_id: Optional[int] = None
    tags: list[str] = []
    image: Optional[str] = None


class ArticleUpdate(BaseModel):
    title: Optional[str] = None
    excerpt: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    category_model_id: Optional[int] = None
    tags: Optional[list[str]] = None
    image: Optional[str] = None
    is_published: Optional[bool] = None
    is_featured: Optional[bool] = None


class ArticleListResponse(BaseModel):
    id: int
    title: str
    slug: str
    excerpt: str
    cover_image: Optional[str] = None
    author: Optional[AuthorResponse] = None
    category: str
    category_detail: Optional[CategoryResponse] = None
    tags: list[TagResponse] = []
    published_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    reading_time: int
    views_count: int
    like_count: int = 0
    is_featured: bool
    is_published: bool

    class Config:
        from_attributes = True


class ArticleDetailResponse(ArticleListResponse):
    content: str
    # Raw stored image value (unresolved). The editor needs this to round-trip
    # the original value instead of writing back the resolved display URL.
    image: Optional[str] = None
    updated_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    liked_by_current_user: bool = False
    bookmarked_by_current_user: bool = False


# ─── Interaction Schemas (likes / bookmarks) ─────────────────────────────────

class InteractionResponse(BaseModel):
    """State returned by like/bookmark endpoints — DB is the source of truth."""
    liked: bool = False
    like_count: int = 0
    bookmarked: bool = False


class BookmarksResponse(BaseModel):
    """The current user's reading list (private to the JWT-derived user)."""
    count: int
    articles: list[ArticleListResponse] = []


# ─── Auth Schemas ────────────────────────────────────────────────────────────

class Token(BaseModel):
    access: str
    refresh: str


class TokenRefresh(BaseModel):
    refresh: str


class LoginRequest(BaseModel):
    username: str
    password: str


# ─── Pagination ──────────────────────────────────────────────────────────────

class PaginatedResponse(BaseModel):
    count: int
    next: Optional[str] = None
    previous: Optional[str] = None
    results: list[ArticleListResponse]
