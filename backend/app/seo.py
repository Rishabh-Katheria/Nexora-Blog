"""Server-side SEO metadata for public article and author URLs.

The React app updates document metadata on the client, but social crawlers and
most link-preview scrapers do not execute JavaScript. This module builds the
same metadata from the database so it can be rendered into the HTML document
that is actually served to a crawler.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.parse import unquote

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.media import resolve_image_url
from app.models import Article, User
from app.routers.articles import article_to_list_response
from app.routers.users import _public_profile

settings = get_settings()

router = APIRouter(tags=["seo"])

SITE_NAME = "Nexora"
DEFAULT_DESCRIPTION = (
    "A modern publishing platform where writers, researchers, and technologists "
    "share in-depth insights on AI, data science, and the future of technology."
)

# Default Open Graph image used when an article or profile has no cover image
# or avatar. Served from the same origin as the SPA shell.
DEFAULT_IMAGE = "/og-image.svg"

# Built frontend. When present the SPA shell and its assets are served by the
# backend, which gives crawlers a real HTML document per URL.
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
INDEX_HTML = FRONTEND_DIST / "index.html"


def _site_url(request: Request) -> str:
    """Public origin used for absolute metadata URLs."""
    if settings.SITE_URL:
        return settings.SITE_URL.rstrip("/")
    return str(request.base_url).rstrip("/")


def _author_name(user: Optional[User]) -> str:
    if not user:
        return ""
    if user.first_name or user.last_name:
        return f"{user.first_name or ''} {user.last_name or ''}".strip()
    return user.username or ""


def _absolute_image(value: Optional[str], site: str) -> str:
    """Resolve a stored image value to an absolute URL for social cards.

    Falls back to DEFAULT_IMAGE when no value is provided so every public page
    has a sensible social preview image.
    """
    if not value:
        resolved = DEFAULT_IMAGE
    else:
        resolved = resolve_image_url(value)
        if not resolved:
            resolved = DEFAULT_IMAGE
    if resolved.startswith("/"):
        return f"{site}{resolved}"
    return resolved


def _iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if isinstance(value, datetime) else None


def _truncate(text: Optional[str], limit: int = 160) -> str:
    clean = " ".join((text or "").split())
    if len(clean) <= limit:
        return clean
    return f"{clean[: limit - 1].rstrip()}…"


def _article_meta(article: Article, site: str) -> dict:
    """Build metadata for a single article from real database values."""
    url = f"{site}/article/{article.slug}"
    description = _truncate(article.excerpt or article.title)
    name = _author_name(article.author)
    image = _absolute_image(article.cover_image, site)
    author_url = f"{site}/u/{article.author.username}" if article.author else ""
    published = _iso(article.published_at)
    modified = _iso(article.updated_at)

    og = {
        "og:title": article.title,
        "og:description": description,
        "og:type": "article",
        "og:url": url,
        "og:site_name": SITE_NAME,
    }
    if image:
        og["og:image"] = image
    if name:
        og["article:author"] = name
    if published:
        og["article:published_time"] = published
    if article.category:
        og["article:section"] = article.category

    twitter = {
        "twitter:card": "summary_large_image" if image else "summary",
        "twitter:title": article.title,
        "twitter:description": description,
    }
    if image:
        twitter["twitter:image"] = image

    json_ld: dict = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": article.title,
        "description": description,
        "mainEntityOfPage": {"@type": "WebPage", "@id": url},
        "publisher": {"@type": "Organization", "name": SITE_NAME},
    }
    if image:
        json_ld["image"] = [image]
    if published:
        json_ld["datePublished"] = published
    if modified:
        json_ld["dateModified"] = modified
    if name:
        json_ld["author"] = (
            {"@type": "Person", "name": name, "url": author_url}
            if author_url
            else {"@type": "Person", "name": name}
        )

    return {
        "title": f"{article.title} | {SITE_NAME}",
        "description": description,
        "canonical": url,
        "robots": "index, follow",
        "og": og,
        "twitter": twitter,
        "jsonLd": json_ld,
    }


def _profile_meta(user: User, site: str) -> dict:
    """Build metadata for a public author profile from real database values."""
    url = f"{site}/u/{user.username}"
    display_name = _author_name(user) or user.username
    description = _truncate(
        user.bio or f"{display_name} publishes on {SITE_NAME}."
    )
    image = _absolute_image(user.avatar, site)

    og = {
        "og:title": f"{display_name} | {SITE_NAME}",
        "og:description": description,
        "og:type": "profile",
        "og:url": url,
        "og:site_name": SITE_NAME,
    }
    if image:
        og["og:image"] = image

    twitter = {
        "twitter:card": "summary_large_image" if image else "summary",
        "twitter:title": f"{display_name} | {SITE_NAME}",
        "twitter:description": description,
    }
    if image:
        twitter["twitter:image"] = image

    json_ld = {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        "name": display_name,
        "url": url,
        "mainEntity": {"@type": "Person", "name": display_name, "url": url},
    }

    return {
        "title": f"{display_name} | {SITE_NAME}",
        "description": description,
        "canonical": url,
        "robots": "index, follow",
        "og": og,
        "twitter": twitter,
        "jsonLd": json_ld,
    }


def render_head(meta: dict) -> str:
    """Serialize metadata into a <head> fragment (escaped, safe to inject)."""
    parts = [f"<title>{_escape(meta.get('title', SITE_NAME))}</title>"]

    description = meta.get("description")
    if description:
        parts.append(f'<meta name="description" content="{_escape(description)}" />')

    robots = meta.get("robots")
    if robots:
        parts.append(f'<meta name="robots" content="{_escape(robots)}" />')

    canonical = meta.get("canonical")
    if canonical:
        parts.append(f'<link rel="canonical" href="{_escape(canonical)}" />')

    for key, value in (meta.get("og") or {}).items():
        if value:
            parts.append(f'<meta property="{_escape(key)}" content="{_escape(str(value))}" />')

    for key, value in (meta.get("twitter") or {}).items():
        if value:
            parts.append(f'<meta name="{_escape(key)}" content="{_escape(str(value))}" />')

    json_ld = meta.get("jsonLd")
    if json_ld:
        import json

        serialized = json.dumps(json_ld).replace("<", "\\u003c")
        parts.append(f'<script type="application/ld+json">{serialized}</script>')

    return "\n    ".join(parts)


def _escape(value: str) -> str:
    return (
        str(value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _render_shell(head_html: str) -> str:
    """Return an HTML document with the metadata injected into <head>."""
    if INDEX_HTML.exists():
        html = INDEX_HTML.read_text(encoding="utf-8")
        if "</head>" in html:
            return html.replace("</head>", f"    {head_html}\n  </head>", 1)
        return f"{head_html}\n{html}"

    return (
        '<!doctype html>\n<html lang="en">\n<head>\n    <meta charset="utf-8" />\n'
        f"    {head_html}\n  </head>\n  <body>\n"
        '    <div id="root"></div>\n  </body>\n</html>\n'
    )


def build_meta_for_path(path: str, request: Request, db: Session) -> Optional[dict]:
    """Resolve a public path to metadata, or None when it is not public."""
    site = _site_url(request)

    if path.startswith("/article/"):
        slug = unquote(path[len("/article/"):].strip("/"))
        if not slug:
            return None
        article = (
            db.query(Article)
            .filter(Article.slug == slug, Article.is_published == True)
            .first()
        )
        return _article_meta(article, site) if article else None

    if path.startswith("/u/"):
        username = unquote(path[len("/u/"):].strip("/"))
        if not username:
            return None
        user = db.query(User).filter(User.username == username).first()
        return _profile_meta(user, site) if user else None

    return None


@router.get("/api/seo/meta")
def seo_meta(path: str, request: Request, db: Session = Depends(get_db)):
    """Return metadata (and the rendered head fragment) for a public URL."""
    meta = build_meta_for_path(path, request, db)
    if meta is None:
        raise HTTPException(status_code=404, detail="Not found.")
    return {"path": path, "meta": meta, "head": render_head(meta)}


@router.get("/article/{slug}", response_class=HTMLResponse, include_in_schema=False)
def article_shell(slug: str, request: Request, db: Session = Depends(get_db)):
    """Serve the SPA shell with article metadata for crawlers."""
    article = (
        db.query(Article)
        .filter(Article.slug == slug, Article.is_published == True)
        .first()
    )
    if not article:
        raise HTTPException(status_code=404, detail="Article not found.")
    return HTMLResponse(_render_shell(render_head(_article_meta(article, _site_url(request)))))


@router.get("/u/{username}", response_class=HTMLResponse, include_in_schema=False)
def profile_shell(username: str, request: Request, db: Session = Depends(get_db)):
    """Serve the SPA shell with author metadata for crawlers."""
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Author not found.")
    return HTMLResponse(_render_shell(render_head(_profile_meta(user, _site_url(request)))))
