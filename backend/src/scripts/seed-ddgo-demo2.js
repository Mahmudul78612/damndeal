/**
 * DDGo demo footprint, round two: photos everywhere, plus a US side.
 *
 * Builds on what seed-ddgo-demo.js made (and re-tags it with images):
 *   - store photos and keyword-matched product photos (loremflickr URLs,
 *     verified reachable before this was written)
 *   - three US quick-commerce categories, nine US products in dollars
 *   - two US stores (New York, Los Angeles)
 *
 * Same contract as before: everything is tagged (DD- store codes, DDGO- skus)
 * and safe to re-run.
 *
 *   node src/scripts/seed-ddgo-demo2.js
 *   node src/scripts/seed-ddgo-demo2.js --undo    (removes ALL DDGo demo data)
 */
require("dotenv").config();
const mongoose = require("mongoose");

const img = (kw) => `https://loremflickr.com/480/480/${kw}`;
const storeImg = (kw) => `https://loremflickr.com/640/480/${kw}`;

const STORE_IMAGES = {
  "DD-GHY1": storeImg("grocery,shop"),
  "DD-PTA1": storeImg("supermarket"),
  "DD-DEL1": storeImg("grocery,market"),
};

const IN_PRODUCT_IMAGES = {
  "DDGO-TOM1": img("tomato"),        "DDGO-ONI1": img("onion"),
  "DDGO-POT1": img("potato"),        "DDGO-BAN1": img("banana"),
  "DDGO-ATT1": img("flour,wheat"),   "DDGO-RIC1": img("rice"),
  "DDGO-DAL1": img("lentils"),       "DDGO-TEA1": img("tea"),
  "DDGO-COF1": img("coffee"),        "DDGO-CHI1": img("chips,snack"),
  "DDGO-NAM1": img("snack,indian"),  "DDGO-COL1": img("cola,drink"),
  "DDGO-WAT1": img("water,bottle"),  "DDGO-SOA1": img("soap"),
  "DDGO-SHA1": img("shampoo"),       "DDGO-MAG1": img("noodles"),
};

const US_CATEGORIES = [
  { name: "Fresh Produce",    icon: img("vegetables,fruit") },
  { name: "Snacks & Drinks",  icon: img("snacks,soda") },
  { name: "Household",        icon: img("cleaning,household") },
];

const US_STORES = [
  {
    code: "DD-NYC1", name: "DamnDeal Go — Manhattan",
    lat: 40.7549, lng: -73.9840, radiusKm: 5,
    city: "New York", state: "NY", pincode: "10019",
    address: "8th Ave & W 52nd St, Manhattan",
    image: storeImg("newyork,store"),
  },
  {
    code: "DD-LAX1", name: "DamnDeal Go — Los Angeles",
    lat: 34.0614, lng: -118.3082, radiusKm: 8,
    city: "Los Angeles", state: "CA", pincode: "90036",
    address: "Wilshire Blvd, Mid-City, LA",
    image: storeImg("losangeles,market"),
  },
];

const US_ITEMS = [
  { sku: "DDGO-USAVO", name: "Avocado",              cat: "Fresh Produce",   unit: "each",   mrp: 2.49, price: 1.99, cost: 1.2, kw: "avocado" },
  { sku: "DDGO-USBAN", name: "Bananas",              cat: "Fresh Produce",   unit: "bunch",  mrp: 1.99, price: 1.49, cost: 0.9, kw: "banana" },
  { sku: "DDGO-USSTR", name: "Strawberries",         cat: "Fresh Produce",   unit: "1 lb",   mrp: 5.99, price: 4.99, cost: 3.4, kw: "strawberry" },
  { sku: "DDGO-USMLK", name: "Whole Milk",           cat: "Fresh Produce",   unit: "1 gal",  mrp: 4.79, price: 4.29, cost: 3.3, kw: "milk" },
  { sku: "DDGO-USCHI", name: "Doritos Nacho Cheese", cat: "Snacks & Drinks", unit: "9.2 oz", mrp: 5.79, price: 5.29, cost: 3.9, kw: "chips" },
  { sku: "DDGO-USCOK", name: "Coca-Cola 12-pack",    cat: "Snacks & Drinks", unit: "12 cans",mrp: 9.99, price: 8.99, cost: 6.5, kw: "cola" },
  { sku: "DDGO-USWTR", name: "Spring Water 24-pack", cat: "Snacks & Drinks", unit: "24 btl", mrp: 6.99, price: 5.99, cost: 4.0, kw: "water,bottle" },
  { sku: "DDGO-USPPR", name: "Paper Towels",         cat: "Household",       unit: "6 rolls",mrp: 12.99,price: 10.99,cost: 7.8, kw: "paper,towel" },
  { sku: "DDGO-USDSH", name: "Dawn Dish Soap",       cat: "Household",       unit: "19.4 oz",mrp: 4.99, price: 4.49, cost: 3.2, kw: "soap,dish" },
];

