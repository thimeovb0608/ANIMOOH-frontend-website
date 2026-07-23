// GET /blog (rewritten from /api/blog-index by vercel.json) — lists every
// post found in /blog-posts, newest first.

const { listPosts } = require("../lib/blog");
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
  const posts = listPosts();

  const cards = posts.map(p => `
    <a href="/blog/${p.slug}" class="blog-card">
      <span class="blog-card-date">${formatDate(p.meta.date)}</span>
      <h3>${escapeHtml(p.meta.title || p.slug)}</h3>
      <p>${escapeHtml(p.meta.description || "")}</p>
      <span class="line-link">Lees meer →</span>
    </a>`).join("");

  const body = `
    <div class="page-hero neutral-bg">
      <span class="section-label">Blog</span>
      <h1 class="section-title">Tips &amp; verhalen voor Pawsome Pets</h1>
      <p class="section-sub" style="margin:0 auto;">Alles over huisdierverzorging, organische producten en het reilen en zeilen bij ANIMOOH!.</p>
    </div>
    <section>
      <div class="blog-grid">
        ${cards || "<p>Binnenkort onze eerste artikelen!</p>"}
      </div>
    </section>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(renderPage({
    title: "Blog — ANIMOOH!",
    description: "Tips, verhalen en nieuws over organische huisdierverzorging van ANIMOOH!.",
    bodyHtml: body
  }));
};
