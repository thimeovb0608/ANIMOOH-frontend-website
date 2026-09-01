// TEMPORARY PROBE — reads Adsolut's real sales prices and compares them to
// the hand-typed ones in lib/catalog.js.
//
// Endpoint: POST /erp/v1/adm/{id}/ActualPrices (auth policy ErpRead).
// It returns the "verkoopprijs" in force on the given date, per product, with
// both the excl. and incl. VAT columns.
//
// This exists because our catalog prices were typed by hand and at least one
// is provably wrong: EUR17,95 for Good Smell Stuff Eucalyptus cannot be
// produced at 21% VAT from any 2-decimal exclusive price (14,83 -> EUR17,94,
// 14,84 -> EUR17,96). Adsolut's own number settles what it should be.
//
// Read-only: it POSTs, but ActualPrices is a query endpoint — nothing is
// created or changed.

const { PRODUCTS } = require("../lib/catalog");
const {
  getActualPrices,
  SHIPPING_PRODUCT_ID,
  SHIPPING_PRODUCT_CODE
} = require("../lib/adsolut");

function money(n) {
  return typeof n === "number" ? n.toFixed(2) : null;
}

module.exports = async (req, res) => {
  try {
    // Our 8 products plus the shipping article, so we can check that too.
    const wanted = Object.entries(PRODUCTS)
      .filter(([, p]) => p.adsolutProductId)
      .map(([key, p]) => ({
        key,
        productId: p.adsolutProductId,
        code: p.adsolutCode,
        ourPriceInclVat: p.priceEUR
      }));

    wanted.push({
      key: "verzendkosten",
      productId: SHIPPING_PRODUCT_ID,
      code: SHIPPING_PRODUCT_CODE,
      ourPriceInclVat: null // shipping price is ours, not Adsolut's
    });

    const { response, sentPayload } = await getActualPrices(
      wanted.map((w) => w.productId)
    );

    const items = response?.actualPrice?.items || [];
    const byProductId = new Map(items.map((i) => [i.product?.id, i]));

    const comparison = wanted.map((w) => {
      const found = byProductId.get(w.productId);
      if (!found) {
        return { product: w.key, code: w.code, error: "geen prijs teruggekregen" };
      }

      const adsolutInclVat = money(found.unitpriceInclVat);
      return {
        product: w.key,
        code: w.code,
        ourPriceInclVat: w.ourPriceInclVat,
        adsolutExclVat: money(found.unitPrice),
        adsolutInclVat,
        priceType: found.type, // ProductPrice | CustomerPrice | PromoPrice
        discount1: found.discount1,
        discount2: found.discount2,
        matchesOurCatalog:
          w.ourPriceInclVat === null ? null : adsolutInclVat === w.ourPriceInclVat
      };
    });

    const mismatches = comparison.filter((c) => c.matchesOurCatalog === false);

    res.status(200).json({
      summary: mismatches.length
        ? `${mismatches.length} prijs/prijzen wijken af van lib/catalog.js`
        : "Alle prijzen komen overeen met lib/catalog.js",
      mismatches,
      comparison,
      validationResults: response?.validationResults || [],
      priceDate: sentPayload.date,
      priceCategoryId: sentPayload.priceCategory.id
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
      hint:
        "403? Dan mist de token de WK.BE.Erp.Read scope — log opnieuw in via /api/adsolut-login."
    });
  }
};
