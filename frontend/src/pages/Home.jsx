import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, PenLine, BookOpen } from "lucide-react";
import { getFeaturedArticles, getLatestArticles } from "../services/articles";
import ArticleCard from "../components/ArticleCard";
import Seo from "../components/Seo";
import { homeMeta } from "../lib/seo";

export default function Home() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Real content only: featured articles, falling back to the latest published.
  useEffect(() => {
    setLoading(true);
    setError("");
    getFeaturedArticles()
      .then((featured) => {
        if (featured && featured.length > 0) {
          setArticles(featured);
        } else {
          return getLatestArticles()
            .then((latest) => setArticles(latest || []))
            .catch(() => setArticles([]));
        }
      })
      .catch(() => setError("Unable to load stories. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <Seo meta={homeMeta()} />
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-violet-500/[0.06] via-transparent to-transparent" />
        <div className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-violet-500/[0.07] blur-[120px]" />

        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-20 sm:px-6 sm:pt-28 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-medium tracking-wide text-violet-300">Nexora</p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Ideas worth reading.
              <br />
              <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                Stories worth sharing.
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-zinc-400">
              A publishing platform for writers, researchers, and technologists sharing in-depth
              insights on AI, data science, and the future of technology.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link to="/explore" className="btn-primary">
                <BookOpen className="h-4 w-4" />
                Explore Stories
              </Link>
              <Link to="/create" className="btn-secondary">
                <PenLine className="h-4 w-4" />
                Start Writing
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stories */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Featured Stories
            </h2>
            <p className="mt-2 text-sm text-zinc-500">Handpicked from the Nexora community.</p>
          </div>
          <Link
            to="/explore"
            className="hidden items-center gap-1.5 text-sm font-medium text-violet-300 transition-colors hover:text-violet-200 sm:inline-flex"
          >
            View all
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
                <div className="aspect-[16/9] rounded-xl bg-white/[0.06]" />
                <div className="mt-4 h-5 w-24 rounded-full bg-white/[0.06]" />
                <div className="mt-3 h-6 w-full rounded bg-white/[0.06]" />
                <div className="mt-2 h-6 w-3/4 rounded bg-white/[0.06]" />
                <div className="mt-4 h-4 w-full rounded bg-white/[0.04]" />
                <div className="mt-2 h-4 w-2/3 rounded bg-white/[0.04]" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="card p-12 text-center">
            <p className="text-lg font-medium text-zinc-300">{error}</p>
            <button onClick={() => window.location.reload()} className="btn-secondary mt-6">
              Try Again
            </button>
          </div>
        ) : articles.length === 0 ? (
          <div className="card px-6 py-16 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-zinc-600" />
            <p className="mt-4 text-lg font-medium text-white">No stories published yet.</p>
            <p className="mt-2 text-sm text-zinc-400">
              Be the first to share your ideas with the Nexora community.
            </p>
            <Link to="/create" className="btn-primary mt-6">
              <PenLine className="h-4 w-4" />
              Write the first story
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.slug} article={article} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
