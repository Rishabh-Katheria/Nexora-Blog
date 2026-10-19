import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { getArticles, getCategories } from "../services/articles";
import ArticleCard from "../components/ArticleCard";
import Seo from "../components/Seo";
import { exploreMeta } from "../lib/seo";
import { ALLOWED_CATEGORIES } from "../lib/categories";

export default function Explore() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Discovery state lives in the URL: /explore?search=...&category=...
  const search = searchParams.get("search") || "";
  const activeCategory = searchParams.get("category") || "";

  // Input value is local; the URL is the source of truth for fetching.
  const [searchInput, setSearchInput] = useState(search);

  const updateParams = useCallback(
    (updates) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(updates)) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  // Load categories on mount — only the five allowed ones are shown
  useEffect(() => {
    getCategories()
      .then((cats) => {
        const allowed = ALLOWED_CATEGORIES.map((a) => {
          const found = cats.find((c) => c.slug === a.slug);
          return found ? { slug: a.slug, name: a.name } : null;
        }).filter(Boolean);
        setCategories(allowed);
      })
      .catch(() => {
        // Categories are non-critical — fail silently
      });
  }, []);

  // Keep the input in sync when the URL changes (back/forward, category click)
  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  // Fetch articles whenever search or category changes
  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getArticles({
        search: search || undefined,
        category: activeCategory || undefined,
      });
      setArticles(data.results || []);
    } catch (err) {
      setError(err.message || "Unable to load articles. Please try again.");
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [search, activeCategory]);

  // Debounce search requests (300ms)
  useEffect(() => {
    const timer = setTimeout(fetchArticles, 300);
    return () => clearTimeout(timer);
  }, [fetchArticles]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchInput(value);
    updateParams({ search: value });
  };

  const handleCategoryChange = (slug) => {
    updateParams({ category: slug });
  };

  const hasActiveFilters = Boolean(search || activeCategory);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <Seo meta={exploreMeta()} />
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Explore
        </h1>
        <p className="mt-3 text-lg text-zinc-400">
          Discover ideas in:{" "}
          <span className="text-zinc-200">
            Generative AI · Machine Learning · Deep Learning · Python · Data Science
          </span>
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={handleSearchChange}
            placeholder="Search articles by title, topic, or keyword..."
            aria-label="Search articles"
            className="input py-3.5 pl-12"
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className="mb-8 flex flex-wrap gap-2">
        <button
          onClick={() => handleCategoryChange("")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
            activeCategory === ""
              ? "bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40"
              : "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1] hover:text-white"
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.slug}
            onClick={() => handleCategoryChange(cat.slug)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
              activeCategory === cat.slug
                ? "bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40"
                : "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1] hover:text-white"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6"
            >
              <div className="h-5 w-24 rounded-full bg-white/[0.06]" />
              <div className="mt-4 h-6 w-full rounded bg-white/[0.06]" />
              <div className="mt-2 h-6 w-3/4 rounded bg-white/[0.06]" />
              <div className="mt-4 h-4 w-full rounded bg-white/[0.04]" />
              <div className="mt-2 h-4 w-2/3 rounded bg-white/[0.04]" />
              <div className="mt-6 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-white/[0.06]" />
                <div className="space-y-2">
                  <div className="h-3 w-24 rounded bg-white/[0.06]" />
                  <div className="h-3 w-16 rounded bg-white/[0.04]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-8 text-center">
          <p className="text-red-400">{error}</p>
          <button
            onClick={fetchArticles}
            className="mt-4 rounded-full bg-white/10 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-white/15"
          >
            Try Again
          </button>
        </div>
      ) : articles.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-zinc-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
            />
          </svg>
          <p className="mt-4 text-lg font-medium text-zinc-300">
            {hasActiveFilters ? "No articles found" : "No articles published yet."}
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            {hasActiveFilters
              ? "Try another search or category."
              : "Check back soon for new content."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      )}
    </div>
  );
}
