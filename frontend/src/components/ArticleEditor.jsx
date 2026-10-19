import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Bold,
  Italic,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Code,
  Image as ImageIcon,
  Send,
  Plus,
  RefreshCw,
  X,
  Link2,
} from "lucide-react";
import { publishArticle, getCategories, uploadImage } from "../services/articles";
import { useAuth } from "../hooks/useAuth";
import { getMediaUrl } from "../lib/media";
import { ALLOWED_CATEGORIES } from "../lib/categories";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/* ─── Toolbar ──────────────────────────────────────────────────────────── */

function ToolbarButton({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function EditorBox({ label, htmlFor, children }) {
  return (
    <div className="mb-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 transition-colors focus-within:border-white/[0.16]">
      {label && (
        <label
          htmlFor={htmlFor}
          className="mb-3 block text-xs font-semibold uppercase tracking-wider text-zinc-500"
        >
          {label}
        </label>
      )}
      {children}
    </div>
  );
}

/* ─── Editor ────────────────────────────────────────────────────────────── */

export default function ArticleEditor({ slug: initialSlug = null, initialData = null }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState(initialData?.title || "");
  const [excerpt, setExcerpt] = useState(initialData?.excerpt || "");
  const [content, setContent] = useState(initialData?.content || "");
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState(
    initialData?.category_model_id ? String(initialData.category_model_id) : ""
  );
  const [coverImageUrl, setCoverImageUrl] = useState(initialData?.image || initialData?.cover_image || "");
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const contentRef = useRef(null);
  const slugRef = useRef(initialSlug || null);
  // Baseline for the unsaved-changes warning — for a new article this is the
  // empty form, so navigating away without typing anything does not warn.
  const lastSavedRef = useRef({
    title: initialData?.title || "",
    excerpt: initialData?.excerpt || "",
    content: initialData?.content || "",
    categoryId: initialData?.category_model_id ? String(initialData.category_model_id) : "",
    coverImageUrl: initialData?.image || initialData?.cover_image || "",
  });

  // Redirect unauthenticated users (wait for the session restore to finish)
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Load categories, keeping only the five allowed ones
  useEffect(() => {
    getCategories()
      .then((cats) => {
        const allowed = ALLOWED_CATEGORIES.map((a) => {
          const found = cats.find((c) => c.slug === a.slug);
          return found ? { id: found.id, slug: a.slug, name: a.name } : null;
        }).filter(Boolean);
        setCategories(allowed);
        if (!initialData && allowed.length > 0) {
          setCategoryId((prev) => prev || String(allowed[0].id));
        }
      })
      .catch(() => {});
  }, [initialData]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const buildFields = useCallback(() => {
    const selectedCategory = categories.find((c) => String(c.id) === String(categoryId));
    return {
      title: title.trim(),
      excerpt: excerpt.trim() || content.trim().slice(0, 200),
      content: content,
      category: selectedCategory ? selectedCategory.slug : "",
      category_model_id: selectedCategory ? selectedCategory.id : undefined,
      image: coverImageUrl.trim(),
    };
  }, [title, excerpt, content, categoryId, coverImageUrl, categories]);

  const fieldsChanged = useCallback(() => {
    const s = lastSavedRef.current;
    return (
      title !== s.title ||
      excerpt !== s.excerpt ||
      content !== s.content ||
      categoryId !== s.categoryId ||
      coverImageUrl !== s.coverImageUrl
    );
  }, [title, excerpt, content, categoryId, coverImageUrl]);

  /* ─── Warn before leaving with unsaved changes ─── */
  useEffect(() => {
    const handler = (e) => {
      if (fieldsChanged()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [fieldsChanged]);

  /* ─── Image upload (cover + inline) ─── */

  const validateImageFile = (file) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return "Only JPG, PNG, or WEBP images are allowed.";
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return "Image is too large. Maximum size is 5 MB.";
    }
    return null;
  };

  const openImagePicker = (onPicked) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (file) onPicked(file);
      input.value = "";
    };
    input.click();
  };

  const handleCoverSelect = async (file) => {
    const err = validateImageFile(file);
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setUploadingImage(true);
    try {
      const res = await uploadImage(file);
      setCoverImageUrl(res.url);
      setToast("Cover image uploaded");
    } catch (e) {
      setError(e.message || "Failed to upload image.");
    } finally {
      setUploadingImage(false);
    }
  };

  /* ─── Markdown formatting ─── */

  const insertAtCursor = (snippet, placeholder = "") => {
    const ta = contentRef.current;
    if (!ta) return;
    const { selectionStart: start, selectionEnd: end, value } = ta;
    const selected = value.substring(start, end) || placeholder;
    const next = value.substring(0, start) + snippet(selected) + value.substring(end);
    setContent(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + snippet(selected).length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const applyInline = (before, after, placeholder) => {
    insertAtCursor((sel) => before + sel + after, placeholder);
  };

  const applyLinePrefix = (prefix) => {
    const ta = contentRef.current;
    if (!ta) return;
    const { selectionStart: start, selectionEnd: end, value } = ta;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEndIdx = value.indexOf("\n", end);
    const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
    const block = value.substring(lineStart, lineEnd);
    const lines = block.split("\n");
    const nextBlock = lines
      .map((l) => (l.startsWith(prefix) ? l.slice(prefix.length) : prefix + l))
      .join("\n");
    const next = value.substring(0, lineStart) + nextBlock + value.substring(lineEnd);
    setContent(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(lineStart, lineStart + nextBlock.length);
    });
  };

  const applyCodeBlock = () => {
    insertAtCursor((sel) => `\n\`\`\`\n${sel}\n\`\`\`\n`, "code here");
  };

  const handleInlineSelect = async (file) => {
    const err = validateImageFile(file);
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setUploadingImage(true);
    try {
      const res = await uploadImage(file);
      insertAtCursor((sel) => `![${sel || "image"}](${res.url})`, "");
    } catch (e) {
      setError(e.message || "Failed to upload image.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleKeyDown = (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const key = e.key.toLowerCase();
    if (key === "b") {
      e.preventDefault();
      applyInline("**", "**", "bold text");
    } else if (key === "i") {
      e.preventDefault();
      applyInline("*", "*", "italic text");
    } else if (key === "k") {
      e.preventDefault();
      applyInline("[", "](https://)", "link text");
    }
  };

  /* ─── Publish ─── */

  const handlePublish = async () => {
    if (!title.trim()) {
      setError("Please enter a title.");
      return;
    }
    if (!content.trim()) {
      setError("Please write some content before publishing.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const article = await publishArticle(slugRef.current, buildFields());
      navigate(`/article/${article.slug}`);
    } catch (err) {
      if (err.message && err.message.includes("own articles")) {
        setError("You don't have permission to edit this article.");
      } else {
        setError(err.message || "Failed to publish.");
      }
    } finally {
      setSaving(false);
    }
  };

  /* ─── Render ─── */

  return (
    <div className="min-h-screen bg-[#09090B]">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#09090B]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600">
              <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-tight text-white">Nexora</span>
          </Link>
          <button
            type="button"
            onClick={handlePublish}
            disabled={saving}
            className="btn-primary btn-sm"
          >
            <Send className="h-3.5 w-3.5" />
            {saving ? "Publishing..." : "Publish"}
          </button>
        </div>
      </header>

      {/* Writing area */}
      <main className="mx-auto max-w-[960px] px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="mb-8 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Write your story
        </h1>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400" role="alert">
            {error}
          </div>
        )}

        {toast && (
          <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400">
            {toast}
          </div>
        )}

        {/* ── 1. STORY TITLE BOX ── */}
        <EditorBox label="Story Title" htmlFor="story-title">
          <input
            id="story-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Your story title..."
            className="w-full bg-transparent text-3xl font-bold tracking-tight text-white placeholder-zinc-600 focus:outline-none sm:text-4xl"
          />
        </EditorBox>

        {/* ── 2. SHORT STORY BOX ── */}
        <EditorBox label="Short Story" htmlFor="short-story">
          <textarea
            id="short-story"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="Add a short description of your story..."
            rows={3}
            className="w-full resize-none bg-transparent text-base leading-relaxed text-zinc-300 placeholder-zinc-600 focus:outline-none"
          />
        </EditorBox>

        {/* ── 3. CATEGORY BOX ── */}
        <EditorBox label="Category" htmlFor="category">
          <div className="relative">
            <select
              id="category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={categories.length === 0}
              className="w-full appearance-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 pr-10 text-sm text-white transition-all focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 disabled:opacity-50"
            >
              {categories.length === 0 && <option value="">Loading...</option>}
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id} className="bg-zinc-900">
                  {cat.name}
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </EditorBox>

        {/* ── 4. COVER IMAGE BOX ── */}
        <EditorBox label="Cover Image">
          {coverImageUrl ? (
            <div>
              <div className="overflow-hidden rounded-xl border border-white/[0.08]">
                <img
                  src={getMediaUrl(coverImageUrl)}
                  alt="Cover preview"
                  className="aspect-[16/9] w-full object-cover"
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => openImagePicker(handleCoverSelect)}
                  disabled={uploadingImage}
                  className="btn-secondary btn-sm"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Change image
                </button>
                <button
                  type="button"
                  onClick={() => setCoverImageUrl("")}
                  className="btn-secondary btn-sm"
                >
                  <X className="h-3.5 w-3.5" />
                  Remove image
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openImagePicker(handleCoverSelect)}
              disabled={uploadingImage}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.01] px-6 py-10 text-center transition-all hover:border-white/25 hover:bg-white/[0.03] disabled:opacity-50"
            >
              {uploadingImage ? (
                <RefreshCw className="h-6 w-6 animate-spin text-zinc-500" />
              ) : (
                <Plus className="h-6 w-6 text-zinc-500" />
              )}
              <span className="text-sm font-medium text-zinc-300">
                {uploadingImage ? "Uploading..." : "Add Cover Image"}
              </span>
              <span className="text-xs text-zinc-500">JPG, PNG or WEBP • Max 5 MB</span>
            </button>
          )}

          {/* URL alternative */}
          <div className="mt-4">
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="url"
                value={coverImageUrl.startsWith("http") ? coverImageUrl : ""}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                placeholder="Or paste an image URL"
                className="input py-2.5 pl-9"
              />
            </div>
          </div>
        </EditorBox>

        {/* ── 5. STORY CONTENT BOX ── */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 transition-colors focus-within:border-white/[0.16]">
          <label
            htmlFor="story-content"
            className="mb-3 block text-xs font-semibold uppercase tracking-wider text-zinc-500"
          >
            Story Content
          </label>

          {/* Toolbar */}
          <div className="mb-4 flex items-center gap-0.5 overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.02] p-1.5">
            <ToolbarButton icon={Bold} label="Bold (Ctrl+B)" onClick={() => applyInline("**", "**", "bold text")} />
            <ToolbarButton icon={Italic} label="Italic (Ctrl+I)" onClick={() => applyInline("*", "*", "italic text")} />
            <ToolbarButton icon={Heading2} label="Heading" onClick={() => applyLinePrefix("## ")} />
            <ToolbarButton icon={List} label="Bullet list" onClick={() => applyLinePrefix("- ")} />
            <ToolbarButton icon={ListOrdered} label="Numbered list" onClick={() => applyLinePrefix("1. ")} />
            <ToolbarButton icon={Quote} label="Quote" onClick={() => applyLinePrefix("> ")} />
            <ToolbarButton icon={LinkIcon} label="Link (Ctrl+K)" onClick={() => applyInline("[", "](https://)", "link text")} />
            <ToolbarButton icon={Code} label="Code block" onClick={applyCodeBlock} />
            <ToolbarButton icon={ImageIcon} label="Insert image" onClick={() => openImagePicker(handleInlineSelect)} />
          </div>

          {/* Textarea */}
          <textarea
            id="story-content"
            ref={contentRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Start writing your story..."
            rows={16}
            className="w-full resize-y bg-transparent text-base leading-[1.8] text-zinc-200 placeholder-zinc-600 focus:outline-none"
          />
        </div>
      </main>
    </div>
  );
}
