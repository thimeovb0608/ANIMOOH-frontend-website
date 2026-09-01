// One-time bootstrap login — the redirect target for api/adsolut-login.js.
// Exchanges the login code for tokens, SAVES the refresh token into Vercel KV
// (this is what seeds lib/adsolut-auth.js's read/refresh/save cycle for all
// future automated calls), then does one live sanity check: lists
// administrations, activates our integration, and fetches a few real
// CatalogueProducts to confirm everything actually works end to end.
//
// You only need to visit this once (or again if the stored refresh token
// ever dies for some reason — see lib/adsolut-auth.js).

const { kv } = require("@vercel/kv");
const { REFRESH_TOKEN_KEY } = require("../lib/adsolut-auth");

const TOKEN_URL = "https://login.wolterskluwer.eu/auth/core/connect/token";
const ADM_URL = "https://api.adsolut.com/adm/v1/administrations";

module.exports = async (req, res) => {
  const clientId = process.env.ADSOLUT_CLIENT_ID;
  const clientSecret = process.env.ADSOLUT_CLIENT_SECRET;
  const siteUrl = process.env.SITE_URL;
  const code = req.query.code;

  if (!clientId || !clientSecret || !siteUrl) {
    res.status(500).json({ error: "ADSOLUT_CLIENT_ID / ADSOLUT_CLIENT_SECRET / SITE_URL ontbreken op Vercel." });
    return;
  }
  if (!code) {
    // OAuth reports refusals by redirecting back with error params rather than
    // a code — e.g. invalid_scope when a requested scope isn't provisioned for
    // this client. Surface those instead of swallowing the reason.
    if (req.query.error) {
      res.status(400).json({
        error: req.query.error,
        errorDescription: req.query.error_description || null,
        meaning:
          req.query.error === "invalid_scope"
            ? "Wolters Kluwer heeft een gevraagde scope geweigerd — waarschijnlijk WK.BE.Erp.Read. Die moet WK eerst voor deze client vrijgeven."
            : "Zie errorDescription.",
        note: "De bestaande refresh token in KV is NIET aangepast."
      });
      return;
    }

    res.status(400).json({
      error: "Geen 'code' in de URL. Start opnieuw via /api/adsolut-login.",
      receivedQueryParams: Object.keys(req.query || {}),
      note: "Open /api/adsolut-login (niet deze callback rechtstreeks)."
    });
    return;
  }

  const redirectUri = `${siteUrl}/api/adsolut-callback`;
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const log = { step: "start" };

  try {
    // Step 1: exchange the code for an access token + refresh token
    log.step = "token exchange";
    const tokenResp = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri
      })
    });

    if (!tokenResp.ok) {
      log.tokenError = await tokenResp.text();
      res.status(502).json(log);
      return;
    }

    const tokens = await tokenResp.json();
    const accessToken = tokens.access_token;
    log.gotAccessToken = !!accessToken;
    log.refreshTokenPreview = tokens.refresh_token ? tokens.refresh_token.slice(0, 12) + "..." : null;

    // Step 1b: seed Vercel KV — this is the actual point of this file now.
    // From here on, lib/adsolut-auth.js keeps this fresh on its own.
    log.step = "save refresh token to KV";
    await kv.set(REFRESH_TOKEN_KEY, tokens.refresh_token);
    log.savedToKv = true;

    // Step 2: list administrations
    log.step = "list administrations";
    const admResp = await fetch(ADM_URL, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const admData = await admResp.json();
    log.administrations = admData;

    const firstAdmId = admData?.data?.[0]?.id || admData?.[0]?.id;
    if (!firstAdmId) {
      log.note = "Geen administratie-id gevonden in de respons hierboven — kan niet verder naar CatalogueProducts.";
      res.status(200).json(log);
      return;
    }
    log.usingAdministrationId = firstAdmId;

    // Step 3: try activating our integration on this administration
    // (harmless to call again if already activated — Adsolut will just tell us)
    log.step = "activate administration";
    const activateResp = await fetch(`${ADM_URL}/${firstAdmId}/integrations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    log.activateStatus = activateResp.status;
    log.activateBody = await activateResp.text();

    // Step 4: the real test — fetch actual CatalogueProducts data
    log.step = "fetch CatalogueProducts";
    const productsResp = await fetch(
      `https://api.adsolut.com/erp/V1/adm/${firstAdmId}/CatalogueProducts?PageSize=3`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    log.productsStatus = productsResp.status;
    log.products = await productsResp.json();

    log.step = "done";
    res.status(200).json(log);
  } catch (err) {
    log.exception = err.message;
    res.status(500).json(log);
  }
};
