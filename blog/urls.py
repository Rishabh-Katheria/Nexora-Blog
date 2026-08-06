from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),

    path('article/<int:id>/', views.article_detail, name='article_detail'),

    path('register/', views.register_view, name='register'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),

    path('dashboard/', views.dashboard, name='dashboard'),

    path('write/', views.write_article, name='write_article'),
    path('edit/<int:id>/', views.edit_article, name='edit_article'),
    path('delete/<int:id>/', views.delete_article, name='delete_article'),
]