// Order price maths — the single source of truth for what an order costs.
//
// Used by api/checkout.js (the amount Mollie charges) and by lib/adsolut.js
// (the amount recorded in the ERP). Both MUST produce the same number: Adsolut
// recalculates every order it receives and rejects totals that don't match to
// the cent. cart.js mirrors this same formula in the browser for display.
//
// Deliberately dependency-free so the payment path can never break on an
// unrelated import.

const VAT_RATE = 0.21;

// Adsolut rounds with MidpointRounding.AwayFromZero at 2 decimals (confirmed by
// ErpConfigurations.decimalsUnitPriceSales = 2). For the positive amounts we
// deal with, Math.round matches that — the EPSILON nudge just avoids float
// artefacts like 1.005 landing on 1.00.
function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Our catalog prices are VAT-INCLUSIVE (what the customer pays), so the
// VAT-exclusive unit price is derived by dividing by 1.21.
//
// The unit price is rounded to 2 decimals BEFORE multiplying by quantity. That
// ordering matters: 3x EUR19.95 gives EUR59.86 this way but EUR59.85 if you
// divide once and only round the final total. EUR59.86 is what Rubco's existing
// webshop shows, so we match it rather than inventing a second price.
function lineAmounts(priceInclVatEUR, quantity) {
  const qty = Number(quantity);
  const unitPriceExclVat = round2(Number(priceInclVatEUR) / (1 + VAT_RATE));
  const totalPriceExclVat = round2(qty * unitPriceExclVat);

  return {
    quantity: qty,
    unitPriceExclVat,
    totalPriceExclVat,
    totalPriceInclVat: round2(totalPriceExclVat * (1 + VAT_RATE))
  };
}

// What shipping costs for a given products total (incl. VAT, before shipping).
// Free from the threshold up; the flat rate below it.
function shippingFor(productsInclVat, shippingEUR, freeFromEUR) {
  const rate = round2(Number(shippingEUR || 0));
  const threshold = Number(freeFromEUR);

  if (!threshold || Number.isNaN(threshold)) return rate;
  return productsInclVat >= threshold ? 0 : rate;
}

// lines: [{ priceInclVatEUR, quantity }]
// shippingEUR: "7.99", freeFromEUR: "50.00" (pass null to always charge shipping)
function orderTotals(lines, shippingEUR, freeFromEUR) {
  const productAmounts = lines.map((l) => lineAmounts(l.priceInclVatEUR, l.quantity));

  // Order total incl VAT is derived per VAT code from the excl subtotal. All
  // ANIMOOH products share the 21% code — and so does the shipping article
  // (75600) — so there is exactly one group.
  const productsExclVat = round2(
    productAmounts.reduce((sum, a) => sum + a.totalPriceExclVat, 0)
  );
  const productsInclVat = round2(productsExclVat * (1 + VAT_RATE));

  // The free-shipping threshold is measured on the products alone.
  const shipping = shippingFor(productsInclVat, shippingEUR, freeFromEUR);

  // Shipping is charged as an ordinary ORDER LINE, because a WebOrder has no
  // shipping-cost field — Adsolut only ever sees it as article 75600. So the
  // grand total must be computed across ALL lines, shipping included.
  //
  // Do NOT simplify this to productsInclVat + shipping: VAT then gets rounded
  // twice (once on the products, once inside the EUR7,99) and the two totals
  // disagree by a cent on most baskets, which Adsolut rejects outright.
  const shippingAmounts = shipping > 0 ? lineAmounts(shipping, 1) : null;
  const allAmounts = shippingAmounts
    ? productAmounts.concat([shippingAmounts])
    : productAmounts;

  const totalPriceExclVat = round2(
    allAmounts.reduce((sum, a) => sum + a.totalPriceExclVat, 0)
  );
  const grandTotalInclVat = round2(totalPriceExclVat * (1 + VAT_RATE));

  return {
    amounts: allAmounts,       // product lines, then the shipping line if charged
    productAmounts,            // products only, index-aligned with `lines`
    productsExclVat,
    productsInclVat,
    shipping,
    shippingAmounts,
    freeShipping: shipping === 0,
    // How much more the customer needs to spend to earn free shipping (0 once
    // they already have it) — drives the nudge in the basket.
    amountToFreeShipping: shipping === 0
      ? 0
      : round2(Math.max(0, Number(freeFromEUR || 0) - productsInclVat)),
    totalPriceExclVat,
    vatAmount: round2(grandTotalInclVat - totalPriceExclVat),
    grandTotalInclVat
  };
}

module.exports = { VAT_RATE, round2, lineAmounts, shippingFor, orderTotals };
