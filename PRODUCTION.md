# Nexora — Production Deployment Guide

## Overview

Nexora is a React + Vite frontend with a FastAPI backend running on PostgreSQL.
This document covers the steps required to deploy to production safely.

## Prerequisites

- Python 3.10+ (backend)
- Node.js 18+ (frontend)
- PostgreSQL database (Neon, RDS, or self-hosted)
- A domain name with DNS configured
- SSL/TLS certificates (Let's Encrypt or your provider)

## 1. Backend Environment Configuration

Copy `backend/.env.example` to `backend/.env` and fill in real values:

```bash
cp backend/.env.example backend/.env
```

Required variables:

| Variable | Description | Example |
|---|---|---|
| `SECRET_KEY` | JWT signing secret — **must be strong and unique** | `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `DEBUG` | Set to `False` in production (hides /docs) | `False` |
| `SITE_URL` | Canonical public URL (no trailing slash) | `https://www.nexora.com` |
| `FRONTEND_URL` | Deployed frontend origin (for CORS) | `https://www.nexora.com` |
| `LOG_LEVEL` | Logging level | `INFO` |
| `RATE_LIMIT_MAX_ATTEMPTS` | Auth rate limit per window | `10` |
| `RATE_LIMIT_WINDOW_SECONDS` | Rate limit window in seconds | `60` |
| `CLOUDINARY_*` | Only if using legacy Cloudinary uploads | (optional) |
| `S3_*` | Future S3 migration (optional, not wired by default) | (optional) |

**Never commit `.env`.** It is in `.gitignore`.

## 2. Frontend Environment Configuration

Copy `frontend/.env.example` to `frontend/.env`:

```bash
cp frontend/.env.example frontend/.env
```

| Variable | Description | Example |
|---|---|---|
| `VITE_API_URL` | Backend origin (no trailing slash) | `https://api.nexora.com` |
| `VITE_SITE_URL` | Canonical site URL (no trailing slash) | `https://www.nexora.com` |

**Do not use `localhost` URLs in production.** `VITE_API_URL` must point to your deployed backend.

## 3. Database Setup

The backend uses SQLAlchemy with `create_all()` on startup — it creates missing tables but never alters or drops existing ones. No Alembic is used (idempotent migration scripts only).

Run idempotent migrations once before first deploy:

```bash
cd backend
.\env\Scripts\python.exe migrate_interactions.py    # creates like/bookmark tables
.\env\Scripts\python.exe migrate_profile_fields.py  # adds bio/avatar columns
.\env\Scripts\python.exe migrate_image_column.py    # widens image column to VARCHAR(500)
```

Seed categories (idempotent — runs automatically on server startup).

### Backup and Restore (PostgreSQL)

**Backup:**
```bash
pg_dump -h <host> -U <user> -d <db> > nexora_backup_$(date +%F).sql
```

**Restore:**
```bash
psql -h <host> -U <user> -d <db> < nexora_backup_YYYY-MM-DD.sql
```

**Automated backup:** Schedule `pg_dump` daily via cron or your cloud provider's automated backup.

**Point-in-time recovery:** If using Neon or RDS, enable their built-in PITR features.

## 4. Backend Startup

From `backend/`:

```bash
.\env\Scripts\python.exe manage.py runserver --no-reload --host 0.0.0.0 --port 8000
```

For production, use a proper ASGI server (e.g., `uvicorn` directly with workers) behind a reverse proxy:

```bash
.\env\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## 5. Frontend Build and Serve

From `frontend/`:

```bash
# Install dependencies (first time only)
npm ci

# Build for production (runs prebuild → generates sitemap from live backend data)
npm run build
```

The `prebuild` script calls `scripts/generate-sitemap.mjs`, which fetches published articles and authors from the backend and writes `public/sitemap.xml` and `public/robots.txt`. The backend **must be running** with data available for the sitemap to include real content.

Serve the built `dist/` directory with any static file host (Nginx, Apache, Vercel, Netlify, S3+CloudFront, etc.):

```bash
# Example with Nginx: serve dist/ on port 80, proxy /api to backend:8000
```

## 6. Reverse Proxy (Nginx Example)

```nginx
server {
    listen 80;
    server_name www.nexora.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name www.nexora.com;

    # SSL certificates (certbot or your provider)
    ssl_certificate /etc/letsencrypt/live/www.nexora.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.nexora.com/privkey.pem;

    # Frontend static files
    location / {
        root /var/www/nexora/dist;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Media files
    location /media/ {
        proxy_pass http://127.0.0.1:8000;
    }
}
```

## 7. Security Checklist

- [ ] `SECRET_KEY` is strong and unique (not the example value)
- [ ] `DEBUG=False` in production `.env`
- [ ] `SITE_URL` and `FRONTEND_URL` set to real domain(s)
- [ ] `VITE_API_URL` points to production backend, not localhost
- [ ] CORS origins do not include `*`
- [ ] Database credentials not in version control
- [ ] `.env` files are in `.gitignore`
- [ ] HTTPS enforced (Strict-Transport-Security header added by backend when `DEBUG=False`)
- [ ] Regular database backups scheduled
- [ ] `backend/media/` directory on a persistent volume (files won't survive container restart otherwise)

## 8. Image Storage

Images are stored locally under `backend/media/uploads/` and `backend/media/avatars/`.

**Limitation:** Local files will NOT survive a container restart or redeployment unless the `backend/media/` directory is mounted as a persistent volume.

**Future S3 migration:** The storage abstraction (`backend/app/storage.py`) uses a `Protocol`-based interface. To migrate to S3, implement `S3ImageStorage.save()` with boto3, set `S3_BUCKET_NAME`/`S3_REGION`, and wire it in. Existing local files are untouched.

## 9. Running Tests

Backend tests require the backend to be running:

```bash
cd backend
$env:NEXORA_TEST_MODE="1"  # bypasses auth rate limiting for tests
.\env\Scripts\python.exe -m pytest tests/ -v
```

Frontend:

```bash
cd frontend
npm run build        # production build + sitemap generation
npm run lint         # ESLint checks
```

## 10. What Is NOT Included

- No Alembic migrations (schema changes via idempotent scripts only)
- No AWS deployment (S3 is configurable but not implemented)
- No email verification, password reset, or OAuth
- No comments, notifications, messaging, or followers
- No frontend test framework (Vitest/Jest) — backend tests cover API behavior

## 11. Support

For deployment issues, check:
- Backend logs (configured via `LOG_LEVEL`)
- Browser console for frontend errors
- `/api/health` for backend uptime
- Database connection via `psql` or your provider's console
