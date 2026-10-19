"""Idempotent migration: create the like + bookmark tables (additive only).

Never drops, alters, or resets existing tables/data. Safe to run repeatedly.

Run once from the backend/ directory:
    backend\\env\\Scripts\\python.exe migrate_interactions.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import inspect

from app.database import engine, Base
from app.models import ArticleLike, ArticleBookmark


def main():
    new_tables = [ArticleLike.__table__, ArticleBookmark.__table__]

    inspector = inspect(engine)
    existing = set(inspector.get_table_names())
    missing = [t for t in new_tables if t.name not in existing]

    if missing:
        # create_all only creates tables that don't exist — it never drops/alters
        Base.metadata.create_all(bind=engine, tables=missing)
        print("Created tables:", ", ".join(t.name for t in missing))
    else:
        print("Tables already exist:", ", ".join(t.name for t in new_tables))

    # Verify the unique (user_id, article_id) constraints are in place
    inspector = inspect(engine)
    for table in new_tables:
        constraints = inspector.get_unique_constraints(table.name)
        names = {c["name"] for c in constraints}
        expected = {c.name for c in table.constraints if c.name}
        if expected and not expected.issubset(names):
            print(f"WARNING: {table.name} missing unique constraints: {expected - names}")
        else:
            print(f"Unique constraint OK on {table.name}: {sorted(expected)}")

    print("Migration complete.")


if __name__ == "__main__":
    main()
