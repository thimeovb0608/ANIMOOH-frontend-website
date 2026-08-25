// TEMPORARY PROBE — fetches the reference data we need to hardcode.
//
// Right now: Countries (we need the countryId UUID for Belgium and the
// Netherlands — the only required field for WebAccounts we don't have yet)
// and Catalogues (so we can find ANIMOOH's catalogue code, needed later to
// filter CatalogueProducts down to just our own products).
//
// Uses the real getAccessToken() helper, so this also doubles as another
// check that the refresh cycle keeps working.

const { getAccessToken } = require("../lib/adsolut-auth");

// The Rubco administration, as returned by /api/adsolut-login earlier.
const ADMINISTRATION_ID = "9085076a-7795-4b2a-b3c5-9cb83eaa0499";
const ERP_BASE = `https://api.adsolut.com/erp/V1/adm/${ADMINISTRATION_ID}`;

async function fetchAll(path, accessToken) {
  const resp = await fetch(`${ERP_BASE}/${path}?PageSize=200`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return { status: resp.status, body: await resp.json() };
}

module.exports = async (req, res) => {
  try {
    const accessToken = await getAccessToken();

    const [countries, catalogues] = await Promise.all([
      fetchAll("Countries", accessToken),
      fetchAll("Catalogues", accessToken)
    ]);

    // Pull out just BE and NL so they're easy to spot in the response.
    const rows = countries.body?.data || [];
    const pick = (iso) => rows.find((c) => c.isoCode === iso || c.code === iso) || null;

    res.status(200).json({
      belgium: pick("BE"),
      netherlands: pick("NL"),
      countriesStatus: countries.status,
      countriesCount: rows.length,
      catalogues: catalogues.body,
      allCountries: rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
