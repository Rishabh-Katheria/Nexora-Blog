"""Idempotent migration: align blog_article.image with the model (VARCHAR(500)).

The model declares String(500) but the live table was created with
VARCHAR(100), so saving a fully-qualified image URL raised
StringDataRightTruncation (HTTP 500). Widening never truncates or rewrites
existing rows. Safe to run any number of times.
"""

from sqlalchemy import text

from app.database import engine

STATEMENTS = [
    "ALTER TABLE blog_article ALTER COLUMN image TYPE VARCHAR(500)",
]

if __name__ == "__main__":
    with engine.begin() as conn:
        for statement in STATEMENTS:
            conn.execute(text(statement))
    print("blog_article.image widened to VARCHAR(500)")
