from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    DATABASE_URL: str = "postgresql://localhost/nexora"

    # JWT — SECRET_KEY must be provided via environment/.env (never hardcode).
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Canonical public origin of the deployed site (used for absolute metadata
    # URLs). Falls back to the request origin when unset.
    SITE_URL: Optional[str] = None

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ]
    # Optional extra origin (e.g. the deployed frontend) appended to CORS_ORIGINS.
    FRONTEND_URL: Optional[str] = None

    # Cloudinary (legacy images only — empty disables upload path)
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # App — set DEBUG=False in production (hides /docs and /redoc).
    DEBUG: bool = True
    PAGE_SIZE: int = 12

    # Logging
    LOG_LEVEL: str = "INFO"

    # Rate limiting for auth endpoints (login/register) — sliding window.
    # Set RATE_LIMIT_MAX_ATTEMPTS=0 to disable.
    RATE_LIMIT_MAX_ATTEMPTS: int = 10
    RATE_LIMIT_WINDOW_SECONDS: int = 60

    # Object storage (future S3 migration). When set, use S3 instead of local
    # filesystem for new uploads. Existing local files are untouched.
    S3_BUCKET_NAME: Optional[str] = None
    S3_REGION: Optional[str] = None
    S3_ENDPOINT_URL: Optional[str] = None  # e.g. for MinIO/local testing

    def cors_origin_list(self) -> list[str]:
        """Effective CORS origins, including FRONTEND_URL when configured."""
        origins = list(self.CORS_ORIGINS)
        if self.FRONTEND_URL:
            url = self.FRONTEND_URL.rstrip("/")
            if url and url not in origins:
                origins.append(url)
        return origins

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
