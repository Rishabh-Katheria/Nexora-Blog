from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Table, UniqueConstraint, func
from sqlalchemy.orm import relationship
from typing import Optional
from app.database import Base


# Association table for Article <-> Tag many-to-many
article_tags = Table(
    "blog_article_tags",
    Base.metadata,
    Column("article_id", Integer, ForeignKey("blog_article.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("blog_tag.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    __tablename__ = "auth_user"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(150), unique=True, nullable=False, index=True)
    email = Column(String(254), unique=True, nullable=False, index=True)
    first_name = Column(String(150), default="")
    last_name = Column(String(150), default="")
    bio = Column(Text, default="")
    avatar = Column(String(500), nullable=True)
    password = Column(String(128), nullable=False)
    is_active = Column(Boolean, default=True)
    is_staff = Column(Boolean, default=False)
    is_superuser = Column(Boolean, default=False)
    date_joined = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)

    articles = relationship("Article", back_populates="author", cascade="all, delete-orphan")
    likes = relationship("ArticleLike", back_populates="user", cascade="all, delete-orphan")
    bookmarks = relationship("ArticleBookmark", back_populates="user", cascade="all, delete-orphan")


class Category(Base):
    __tablename__ = "blog_category"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, default="")

    articles = relationship("Article", back_populates="category_model")


class Tag(Base):
    __tablename__ = "blog_tag"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    slug = Column(String(50), unique=True, nullable=False, index=True)

    articles = relationship("Article", secondary=article_tags, back_populates="tags")


class Article(Base):
    __tablename__ = "blog_article"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    slug = Column(String(200), unique=True, nullable=False, index=True)
    excerpt = Column(Text, nullable=False)
    content = Column(Text, nullable=False)
    image = Column(String(500), nullable=True)

    # Legacy category field (kept for backward compatibility)
    category = Column(String(50), default="AI")

    # Foreign keys
    author_id = Column(Integer, ForeignKey("auth_user.id", ondelete="CASCADE"), nullable=True, index=True)
    category_model_id = Column(Integer, ForeignKey("blog_category.id", ondelete="SET NULL"), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    published_at = Column(DateTime(timezone=True), nullable=True, index=True)

    # Status flags
    is_published = Column(Boolean, default=True, index=True)
    is_featured = Column(Boolean, default=False)
    views_count = Column(Integer, default=0)

    # Relationships — author/tags use selectin to avoid N+1 queries in listings
    author = relationship("User", back_populates="articles", lazy="selectin")
    category_model = relationship("Category", back_populates="articles", lazy="joined")
    tags = relationship("Tag", secondary=article_tags, back_populates="articles", lazy="selectin")
    likes = relationship("ArticleLike", back_populates="article", cascade="all, delete-orphan")
    bookmarks = relationship("ArticleBookmark", back_populates="article", cascade="all, delete-orphan")

    @property
    def reading_time(self) -> int:
        """Calculate reading time in minutes (200 WPM)."""
        words = len(self.content.split())
        return max(1, words // 200)

    @property
    def cover_image(self) -> Optional[str]:
        """Resolved display URL for the article image (Cloudinary / media / full)."""
        from app.media import resolve_image_url
        return resolve_image_url(self.image)

    @property
    def category_detail(self):
        """Alias for category_model so response schemas can use category_detail."""
        return self.category_model


class ArticleLike(Base):
    """A single like from a user on an article.

    The (user_id, article_id) unique constraint guarantees one like per user
    per article — duplicates are impossible at the database level.
    Both foreign keys cascade so deleted users/articles leave no orphans.
    """
    __tablename__ = "blog_article_like"
    __table_args__ = (
        UniqueConstraint("user_id", "article_id", name="uq_like_user_article"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("auth_user.id", ondelete="CASCADE"), nullable=False, index=True)
    article_id = Column(Integer, ForeignKey("blog_article.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="likes")
    article = relationship("Article", back_populates="likes")


class ArticleBookmark(Base):
    """A bookmark (saved article) from a user — the reading list source.

    Same guarantees as ArticleLike: one bookmark per user per article,
    cascade on user/article deletion.
    """
    __tablename__ = "blog_article_bookmark"
    __table_args__ = (
        UniqueConstraint("user_id", "article_id", name="uq_bookmark_user_article"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("auth_user.id", ondelete="CASCADE"), nullable=False, index=True)
    article_id = Column(Integer, ForeignKey("blog_article.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="bookmarks")
    article = relationship("Article", back_populates="bookmarks")
