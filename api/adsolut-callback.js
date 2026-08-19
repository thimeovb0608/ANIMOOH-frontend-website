// TEMPORARY PROBE — the redirect target for api/adsolut-login.js.
// Exchanges the login code for tokens, lists administrations, activates our
// integration on the first one, then fetches ONE real CatalogueProducts page
// and prints everything to the screen as JSON so we can inspect it directly.
//
// NOT the final integration — see the note in adsolut-login.js. Once we know
// the real data shape, this whole file gets replaced by lib/adsolut.js plus
// proper secure storage for the refresh token (it rotates on every use, so it
// can't just live in a static Vercel env var long-term).

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
    res.status(400).json({ error: "Geen 'code' in de URL. Start opnieuw via /api/adsolut-login." });
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
