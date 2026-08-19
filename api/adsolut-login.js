// TEMPORARY PROBE — starts the one-time Adsolut login so we can see one real
// CatalogueProducts response. Visit this URL in your browser to kick it off:
//   https://<your-site>/api/adsolut-login
//
// This is NOT the final integration — once we've learned the real data shape
// (specifically: where stock/price actually live), this gets replaced by the
// proper lib/adsolut.js + secure refresh-token storage discussed separately.

const SCOPES = "WK.GraphAPI.User offline_access WK.BE.Administrations WK.BE.ERP.Base WK.BE.ERP.Webshop WK.BE.Documents";
const AUTHORIZE_URL = "https://login.wolterskluwer.eu/auth/core/connect/authorize";

module.exports = async (req, res) => {
  const clientId = process.env.ADSOLUT_CLIENT_ID;
  const siteUrl = process.env.SITE_URL;

  if (!clientId || !siteUrl) {
    res.status(500).send("ADSOLUT_CLIENT_ID en/of SITE_URL ontbreken als environment variable op Vercel.");
    return;
  }

  const redirectUri = `${siteUrl}/api/adsolut-callback`;

  const authorizeUrl =
    `${AUTHORIZE_URL}?response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`;

  res.writeHead(302, { Location: authorizeUrl });
  res.end();
};
