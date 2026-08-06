from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required

from .models import Article
from .forms import ArticleForm


def home(request):

    query = request.GET.get('q')
    category = request.GET.get('category')

    articles = Article.objects.all().order_by('-created_at')

    if query:
        articles = articles.filter(title__icontains=query)

    if category:
        articles = articles.filter(category=category)

    return render(request, 'blog/home.html', {
        'articles': articles,
        'query': query,
        'current_category': category,
    })


def article_detail(request, id):

    article = get_object_or_404(Article, id=id)

    return render(request, 'blog/article_detail.html', {
        'article': article
    })


def register_view(request):

    if request.method == 'POST':

        form = UserCreationForm(request.POST)

        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect('home')

    else:
        form = UserCreationForm()

    return render(request, 'blog/register.html', {'form': form})


def login_view(request):

    if request.method == 'POST':

        username = request.POST.get('username')
        password = request.POST.get('password')

        user = authenticate(
            request,
            username=username,
            password=password
        )

        if user:
            login(request, user)
            return redirect('home')

    return render(request, 'blog/login.html')


def logout_view(request):

    logout(request)
    return redirect('home')


@login_required
def dashboard(request):

    articles = Article.objects.filter(
        author=request.user
    ).order_by('-created_at')

    return render(request, 'blog/dashboard.html', {
        'articles': articles
    })


@login_required
def write_article(request):

    if request.method == 'POST':

        form = ArticleForm(request.POST, request.FILES)

        if form.is_valid():

            article = form.save(commit=False)
            article.author = request.user
            article.save()

            return redirect('article_detail', id=article.id)

    else:
        form = ArticleForm()

    return render(request, 'blog/write.html', {
        'form': form
    })


@login_required
def edit_article(request, id):

    article = get_object_or_404(
        Article,
        id=id,
        author=request.user
    )

    if request.method == 'POST':

        form = ArticleForm(
            request.POST,
            request.FILES,
            instance=article
        )

        if form.is_valid():
            form.save()
            return redirect('dashboard')

    else:
        form = ArticleForm(instance=article)

    return render(request, 'blog/write.html', {
        'form': form
    })


@login_required
def delete_article(request, id):

    article = get_object_or_404(
        Article,
        id=id,
        author=request.user
    )

    if request.method == 'POST':
        article.delete()
        return redirect('dashboard')

    return render(request, 'blog/delete_confirm.html', {
        'article': article
    })