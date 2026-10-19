import { useEffect } from "react";

/**
 * Minimal, dependency-free document head helpers.
 * Each helper returns a cleanup function that restores the previous state.
 */

function upsertMeta(attr, key, content) {
  if (!key || content === undefined || content === null || content === "") return null;
  const selector = `meta[${attr}="${key}"]`;
  const existing = document.head.querySelector(selector);
  if (!existing) {
    const el = document.createElement("meta");
    el.setAttribute(attr, key);
    el.setAttribute("content", content);
    el.dataset.seoOwned = "true";
    document.head.appendChild(el);
    return () => el.remove();
  }
  const previous = existing.getAttribute("content");
  existing.setAttribute("content", content);
  return () => existing.setAttribute("content", previous ?? "");
}

function upsertLink(rel, href) {
  if (!rel || !href) return null;
  const selector = `link[rel="${rel}"]`;
  const existing = document.head.querySelector(selector);
  if (!existing) {
    const el = document.createElement("link");
    el.setAttribute("rel", rel);
    el.setAttribute("href", href);
    el.dataset.seoOwned = "true";
    document.head.appendChild(el);
    return () => el.remove();
  }
  const previous = existing.getAttribute("href");
  existing.setAttribute("href", href);
  return () => existing.setAttribute("href", previous ?? "");
}

function setTitle(title) {
  if (!title) return null;
  const previous = document.title;
  document.title = title;
  return () => {
    document.title = previous;
  };
}

function setJsonLd(data) {
  if (!data) return null;
  const selector = 'script[data-seo="jsonld"]';
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("script");
    el.setAttribute("type", "application/ld+json");
    el.dataset.seo = "jsonld";
    el.dataset.seoOwned = "true";
    document.head.appendChild(el);
  }
  // Escape "<" so a "</script>" sequence can never break out of the tag.
  el.textContent = JSON.stringify(data).replace(/</g, "\\u003c");
  return () => el.remove();
}

/**
 * Applies document metadata for the current route.
 *
 * `meta` shape:
 *   { title, description, canonical, robots, og: {}, twitter: {}, jsonLd: {} }
 *
 * Pass `null` to leave the current head untouched.
 */
export default function Seo({ meta }) {
  useEffect(() => {
    if (!meta) return undefined;

    const cleanups = [];

    const titleCleanup = setTitle(meta.title);
    if (titleCleanup) cleanups.push(titleCleanup);

    const descriptionCleanup = upsertMeta("name", "description", meta.description);
    if (descriptionCleanup) cleanups.push(descriptionCleanup);

    const robotsCleanup = upsertMeta("name", "robots", meta.robots);
    if (robotsCleanup) cleanups.push(robotsCleanup);

    const canonicalCleanup = upsertLink("canonical", meta.canonical);
    if (canonicalCleanup) cleanups.push(canonicalCleanup);

    for (const [key, value] of Object.entries(meta.og || {})) {
      const cleanup = upsertMeta("property", key, value);
      if (cleanup) cleanups.push(cleanup);
    }

    for (const [key, value] of Object.entries(meta.twitter || {})) {
      const cleanup = upsertMeta("name", key, value);
      if (cleanup) cleanups.push(cleanup);
    }

    const jsonLdCleanup = setJsonLd(meta.jsonLd);
    if (jsonLdCleanup) cleanups.push(jsonLdCleanup);

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [meta]);

  return null;
}
