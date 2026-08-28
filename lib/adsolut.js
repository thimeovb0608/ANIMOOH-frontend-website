// Adsolut (Wolters Kluwer) ERP integration.
//
// Auth is handled by lib/adsolut-auth.js (reads the refresh token from Vercel
// KV, exchanges it, saves the new one). Everything here just asks that helper
// for a valid access token and then makes normal REST calls.
//
// Docs: https://api-portal.adsolut.com/ — see the API reference (not the
// narrative guide pages) for the authoritative endpoint/field list.

const { getAccessToken } = require("./adsolut-auth");

// Rubco administration, from GET /adm/v1/administrations.
const ADMINISTRATION_ID = "9085076a-7795-4b2a-b3c5-9cb83eaa0499";
const ERP_BASE = `https://api.adsolut.com/erp/V1/adm/${ADMINISTRATION_ID}`;

// Country UUIDs, fetched once from GET /Countries. Required on every address.
const COUNTRY_IDS = {
  BE: "3aca3103-3ebc-453a-9c8e-09ad4cbf9201",
  NL: "5b4793cc-fe33-447b-b063-d01749abb527"
};

// Fixed IDs shared by all 8 ANIMOOH products, confirmed via live API calls.
const VAT_CODE_ID = "0bf3ac8b-35a1-423e-9203-ab37f18cf7b2"; // code "4" = 21%
const VAT_RATE = 0.21;
const UNIT_ID = "3d6040ed-7cb7-4216-a672-6e01cacab4c6";
const CURRENCY_ID = "dffbf984-0554-4960-9476-b9afe1ef98a3"; // EUR

