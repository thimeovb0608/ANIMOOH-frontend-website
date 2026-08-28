// Shared page wrapper for server-rendered pages (the blog) — same nav/footer
// as the static HTML pages, so a page built here looks identical to the rest
// of the site. Uses absolute paths ("/style.css" not "style.css") because
// blog articles live one level deeper in the URL (/blog/mijn-artikel).

function renderPage({ title, description, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta name="description" content="${description || ""}" />
  <link rel="stylesheet" href="/style.css" />
</head>
<body>

  <!-- NAV -->
  <nav class="nav-brand">
    <a href="/index.html" class="nav-brand-logo">
      <img src="/Assets/Logo/Animooh Logo transparant.png" alt="ANIMOOH!" />
    </a>
    <button class="nav-toggle" aria-label="Menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
    <ul>
      <li><a href="/products.html">Producten</a></li>
      <li><a href="/no-pee-here.html">No Pee Here</a></li>
      <li><a href="/good-smell.html">Good Smell</a></li>
      <li><a href="/blog">Blog</a></li>
      <li><a href="/about.html">Over ons</a></li>
      <li><a href="/products.html" class="nav-cta">Shop nu</a></li>
    </ul>
  </nav>

  ${bodyHtml}

  <!-- FOOTER -->
  <footer>
    <div class="footer-logo">
      <img src="/Assets/Logo/Animooh Logo transparant.png" alt="ANIMOOH!" />
    </div>
    <nav>
      <ul>
        <li><a href="/index.html">Home</a></li>
        <li><a href="/products.html">Producten</a></li>
        <li><a href="/blog">Blog</a></li>
        <li><a href="/about.html">Over ons</a></li>
      </ul>
    </nav>
    <p class="footer-copy">© 2025 ANIMOOH! — 100% Organic for Pawsome Pets</p>
  </footer>

  <script src="/nav.js"></script>
  <script src="/cart.js"></script>
</body>
</html>`;
}

module.exports = { renderPage };
