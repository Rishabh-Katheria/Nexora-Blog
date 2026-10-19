"""Image storage abstraction.

Local development stores files under backend/media/uploads/.
The interface is intentionally small so a future S3 implementation can
replace LocalImageStorage without touching the article/upload code.

To migrate to S3 in the future, implement ImageStorage with boto3 and set
S3_BUCKET_NAME / S3_REGION / S3_ENDPOINT_URL in the environment. Existing
local files are never moved automatically.
"""
import uuid
from pathlib import Path
from typing import Protocol, Optional
import os

from app.config import get_settings

settings = get_settings()


class ImageStorage(Protocol):
    """Storage backend for article images."""

    def save(self, data: bytes, ext: str) -> str:
        """Store image bytes and return the public path/URL."""
        ...


class LocalImageStorage:
    """Stores images on the local filesystem under an uploads directory."""

    def __init__(self, upload_dir: str | Path, url_prefix: str = "/media/uploads"):
        self.upload_dir = Path(upload_dir)
        self.url_prefix = url_prefix.rstrip("/")
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def save(self, data: bytes, ext: str) -> str:
        # Never trust the original filename — use a UUID to avoid collisions
        # and path-traversal issues.
        filename = f"{uuid.uuid4().hex}.{ext}"
        (self.upload_dir / filename).write_bytes(data)
        return f"{self.url_prefix}/{filename}"


class S3ImageStorage:
    """Placeholder storage backend for future Amazon S3 migration.

    Not wired into the app by default. To enable, instantiate this class and
    assign it to the `storage` module-level variable below, then ensure
    S3_BUCKET_NAME / S3_REGION are configured.

    Requires boto3 (not a project dependency — add it when ready).
    """

    def __init__(self, bucket_name: str, region: str, endpoint_url: Optional[str] = None):
        self.bucket_name = bucket_name
        self.region = region
        self.endpoint_url = endpoint_url
        raise NotImplementedError(
            "S3ImageStorage is a placeholder. Install boto3 and implement "
            "the save() method before enabling S3 storage."
        )

    def save(self, data: bytes, ext: str) -> str:
        raise NotImplementedError("S3 save() not implemented.")


# Backend root: backend/app/storage.py -> backend/
BACKEND_ROOT = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BACKEND_ROOT / "media" / "uploads"
AVATAR_DIR = BACKEND_ROOT / "media" / "avatars"

# Local storage is the default and only active backend.
# Files stored here will NOT survive a container restart unless the
# backend/media directory is mounted as a persistent volume.
storage: ImageStorage = LocalImageStorage(UPLOAD_DIR, url_prefix="/media/uploads")
avatar_storage: ImageStorage = LocalImageStorage(AVATAR_DIR, url_prefix="/media/avatars")

# S3 configuration (read from environment, not used unless wiring is added):
S3_BUCKET_NAME = settings.S3_BUCKET_NAME
S3_REGION = settings.S3_REGION
S3_ENDPOINT_URL = settings.S3_ENDPOINT_URL
