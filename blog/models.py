from django.db import models
from django.contrib.auth.models import User


class Article(models.Model):

    CATEGORY_CHOICES = [
        ('AI', 'Generative AI'),
        ('ML', 'Machine Learning'),
        ('DL', 'Deep Learning'),
        ('PY', 'Python'),
        ('DS', 'Data Science'),
    ]

    title = models.CharField(max_length=200)

    category = models.CharField(
        max_length=10,
        choices=CATEGORY_CHOICES,
        default='AI'
    )

    excerpt = models.TextField()

    content = models.TextField()

    image = models.ImageField(
        upload_to='articles/',
        blank=True,
        null=True
    )

    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def reading_time(self):
        words = len(self.content.split())
        return max(1, words // 200)

    def __str__(self):
        return self.title