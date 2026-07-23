// Adsolut (Wolters Kluwer) integration — phase 2.
//
// Adsolut exposes a Public API; docs live at https://api-portal.adsolut.com/
// API access must first be activated for your installation via My Adsolut
// (see: "Hoe zet ik een integratie op met een eigen applicatie op my.Adsolut.com").
//
// Once you have credentials, set these environment variables on Vercel:
//   ADSOLUT_CLIENT_ID / ADSOLUT_CLIENT_SECRET (or the token the portal gives you)
//
// getStock() should then map Adsolut article numbers to our product ids and
// return { "no-pee-lemon": 12, "buddy-flower": 0, ... }.
// Until then it returns null, which the site treats as "stock unknown — allow buying".

async function getStock() {
  if (!process.env.ADSOLUT_CLIENT_ID) {
    return null; // not connected yet
  }
  // TODO (fase 2): authenticate against the Adsolut Public API, fetch article
  // stock levels and return them keyed by our product ids.
  return null;
}

module.exports = { getStock };
