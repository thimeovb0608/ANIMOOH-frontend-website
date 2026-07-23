// GET /api/products — public catalog the site can read: names, prices, stock.
// Never exposes secrets; only what a customer may see.

const { PRODUCTS, SHIPPING_EUR } = require("../lib/catalog");
const { getStock } = require("../lib/adsolut");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const stock = await getStock(); // null until Adsolut is connected

  const products = {};
  for (const [id, p] of Object.entries(PRODUCTS)) {
    products[id] = {
      name: p.name,
      line: p.line,
      priceEUR: p.priceEUR,
      image: p.image,
      buyable: p.priceEUR !== null && (stock === null || stock[id] > 0),
      stock: stock === null ? null : stock[id]
    };
  }

  res.status(200).json({ products, shippingEUR: SHIPPING_EUR });
};
