// GET /blog/:slug (rewritten from /api/blog-post?slug=... by vercel.json) —
// renders one article, converting its Markdown body to HTML.

const { marked } = require("marked");
const { getPost } = require("../lib/blog");
const { renderPage } = require("../lib/layout");

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr || "";
  return d.toLocaleDateString("nl-BE", { day: "numeric", month: "long", year: "numeric" });
}

module.exports = async (req, res) => {
  const post = getPost(req.query.slug);
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  if (!post) {
    res.status(404).send(renderPage({
      title: "Artikel niet gevonden — ANIMOOH!",
      description: "Dit artikel bestaat niet (meer).",
      bodyHtml: `
        <section style="padding-top:140px;text-align:center;">
          <h1 class="section-title">Artikel niet gevonden</h1>
          <p class="section-sub" style="margin:0 auto;">Dit artikel bestaat niet of is verwijderd.</p>
          <a href="/blog" class="btn-primary">Naar de blog →</a>
        </section>`
    }));
    return;
  }

  const contentHtml = marked.parse(post.body);

  const body = `
    <section style="padding-top:140px;max-width:760px;margin:0 auto;">
      <a href="/blog" class="section-label" style="text-decoration:none;">← Terug naar blog</a>
      <div class="blog-post-meta">${formatDate(post.meta.date)}</div>
      <h1 class="section-title">${escapeHtml(post.meta.title || post.slug)}</h1>
      <div class="blog-post-content">${contentHtml}</div>
    </section>`;

  res.status(200).send(renderPage({
    title: `${post.meta.title || post.slug} — ANIMOOH! Blog`,
    description: post.meta.description || "",
    bodyHtml: body
  }));
};
