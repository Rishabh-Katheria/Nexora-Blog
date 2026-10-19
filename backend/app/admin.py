"""
Admin interface for Nexora using SQLAdmin.
Run with: uvicorn app.admin:app --port 8001
"""
from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request
from starlette.responses import RedirectResponse

from app.database import engine
from app.models import User, Article, Category, Tag


class AdminAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        username = form.get("username")
        password = form.get("password")
        # Simple check — in production, verify against database
        if username == "admin" and password == "admin":
            request.session.update({"token": "admin_token"})
            return True
        return False

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        token = request.session.get("token")
        return token == "admin_token"


class UserAdmin(ModelView, model=User):
    column_list = [User.id, User.username, User.email, User.is_active, User.date_joined]
    column_searchable_list = [User.username, User.email]
    column_filters = [User.is_active, User.is_staff, User.date_joined]
    can_create = True
    can_edit = True
    can_delete = True


class ArticleAdmin(ModelView, model=Article):
    column_list = [Article.id, Article.title, Article.author, Article.category, Article.is_published, Article.is_featured, Article.published_at, Article.views_count]
    column_searchable_list = [Article.title, Article.excerpt, Article.content]
    column_filters = [Article.category, Article.is_published, Article.is_featured, Article.created_at]
    can_create = True
    can_edit = True
    can_delete = True


class CategoryAdmin(ModelView, model=Category):
    column_list = [Category.id, Category.name, Category.slug]
    column_searchable_list = [Category.name]
    can_create = True
    can_edit = True
    can_delete = True


class TagAdmin(ModelView, model=Tag):
    column_list = [Tag.id, Tag.name, Tag.slug]
    column_searchable_list = [Tag.name]
    can_create = True
    can_edit = True
    can_delete = True


def create_admin_app():
    from fastapi import FastAPI
    admin_app = FastAPI(title="Nexora Admin")
    authentication_backend = AdminAuth(secret_key="admin_secret_key")
    admin = Admin(admin_app, engine, authentication_backend=authentication_backend)

    admin.add_view(UserAdmin)
    admin.add_view(ArticleAdmin)
    admin.add_view(CategoryAdmin)
    admin.add_view(TagAdmin)

    return admin_app


admin_app = create_admin_app()
