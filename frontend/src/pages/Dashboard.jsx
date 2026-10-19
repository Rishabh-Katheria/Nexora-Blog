import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { PenLine, Eye, Pencil, Trash2, X, AlertTriangle, Bookmark } from "lucide-react";import { getMyPublishedArticles, deleteArticle } from "../services/articles";
import { getMyBookmarks } from "../services/users";
import { useAuth } from "../hooks/useAuth";
import { getMediaUrl } from "../lib/media";
import Avatar from "../components/Avatar";
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

export default function Dashboard() {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const navigate = useNavigate();

  const [articles, setArticles] = useState([]);
  const [count, setCount] = useState(0);
  const [savedCount, setSavedCount] = useState(null); // null until the backend responds
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null); // article being confirmed
  const [deleting, setDeleting] = useState(false);

  // Redirect unauthenticated users
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Load published articles
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    loadArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated]);

  const loadArticles = () => {
    setLoading(true);
    setError("");
    getMyPublishedArticles()
      .then((res) => {
        setArticles(res.articles || []);
        setCount(res.count || 0);
      })
      .catch((err) => setError(err.message || "Unable to load your articles."))
      .finally(() => setLoading(false));

    // Saved (bookmarked) count — real backend number, non-critical
    getMyBookmarks()
      .then((res) => setSavedCount(res.count || 0))
      .catch(() => setSavedCount(null)); // leave as "—" rather than inventing a number
  };

  // Auto-dismiss success message
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(""), 3000);
    return () => clearTimeout(t);
  }, [success]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteArticle(pendingDelete.slug);
      setArticles((prev) => prev.filter((a) => a.slug !== pendingDelete.slug));
      setCount((prev) => Math.max(0, prev - 1));
      setSuccess(`"${pendingDelete.title}" deleted.`);
      setPendingDelete(null);
    } catch (err) {
      setError(err.message || "Failed to delete article.");
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  // Display name
  const displayName = user?.first_name
    ? `${user.first_name}${user.last_name ? " " + user.last_name : ""}`.trim()
    : user?.username || "there";

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-sm text-zinc-500">Loading your articles...</p>
        <div className="mt-8 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <Seo meta={privateMeta("Dashboard")} />
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar user={user} size="lg" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Welcome back, {displayName}
            </h1>
            <p className="mt-2 text-zinc-400">
              Manage your published stories and profile activity.
            </p>
          </div>
        </div>
        <Link
          to="/profile"
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/[0.06] self-start sm:self-auto"
        >
          <Eye className="h-4 w-4" />
          View Profile
        </Link>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400">
          {success}
        </div>
      )}

      {/* Stats */}
      <div className="mb-10 flex flex-wrap items-stretch gap-4">
        <div className="inline-flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.02] px-8 py-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Published Articles
          </span>
          <span className="mt-2 text-5xl font-bold tracking-tight text-white">
            {count}
          </span>
          <span className="mt-2 text-sm text-zinc-500">
            Total published stories
          </span>
        </div>

        <div className="inline-flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.02] px-8 py-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Saved Articles
          </span>
          <span className="mt-2 text-5xl font-bold tracking-tight text-white">
            {savedCount === null ? "—" : savedCount}
          </span>
          <span className="mt-2 text-sm text-zinc-500">
            Stories saved for later
          </span>
        </div>

        <Link
          to="/reading-list"
          className="inline-flex items-center gap-2 self-center rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/[0.06]"
        >
          <Bookmark className="h-4 w-4" />
          Reading List
        </Link>
      </div>

      {/* Articles */}
      <h2 className="mb-5 text-lg font-semibold tracking-tight text-white">
        My Published Articles
      </h2>

      {articles.length === 0 ? (
        <div className="card px-6 py-16 text-center">
          <PenLine className="mx-auto h-10 w-10 text-zinc-600" />
          <p className="mt-4 text-lg font-medium text-white">No stories published yet.</p>
          <p className="mt-2 text-sm text-zinc-400">
            Start sharing your ideas with the Nexora community.
          </p>
          <Link to="/create" className="btn-primary mt-6">
            <PenLine className="h-4 w-4" />
            Write your first story
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
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
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
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
                {article.category && (
                  <span className="mb-2 self-start rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-medium text-zinc-300">
                    {article.category_name || article.category}
                  </span>
                )}
                <h3 className="text-base font-semibold leading-snug text-white">
                  {article.title}
                </h3>
                {article.excerpt && (
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-zinc-400">
                    {article.excerpt}
                  </p>
                )}
                <p className="mt-3 text-xs text-zinc-500">
                  Published {formatDate(article.published_at || article.created_at)}
                </p>

                {/* Actions */}
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <Link
                    to={`/article/${article.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </Link>
                  <Link
                    to={`/edit/${article.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Link>
                  <button
                    onClick={() => setPendingDelete(article)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="animate-fade-in absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !deleting && setPendingDelete(null)}
          />
          <div className="animate-fade-up relative w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#111113] p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/15">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <button
                onClick={() => !deleting && setPendingDelete(null)}
                className="rounded-full p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <h3 className="mt-4 text-lg font-semibold text-white">Delete article?</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Are you sure you want to permanently delete:
            </p>
            <p className="mt-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm font-medium text-white">
              "{pendingDelete.title}"
            </p>
            <p className="mt-2 text-sm text-zinc-500">This action cannot be undone.</p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
                className="rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-white/[0.06] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="rounded-full bg-red-500 px-5 py-2 text-sm font-medium text-white transition-all hover:bg-red-600 active:scale-[0.98] disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
