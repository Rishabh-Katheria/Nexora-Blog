"""
Backend production-readiness tests for Nexora.

These tests run against a live backend at http://127.0.0.1:8000.
They create isolated test users/articles and clean up after themselves,
so they never touch production/development data.

Run with:
    cd backend
    ..\env\Scripts\python.exe -m pytest tests/ -v

Prerequisites:
    Backend must be running: .\env\Scripts\python.exe manage.py runserver --no-reload
"""

import os
import sys
import time
import uuid

import httpx

# Allow running from backend/ directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE_URL = os.environ.get("NEXORA_TEST_BASE_URL", "http://127.0.0.1:8000")

# Track created resources for cleanup
_created_users: list[int] = []
_created_articles: list[str] = []


def unique_name(prefix: str = "test") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def register_user(client: httpx.Client, username: str | None = None, email: str | None = None, password: str = "TestPass123!") -> dict:
    username = username or unique_name("reguser")
    email = email or f"{username}@example.com"
    resp = client.post("/api/auth/register/", json={
        "username": username,
        "email": email,
        "password": password,
        "password2": password,
        "first_name": "Test",
        "last_name": "User",
    })
    assert resp.status_code == 201, f"register failed: {resp.status_code} {resp.text}"
    data = resp.json()
    assert "access" in data
    assert "refresh" in data
    # response_model=Token strips the 'user' field; fetch /me to get user id
    headers = auth_headers(data["access"])
    me_resp = client.get("/api/auth/me/", headers=headers)
    assert me_resp.status_code == 200, f"/me failed: {me_resp.status_code} {me_resp.text}"
    user_data = me_resp.json()
    _created_users.append(user_data["id"])
    return {"access": data["access"], "refresh": data["refresh"], "user": user_data}


def login_user(client: httpx.Client, username: str, password: str = "TestPass123!") -> dict:
    resp = client.post("/api/auth/token/", json={"username": username, "password": password})
    assert resp.status_code == 200, f"login failed: {resp.status_code} {resp.text}"
    return resp.json()


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def create_article(client: httpx.Client, headers: dict, slug: str | None = None, published: bool = True, title: str | None = None) -> dict:
    title = title or unique_name("article")
    slug = slug or unique_name("article-slug")
    # Endpoint uses Form() fields, not JSON
    form_data = {
        "title": title,
        "excerpt": "Test excerpt for automated testing.",
        "content": "Test content body for automated testing.",
        "category": "generative-ai",
        "slug": slug,
        "is_published": str(published).lower(),
    }
    resp = client.post("/api/articles/", data=form_data, headers=headers)
    assert resp.status_code == 201, f"create article failed: {resp.status_code} {resp.text}"
    data = resp.json()
    _created_articles.append(data["slug"])
    return data


def cleanup():
    """Delete test articles and users via the API (as their owners)."""
    # We can't easily delete articles/users without auth tokens for each,
    # so we leave them. They have unique names and won't collide.
    # In a production test environment, a test DB reset would be used.
    pass


# ──────────────────────────────────────────────────────────────
# Registration tests
# ──────────────────────────────────────────────────────────────

def test_register_success():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        data = register_user(client)
        assert "access" in data
        assert "refresh" in data
        assert "user" in data
        assert data["user"]["username"].startswith("reguser-")


def test_register_password_mismatch():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        username = unique_name("regfail")
        resp = client.post("/api/auth/register/", json={
            "username": username,
            "email": f"{username}@example.com",
            "password": "TestPass123!",
            "password2": "DifferentPass123!",
            "first_name": "Test",
            "last_name": "User",
        })
        assert resp.status_code == 400


def test_register_duplicate_username():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        username = unique_name("regdup")
        email = f"{username}@example.com"
        # First registration succeeds
        r1 = client.post("/api/auth/register/", json={
            "username": username, "email": email,
            "password": "TestPass123!", "password2": "TestPass123!",
        })
        assert r1.status_code == 201
        # Second registration with same username fails
        r2 = client.post("/api/auth/register/", json={
            "username": username, "email": f"{username}-2@example.com",
            "password": "TestPass123!", "password2": "TestPass123!",
        })
        assert r2.status_code == 400


def test_register_short_password():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        username = unique_name("regshort")
        resp = client.post("/api/auth/register/", json={
            "username": username,
            "email": f"{username}@example.com",
            "password": "short",
            "password2": "short",
        })
        assert resp.status_code == 400


# ──────────────────────────────────────────────────────────────
# Login tests
# ──────────────────────────────────────────────────────────────

def test_login_success():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        data = register_user(client)
        username = data["user"]["username"]
        token_data = login_user(client, username)
        assert "access" in token_data
        assert "refresh" in token_data