async function main() {
  const undo = process.argv.includes("--undo");
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/damndeal");

  const DarkStore = require("../models/DarkStore");
  const StoreInventory = require("../models/StoreInventory");
  const Product = require("../models/Product");
  const Category = require("../models/Category");
  const User = require("../models/User");

  if (undo) {
    const stores = await DarkStore.find({ code: /^DD-/ }).select("_id").lean();
    const prods = await Product.find({ sku: /^DDGO-/ }).select("_id").lean();
    const inv = await StoreInventory.deleteMany({
      $or: [{ store: { $in: stores.map((s) => s._id) } }, { product: { $in: prods.map((p) => p._id) } }],
    });
    const ds = await DarkStore.deleteMany({ code: /^DD-/ });
    const pd = await Product.deleteMany({ sku: /^DDGO-/ });
    const ct = await Category.deleteMany({ platform: "ddgo", regions: ["US"], name: { $in: US_CATEGORIES.map((c) => c.name) } });
    console.log(`removed ${ds.deletedCount} stores, ${pd.deletedCount} products, ${inv.deletedCount} shelf rows, ${ct.deletedCount} US categories`);
    return mongoose.disconnect();
  }

  const owner = await User.findOne({ role: "admin" }).select("_id").lean();
  if (!owner) { console.log("no admin user"); return mongoose.disconnect(); }

  console.log("── photos on the India stores & products ──");
  for (const [code, image] of Object.entries(STORE_IMAGES)) {
    const r = await DarkStore.updateOne({ code }, { $set: { image } });
    if (r.matchedCount) console.log(`   ${code}: photo set`);
  }
  for (const [sku, url] of Object.entries(IN_PRODUCT_IMAGES)) {
    const r = await Product.updateOne({ sku, images: { $size: 0 } }, { $set: { images: [url] } });
    if (r.modifiedCount) console.log(`   ${sku}: photo set`);
  }

  console.log("\n── US categories ──");
  const usCatByName = {};
  for (const c of US_CATEGORIES) {
    const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const doc = await Category.findOneAndUpdate(
      { name: c.name, platform: "ddgo", regions: ["US"] },
      { $set: { icon: c.icon, isActive: true }, $setOnInsert: { name: c.name, slug, platform: "ddgo", regions: ["US"] } },
      { upsert: true, new: true }
    );
    usCatByName[c.name] = doc._id;
    console.log(`   ${doc.name}`);
  }

  console.log("\n── US products ──");
  const usProducts = [];
  for (const it of US_ITEMS) {
    const doc = await Product.findOneAndUpdate(
      { sku: it.sku },
      {
        $set: {
          name: it.name, category: usCatByName[it.cat], partner: owner._id,
          platform: "ddgo", regions: ["US"],
          unit: it.unit, mrp: it.mrp, price: it.mrp, sellingPrice: it.price, costPrice: it.cost,
          stock: 0, images: [img(it.kw)],
          isActive: true, approvalStatus: "approved",
        },
        $setOnInsert: { sku: it.sku },
      },
      { upsert: true, new: true }
    );
    usProducts.push(doc);
  }
  console.log(`   ${usProducts.length} products`);

  console.log("\n── US stores + shelves ──");
  for (const s of US_STORES) {
    const doc = await DarkStore.findOneAndUpdate(
      { code: s.code },
      {
        $set: {
          name: s.name, image: s.image,
          location: { type: "Point", coordinates: [s.lng, s.lat] },
          radiusKm: s.radiusKm, city: s.city, state: s.state,
          pincode: s.pincode, address: s.address,
          alwaysOpen: false, opensAtMin: 8 * 60, closesAtMin: 22 * 60,
          prepTimeMins: 10, regions: ["US"], isActive: true, isAcceptingOrders: true,
        },
        $setOnInsert: { code: s.code },
      },
      { upsert: true, new: true }
    );
    // NYC carries everything, LA skips the household aisle — different shops
    // should look different.
    const slice = s.code === "DD-NYC1" ? usProducts : usProducts.slice(0, 7);
    for (const p of slice) {
      await StoreInventory.findOneAndUpdate(
        { store: doc._id, product: p._id },
        { $set: { stock: 30, isActive: true, lowStockAt: 5 }, $setOnInsert: { store: doc._id, product: p._id } },
        { upsert: true }
      );
    }
    console.log(`   ${doc.name}: ${slice.length} items  (${s.city})`);
  }

  console.log("\ndone. Undo with:  node src/scripts/seed-ddgo-demo2.js --undo");
  await mongoose.disconnect();
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
