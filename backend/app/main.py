from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from pathlib import Path
import logging

from app.config import get_settings
from app.database import engine, Base, SessionLocal
from app.routers import articles, categories, tags, authors, auth, uploads, users
from app import seo
from app.seo import FRONTEND_DIST, INDEX_HTML
from app.models import Category

settings = get_settings()

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("nexora")

# Media (uploaded images) directory — backend/media
# Mounted at /media, so /media/uploads/x.png -> backend/media/uploads/x.png
MEDIA_DIR = Path(__file__).resolve().parent.parent / "media"
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

# The five categories allowed for new articles
REQUIRED_CATEGORIES = [
    ("Generative AI", "generative-ai"),
    ("Machine Learning", "machine-learning"),
    ("Deep Learning", "deep-learning"),
    ("Python", "python"),
    ("Data Science", "data-science"),
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Fail fast if no signing secret is configured (never run with an empty key)
    if not settings.SECRET_KEY:
        raise RuntimeError(
            "SECRET_KEY is not configured. Set it in backend/.env or the environment "
            "(see backend/.env.example)."
        )
    # Create tables on startup
    Base.metadata.create_all(bind=engine)
    # Seed the required categories (idempotent — existing rows are kept)
    db = SessionLocal()
    try:
        for name, slug in REQUIRED_CATEGORIES:
            exists = db.query(Category).filter(Category.slug == slug).first()
            if not exists:
                db.add(Category(name=name, slug=slug))
        db.commit()
    finally:
        db.close()
    yield
    logger.info("Nexora API shutdown")


app = FastAPI(
    title="Nexora API",
    description="A premium content platform API",
    version="1.0.0",
    lifespan=lifespan,
    # API docs are a development convenience — hidden when DEBUG=False
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)

# TrustedHostMiddleware guards against HTTP Host header attacks.
# In production, set ALLOWED_HOSTS (or FRONTEND_URL) to your real domain(s).
allowed_hosts = ["*"] if settings.DEBUG else [
    h.replace("http://", "").replace("https://", "").split(":")[0]
    for h in settings.cors_origin_list()
]
app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Add basic security headers to every response."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    if not settings.DEBUG:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# Serve uploaded media files at /media/...
app.mount("/media", StaticFiles(directory=str(MEDIA_DIR)), name="media")

# Include routers
app.include_router(articles.router)
app.include_router(categories.router)
app.include_router(tags.router)
app.include_router(authors.router)
app.include_router(auth.router)
app.include_router(uploads.router)
app.include_router(users.router)
# SEO metadata + crawler-facing SPA shell (registered last so /api, /media
# and /docs always win).
app.include_router(seo.router)

# When the frontend has been built, serve it from the same origin so crawlers
# receive a real HTML document (with metadata) for every public URL. Inactive
# until `frontend/dist` exists.
if INDEX_HTML.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="frontend-assets")

    @app.get("/robots.txt", include_in_schema=False)
    def robots_txt():
        return FileResponse(FRONTEND_DIST / "robots.txt")

    @app.get("/sitemap.xml", include_in_schema=False)
    def sitemap_xml():
        return FileResponse(FRONTEND_DIST / "sitemap.xml")

    @app.get("/favicon.svg", include_in_schema=False)
    def favicon_svg():
        return FileResponse(FRONTEND_DIST / "favicon.svg")


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "nexora-api"}


@app.get("/")
def home():
    return {"message": "Welcome to Nexora API"}
