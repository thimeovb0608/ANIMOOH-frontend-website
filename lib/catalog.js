// Server-side product catalog — the single source of truth for what can be sold.
// priceEUR is a string like "12.95" (Mollie wants exact decimal strings) and is
// the price the CUSTOMER PAYS, i.e. VAT included.
// A product with priceEUR: null cannot be bought (checkout refuses it).
//
// adsolutProductId / adsolutCode link each product to its record in Adsolut,
// found via /api/adsolut-find-products. Note: NO PEE HERE LEMON also exists as
// code 50084 ("ENKEL VOOR AMAZON") — we deliberately use 50053, the webshop one.
// All 8 share the same VAT code and unit, so those live in lib/adsolut.js.

const PRODUCTS = {
  "no-pee-lemon": {
    name: "No Pee Here Lemon 500ml",
    line: "No Pee Here",
    priceEUR: "19.95",
    adsolutCode: "50053",
    adsolutProductId: "e5d9172a-6a7f-49dc-ad72-57a45ef99f80",
    image: "Assets/Productfotos/no pee no background.png"
  },
  "no-pee-agrum": {
    name: "No Pee Here Agrum 500ml",
    line: "No Pee Here",
    priceEUR: "19.95",
    adsolutCode: "50054",
    adsolutProductId: "973e5d67-7a33-4361-82e6-497dc61eae3c",
    image: "Assets/Productfotos/No pee agrum final vertical.png"
  },
  "buddy-flower": {
    name: "Good Smell Buddy Flower 100ml",
    line: "Good Smell",
    priceEUR: "18.95",
    adsolutCode: "50052",
    adsolutProductId: "2361034a-9df8-44c5-ac32-5acb303ac9d5",
    image: "Assets/Productfotos/Good smell no background.png"
  },
  "buddy-lavendel": {
    name: "Good Smell Buddy Lavendel 100ml",
    line: "Good Smell",
    priceEUR: "18.95",
    adsolutCode: "50051",
    adsolutProductId: "bff95137-dde2-4a7e-ad70-8d95cc6a3eb5",
    image: "Assets/Productfotos/buddy lavendel final productfoto.png"
  },
  "air-euca": {
    name: "Good Smell Air Eucalyptus 100ml",
    line: "Good Smell",
    priceEUR: "18.95",
    adsolutCode: "50050",
    adsolutProductId: "5179565f-4fd2-465e-a202-dda83583cc89",
    image: "Assets/Productfotos/Good smell air euca final.png"
  },
  "air-agrum": {
    name: "Good Smell Air Agrum 100ml",
    line: "Good Smell",
    priceEUR: "18.95",
    adsolutCode: "50049",
    adsolutProductId: "29749441-612f-41ee-b160-9b95bad22689",
    image: "Assets/Productfotos/good smell air agrum - kopie.png"
  },
  "stuff-euca": {
    name: "Good Smell Stuff Eucalyptus 500ml",
    line: "Good Smell",
    priceEUR: "17.95",
    adsolutCode: "50055",
    adsolutProductId: "c8454e42-33eb-4123-93a5-254785c7e175",
    image: "Assets/Productfotos/Good smell stuff euca final vertical.png"
  },
  "floorings": {
    name: "Good Smell Floorings 1L",
    line: "Good Smell",
    priceEUR: "21.95",
    adsolutCode: "50056",
    adsolutProductId: "8e861e22-ee7a-43d0-8736-b5856ef95ab3",
    image: "Assets/Productfotos/Good smell floorings productphoto final.png"
  }
};

// Flat shipping cost for every order, as a decimal string. "0.00" = free shipping.
// TODO: bepaal verzendkost (of gratis verzending vanaf bedrag X — dan passen we dit aan).
const SHIPPING_EUR = "0.00";

module.exports = { PRODUCTS, SHIPPING_EUR };
