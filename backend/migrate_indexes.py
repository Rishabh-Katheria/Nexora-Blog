"""Idempotent index creation for existing tables (no Alembic in this project).

Adds indexes declared on models that already-existing tables never received
via create_all. Safe to run any number of times.
"""
from sqlalchemy import text

from app.database import engine

INDEXES = [
    "CREATE INDEX IF NOT EXISTS ix_blog_article_author_id ON blog_article (author_id)",
    "CREATE INDEX IF NOT EXISTS ix_blog_article_is_published ON blog_article (is_published)",
    "CREATE INDEX IF NOT EXISTS ix_blog_article_published_at ON blog_article (published_at)",
]

if __name__ == "__main__":
    with engine.begin() as conn:
        for stmt in INDEXES:
            conn.execute(text(stmt))
    print("Indexes ensured:", len(INDEXES))
