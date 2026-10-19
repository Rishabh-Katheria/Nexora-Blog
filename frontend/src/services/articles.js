import { api } from "../lib/api";

/**
 * Fetch paginated articles from FastAPI.
 * Supports search, category slug, tag slug, ordering, and pagination.
 */
export async function getArticles({ search = "", category = "", tag = "", page = 1, pageSize = 12, ordering = "-published_at" } = {}) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (category) params.set("category", category);
  if (tag) params.set("tag", tag);
  params.set("page", String(page));
  params.set("page_size", String(pageSize));
  params.set("ordering", ordering);

  return api(`/api/articles/?${params.toString()}`);
}

/**
 * Fetch a single article by slug.
 */
export async function getArticle(slug) {
  return api(`/api/articles/${encodeURIComponent(slug)}`);
}

/**
 * Fetch featured articles (real backend data).
 */
export async function getFeaturedArticles() {
  return api("/api/articles/featured/");
}

/**
 * Fetch the latest published articles (real backend data).
 */
export async function getLatestArticles() {
  return api("/api/articles/latest/");
}

/**
 * Like an article (authenticated — JWT identifies the user server-side).
 * Returns { liked, like_count, bookmarked } from the database.
 */
export async function likeArticle(slug) {
  return api(`/api/articles/${encodeURIComponent(slug)}/like`, { method: "POST" });
}

/**
 * Remove the current user's like. Returns { liked, like_count, bookmarked }.
 */
export async function unlikeArticle(slug) {
  return api(`/api/articles/${encodeURIComponent(slug)}/like`, { method: "DELETE" });
}

/**
 * Fetch the current user's like state for an article.
 */
export async function getLikeState(slug) {
  return api(`/api/articles/${encodeURIComponent(slug)}/like`);
}

/**
 * Bookmark an article (adds it to the current user's reading list).
 */
export async function bookmarkArticle(slug) {
  return api(`/api/articles/${encodeURIComponent(slug)}/bookmark`, { method: "POST" });
}

/**
 * Remove the current user's bookmark.
 */
export async function unbookmarkArticle(slug) {
  return api(`/api/articles/${encodeURIComponent(slug)}/bookmark`, { method: "DELETE" });
}

/**
 * Fetch the current user's bookmark state for an article.
 */
export async function getBookmarkState(slug) {
  return api(`/api/articles/${encodeURIComponent(slug)}/bookmark`);
}

/**
 * Fetch all categories with article counts.
 */
export async function getCategories() {
  return api("/api/categories/");
}

/**
 * Create a new article. Sends multipart/form-data so the backend accepts
 * text fields and (optionally) an image file. The JWT is attached
 * automatically by the api() wrapper from localStorage.
 */
export async function createArticle(formData) {
  return api("/api/articles/", {
    method: "POST",
    body: formData,
  });
}

/**
 * Update an existing article (author only, enforced by the backend).
 * Sends JSON via PATCH.
 */
export async function updateArticle(slug, data) {
  return api(`/api/articles/${slug}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/**
 * Fetch the current user's articles, optionally filtered by publication status.
 */
export async function getMyArticles({ isPublished } = {}) {
  const params = new URLSearchParams();
  if (isPublished !== undefined) params.set("is_published", String(isPublished));
  const qs = params.toString();
  return api(`/api/articles/my_articles/${qs ? `?${qs}` : ""}`);
}

/**
 * Fetch the current user's published articles with count.
 * Returns { count, articles }.
 */
export async function getMyPublishedArticles() {
  return api("/api/articles/my_articles/published/");
}

/**
 * Delete an article (author only, enforced by the backend).
 */
export async function deleteArticle(slug) {
  return api(`/api/articles/${slug}`, {
    method: "DELETE",
  });
}

/**
 * Convert a plain fields object into FormData for the POST endpoint.
 * Maps `image` -> `image_url` to match the backend form field name.
 */
function toFormData(obj) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null || value === "") continue;
    fd.append(key === "image" ? "image_url" : key, String(value));
  }
  return fd;
}

/**
 * Save a draft. Creates the draft on first save (no slug yet), then updates
 * the existing draft on subsequent saves — never creates duplicates.
 */
export async function saveDraft(slug, fields) {
  if (slug) {
    return updateArticle(slug, { ...fields, is_published: false });
  }
  return createArticle(toFormData({ ...fields, is_published: "false" }));
}

/**
 * Publish an article. Creates on first publish (no slug yet), otherwise
 * updates the existing article and marks it published.
 */
export async function publishArticle(slug, fields) {
  if (slug) {
    return updateArticle(slug, { ...fields, is_published: true });
  }
  return createArticle(toFormData({ ...fields, is_published: "true" }));
}

/**
 * Upload an image file (cover or inline). Returns { url: "/media/uploads/..." }.
 * The JWT is attached automatically by the api() wrapper.
 */
export async function uploadImage(file) {
  const formData = new FormData();
  formData.append("image", file);
  return api("/api/uploads/image/", {
    method: "POST",
    body: formData,
  });
}
