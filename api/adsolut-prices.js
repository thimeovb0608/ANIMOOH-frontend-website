// TEMPORARY PROBE — works out how to read Adsolut's own sales prices.
//
// We need the "verkoopprijs" row with the latest valid date, which carries the
// excl. and incl. VAT columns. Those prices are NOT in the REST
// CatalogueProducts response (article 75600 came back with no price field at
// all) — they live in the GraphQL variant of the same ERP API.
//
// Our docs folder has nothing on the GraphQL endpoint, so this probe discovers
// the shape instead of assuming it:
//   1. which transport works (administration in the path? a header?)
//   2. which root query fields relate to prices
//   3. what fields the price type actually exposes
//
// Everything is reported raw, including failures, so one run tells us enough to
// write the real query.

const { getAccessToken } = require("../lib/adsolut-auth");
const { ADMINISTRATION_ID } = require("../lib/adsolut");

const GQL_ROOT = "https://api.adsolut.com/erp/graphql/v1";

// The administration has to be identified somehow; undocumented, so try the
// plausible conventions in order and keep the first that answers.
const TRANSPORTS = [
  { label: "path /adm/{id}", url: `${GQL_ROOT}/adm/${ADMINISTRATION_ID}`, headers: {} },
  { label: "header AdministrationId", url: GQL_ROOT, headers: { AdministrationId: ADMINISTRATION_ID } },
  { label: "header X-Administration-Id", url: GQL_ROOT, headers: { "X-Administration-Id": ADMINISTRATION_ID } },
  { label: "header administration-id", url: GQL_ROOT, headers: { "administration-id": ADMINISTRATION_ID } },
  { label: "no administration", url: GQL_ROOT, headers: {} }
];

async function gql(transport, accessToken, query, variables) {
  const resp = await fetch(transport.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...transport.headers
    },
    body: JSON.stringify({ query, variables: variables || {} })
  });

  const text = await resp.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text.slice(0, 600); // an HTML error page — keep enough to read it
  }
  return { status: resp.status, ok: resp.ok, body };
}

// Unwraps GraphQL's nested type wrappers (NON_NULL / LIST) down to a name.
function typeName(t) {
  let cur = t;
  const wrappers = [];
  while (cur) {
    if (cur.name) return wrappers.length ? `${cur.name} (${wrappers.join(" of ")})` : cur.name;
    wrappers.push(cur.kind);
    cur = cur.ofType;
  }
  return "?";
}

module.exports = async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    const report = { transportsTried: [] };

    // ── 1. Which transport answers a trivial query? ────────────────────────
    let working = null;
    for (const transport of TRANSPORTS) {
      const probe = await gql(transport, accessToken, "{ __typename }");
      report.transportsTried.push({
        transport: transport.label,
        status: probe.status,
        answered: !!probe.body?.data,
        error: probe.body?.errors?.[0]?.message || (probe.body?.data ? null : probe.body)
      });
      if (probe.body?.data) {
        working = transport;
        break;
      }
    }

    if (!working) {
      res.status(200).json({
        conclusion: "Geen enkele GraphQL-transport werkte — zie transportsTried.",
        ...report
      });
      return;
    }
    report.workingTransport = working.label;

    // ── 2. Which root query fields look price/product related? ─────────────
    const roots = await gql(
      working,
      accessToken,
      `{ __schema { queryType { fields {
           name
           args { name type { kind name ofType { kind name } } }
           type { kind name ofType { kind name ofType { kind name } } }
      } } } }`
    );

    const allFields = roots.body?.data?.__schema?.queryType?.fields || [];
    report.rootFieldsTotal = allFields.length;
    report.rootFieldsError = roots.body?.errors || null;

    const interesting = allFields.filter((f) => /price|prijs|product/i.test(f.name));
    report.priceRelatedRootFields = interesting.map((f) => ({
      name: f.name,
      returns: typeName(f.type),
      args: (f.args || []).map((a) => `${a.name}: ${typeName(a.type)}`)
    }));

    // ── 3. What does the price type expose? ────────────────────────────────
    const priceField =
      interesting.find((f) => /^productPrices$/i.test(f.name)) ||
      interesting.find((f) => /price/i.test(f.name));

    if (priceField) {
      // Strip the wrapper text so we can introspect the bare type name.
      const bare = typeName(priceField.type).split(" (")[0];
      report.inspectingType = bare;

      const detail = await gql(
        working,
        accessToken,
        `query T($n: String!) { __type(name: $n) {
             name kind
             fields { name type { kind name ofType { kind name ofType { kind name } } } }
        } }`,
        { n: bare }
      );

      const t = detail.body?.data?.__type;
      report.priceTypeFields = t?.fields
        ? t.fields.map((f) => `${f.name}: ${typeName(f.type)}`)
        : null;
      report.priceTypeRaw = t ? undefined : detail.body;

      // A paged wrapper usually exposes the real row type under data/items.
      const rowField = (t?.fields || []).find((f) => /^(data|items|nodes|edges)$/i.test(f.name));
      if (rowField) {
        const rowType = typeName(rowField.type).split(" (")[0];
        report.rowTypeName = rowType;
        const rowDetail = await gql(
          working,
          accessToken,
          `query T($n: String!) { __type(name: $n) { name fields { name type { kind name ofType { kind name ofType { kind name } } } } } }`,
          { n: rowType }
        );
        report.rowTypeFields = (rowDetail.body?.data?.__type?.fields || []).map(
          (f) => `${f.name}: ${typeName(f.type)}`
        );
      }
    } else {
      report.note = "Geen price-achtig root field gevonden — zie alleRootFields.";
      report.allRootFields = allFields.map((f) => f.name);
    }

    res.status(200).json(report);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack?.split("\n").slice(0, 4) });
  }
};
