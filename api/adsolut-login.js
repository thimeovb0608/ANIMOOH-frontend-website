// TEMPORARY PROBE — starts the one-time Adsolut login so we can see one real
// CatalogueProducts response. Visit this URL in your browser to kick it off:
//   https://<your-site>/api/adsolut-login
//
// This is NOT the final integration — once we've learned the real data shape
// (specifically: where stock/price actually live), this gets replaced by the
// proper lib/adsolut.js + secure refresh-token storage discussed separately.

// The scopes we know Wolters Kluwer grants this client — a plain visit to this
// URL always uses exactly these, so it can never break the working token.
const BASE_SCOPES =
  "WK.GraphAPI.User offline_access WK.BE.Administrations WK.BE.ERP.Base WK.BE.ERP.Webshop WK.BE.Documents";

// ActualPrices (the real verkoopprijs) sits behind the ErpRead policy, which
// per Scopes.md needs WK.BE.Erp / WK.BE.Erp.Read — neither of which we hold.
// Requesting it as documented ("WK.BE.Erp.Read") came back invalid_scope, but
// note our granted scopes spell it ERP in caps, so the casing may simply be
// wrong. Rather than redeploy per guess, extra scopes can be appended here:
//   /api/adsolut-login?extra=WK.BE.ERP.Read
// A rejected scope just returns invalid_scope and leaves the stored token
// untouched, so trying variants is safe.
const AUTHORIZE_URL = "https://login.wolterskluwer.eu/auth/core/connect/authorize";

module.exports = async (req, res) => {
  const clientId = process.env.ADSOLUT_CLIENT_ID;
  const siteUrl = process.env.SITE_URL;

  if (!clientId || !siteUrl) {
    res.status(500).send("ADSOLUT_CLIENT_ID en/of SITE_URL ontbreken als environment variable op Vercel.");
    return;
  }

  const redirectUri = `${siteUrl}/api/adsolut-callback`;

  // Only allow scope-shaped values through, so this can't be used to inject
  // arbitrary junk into the authorize URL.
  const extra = (req.query.extra || "")
    .split(/[\s,]+/)
    .filter((s) => /^[A-Za-z0-9._]+$/.test(s));

  const scopes = [BASE_SCOPES, ...extra].join(" ");

  const authorizeUrl =
    `${AUTHORIZE_URL}?response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`;

  res.writeHead(302, { Location: authorizeUrl });
  res.end();
};
