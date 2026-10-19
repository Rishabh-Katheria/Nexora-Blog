import { Link } from "react-router-dom";
import { ImageOff, Heart } from "lucide-react";
import { getMediaUrl } from "../lib/media";

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

function getInitials(name) {
  if (!name) return "NT";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function ArticleCard({ article }) {
  const authorName = getAuthorName(article);
  const categoryName = article.category_detail?.name || article.category || "Technology";

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.14] hover:bg-white/[0.04] hover:shadow-xl hover:shadow-black/20">
      {/* Cover Image */}
      {article.cover_image ? (
        <div className="aspect-[16/9] overflow-hidden">
          <img
            src={getMediaUrl(article.cover_image)}
            alt={article.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="flex aspect-[16/9] items-center justify-center border-b border-white/[0.06] bg-gradient-to-br from-zinc-800/50 to-zinc-900/70">
          <div className="flex flex-col items-center gap-2 text-zinc-600">
            <ImageOff className="h-7 w-7" />
            <span className="text-xs font-medium tracking-wide">No cover image</span>
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col p-6">
        {/* Category */}
        <span className="inline-flex w-fit items-center rounded-full bg-violet-500/15 px-3 py-1 text-xs font-medium text-violet-300 ring-1 ring-violet-500/25">
          {categoryName}
        </span>

        {/* Title */}
        <h3 className="mt-3 text-lg font-semibold leading-snug text-white transition-colors group-hover:text-violet-300">
          <Link
            to={`/article/${article.slug}`}
            className="after:absolute after:inset-0 after:content-['']"
          >
            {article.title}
          </Link>
        </h3>

        {/* Excerpt */}
        <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-400 line-clamp-2">
          {article.excerpt}
        </p>

        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {article.tags.slice(0, 3).map((tag) => (
              <span
                key={tag.slug}
                className="rounded-md bg-white/[0.05] px-2 py-0.5 text-xs text-zinc-500"
              >
                #{tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-5 flex items-center gap-3 border-t border-white/[0.06] pt-4">
          <Link
            to={article.author ? `/u/${article.author.username}` : "#"}
            className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 text-xs font-semibold text-white transition-opacity hover:opacity-80"
            aria-label={`View ${authorName}'s profile`}
          >
            {article.author?.avatar ? (
              <img
                src={getMediaUrl(article.author.avatar)}
                alt={authorName}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              getInitials(authorName)
            )}
          </Link>
          <div className="min-w-0">
            <Link
              to={article.author ? `/u/${article.author.username}` : "#"}
              className="relative z-10 block truncate text-sm font-medium text-white transition-colors hover:text-violet-300"
            >
              {authorName}
            </Link>
            <p className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span>
                {formatDate(article.published_at)}
                {article.reading_time != null && ` · ${article.reading_time} min read`}
              </span>
              <span className="inline-flex items-center gap-1 text-zinc-600" title={`${article.like_count || 0} likes`}>
                <Heart className="h-3 w-3" />
                {article.like_count ?? 0}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
