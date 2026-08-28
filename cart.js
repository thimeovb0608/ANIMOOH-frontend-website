// Shopping basket — one shared file used by every page.
//
// It injects its own UI (the cart button in the nav + the slide-out drawer), so
// adding a basket to a page only takes <script src="/cart.js"></script>. The
// basket itself lives in localStorage as { productId: quantity }, which means it
// survives page navigation and browser restarts without any backend.
//
// Absolute paths ("/api/products") on purpose: blog articles live one level
// deeper (/blog/artikel), where relative paths would break.

(function () {
  var STORAGE_KEY = "animooh_cart";
  var VAT_RATE = 0.21;
  var MAX_PER_PRODUCT = 10;

  var catalog = null;    // { id: { name, priceEUR, image, buyable } }
  var shippingEUR = "0.00";
  var freeShippingFromEUR = null;

  // ── Price maths ───────────────────────────────────────────────────────────
  // Must stay identical to round2()/buildWebOrderPayload() in lib/adsolut.js:
  // the VAT-exclusive unit price is rounded to 2 decimals BEFORE multiplying by
  // quantity. Adsolut recalculates every order this way and rejects totals that
  // don't match, so the price shown here is the price actually charged.
  function round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  function lineAmounts(priceInclVatEUR, qty) {
    var unitExclVat = round2(Number(priceInclVatEUR) / (1 + VAT_RATE));
    var totalExclVat = round2(qty * unitExclVat);
    return {
      totalExclVat: totalExclVat,
      totalInclVat: round2(totalExclVat * (1 + VAT_RATE))
    };
  }

  function fmt(value) {
    return "€ " + Number(value).toFixed(2).replace(".", ",");
  }

  // ── Basket state ──────────────────────────────────────────────────────────
  function read() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return raw && typeof raw === "object" ? raw : {};
    } catch (e) {
      return {};
    }
  }

  function write(cart) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch (e) { /* private browsing — basket just won't persist */ }
    render();
    announceChange();
  }

  function itemCount() {
    var cart = read();
    var total = 0;
    for (var id in cart) total += cart[id];
    return total;
  }

  // Drops ids that are no longer in the catalog (e.g. a discontinued product
  // still sitting in someone's browser from an earlier visit).
  function lines() {
    if (!catalog) return [];
    var cart = read();
    var out = [];
    for (var id in cart) {
      var product = catalog[id];
      if (!product || !product.buyable) continue;
      var amounts = lineAmounts(product.priceEUR, cart[id]);
      out.push({
        id: id,
        quantity: cart[id],
        name: product.name,
        // Absolute, so blog articles one level deep resolve it correctly too.
        image: "/" + product.image,
        priceEUR: product.priceEUR,
        totalExclVat: amounts.totalExclVat,
        total: amounts.totalInclVat
      });
    }
    return out;
  }

  // VAT is applied to the order's excl-VAT subtotal, NOT summed per line —
  // that's how Adsolut recalculates it (validation step 7), and lib/pricing.js
  // does the same on the server. Summing the per-line incl-VAT amounts instead
  // can land a cent higher on mixed baskets.
  function subtotal() {
    var exclSum = round2(
      lines().reduce(function (sum, l) { return sum + l.totalExclVat; }, 0)
    );
    return round2(exclSum * (1 + VAT_RATE));
  }

  // Mirrors shippingFor() in lib/pricing.js: free from the threshold up.
  function shipping() {
    var rate = round2(Number(shippingEUR || 0));
    var threshold = Number(freeShippingFromEUR);
    if (!threshold || isNaN(threshold)) return rate;
    return subtotal() >= threshold ? 0 : rate;
  }

  // How much more to spend before shipping is free; 0 once it already is.
  function amountToFreeShipping() {
    var threshold = Number(freeShippingFromEUR);
    if (!threshold || isNaN(threshold) || shipping() === 0) return 0;
    return round2(Math.max(0, threshold - subtotal()));
  }

  function add(id, qty) {
    var cart = read();
    var next = (cart[id] || 0) + (qty || 1);
    cart[id] = Math.min(MAX_PER_PRODUCT, next);
    write(cart);
    open();
  }

  function setQty(id, qty) {
    var cart = read();
    if (qty <= 0) delete cart[id];
    else cart[id] = Math.min(MAX_PER_PRODUCT, qty);
    write(cart);
  }

  function clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* nothing to clear */ }
    render();
    announceChange();
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  var drawer, overlay, badge, linesBox, totalBox, shippingBox, shippingRow, nudgeBox, checkoutBtn;

  function buildUI() {
    var nav = document.querySelector(".nav-brand");
    if (nav) {
      var button = document.createElement("button");
      button.className = "nav-cart";
      button.type = "button";
      button.setAttribute("aria-label", "Winkelmandje openen");
      button.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M6 6h15l-1.5 9h-12z" /><circle cx="9" cy="20" r="1.6" />' +
        '<circle cx="18" cy="20" r="1.6" /><path d="M6 6 5 2H2" />' +
        "</svg><span class='nav-cart-badge' hidden>0</span>";
      button.addEventListener("click", open);

      var toggle = nav.querySelector(".nav-toggle");
      if (toggle) nav.insertBefore(button, toggle);
      else nav.appendChild(button);

      badge = button.querySelector(".nav-cart-badge");
    }

    overlay = document.createElement("div");
    overlay.className = "cart-overlay";
    overlay.addEventListener("click", close);

    drawer = document.createElement("aside");
    drawer.className = "cart-drawer";
    drawer.setAttribute("aria-hidden", "true");
    drawer.innerHTML =
      '<div class="cart-head">' +
      "<h2>Winkelmandje</h2>" +
      '<button type="button" class="cart-close" aria-label="Sluiten">&times;</button>' +
      "</div>" +
      '<div class="cart-lines"></div>' +
      '<div class="cart-foot">' +
      '<p class="cart-nudge" hidden></p>' +
      '<div class="cart-shipping-row"><span>Verzending</span><span class="cart-shipping"></span></div>' +
      '<div class="cart-total"><span>Totaal</span><strong>€ 0,00</strong></div>' +
      '<a class="cart-checkout" href="/checkout.html">Afrekenen</a>' +
      "</div>";

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    drawer.querySelector(".cart-close").addEventListener("click", close);
    linesBox = drawer.querySelector(".cart-lines");
    totalBox = drawer.querySelector(".cart-total strong");
    shippingBox = drawer.querySelector(".cart-shipping");
    shippingRow = drawer.querySelector(".cart-shipping-row");
    nudgeBox = drawer.querySelector(".cart-nudge");
    checkoutBtn = drawer.querySelector(".cart-checkout");

    // One listener for every quantity/remove button, so re-rendering the list
    // never leaves dead listeners behind.
    linesBox.addEventListener("click", function (e) {
      var el = e.target.closest("[data-cart-action]");
      if (!el) return;
      var id = el.getAttribute("data-id");
      var cart = read();
      var current = cart[id] || 0;
      if (el.getAttribute("data-cart-action") === "plus") setQty(id, current + 1);
      else if (el.getAttribute("data-cart-action") === "min") setQty(id, current - 1);
      else setQty(id, 0);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });
  }

  function render() {
    if (badge) {
      var count = itemCount();
      badge.textContent = count;
      badge.hidden = count === 0;
    }

    if (!linesBox) return;

    if (!catalog) {
      linesBox.innerHTML = '<p class="cart-empty">Laden…</p>';
      return;
    }

    var rows = lines();

    if (rows.length === 0) {
      linesBox.innerHTML =
        '<p class="cart-empty">Je winkelmandje is nog leeg.<br /><a href="/products.html">Bekijk onze producten →</a></p>';
      totalBox.textContent = fmt(0);
      shippingRow.hidden = true;
      nudgeBox.hidden = true;
      checkoutBtn.classList.add("is-disabled");
      return;
    }

    linesBox.innerHTML = rows
      .map(function (l) {
        return (
          '<div class="cart-line">' +
          '<img src="' + l.image + '" alt="" />' +
          '<div class="cart-line-body">' +
          "<h3>" + l.name + "</h3>" +
          '<div class="cart-qty">' +
          '<button type="button" data-cart-action="min" data-id="' + l.id + '" aria-label="Eén minder">−</button>' +
          "<span>" + l.quantity + "</span>" +
          '<button type="button" data-cart-action="plus" data-id="' + l.id + '" aria-label="Eén meer">+</button>' +
          '<button type="button" class="cart-remove" data-cart-action="remove" data-id="' + l.id + '">Verwijder</button>' +
          "</div>" +
          "</div>" +
          '<div class="cart-line-price">' + fmt(l.total) + "</div>" +
          "</div>"
        );
      })
      .join("");

    var ship = shipping();
    var toFree = amountToFreeShipping();

    shippingRow.hidden = false;
    shippingBox.textContent = ship > 0 ? fmt(ship) : "Gratis";
    shippingBox.classList.toggle("is-free", ship === 0);

    if (toFree > 0) {
      nudgeBox.textContent = "Nog " + fmt(toFree) + " en je verzending is gratis!";
      nudgeBox.hidden = false;
    } else {
      nudgeBox.hidden = true;
    }

    totalBox.textContent = fmt(subtotal() + ship);
    checkoutBtn.classList.remove("is-disabled");
  }

  // Lets a page (the checkout summary) redraw itself when the drawer changes.
  function announceChange() {
    document.dispatchEvent(new Event("animooh-cart-changed"));
  }

  function open() {
    if (!drawer) return;
    drawer.classList.add("is-open");
    overlay.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function close() {
    if (!drawer) return;
    drawer.classList.remove("is-open");
    overlay.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  function init() {
    buildUI();
    render();

    // Any button anywhere on the site can add to the basket by carrying
    // data-add-to-cart="<product-id>".
    document.addEventListener("click", function (e) {
      var el = e.target.closest("[data-add-to-cart]");
      if (!el) return;
      e.preventDefault();
      add(el.getAttribute("data-add-to-cart"), 1);
    });

    fetch("/api/products")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        catalog = data.products;
        shippingEUR = data.shippingEUR;
        freeShippingFromEUR = data.freeShippingFromEUR;
        render();
        document.dispatchEvent(new Event("animooh-cart-ready"));
      })
      .catch(function () {
        if (linesBox) linesBox.innerHTML = '<p class="cart-empty">Producten konden niet geladen worden.</p>';
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Exposed so checkout.html can read the basket and empty it after payment.
  window.ANIMOOH_CART = {
    read: read,
    lines: lines,
    subtotal: subtotal,
    itemCount: itemCount,
    clear: clear,
    open: open,
    fmt: fmt,
    shipping: shipping,
    amountToFreeShipping: amountToFreeShipping,
    ready: function (cb) {
      if (catalog) cb();
      else document.addEventListener("animooh-cart-ready", cb, { once: true });
    }
  };
})();
