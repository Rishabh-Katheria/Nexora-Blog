import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Pencil, ImageOff, Calendar, Clock, Eye } from "lucide-react";
import { getArticle } from "../services/articles";
import { useAuth } from "../hooks/useAuth";
import { getMediaUrl } from "../lib/media";
import ArticleActions from "../components/ArticleActions";
import Seo from "../components/Seo";
import { articleMeta, privateMeta } from "../lib/seo";

function formatDate(dateString) {
  if (!dateString) return "";
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
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

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function isSafeUrl(url) {
  return /^(https?:\/\/|\/media\/)/i.test(url);
}

/** Render inline markdown: ![alt](url), [text](url), **bold**, *italic*, `code`. */
function renderInline(text) {
  const escaped = escapeHtml(text);
  const parts = [];
  const imageRe = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
  const linkRe = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  const boldRe = /\*\*([^*]+)\*\*/g;
  const italicRe = /\*([^*]+)\*/g;
  const codeRe = /`([^`]+)`/g;

  let lastIndex = 0;
  let match;
  const imageMatches = [];
  while ((match = imageRe.exec(escaped)) !== null) {
    imageMatches.push({ index: match.index, length: match[0].length, alt: match[1], url: match[2] });
  }

  if (imageMatches.length === 0) {
    let result = escaped;
    result = result.replace(codeRe, "<code>$1</code>");
    result = result.replace(boldRe, "<strong>$1</strong>");
    result = result.replace(italicRe, "<em>$1</em>");
    result = result.replace(linkRe, (m, t, u) =>
      isSafeUrl(u) ? `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>` : t
    );
    return result;
  }

  let cursor = 0;
  const segments = [];
  for (const img of imageMatches) {
    if (img.index > cursor) {
      segments.push({ type: "text", value: escaped.slice(cursor, img.index) });
    }
    segments.push({ type: "image", alt: img.alt, url: img.url });
    cursor = img.index + img.length;
  }
  if (cursor < escaped.length) {
    segments.push({ type: "text", value: escaped.slice(cursor) });
  }

  for (const seg of segments) {
    if (seg.type === "image") {
      if (isSafeUrl(seg.url)) {
        parts.push(
          `<figure><img src="${getMediaUrl(seg.url)}" alt="${seg.alt}" loading="lazy" /></figure>`
        );
      }
    } else {
      let result = seg.value;
      result = result.replace(codeRe, "<code>$1</code>");
      result = result.replace(boldRe, "<strong>$1</strong>");
      result = result.replace(italicRe, "<em>$1</em>");
      result = result.replace(linkRe, (m, t, u) =>
        isSafeUrl(u) ? `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>` : t
      );
      parts.push(result);
    }
  }
  return parts.join("");
}

/** Detect title-case headings like "Why Is Data Science Important?" */
function isTitleCase(text) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  return words.every((w) => /^[A-Z]/.test(w));
}

/**
 * Parse plain-text article content (CRLF or LF) into structured blocks.
 * Detects: lead paragraph, lead-ins, callouts, H2/H3 headings, bullet lists.
 */
function parseContent(content) {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalized
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  return blocks.map((block) => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const single = lines.length === 1 ? lines[0] : null;

    // Numbered section heading: "1. Collecting Data"
    if (single && /^\d+\.\s+\S/.test(single)) {
      const match = single.match(/^(\d+\.)\s+(.*)$/);
      return { type: "h3", number: match[1], text: match[2] };
    }

    // Callout: contains arrows (e.g. "Data → Analysis → Insights → Decisions")
    if (single && /→|->|⟶/.test(single)) {
      return { type: "callout", text: single };
    }

    // Lead-in: ends with a colon (e.g. "Data can come from:")
    if (single && /:\s*$/.test(single)) {
      return { type: "leadin", text: single };
    }

    // H2 heading: title case, short, no ending period
    if (single && isTitleCase(single) && single.length < 60 && !single.endsWith(".")) {
      return { type: "h2", text: single };
    }

    // Multi-line block where all lines are short items → bullet list
    if (lines.length > 1 && lines.every((l) => l.length < 60 && !l.endsWith("."))) {
      return { type: "list", items: lines };
    }

    // Default: paragraph (join wrapped lines with a space)
    return { type: "paragraph", text: lines.join(" ") };
  });
}

function renderArticleBody(content) {
  const blocks = parseContent(content);
  return blocks.map((block, i) => {
    switch (block.type) {
      case "h2":
        return (
          <h2 key={i}>{block.text}</h2>
        );
      case "h3":
        return (
          <h3 key={i}>
            <span className="section-number">{block.number}</span>
            {block.text}
          </h3>
        );
      case "callout":
        return (
          <div key={i} className="callout">
            {block.text}
          </div>
        );
      case "leadin":
        return (
          <p key={i} className="lead-in" dangerouslySetInnerHTML={{ __html: renderInline(block.text) }} />
        );
      case "list":
        return (
          <ul key={i}>
            {block.items.map((item, j) => (
              <li key={j} dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
            ))}
          </ul>
        );
      default: {
        const isLead = i === 0;
        return (
          <p
            key={i}
            className={isLead ? "lead-paragraph" : undefined}
            dangerouslySetInnerHTML={{ __html: renderInline(block.text) }}
          />
        );
      }
    }
  });
}

export default function Article() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError("");
    setArticle(null);

    getArticle(slug)
      .then(setArticle)
      .catch((err) => {
        setError(err.message || "Failed to load article.");
      })
      .finally(() => setLoading(false));
  }, [slug, reloadKey]);

  // Loading state
  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Seo meta={privateMeta("Loading")} />
        <div className="animate-pulse">
          <div className="h-5 w-28 rounded-full bg-white/[0.06]" />
          <div className="mt-6 h-10 w-full rounded bg-white/[0.06]" />
          <div className="mt-3 h-10 w-2/3 rounded bg-white/[0.06]" />
          <div className="mt-8 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-4 rounded bg-white/[0.04]" style={{ width: `${90 - i * 5}%` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Seo meta={privateMeta("Article not found")} />
        <div className="card p-8 text-center">
          <p className="text-lg font-medium text-red-400">{error}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button onClick={() => setReloadKey((k) => k + 1)} className="btn-primary">
              Try Again
            </button>
            <Link to="/explore" className="btn-secondary">
              Back to Explore
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Not found
  if (!article) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Seo meta={privateMeta("Article not found")} />
        <div className="card p-12 text-center">
          <p className="text-lg font-medium text-zinc-300">Article not found</p>
          <p className="mt-2 text-sm text-zinc-500">
            The article you're looking for doesn't exist or has been removed.
          </p>
          <Link to="/explore" className="btn-primary mt-6">
            Back to Explore
          </Link>
        </div>
      </div>
    );
  }

  const authorName = getAuthorName(article);
  const categoryName = article.category_detail?.name || article.category || "Technology";

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Seo meta={articleMeta(article)} />
      {/* Breadcrumb */}
      <nav className="mb-8 flex items-center gap-2 text-sm text-zinc-500" aria-label="Breadcrumb">
        <Link to="/" className="transition-colors hover:text-white">
          Home
        </Link>
        <span>/</span>
        <Link to="/explore" className="transition-colors hover:text-white">
          Explore
        </Link>
        <span>/</span>
        <span className="truncate text-zinc-400">{article.title}</span>
      </nav>

      {/* Article Header */}
      <header className="mb-10">
        <span className="badge">{categoryName}</span>
        <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
          {article.title}
        </h1>
        {article.excerpt && (
          <p className="mt-4 text-lg leading-relaxed text-zinc-400">
            {article.excerpt}
          </p>
        )}

        {/* Author & Meta */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to={article.author ? `/u/${article.author.username}` : "#"}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 text-sm font-semibold text-white transition-opacity hover:opacity-80"
              aria-label={`View ${authorName}'s profile`}
            >
              {article.author?.avatar ? (
                <img
                  src={getMediaUrl(article.author.avatar)}
                  alt={authorName}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                getInitials(authorName)
              )}
            </Link>
            <div>
              <Link
                to={article.author ? `/u/${article.author.username}` : "#"}
                className="text-sm font-medium text-white transition-colors hover:text-violet-300"
              >
                {authorName}
              </Link>
              <p className="text-xs text-zinc-500">
                {article.author && `@${article.author.username}`}
                {article.author?.bio && (
                  <span className="mt-0.5 block max-w-xs truncate text-zinc-600">
                    {article.author.bio}
                  </span>
                )}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(article.published_at)}
                </span>
                {article.reading_time != null && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {article.reading_time} min read
                  </span>
                )}
                {article.views_count != null && (
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {article.views_count.toLocaleString()} views
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Edit action — only for the article's author */}
          {user && article.author && article.author.id === user.id && (
            <Link to={`/edit/${article.slug}`} className="btn-secondary btn-sm shrink-0">
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Link>
          )}
        </div>
      </header>

      {/* Like / Bookmark action bar */}
      <ArticleActions article={article} />

      {/* Cover Image */}
      {article.cover_image ? (
        <div className="mb-10 overflow-hidden rounded-2xl border border-white/[0.08]">
          <img
            src={getMediaUrl(article.cover_image)}
            alt={article.title}
            className="aspect-[16/9] w-full object-cover"
          />
        </div>
      ) : (
        <div className="mb-10 flex aspect-[16/9] items-center justify-center rounded-2xl border border-white/[0.08] bg-gradient-to-br from-zinc-800/40 to-zinc-900/60">
          <div className="flex flex-col items-center gap-3 text-zinc-600">
            <ImageOff className="h-10 w-10" />
            <span className="text-sm font-medium tracking-wide">No cover image</span>
          </div>
        </div>
      )}

      {/* Article Content */}
      <article className="article-content">{renderArticleBody(article.content)}</article>

      {/* Tags */}
      {article.tags && article.tags.length > 0 && (
        <div className="mt-10 flex flex-wrap gap-2 border-t border-white/[0.06] pt-8">
          {article.tags.map((tag) => (
            <span
              key={tag.slug}
              className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-medium text-zinc-400"
            >
              #{tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Back Link */}
      <div className="mt-12 border-t border-white/[0.06] pt-8">
        <Link
          to="/explore"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Explore
        </Link>
      </div>
    </div>
  );
}
