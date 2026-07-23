// Blog engine — turns plain text files in /blog-posts into pages.
// Each file is Markdown with simple "key: value" lines up top, then a lone
// "---" line, then the article itself. Example:
//
//   title: 5 tips tegen kattenurinegeur
//   date: 2026-07-24
//   description: Korte samenvatting voor Google en social previews.
//   ---
//   De rest van het artikel, gewoon in normale tekst met eventueel ## Kopjes.
//
// The filename (without .md) becomes the URL: blog-posts/mijn-artikel.md -> /blog/mijn-artikel

const fs = require("fs");
const path = require("path");

const POSTS_DIR = path.join(__dirname, "..", "blog-posts");

function parsePost(raw) {
  const lines = raw.split("\n");
  const dashIndex = lines.findIndex(l => l.trim() === "---");
  const meta = {};
  let bodyStartLine = 0;

  if (dashIndex !== -1) {
    for (const line of lines.slice(0, dashIndex)) {
      const match = line.match(/^([a-zA-Z]+):\s*(.*)$/);
      if (match) meta[match[1].toLowerCase()] = match[2].trim();
    }
    bodyStartLine = dashIndex + 1;
  }

  return { meta, body: lines.slice(bodyStartLine).join("\n").trim() };
}

function listSlugs() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs.readdirSync(POSTS_DIR)
    .filter(f => f.endsWith(".md"))
    .map(f => f.replace(/\.md$/, ""));
}

function getPost(slug) {
  const safeSlug = String(slug || "").replace(/[^a-zA-Z0-9-_]/g, "");
  const filePath = path.join(POSTS_DIR, `${safeSlug}.md`);
  if (!safeSlug || !fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  const { meta, body } = parsePost(raw);
  return { slug: safeSlug, meta, body };
}

function listPosts() {
  return listSlugs()
    .map(getPost)
    .filter(Boolean)
    .sort((a, b) => (a.meta.date < b.meta.date ? 1 : -1)); // newest first
}

module.exports = { listPosts, getPost };
