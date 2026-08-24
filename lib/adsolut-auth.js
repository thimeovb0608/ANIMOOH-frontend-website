// Adsolut OAuth2 token handling — the read/refresh/save cycle.
//
// The refresh token lives in Vercel KV (not an env var) because our own code
// must be able to update it automatically. Every refresh always saves
// whatever refresh_token comes back: safe whether Adsolut rotates it to a
// new value or just renews the same one's lifetime (Authentication.md is
// ambiguous on which — always-save covers both correctly).
//
// Bootstrapping: the very first refresh token comes from a one-time human
// login via /api/adsolut-login, which seeds this same KV key.

const { kv } = require("@vercel/kv");

const TOKEN_URL = "https://login.wolterskluwer.eu/auth/core/connect/token";
const REFRESH_TOKEN_KEY = "adsolut_refresh_token";

async function getAccessToken() {
  const clientId = process.env.ADSOLUT_CLIENT_ID;
  const clientSecret = process.env.ADSOLUT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("ADSOLUT_CLIENT_ID / ADSOLUT_CLIENT_SECRET ontbreken op Vercel.");
  }

  const refreshToken = await kv.get(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    throw new Error(
      "Geen refresh token in KV storage. Eenmalig inloggen via /api/adsolut-login nodig."
    );
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret
    })
  });

  if (!resp.ok) {
    throw new Error(`Adsolut token refresh mislukt (${resp.status}): ${await resp.text()}`);
  }

  const tokens = await resp.json();

  // Always overwrite — harmless if the token didn't change, essential if it did.
  await kv.set(REFRESH_TOKEN_KEY, tokens.refresh_token);

  return tokens.access_token;
}

module.exports = { getAccessToken, REFRESH_TOKEN_KEY };
