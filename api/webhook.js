// POST /api/webhook — Mollie calls this when a payment changes status.
// We fetch the payment (never trust the request body alone) and act on it.
//
// v1: paid orders are visible in your Mollie dashboard (with customer address in
// the metadata). Fase 2: push paid orders into Adsolut as verkooporder/factuur.

const MOLLIE_API = "https://api.mollie.com/v2";

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const id = (req.body && req.body.id) || null;
  if (!id) {
    res.status(400).end();
    return;
  }

  const resp = await fetch(`${MOLLIE_API}/payments/${id}`, {
    headers: { Authorization: `Bearer ${process.env.MOLLIE_API_KEY}` }
  });

  if (!resp.ok) {
    res.status(502).end();
    return;
  }

  const payment = await resp.json();
  console.log(`Mollie webhook: ${payment.id} is nu '${payment.status}'`, payment.metadata);

  // TODO (fase 2): if payment.status === "paid" → create the order in Adsolut
  // via lib/adsolut.js so stock and invoicing follow automatically.

  res.status(200).end();
};
