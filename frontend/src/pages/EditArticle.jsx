import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getArticle } from "../services/articles";
import { useAuth } from "../hooks/useAuth";
import ArticleEditor from "../components/ArticleEditor";
import Seo from "../components/Seo";
import { privateMeta } from "../lib/seo";

export default function EditArticle() {
  const { slug } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [article, setArticle] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError("");
    getArticle(slug)
      .then(setArticle)
      .catch((err) => setError(err.message || "Article not found."))
      .finally(() => setLoading(false));
  }, [slug]);

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Seo meta={privateMeta("Edit story")} />
        <div className="animate-pulse">
          <div className="h-10 w-2/3 rounded bg-white/[0.06]" />
          <div className="mt-4 h-6 w-1/3 rounded bg-white/[0.06]" />
          <div className="mt-8 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-4 rounded bg-white/[0.04]" style={{ width: `${90 - i * 5}%` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Seo meta={privateMeta("Edit story")} />
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-8 text-center">
          <p className="text-lg font-medium text-red-400">{error}</p>
          <Link
            to="/explore"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-medium text-[#09090B] transition-all hover:bg-zinc-200"
          >
            Back to Explore
          </Link>
        </div>
      </div>
    );
  }

  // Ownership check (backend also enforces via 403 on save)
  if (user && article.author && article.author.id !== user.id) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-8 text-center">
          <p className="text-lg font-medium text-red-400">
            You don't have permission to edit this article.
          </p>
          <Link
            to="/explore"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-medium text-[#09090B] transition-all hover:bg-zinc-200"
          >
            Back to Explore
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Seo meta={privateMeta("Edit story")} />
      <ArticleEditor slug={slug} initialData={article} />
    </>
  );
}
