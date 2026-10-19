"""Idempotent migration: add bio + avatar columns to auth_user.

Run once from the backend/ directory:
    backend\\env\\Scripts\\python.exe migrate_profile_fields.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import inspect, text

from app.database import engine


def main():
    inspector = inspect(engine)
    columns = {c["name"] for c in inspector.get_columns("auth_user")}

    with engine.begin() as conn:
        if "bio" not in columns:
            conn.execute(text("ALTER TABLE auth_user ADD COLUMN bio TEXT NOT NULL DEFAULT ''"))
            print("Added column: bio")
        else:
            print("Column already exists: bio")

        if "avatar" not in columns:
            conn.execute(text("ALTER TABLE auth_user ADD COLUMN avatar VARCHAR(500)"))
            print("Added column: avatar")
        else:
            print("Column already exists: avatar")

    print("Migration complete.")


if __name__ == "__main__":
    main()
