// GET /api/status?pid=tr_xxx — lets the thank-you page show whether the payment
// succeeded. Returns only the status, never customer or payment details.

const MOLLIE_API = "https://api.mollie.com/v2";

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const pid = req.query.pid;
  if (!pid || !/^tr_[A-Za-z0-9]+$/.test(pid)) {
    res.status(400).json({ error: "Ongeldige betaling." });
    return;
  }

  const resp = await fetch(`${MOLLIE_API}/payments/${pid}`, {
    headers: { Authorization: `Bearer ${process.env.MOLLIE_API_KEY}` }
  });

  if (!resp.ok) {
    res.status(502).json({ error: "Status ophalen mislukt." });
    return;
  }

  const payment = await resp.json();
  res.status(200).json({ status: payment.status }); // open | pending | paid | failed | canceled | expired
};
