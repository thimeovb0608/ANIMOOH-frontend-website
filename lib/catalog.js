// Server-side product catalog — the single source of truth for what can be sold.
// priceEUR is a string like "12.95" (Mollie wants exact decimal strings).
// A product with priceEUR: null cannot be bought (checkout refuses it) — fill in
// every price before going live. Later, stock comes from Adsolut (see lib/adsolut.js).

const PRODUCTS = {
  "no-pee-lemon": {
    name: "No Pee Here Lemon 500ml",
    line: "No Pee Here",
    priceEUR: "19.95",
    image: "Assets/Productfotos/no pee no background.png"
  },
  "no-pee-agrum": {
    name: "No Pee Here Agrum 500ml",
    line: "No Pee Here",
    priceEUR: "19.95",
    image: "Assets/Productfotos/No pee agrum final vertical.png"
  },
  "buddy-flower": {
    name: "Good Smell Buddy Flower 100ml",
    line: "Good Smell",
    priceEUR: "18.95",
    image: "Assets/Productfotos/Good smell no background.png"
  },
  "buddy-lavendel": {
    name: "Good Smell Buddy Lavendel 100ml",
    line: "Good Smell",
    priceEUR: "18.95",
    image: "Assets/Productfotos/buddy lavendel final productfoto.png"
  },
  "air-euca": {
    name: "Good Smell Air Eucalyptus 100ml",
    line: "Good Smell",
    priceEUR: "18.95",
    image: "Assets/Productfotos/Good smell air euca final.png"
  },
  "air-agrum": {
    name: "Good Smell Air Agrum 100ml",
    line: "Good Smell",
    priceEUR: "18.95",
    image: "Assets/Productfotos/good smell air agrum - kopie.png"
  },
  "stuff-euca": {
    name: "Good Smell Stuff Eucalyptus 500ml",
    line: "Good Smell",
    priceEUR: "17.95",
    image: "Assets/Productfotos/Good smell stuff euca final vertical.png"
  },
  "floorings": {
    name: "Good Smell Floorings 1L",
    line: "Good Smell",
    priceEUR: "21.95",
    image: "Assets/Productfotos/Good smell floorings productphoto final.png"
  }
};

// Flat shipping cost for every order, as a decimal string. "0.00" = free shipping.
// TODO: bepaal verzendkost (of gratis verzending vanaf bedrag X — dan passen we dit aan).
const SHIPPING_EUR = "0.00";

module.exports = { PRODUCTS, SHIPPING_EUR };
