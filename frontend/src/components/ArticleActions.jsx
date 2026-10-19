import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Bookmark } from "lucide-react";
import { likeArticle, unlikeArticle, bookmarkArticle, unbookmarkArticle } from "../services/articles";
import { useAuth } from "../hooks/useAuth";

/**
 * Article interaction bar — Like + Bookmark.
 *
 * The database is the source of truth: every click calls the API and adopts
 * the server's returned state. The UI updates optimistically but reverts if
 * the request fails. Logged-out users are redirected to /login.
 */
export default function ArticleActions({ article }) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [liked, setLiked] = useState(Boolean(article.liked_by_current_user));
  const [bookmarked, setBookmarked] = useState(Boolean(article.bookmarked_by_current_user));
  const [likeCount, setLikeCount] = useState(Number(article.like_count) || 0);
  const [busy, setBusy] = useState(false); // "like" | "bookmark" | null
  const [error, setError] = useState("");

  const requireAuth = () => {
    if (!isAuthenticated) {
      navigate("/login");
      return false;
    }
    return true;
  };

  const handleLike = async () => {
    if (busy) return;
    if (!requireAuth()) return;

    const prevLiked = liked;
    const prevCount = likeCount;
    // Optimistic update
    setLiked(!prevLiked);
    setLikeCount(prevCount + (prevLiked ? -1 : 1));
    setError("");
    setBusy("like");

    try {
      const state = prevLiked ? await unlikeArticle(article.slug) : await likeArticle(article.slug);
      // Adopt the authoritative database state
      setLiked(state.liked);
      setLikeCount(state.like_count);
      setBookmarked(state.bookmarked);
    } catch (err) {
      // Revert — the backend rejected the action
      setLiked(prevLiked);
      setLikeCount(prevCount);
      setError(err.message || "Couldn't update your like. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const handleBookmark = async () => {
    if (busy) return;
    if (!requireAuth()) return;

    const prev = bookmarked;
    setBookmarked(!prev); // optimistic
    setError("");
    setBusy("bookmark");

    try {
      const state = prev ? await unbookmarkArticle(article.slug) : await bookmarkArticle(article.slug);
      setBookmarked(state.bookmarked);
      setLiked(state.liked);
      setLikeCount(state.like_count);
    } catch (err) {
      setBookmarked(prev); // revert
      setError(err.message || "Couldn't update your bookmark. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-4">
        {/* Like */}
        <button
          onClick={handleLike}
          disabled={busy === "like"}
          aria-pressed={liked}
          aria-label={liked ? "Unlike this article" : "Like this article"}
          className={`btn ${
            liked
              ? "border border-rose-500/40 bg-rose-500/15 text-rose-300 hover:bg-rose-500/20"
              : "border border-white/10 text-zinc-300 hover:bg-white/[0.06] hover:text-white"
          }`}
        >
          <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
          <span>{likeCount}</span>
          <span className="sr-only">{likeCount === 1 ? "like" : "likes"}</span>
        </button>

        {/* "N likes" label */}
        <span className="hidden flex-1 text-center text-sm text-zinc-500 sm:block">
          {likeCount === 0 ? "No likes yet" : `${likeCount} ${likeCount === 1 ? "like" : "likes"}`}
        </span>

        {/* Bookmark */}
        <button
          onClick={handleBookmark}
          disabled={busy === "bookmark"}
          aria-pressed={bookmarked}
          aria-label={bookmarked ? "Remove from reading list" : "Save to reading list"}
          className={`btn ${
            bookmarked
              ? "border border-violet-500/40 bg-violet-500/15 text-violet-300 hover:bg-violet-500/20"
              : "border border-white/10 text-zinc-300 hover:bg-white/[0.06] hover:text-white"
          }`}
        >
          <Bookmark className={`h-4 w-4 ${bookmarked ? "fill-current" : ""}`} />
          {bookmarked ? "Saved" : "Save"}
        </button>
      </div>

      {error && (
        <p className="mt-2 text-center text-xs text-rose-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
