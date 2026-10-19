import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, BookmarkX, BookOpen, X } from "lucide-react";
import { getMyBookmarks } from "../services/users";
import { unbookmarkArticle } from "../services/articles";
import { useAuth } from "../hooks/useAuth";
import { getMediaUrl } from "../lib/media";
import Seo from "../components/Seo";
import { privateMeta } from "../lib/seo";

function formatDate(dateString) {
  if (!dateString) return "";
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

function getAuthorName(article) {
  if (article.author) {
    return article.author.first_name && article.author.last_name
      ? `${article.author.first_name} ${article.author.last_name}`.trim()
      : article.author.username;
  }
  return "Nexora Team";
}

export default function ReadingList() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [articles, setArticles] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removingSlug, setRemovingSlug] = useState(null); // article being removed

  // Redirect unauthenticated users
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Load the current user's bookmarks (JWT-derived server-side)
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    setLoading(true);
    setError("");
    getMyBookmarks()
      .then((res) => {
        setArticles(res.articles || []);
        setCount(res.count || 0);
      })
      .catch((err) => setError(err.message || "Unable to load your reading list."))
      .finally(() => setLoading(false));
  }, [authLoading, isAuthenticated]);

  const handleRemove = async (article) => {
    if (removingSlug) return;
    setRemovingSlug(article.slug);
    setError("");
    try {
      await unbookmarkArticle(article.slug);
      setArticles((prev) => prev.filter((a) => a.slug !== article.slug));
      setCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      setError(err.message || "Failed to remove from your reading list.");
    } finally {
      setRemovingSlug(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-sm text-zinc-500">Loading your reading list...</p>
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-72 rounded-2xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <Seo meta={privateMeta("Reading List")} />
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Your Reading List
        </h1>
        <p className="mt-2 text-zinc-400">Stories you've saved for later.</p>
      </div>

      {error && (
        <div className="mb-6 flex items-start justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          <span>{error}</span>
          <button
            onClick={() => setError("")}
            className="rounded-full p-0.5 transition-colors hover:text-red-300"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {articles.length === 0 ? (
        /* Empty state */
        <div className="card px-6 py-16 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-zinc-600" />
          <p className="mt-4 text-lg font-medium text-white">Your reading list is empty.</p>
          <p className="mt-2 text-sm text-zinc-400">
            Explore stories and save the ones you want to read later.
          </p>
          <Link to="/explore" className="btn-primary mt-6">
            Explore Stories
          </Link>
        </div>
      ) : (
        <>
          {/* Real count from the backend */}
          <p className="mb-5 text-sm text-zinc-500">
            {count} {count === 1 ? "saved article" : "saved articles"}
          </p>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => {
              const categoryName = article.category_detail?.name || article.category || "Technology";
              const removing = removingSlug === article.slug;
              return (
                <div
                  key={article.slug}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] transition-colors hover:border-white/[0.14]"
                >
                  {/* Cover */}
                  <div className="relative aspect-[16/9] overflow-hidden bg-white/[0.03]">
                    {article.cover_image ? (
                      <img
                        src={getMediaUrl(article.cover_image)}
                        alt={article.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
                        <span className="text-xs font-medium uppercase tracking-wider text-zinc-600">
                          No cover image
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="flex flex-1 flex-col p-5">
                    <span className="mb-2 self-start rounded-full bg-violet-500/15 px-2.5 py-0.5 text-[11px] font-medium text-violet-300 ring-1 ring-violet-500/25">
                      {categoryName}
                    </span>
                    <h3 className="text-base font-semibold leading-snug text-white">
                      {article.title}
                    </h3>
                    {article.excerpt && (
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-zinc-400">
                        {article.excerpt}
                      </p>
                    )}
                    <p className="mt-3 text-xs text-zinc-500">
                      {getAuthorName(article)} · {formatDate(article.published_at || article.created_at)}
                      {article.reading_time != null && ` · ${article.reading_time} min read`}
                    </p>

                    {/* Actions */}
                    <div className="mt-auto flex flex-wrap gap-2 pt-4">
                      <Link
                        to={`/article/${article.slug}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Read article
                      </Link>
                      <button
                        onClick={() => handleRemove(article)}
                        disabled={removing}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50"
                      >
                        <BookmarkX className="h-3.5 w-3.5" />
                        {removing ? "Removing..." : "Remove bookmark"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