async function adsolutFetch(path, options = {}) {
  const accessToken = await getAccessToken();
  const resp = await fetch(`${ERP_BASE}/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await resp.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text; // non-JSON error page — keep it so we can see what happened
  }

  return { ok: resp.ok, status: resp.status, body };
}

// Looks up an existing web account by email address.
// Returns the account object, or null if this email is not known yet.
async function findWebAccountByEmail(email) {
  const result = await adsolutFetch(`WebAccounts?Mail=${encodeURIComponent(email)}`);

  if (!result.ok) {
    throw new Error(`WebAccounts lookup mislukt (${result.status}): ${JSON.stringify(result.body)}`);
  }

  const accounts = result.body?.webAccounts || result.body?.data || [];
  return accounts.length > 0 ? accounts[0] : null;
}

// Creates a new web account (customer + contact + delivery address in one call).
//
// Only these are actually required by the API:
//   customer.name, contact.firstName OR lastName, deliveryAddress.name,
//   and on every address: street + countryId.
// We deliberately leave salutationId / currencyId / phone empty — all optional,
// and we don't collect them at checkout.
async function createWebAccount({ name, email, street, zip, city, country }) {
  const countryId = COUNTRY_IDS[country] || COUNTRY_IDS.BE;

  const address = {
    street,
    postalCode: zip,
    city,
    countryId
  };

  const payload = {
    contact: {
      lastName: name, // one of firstName/lastName is enough — avoids splitting names
      email,
      language: "Nl",
      address
    },
    deliveryAddress: {
      name, // required; firstName/lastName are deprecated here
      email,
      language: "Nl",
      address,
      active: true
    },
    customer: {
      name,
      email,
      language: "Nl",
      address
    }
  };

  const result = await adsolutFetch("WebAccounts", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  if (!result.ok || result.body?.success === false) {
    throw new Error(
      `WebAccount aanmaken mislukt (${result.status}): ${JSON.stringify(result.body)}`
    );
  }

  return result.body; // { success, id, contactId, customerId, deliveryAddressId, validationResults }
}

// The function the checkout flow will actually use: reuse an existing customer
// if we've seen this email before, otherwise create one.
async function findOrCreateWebAccount(customerDetails) {
  const existing = await findWebAccountByEmail(customerDetails.email);

  if (existing) {
    return {
      created: false,
      webAccountId: existing.id,
      customerId: existing.customer?.id,
      contactId: existing.contact?.id,
      deliveryAddressId: existing.customer?.deliveryAddresses?.[0]?.id || null,
      raw: existing
    };
  }

  const result = await createWebAccount(customerDetails);
  return {
    created: true,
    webAccountId: result.id,
    customerId: result.customerId,
    contactId: result.contactId,
    deliveryAddressId: result.deliveryAddressId,
    raw: result
  };
}

// ─── WebOrders ────────────────────────────────────────────────────────────
//
// Adsolut re-calculates every total itself and rejects the order if our
// numbers don't match to the cent (see "Validation steps WebOrders" in the
// docs). So the arithmetic below deliberately mirrors theirs exactly.

// Adsolut rounds with MidpointRounding.AwayFromZero at 2 decimals. For the
// positive amounts we deal with, JS Math.round matches that — the EPSILON
// nudge just avoids float artefacts like 1.005 landing on 1.00.
function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Turns our checkout data into the exact body Adsolut's WebOrders endpoint wants.
//
// Our catalog prices are VAT-INCLUSIVE (what the customer actually pays), so we
// derive unitPrice (VAT-EXCLUSIVE) by dividing by 1.21.
//
// IMPORTANT: the unit price is rounded to 2 decimals IMMEDIATELY, before any
// multiplication — this exactly matches the existing Rubco webshop's own
// behaviour (verified against its real output: 3x EUR19.95 -> excl EUR49.47,
// BTW EUR10.39, totaal EUR59.86). Dividing once and rounding only the final
// totals gives a DIFFERENT number for some quantities (e.g. EUR59.85 for the
// same order) — a cent that's unreachable exactly at 21% VAT either way, so we
// match the number customers already see on the existing site rather than
// inventing a new one.
//
// grossUnitPrice is sent as 0 on purpose: with no discounts, Adsolut derives it
// from unitPrice itself (validation step 3).
function buildWebOrderPayload({ customerId, contactId, deliveryAddressId, lines, reference }) {
  const orderDetails = lines.map((line) => {
    const qty = Number(line.quantity);
    const unitPriceExclVat = round2(Number(line.priceInclVatEUR) / (1 + VAT_RATE));
    const lineExclVat = round2(qty * unitPriceExclVat);

    return {
      productId: line.adsolutProductId,
      description: line.name,
      vatCodeId: VAT_CODE_ID,
      unitId: UNIT_ID,
      quantity: qty,
      unitPrice: unitPriceExclVat,
      grossUnitPrice: 0,
      discount1: 0,
      discount2: 0,
      totalPriceExclVat: lineExclVat,
      totalPriceInclVat: round2(lineExclVat * (1 + VAT_RATE))
    };
  });

  // Order total excl = sum of the line totals (validation step 6).
  const totalExclVat = round2(
    orderDetails.reduce((sum, d) => sum + d.totalPriceExclVat, 0)
  );

  // Order total incl is calculated PER VAT CODE from the excl subtotal
  // (validation step 7). All ANIMOOH products share the 21% code, so there is
  // exactly one group — if that ever changes, this needs grouping logic.
  const totalInclVat = round2(totalExclVat * (1 + VAT_RATE));

  return {
    customerId,
    contactId,
    deliveryAddressId,
    currencyId: CURRENCY_ID,
    language: "Nl",
    orderDate: new Date().toISOString(),
    partnerRef: reference || "", // Mollie payment id — lets us trace back later
    totalPriceExclVat: totalExclVat,
    totalPriceInclVat: totalInclVat,
    orderDetails
  };
}

// Submits the order to Adsolut. Returns the response, which includes the new
// order's id plus any validationResults.
async function createWebOrder(orderInput) {
  const payload = buildWebOrderPayload(orderInput);

  const result = await adsolutFetch("WebOrders", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  if (!result.ok || result.body?.success === false) {
    throw new Error(
      `WebOrder aanmaken mislukt (${result.status}): ${JSON.stringify(result.body)}`
    );
  }

  return { response: result.body, sentPayload: payload };
}

// Stock sync is deliberately not built — the ANIMOOH catalogue is small enough
// to maintain by hand in lib/catalog.js. Returning null means "stock unknown,
// allow buying", which is what api/products.js expects.
async function getStock() {
  return null;
}

module.exports = {
  ADMINISTRATION_ID,
  COUNTRY_IDS,
  VAT_CODE_ID,
  VAT_RATE,
  UNIT_ID,
  CURRENCY_ID,
  adsolutFetch,
  findWebAccountByEmail,
  createWebAccount,
  findOrCreateWebAccount,
  buildWebOrderPayload,
  createWebOrder,
  getStock
};
