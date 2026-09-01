// TEMPORARY PROBE — tests the WebAccounts find-or-create flow.
//
// ⚠ This writes to the REAL Rubco administration. A successful run creates an
// actual customer record in Adsolut. The test data is deliberately obvious
// ("ZZ TEST — Website Integratie") so it's easy to spot and delete afterwards.
//
// Two-step on purpose:
//   /api/adsolut-test-webaccount              → lookup only, changes nothing
//   /api/adsolut-test-webaccount?create=yes   → actually creates the account

const { findWebAccountByEmail, findOrCreateWebAccount } = require("../lib/adsolut");

// Fixed test identity, so repeated runs hit the same record instead of
// creating a new one each time.
const TEST_CUSTOMER = {
  name: "ZZ TEST — Website Integratie",
  email: "test-integratie@animooh-test.be",
  street: "Teststraat 1",
  zip: "2000",
  city: "Antwerpen",
  country: "BE"
};

module.exports = async (req, res) => {
  const shouldCreate = req.query.create === "yes";

  try {
    if (!shouldCreate) {
      const existing = await findWebAccountByEmail(TEST_CUSTOMER.email);
      res.status(200).json({
        mode: "lookup only (niets aangemaakt)",
        testCustomer: TEST_CUSTOMER,
        found: !!existing,
        existing,
        hint: "Voeg ?create=yes toe aan de URL om echt een klant aan te maken in Adsolut."
      });
      return;
    }

    const result = await findOrCreateWebAccount(TEST_CUSTOMER);
    res.status(200).json({
      mode: "find-or-create",
      wasCreated: result.created,
      webAccountId: result.webAccountId,
      customerId: result.customerId,
      contactId: result.contactId,
      deliveryAddressId: result.deliveryAddressId,
      raw: result.raw
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
