"""Helpers for turning stored image values into displayable URLs."""
from app.config import get_settings

settings = get_settings()


def resolve_image_url(image):
    """Convert a stored image value into a URL the frontend can display.

    - empty/None -> None
    - full http(s) URL -> unchanged
    - /media/... path -> unchanged (frontend prefixes the API base URL)
    - anything else is treated as a legacy Cloudinary public ID and
      expanded to a full Cloudinary URL using the configured cloud name.
    """
    if not image:
        return None
    if image.startswith("http://") or image.startswith("https://"):
        return image
    if image.startswith("/media/"):
        return image
    return f"https://res.cloudinary.com/{settings.CLOUDINARY_CLOUD_NAME}/image/upload/{image}"
