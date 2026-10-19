from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from app.auth import get_current_user_required
from app.storage import storage

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

# Allowed MIME types mapped to their canonical extension
ALLOWED_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


@router.post("/image/")
async def upload_image(
    image: UploadFile = File(...),
    current_user=Depends(get_current_user_required),
):
    """Upload a cover/inline image. Returns { url: "/media/uploads/..." }."""
    # Validate extension
    filename = image.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Only JPG, PNG, and WEBP images are allowed.",
        )

    # Validate MIME type
    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Only JPG, PNG, and WEBP images are allowed.",
        )

    # Validate size
    data = await image.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="File is too large. Maximum size is 5 MB.",
        )

    path = storage.save(data, ALLOWED_TYPES[image.content_type])
    return {"url": path}
