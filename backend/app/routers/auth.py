from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import UserCreate, UserResponse, Token, LoginRequest, TokenRefresh, UserUpdate
from app.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user_required,
    _rate_limit_check,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128


def _client_identifier(request: Request) -> str:
    """Best-effort client identifier for rate limiting (forwarded-for or host)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    client = request.client
    return client.host if client else "unknown"


@router.post("/register/", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(
    payload: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    """Register a new user and return JWT tokens."""
    _rate_limit_check(f"register:{_client_identifier(request)}")

    if payload.password != payload.password2:
        raise HTTPException(status_code=400, detail="Passwords do not match.")

    if not (MIN_PASSWORD_LENGTH <= len(payload.password) <= MAX_PASSWORD_LENGTH):
        raise HTTPException(
            status_code=400,
            detail=f"Password must be between {MIN_PASSWORD_LENGTH} and {MAX_PASSWORD_LENGTH} characters.",
        )

    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already exists.")

    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered.")

    user = User(
        username=payload.username,
        email=payload.email,
        first_name=payload.first_name,
        last_name=payload.last_name,
        password=get_password_hash(payload.password),
        date_joined=datetime.now(timezone.utc),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token_data = {"sub": str(user.id)}
    return {
        "access": create_access_token(token_data),
        "refresh": create_refresh_token(token_data),
        "user": user,
    }


@router.post("/token/", response_model=Token)
def login(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Authenticate and return JWT tokens."""
    _rate_limit_check(f"login:{_client_identifier(request)}")

    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    token_data = {"sub": str(user.id)}
    return {
        "access": create_access_token(token_data),
        "refresh": create_refresh_token(token_data),
    }


@router.post("/token/refresh/", response_model=Token)
def refresh_token(payload: TokenRefresh):
    """Refresh access token using refresh token."""
    data = decode_token(payload.refresh)
    if data is None or data.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token.")

    user_id = data.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token payload.")

    token_data = {"sub": str(user_id)}
    return {
        "access": create_access_token(token_data),
        "refresh": create_refresh_token(token_data),
    }


@router.get("/me/", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user_required)):
    """Get current user profile."""
    return current_user


@router.patch("/me/", response_model=UserResponse)
def update_me(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    """Update current user profile."""
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user
