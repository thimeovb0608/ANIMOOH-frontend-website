// TEMPORARY PROBE — proves the ongoing refresh cycle works, not just the
// initial login. Visit this AFTER /api/adsolut-login has run once. It uses
// the same lib/adsolut-auth.js helper the real integration will use later:
// reads the refresh token from KV, exchanges it for a fresh access token,
// saves whatever comes back, then makes one real API call to prove the
// access token actually works.

const { getAccessToken } = require("../lib/adsolut-auth");

const ADM_URL = "https://api.adsolut.com/adm/v1/administrations";

module.exports = async (req, res) => {
  try {
    const accessToken = await getAccessToken();

    const admResp = await fetch(ADM_URL, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const admData = await admResp.json();

    res.status(200).json({
      refreshCycleWorked: true,
      administrationsStatus: admResp.status,
      administrations: admData
    });
  } catch (err) {
    res.status(500).json({ refreshCycleWorked: false, error: err.message });
  }
};
