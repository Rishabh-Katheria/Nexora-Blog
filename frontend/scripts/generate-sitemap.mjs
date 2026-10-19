/**
 * Generates public/sitemap.xml and public/robots.txt from real backend data.
 *
 * Run automatically before every production build (`npm run prebuild`), and
 * manually with `npm run build:sitemap`.
 *
 * - Article URLs come from the published articles in the database (paginated).
 * - Author profile URLs come from the public authors endpoint.
 * - If the backend is unreachable the script still writes a valid sitemap
 *   containing the static public routes, so the build never fails.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, "..");
const publicDir = path.join(frontendRoot, "public");

/** Read VITE_* variables from frontend/.env (npm scripts do not load it). */
function readEnvFile() {
  const envPath = path.join(frontendRoot, ".env");
  const values = {};
  if (!fs.existsSync(envPath)) return values;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    values[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return values;
}

const env = { ...readEnvFile(), ...process.env };
const API_BASE = (env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
// Canonical public URL of the deployed site (no trailing slash). Configurable via
// VITE_SITE_URL — never invent a production domain. Empty means relative URLs only.
const SITE_URL = (env.VITE_SITE_URL || "").replace(/\/+$/, "");

const STATIC_PATHS = ["/", "/explore"];

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

async function fetchPublishedArticles() {
  const articles = [];
  let page = 1;
  const pageSize = 100;

  for (;;) {
    const data = await fetchJson(
      `${API_BASE}/api/articles/?page=${page}&page_size=${pageSize}&ordering=-published_at`,
    );
    const results = Array.isArray(data) ? data : data.results || [];
    articles.push(...results);
    const total = typeof data.count === "number" ? data.count : articles.length;
    if (results.length === 0 || articles.length >= total) break;
    page += 1;
  }

  return articles.filter((article) => article && article.is_published !== false);
}

async function fetchAuthorUsernames() {
  const data = await fetchJson(`${API_BASE}/api/authors/`);
  const list = Array.isArray(data) ? data : data.results || [];
  return list.map((user) => user && user.username).filter(Boolean);
}

function buildSitemap({ articles, authors }) {
  const urls = [];

  for (const route of STATIC_PATHS) {
    const loc = SITE_URL ? `${SITE_URL}${route === "/" ? "" : route}` : route;
    urls.push({ loc });
  }

  for (const article of articles) {
    const loc = `${SITE_URL}/article/${encodeURIComponent(article.slug)}`;
    const lastmod = article.updated_at || article.published_at;
    urls.push({ loc, lastmod: lastmod ? String(lastmod).slice(0, 10) : undefined });
  }

  for (const username of authors) {
    urls.push({ loc: `${SITE_URL}/u/${encodeURIComponent(username)}` });
  }

  const body = urls
    .map(({ loc, lastmod }) => {
      const lastmodTag = lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : "";
      return `  <url>\n    <loc>${escapeXml(loc)}</loc>${lastmodTag}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function buildRobots() {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /dashboard",
    "Disallow: /profile",
    "Disallow: /reading-list",
    "Disallow: /create",
    "Disallow: /edit/",
    "Disallow: /login",
    "Disallow: /register",
    "",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    "",
  ].join("\n");
}

function main() {
  if (!SITE_URL) {
    console.warn("[sitemap] VITE_SITE_URL is not set - using relative URLs only");
  }

  fs.mkdirSync(publicDir, { recursive: true });

  const sitemap = buildSitemap({ articles: [], authors: [] });
  const robots = buildRobots();
  fs.writeFileSync(path.join(publicDir, "sitemap.xml"), sitemap, "utf8");
  fs.writeFileSync(path.join(publicDir, "robots.txt"), robots, "utf8");

  Promise.all([fetchPublishedArticles(), fetchAuthorUsernames()])
    .then(([articles, authors]) => {
      fs.writeFileSync(
        path.join(publicDir, "sitemap.xml"),
        buildSitemap({ articles, authors }),
        "utf8",
      );
      console.log(
        `[sitemap] wrote ${articles.length} article(s) and ${authors.length} author(s) from ${SITE_URL}`,
      );
    })
    .catch((error) => {
      console.warn(`[sitemap] backend unavailable (${error.message}); kept static routes only`);
    });
}

main();
