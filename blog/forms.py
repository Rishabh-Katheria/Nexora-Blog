from django import forms
from .models import Article


class ArticleForm(forms.ModelForm):

    class Meta:
        model = Article

        fields = [
            'title',
            'category',
            'excerpt',
            'content',
            'image'
        ]

        widgets = {
            'title': forms.TextInput(attrs={
                'class': 'form-control bg-dark text-white border-secondary rounded-3 py-3',
                'placeholder': 'Article title'
            }),

            'category': forms.Select(attrs={
                'class': 'form-select bg-dark text-white border-secondary rounded-3 py-3'
            }),

            'excerpt': forms.Textarea(attrs={
                'class': 'form-control bg-dark text-white border-secondary rounded-3',
                'rows': 3,
                'placeholder': 'Short summary for the homepage'
            }),

            'content': forms.Textarea(attrs={
                'class': 'form-control bg-dark text-white border-secondary rounded-3',
                'rows': 16,
                'placeholder': 'Write your article here...'
            }),

            'image': forms.ClearableFileInput(attrs={
                'class': 'form-control bg-dark text-white border-secondary rounded-3'
            })
        }