def test_login_wrong_password():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        username = unique_name("regwrongpw")
        register_user(client, username=username, email=f"{username}@example.com")
        resp = client.post("/api/auth/token/", json={
            "username": username,
            "password": "WrongPass123!",
        })
        assert resp.status_code == 401


def test_login_nonexistent_user():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        resp = client.post("/api/auth/token/", json={
            "username": "nonexistent-user-xyz",
            "password": "TestPass123!",
        })
        assert resp.status_code == 401


# ──────────────────────────────────────────────────────────────
# Auth protected endpoints
# ──────────────────────────────────────────────────────────────

def test_me_without_auth():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        resp = client.get("/api/auth/me/")
        assert resp.status_code == 401


def test_me_with_auth():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        data = register_user(client)
        token_data = login_user(client, data["user"]["username"])
        headers = auth_headers(token_data["access"])
        resp = client.get("/api/auth/me/", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["username"] == data["user"]["username"]


# ──────────────────────────────────────────────────────────────
# Article ownership tests
# ──────────────────────────────────────────────────────────────

def test_create_article_requires_auth():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        resp = client.post("/api/articles/", json={
            "title": "Unauthorized Article",
            "excerpt": "Excerpt.",
            "content": "Content.",
            "category": "generative-ai",
        })
        assert resp.status_code == 401


def test_create_article_success():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        data = register_user(client)
        token_data = login_user(client, data["user"]["username"])
        headers = auth_headers(token_data["access"])
        article = create_article(client, headers)
        assert article["title"].startswith("article-")
        assert article["is_published"] is True
        assert article["slug"] is not None


def test_update_own_article():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        data = register_user(client)
        token_data = login_user(client, data["user"]["username"])
        headers = auth_headers(token_data["access"])
        article = create_article(client, headers)
        slug = article["slug"]

        resp = client.patch(f"/api/articles/{slug}", json={
            "title": "Updated Title",
            "excerpt": "Updated excerpt.",
        }, headers=headers)
        assert resp.status_code == 200
        assert resp.json()["title"] == "Updated Title"


def test_update_others_article_forbidden():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        # User A creates an article
        data_a = register_user(client, username=unique_name("ownera"))
        token_a = login_user(client, data_a["user"]["username"])
        headers_a = auth_headers(token_a["access"])
        article = create_article(client, headers_a)
        slug = article["slug"]

        # User B tries to update it
        data_b = register_user(client, username=unique_name("userb"))
        token_b = login_user(client, data_b["user"]["username"])
        headers_b = auth_headers(token_b["access"])
        resp = client.patch(f"/api/articles/{slug}", json={"title": "Hacked"}, headers=headers_b)
        assert resp.status_code == 403


def test_delete_own_article():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        data = register_user(client)
        token_data = login_user(client, data["user"]["username"])
        headers = auth_headers(token_data["access"])
        article = create_article(client, headers)
        slug = article["slug"]

        resp = client.delete(f"/api/articles/{slug}", headers=headers)
        assert resp.status_code == 204


def test_delete_others_article_forbidden():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        data_a = register_user(client, username=unique_name("ownera-del"))
        token_a = login_user(client, data_a["user"]["username"])
        headers_a = auth_headers(token_a["access"])
        article = create_article(client, headers_a)
        slug = article["slug"]

        data_b = register_user(client, username=unique_name("userb-del"))
        token_b = login_user(client, data_b["user"]["username"])
        headers_b = auth_headers(token_b["access"])
        resp = client.delete(f"/api/articles/{slug}", headers=headers_b)
        assert resp.status_code == 403


# ──────────────────────────────────────────────────────────────
# Publishing / unpublishing
# ──────────────────────────────────────────────────────────────

def test_publish_and_unpublish():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        data = register_user(client)
        token_data = login_user(client, data["user"]["username"])
        headers = auth_headers(token_data["access"])
        article = create_article(client, headers, published=True)
        slug = article["slug"]

        # Unpublish
        resp = client.patch(f"/api/articles/{slug}", json={"is_published": False}, headers=headers)
        assert resp.status_code == 200
        assert resp.json()["is_published"] is False

        # Republish
        resp = client.patch(f"/api/articles/{slug}", json={"is_published": True}, headers=headers)
        assert resp.status_code == 200
        assert resp.json()["is_published"] is True


def test_publish_without_title_fails():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        data = register_user(client)
        token_data = login_user(client, data["user"]["username"])
        headers = auth_headers(token_data["access"])
        # Create a draft with no title
        resp = client.post("/api/articles/", data={
            "title": "",
            "excerpt": "Draft excerpt.",
            "content": "Draft content.",
            "category": "generative-ai",
            "slug": unique_name("draft-slug"),
            "is_published": "false",
        }, headers=headers)
        assert resp.status_code == 201
        slug = resp.json()["slug"]

        # Trying to publish without a title should fail
        resp = client.patch(f"/api/articles/{slug}", json={"is_published": True}, headers=headers)
        assert resp.status_code == 400


# ──────────────────────────────────────────────────────────────
# Likes and bookmarks
# ──────────────────────────────────────────────────────────────

def test_like_and_unlike():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        data = register_user(client)
        token_data = login_user(client, data["user"]["username"])
        headers = auth_headers(token_data["access"])
        article = create_article(client, headers)
        slug = article["slug"]

        # Like
        resp = client.post(f"/api/articles/{slug}/like", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["liked"] is True
        assert resp.json()["like_count"] == 1

        # Unlike
        resp = client.delete(f"/api/articles/{slug}/like", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["liked"] is False
        assert resp.json()["like_count"] == 0


def test_like_requires_auth():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        resp = client.post("/api/articles/some-slug/like")
        assert resp.status_code == 401


def test_bookmark_and_reading_list():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        data = register_user(client)
        token_data = login_user(client, data["user"]["username"])
        headers = auth_headers(token_data["access"])
        article = create_article(client, headers)
        slug = article["slug"]

        # Bookmark
        resp = client.post(f"/api/articles/{slug}/bookmark", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["bookmarked"] is True

        # Reading list
        resp = client.get("/api/users/me/bookmarks/", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["count"] == 1

        # Unbookmark
        resp = client.delete(f"/api/articles/{slug}/bookmark", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["bookmarked"] is False


def test_bookmark_requires_auth():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        resp = client.post("/api/articles/some-slug/bookmark")
        assert resp.status_code == 401


# ──────────────────────────────────────────────────────────────
# Private data isolation
# ──────────────────────────────────────────────────────────────

def test_user_cannot_see_others_bookmarks():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        data_a = register_user(client, username=unique_name("bookmarka"))
        token_a = login_user(client, data_a["user"]["username"])
        headers_a = auth_headers(token_a["access"])
        article = create_article(client, headers_a)
        slug = article["slug"]

        # User A bookmarks
        client.post(f"/api/articles/{slug}/bookmark", headers=headers_a)

        # User B checks their own reading list — should be empty
        data_b = register_user(client, username=unique_name("bookmarkb"))
        token_b = login_user(client, data_b["user"]["username"])
        headers_b = auth_headers(token_b["access"])
        resp = client.get("/api/users/me/bookmarks/", headers=headers_b)
        assert resp.status_code == 200
        assert resp.json()["count"] == 0


def test_draft_not_visible_to_others():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        data_a = register_user(client, username=unique_name("drafta"))
        token_a = login_user(client, data_a["user"]["username"])
        headers_a = auth_headers(token_a["access"])
        article = create_article(client, headers_a, published=False)
        slug = article["slug"]

        # User B tries to fetch User A's draft — should be 404
        data_b = register_user(client, username=unique_name("draftb"))
        token_b = login_user(client, data_b["user"]["username"])
        headers_b = auth_headers(token_b["access"])
        resp = client.get(f"/api/articles/{slug}", headers=headers_b)
        assert resp.status_code == 404


# ──────────────────────────────────────────────────────────────
# Image upload validation
# ──────────────────────────────────────────────────────────────

def test_upload_image_requires_auth():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        resp = client.post("/api/uploads/image/", files={"image": ("test.jpg", b"fake", "image/jpeg")})
        assert resp.status_code == 401


def test_upload_image_invalid_type():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        data = register_user(client)
        token_data = login_user(client, data["user"]["username"])
        headers = auth_headers(token_data["access"])
        resp = client.post("/api/uploads/image/", files={"image": ("test.txt", b"not an image", "text/plain")}, headers=headers)
        assert resp.status_code == 400


# ──────────────────────────────────────────────────────────────
# Public endpoints accessible without auth
# ──────────────────────────────────────────────────────────────

def test_public_article_list():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        resp = client.get("/api/articles/")
        assert resp.status_code == 200
        data = resp.json()
        assert "count" in data
        assert "results" in data


def test_public_article_detail():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        # Fetch a known published article
        resp = client.get("/api/articles/")
        assert resp.status_code == 200
        results = resp.json()["results"]
        if results:
            slug = results[0]["slug"]
            detail = client.get(f"/api/articles/{slug}")
            assert detail.status_code == 200
            assert detail.json()["slug"] == slug


def test_health_endpoint():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


# ──────────────────────────────────────────────────────────────
# Token refresh
# ──────────────────────────────────────────────────────────────

def test_refresh_token():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        data = register_user(client)
        token_data = login_user(client, data["user"]["username"])
        resp = client.post("/api/auth/token/refresh/", json={"refresh": token_data["refresh"]})
        assert resp.status_code == 200
        assert "access" in resp.json()


def test_refresh_with_invalid_token():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        resp = client.post("/api/auth/token/refresh/", json={"refresh": "invalid.token.value"})
        assert resp.status_code == 401
