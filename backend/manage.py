"""
Management commands for Nexora FastAPI backend.
"""
import argparse
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def runserver(host: str = "127.0.0.1", port: int = 8000, reload: bool = True):
    """Start the development server."""
    import uvicorn
    uvicorn.run("app.main:app", host=host, port=port, reload=reload)


def migrate():
    """Create all database tables."""
    from app.database import engine, Base
    from app import models  # Import all models
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully.")


def createsuperuser():
    """Create a superuser account."""
    from app.database import SessionLocal
    from app.models import User
    from app.auth import get_password_hash

    db = SessionLocal()
    try:
        username = input("Username: ")
        email = input("Email: ")
        password = input("Password: ")

        if db.query(User).filter(User.username == username).first():
            print(f"User '{username}' already exists.")
            return

        user = User(
            username=username,
            email=email,
            password=get_password_hash(password),
            is_staff=True,
            is_superuser=True,
        )
        db.add(user)
        db.commit()
        print(f"Superuser '{username}' created successfully.")
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Nexora management commands")
    subparsers = parser.add_subparsers(dest="command")

    # runserver
    run_parser = subparsers.add_parser("runserver", help="Start development server")
    run_parser.add_argument("--host", default="127.0.0.1")
    run_parser.add_argument("--port", type=int, default=8000)
    run_parser.add_argument("--no-reload", action="store_true")

    # migrate
    subparsers.add_parser("migrate", help="Create database tables")

    # createsuperuser
    subparsers.add_parser("createsuperuser", help="Create a superuser")

    args = parser.parse_args()

    if args.command == "runserver":
        runserver(args.host, args.port, not args.no_reload)
    elif args.command == "migrate":
        migrate()
    elif args.command == "createsuperuser":
        createsuperuser()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
