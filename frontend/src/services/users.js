import { api } from "../lib/api";

/**
 * Get the authenticated user's own profile.
 */
export async function getMyProfile() {
  return api("/api/users/me/");
}

/**
 * Update the authenticated user's profile.
 * Only first_name, last_name, bio, avatar are editable.
 */
export async function updateMyProfile(data) {
  return api("/api/users/me/", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/**
 * Upload a profile photo for the authenticated user.
 * Returns the updated user object.
 */
export async function uploadMyAvatar(file) {
  const formData = new FormData();
  formData.append("image", file);
  return api("/api/users/me/avatar/", {
    method: "POST",
    body: formData,
  });
}

/**
 * Get a public author profile by username (no auth required).
 * Returns { id, username, first_name, last_name, bio, avatar, article_count, articles }.
 */
export async function getPublicProfile(username) {
  return api(`/api/users/${encodeURIComponent(username)}`);
}

/**
 * Get the authenticated user's reading list (bookmarked articles).
 * Returns { count, articles } — private to the JWT-derived user.
 */
export async function getMyBookmarks() {
  return api("/api/users/me/bookmarks/");
}
