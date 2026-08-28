// TEMPORARY PROBE — tests WebOrder creation.
//
// Three modes, deliberately escalating:
//   (no params)                  → dry run: shows the exact payload + the maths,
//                                  sends NOTHING to Adsolut
//   ?qty=3                       → same dry run with a different quantity, so we
//                                  can sanity-check the rounding on multiples
//   ?create=yes                  → ⚠ actually creates a real order in Adsolut,
//                                  billed to the ZZ TEST customer
//
// Uses the test customer created by /api/adsolut-test-webaccount.

const { PRODUCTS } = require("../lib/catalog");
const {
  findWebAccountByEmail,
  buildWebOrderPayload,
  createWebOrder,
  VAT_RATE
} = require("../lib/adsolut");

const TEST_EMAIL = "test-integratie@animooh-test.be";
const TEST_PRODUCT_KEY = "no-pee-lemon";

module.exports = async (req, res) => {
  const shouldCreate = req.query.create === "yes";
  const qty = Math.max(1, parseInt(req.query.qty, 10) || 1);

  try {
    const product = PRODUCTS[TEST_PRODUCT_KEY];
    if (!product?.adsolutProductId) {
      res.status(500).json({ error: `Geen adsolutProductId voor ${TEST_PRODUCT_KEY}` });
      return;
    }

    const account = await findWebAccountByEmail(TEST_EMAIL);
    if (!account) {
      res.status(400).json({
        error: "Testklant bestaat nog niet.",
        hint: "Draai eerst /api/adsolut-test-webaccount?create=yes"
      });
      return;
    }

    const orderInput = {
      customerId: account.customer?.id,
      contactId: account.contact?.id,
      deliveryAddressId: account.customer?.deliveryAddresses?.[0]?.id,
      reference: "TEST-" + Date.now(),
      lines: [
        {
          adsolutProductId: product.adsolutProductId,
          name: product.name,
          quantity: qty,
          priceInclVatEUR: product.priceEUR
        }
      ]
    };

    const payload = buildWebOrderPayload(orderInput);

    // What the customer would actually have paid at checkout, for comparison.
    const customerPays = (Number(product.priceEUR) * qty).toFixed(2);

    const maths = {
      catalogPriceInclVat: product.priceEUR,
      quantity: qty,
      customerWouldPay: customerPays,
      adsolutTotalInclVat: payload.totalPriceInclVat.toFixed(2),
      matches: customerPays === payload.totalPriceInclVat.toFixed(2),
      vatRateUsed: VAT_RATE
    };

    if (!shouldCreate) {
      res.status(200).json({
        mode: "DRY RUN — er is niets naar Adsolut gestuurd",
        maths,
        payloadThatWouldBeSent: payload,
        hint: "Voeg ?create=yes toe om de bestelling echt aan te maken. Test ook ?qty=3."
      });
      return;
    }

    const result = await createWebOrder(orderInput);
    res.status(200).json({
      mode: "ORDER AANGEMAAKT",
      maths,
      adsolutResponse: result.response,
      sentPayload: result.sentPayload
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
