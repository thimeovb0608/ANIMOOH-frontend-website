// POST /api/checkout — creates a Mollie payment and returns the hosted checkout URL.
//
// Body (JSON): { productId, quantity, name, email, street, zip, city, country }
// Response:    { checkoutUrl } → the frontend redirects the customer to Mollie.
//
// Requires environment variables on Vercel:
//   MOLLIE_API_KEY  — test_xxx while testing, live_xxx in production
//   SITE_URL        — e.g. https://animooh.vercel.app (no trailing slash)

const { PRODUCTS, SHIPPING_EUR } = require("../lib/catalog");

const MOLLIE_API = "https://api.mollie.com/v2";

function euros(str) {
  return Math.round(parseFloat(str) * 100); // "12.95" -> 1295 cents
}

function centsToStr(cents) {
  return (cents / 100).toFixed(2); // 1295 -> "12.95"
}

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

  const { productId, quantity, name, email, street, zip, city, country } = req.body || {};

  const product = PRODUCTS[productId];
  if (!product) {
    res.status(400).json({ error: "Onbekend product." });
    return;
  }
  if (product.priceEUR === null) {
    res.status(400).json({ error: "Dit product heeft nog geen prijs en kan nog niet gekocht worden." });
    return;
  }

  const qty = Math.max(1, Math.min(10, parseInt(quantity, 10) || 1));

  for (const [field, value] of Object.entries({ name, email, street, zip, city })) {
    if (!value || String(value).trim().length < 2) {
      res.status(400).json({ error: `Vul alle velden in (ontbreekt: ${field}).` });
      return;
    }
  }

  const totalCents = euros(product.priceEUR) * qty + euros(SHIPPING_EUR);

  const createResp = await fetch(`${MOLLIE_API}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount: { currency: "EUR", value: centsToStr(totalCents) },
      description: `ANIMOOH! ${product.name} x${qty}`,
      redirectUrl: `${siteUrl}/bedankt.html`,
      webhookUrl: `${siteUrl}/api/webhook`,
      locale: "nl_BE",
      metadata: {
        productId,
        quantity: qty,
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
