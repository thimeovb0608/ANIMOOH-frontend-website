// TEMPORARY PROBE — finds the ANIMOOH products inside Adsolut.
//
// There is only one catalogue ("RUBCO WEBSHOP"), so CatalogueCodes can't
// isolate our products. Instead we page through CatalogueProducts and match
// on name/code, then report exactly the three fields a WebOrder line needs:
//   productId (id), vatCodeId, unitId (defaultSalesUnitId)
//
// Optional: ?q=animooh,no pee   → override the default search terms.

const { getAccessToken, } = require("../lib/adsolut-auth");
const { ADMINISTRATION_ID } = require("../lib/adsolut");

const ERP_BASE = `https://api.adsolut.com/erp/V1/adm/${ADMINISTRATION_ID}`;
const PAGE_SIZE = 500;
const MAX_PAGES = 40; // safety cap: 20k products

const DEFAULT_TERMS = ["animooh", "no pee", "good smell"];

// Product names come back as [{ language, value }] — flatten to one string.
function nameToText(product) {
  const parts = [];
  for (const field of ["name", "webName", "description"]) {
    for (const entry of product[field] || []) {
      if (entry?.value) parts.push(entry.value);
    }
  }
  return parts.join(" | ");
}

module.exports = async (req, res) => {
  const terms = (req.query.q ? req.query.q.split(",") : DEFAULT_TERMS)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  try {
    const accessToken = await getAccessToken();

    const matches = [];
    let cursor = "";
    let pages = 0;
    let scanned = 0;

    while (pages < MAX_PAGES) {
      const url =
        `${ERP_BASE}/CatalogueProducts?PageSize=${PAGE_SIZE}` +
        (cursor ? `&NextCursor=${encodeURIComponent(cursor)}` : "");

      const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!resp.ok) {
        res.status(502).json({ error: `CatalogueProducts ${resp.status}`, detail: await resp.text() });
        return;
      }

      const page = await resp.json();
      const rows = page?.data || [];
      scanned += rows.length;

      for (const product of rows) {
        const haystack = `${product.code || ""} ${nameToText(product)}`.toLowerCase();
        if (terms.some((t) => haystack.includes(t))) {
          matches.push({
            code: product.code,
            name: nameToText(product),
            productId: product.id,
            vatCodeId: product.vatCodeId,
            unitId: product.defaultSalesUnitId,
            blocked: product.blocked,
            isActive: product.isActive,
            stockManagement: product.stockManagement,
            catalogueIds: product.catalogueIds
          });
        }
      }

      pages++;
      if (!page?.pagingData?.hasNext) break;
      cursor = page.pagingData.nextCursor;
    }

    res.status(200).json({
      searchedFor: terms,
      productsScanned: scanned,
      pagesFetched: pages,
      matchCount: matches.length,
      matches
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
