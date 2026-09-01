// TEMPORARY PROBE — decodes our own access token to see which scopes Wolters
// Kluwer actually granted.
//
// Why: /api/adsolut-prices got an identical bare 403 (no error body at all)
// on every GraphQL transport we tried, including no administration header.
// That pattern points at a missing scope on the token itself rather than a
// wrong request shape — this settles it directly instead of guessing further.
//
// Access tokens here are JWTs, so the payload can be read without calling
// Adsolut at all. We only report the scope/claim names, never the token.

const { getAccessToken } = require("../lib/adsolut-auth");

function decodeJwtPayload(jwt) {
  const parts = jwt.split(".");
  if (parts.length < 2) return { error: "Geen geldig JWT-formaat" };
  const payload = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  return JSON.parse(payload);
}

module.exports = async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    const claims = decodeJwtPayload(accessToken);

    res.status(200).json({
      scope: claims.scope || claims.scp || null,
      audience: claims.aud || null,
      clientId: claims.client_id || claims.azp || null,
      expiresAt: claims.exp ? new Date(claims.exp * 1000).toISOString() : null,
      allClaimNames: Object.keys(claims) // so we notice anything relevant we didn't think to name
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
