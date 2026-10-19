from fastapi import Query
from typing import Optional


class PaginationParams:
    def __init__(
        self,
        page: int = Query(1, ge=1, description="Page number"),
        page_size: int = Query(12, ge=1, le=100, description="Items per page"),
    ):
        self.page = page
        self.page_size = page_size
        self.offset = (page - 1) * page_size


class ArticleFilterParams:
    def __init__(
        self,
        category: Optional[str] = Query(None, description="Filter by category slug"),
        tag: Optional[str] = Query(None, description="Filter by tag slug"),
        search: Optional[str] = Query(None, description="Search in title, excerpt, content"),
        author: Optional[int] = Query(None, description="Filter by author ID"),
        featured: Optional[bool] = Query(None, description="Filter featured articles"),
        ordering: Optional[str] = Query("-published_at", description="Sort field (prefix with - for desc)"),
    ):
        self.category = category
        self.tag = tag
        self.search = search
        self.author = author
        self.featured = featured
        self.ordering = ordering
