// POST /api/checkout — creates a Mollie payment and returns the hosted checkout URL.
//
// Body (JSON): { items: [{ productId, quantity }], name, email, street, zip, city, country }
// Response:    { checkoutUrl } → the frontend redirects the customer to Mollie.
//
// The amount charged is calculated by lib/pricing.js, the same module the ERP
// integration uses, so Mollie and Adsolut always agree to the cent.
//
// Requires environment variables on Vercel:
//   MOLLIE_API_KEY  — test_xxx while testing, live_xxx in production
//   SITE_URL        — e.g. https://animooh.vercel.app (no trailing slash)

const { PRODUCTS, SHIPPING_EUR } = require("../lib/catalog");
const { orderTotals } = require("../lib/pricing");

const MOLLIE_API = "https://api.mollie.com/v2";
const MAX_PER_PRODUCT = 10;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.MOLLIE_API_KEY;
  const siteUrl = process.env.SITE_URL;
  if (!apiKey || !siteUrl) {
    res.status(500).json({ error: "Betalingen zijn nog niet geconfigureerd (MOLLIE_API_KEY / SITE_URL ontbreekt)." });
    return;
  }

  const { items, name, email, street, zip, city, country } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Je winkelmandje is leeg." });
    return;
  }

  // Rebuild every line from our own catalog — the browser only gets to choose
  // WHICH product and HOW MANY, never the price.
  const lines = [];
  for (const item of items) {
    const product = PRODUCTS[item && item.productId];
    if (!product) {
      res.status(400).json({ error: "Onbekend product in je winkelmandje." });
      return;
    }
    if (product.priceEUR === null) {
      res.status(400).json({ error: `${product.name} kan nog niet gekocht worden.` });
      return;
    }

    const quantity = Math.max(1, Math.min(MAX_PER_PRODUCT, parseInt(item.quantity, 10) || 1));
    lines.push({ productId: item.productId, name: product.name, priceInclVatEUR: product.priceEUR, quantity });
  }

  for (const [field, value] of Object.entries({ name, email, street, zip, city })) {
    if (!value || String(value).trim().length < 2) {
      res.status(400).json({ error: `Vul alle velden in (ontbreekt: ${field}).` });
      return;
    }
  }

  const totals = orderTotals(lines, SHIPPING_EUR);

  const description =
    lines.length === 1
      ? `ANIMOOH! ${lines[0].name} x${lines[0].quantity}`
      : `ANIMOOH! bestelling (${lines.length} producten)`;

  const createResp = await fetch(`${MOLLIE_API}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount: { currency: "EUR", value: totals.grandTotalInclVat.toFixed(2) },
      description,
      redirectUrl: `${siteUrl}/bedankt.html`,
      webhookUrl: `${siteUrl}/api/webhook`,
      locale: "nl_BE",
      metadata: {
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        customer: { name, email, street, zip, city, country: country || "BE" }
      }
    })
  });

  if (!createResp.ok) {
    const err = await createResp.text();
    console.error("Mollie create failed:", err);
    res.status(502).json({ error: "Betaling aanmaken is mislukt. Probeer het opnieuw." });
    return;
  }

  const payment = await createResp.json();

  // Add the payment id to the return URL so the thank-you page can show the status.
  await fetch(`${MOLLIE_API}/payments/${payment.id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ redirectUrl: `${siteUrl}/bedankt.html?pid=${payment.id}` })
  }).catch(() => { /* thank-you page then shows a generic message — not fatal */ });

  res.status(200).json({ checkoutUrl: payment._links.checkout.href });
};
