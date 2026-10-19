from datetime import datetime, timedelta, timezone
from typing import Optional
import base64
import hashlib
import hmac
import os
import time
from collections import defaultdict
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import User

settings = get_settings()
security = HTTPBearer(auto_error=False)

# In-memory rate limiter for auth endpoints (login/register).
# Maps identifier (IP or username) -> list of attempt timestamps.
_rate_limit_attempts: dict[str, list[float]] = defaultdict(list)


def _rate_limit_check(identifier: str) -> None:
    """Reject requests that exceed the per-window attempt limit.

    Simple sliding-window rate limiter — no external dependencies.
    Intended for auth endpoints (login/register) to slow brute-force attempts.
    Not distributed-safe; for single-instance deployments.

    When NEXORA_TEST_MODE is set, rate limiting is bypassed so automated
    test suites can register many users in quick succession.
    """
    if os.environ.get("NEXORA_TEST_MODE") == "1":
        return

    now = time.time()
    window = settings.RATE_LIMIT_WINDOW_SECONDS
    max_attempts = settings.RATE_LIMIT_MAX_ATTEMPTS

    # Purge attempts outside the window
    _rate_limit_attempts[identifier] = [
        t for t in _rate_limit_attempts[identifier] if now - t < window
    ]

    if len(_rate_limit_attempts[identifier]) >= max_attempts:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Please try again later.",
        )

    _rate_limit_attempts[identifier].append(now)


def _verify_django_pbkdf2(plain_password: str, encoded: str) -> bool:
    """Verify a legacy Django `pbkdf2_sha256$iterations$salt$hash` password."""
    try:
        algorithm, iterations, salt, expected = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        derived = hashlib.pbkdf2_hmac(
            "sha256",
            plain_password.encode("utf-8"),
            salt.encode("utf-8"),
            int(iterations),
        )
        computed = base64.b64encode(derived).decode("ascii").rstrip("=")
        return hmac.compare_digest(computed, expected.rstrip("="))
    except (ValueError, TypeError):
        return False


def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Legacy Django accounts store pbkdf2_sha256 hashes — bcrypt can't parse them.
    if hashed_password.startswith("pbkdf2_sha256$"):
        return _verify_django_pbkdf2(plain_password, hashed_password)
    # Unknown/foreign hash format: fail closed instead of raising (avoids HTTP 500).
    if not hashed_password.startswith(("$2a$", "$2b$", "$2y$")):
        return False
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if credentials is None:
        return None

    payload = decode_token(credentials.credentials)
    if payload is None:
        return None

    user_id = payload.get("sub")
    if user_id is None:
        return None

    # JWT `sub` must be a string per RFC 7519 — coerce back to the integer PK.
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        return None

    user = db.query(User).filter(User.id == user_id).first()
    return user


async def get_current_user_required(
    user: Optional[User] = Depends(get_current_user),
) -> User:
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
