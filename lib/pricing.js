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

// lines: [{ priceInclVatEUR, quantity }], shippingEUR: "0.00"
function orderTotals(lines, shippingEUR) {
  const amounts = lines.map((l) => lineAmounts(l.priceInclVatEUR, l.quantity));

  const totalPriceExclVat = round2(
    amounts.reduce((sum, a) => sum + a.totalPriceExclVat, 0)
  );

  // Order total incl VAT is derived per VAT code from the excl subtotal. All
  // ANIMOOH products share the 21% code, so there is exactly one group.
  const productsInclVat = round2(totalPriceExclVat * (1 + VAT_RATE));
  const shipping = round2(Number(shippingEUR || 0));

  return {
    amounts,
    totalPriceExclVat,
    productsInclVat,
    shipping,
    grandTotalInclVat: round2(productsInclVat + shipping)
  };
}

module.exports = { VAT_RATE, round2, lineAmounts, orderTotals };
