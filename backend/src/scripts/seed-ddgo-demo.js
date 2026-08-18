/**
 * Seed a working DDGo footprint: three India stores, a handful of real grocery
 * items, and each store's shelf.
 *
 * Everything it creates is tagged so it can be found and removed again:
 *   stores    code starts with DD-
 *   products  sku starts with DDGO-
 * Re-running is safe — it upserts rather than duplicating.
 *
 *   node src/scripts/seed-ddgo-demo.js          seed
 *   node src/scripts/seed-ddgo-demo.js --undo   remove everything it made
 */
require("dotenv").config();
const mongoose = require("mongoose");

const STORES = [
  {
    code: "DD-GHY1", name: "DamnDeal Go — Guwahati",
    lat: 26.1445, lng: 91.7362, radiusKm: 6,
    city: "Guwahati", state: "Assam", pincode: "781001",
    address: "GS Road, Christian Basti, Guwahati",
  },
  {
    code: "DD-PTA1", name: "DamnDeal Go — Patiala",
    lat: 30.3398, lng: 76.3869, radiusKm: 5,
    city: "Patiala", state: "Punjab", pincode: "147001",
    address: "Leela Bhawan, Patiala",
  },
  {
    code: "DD-DEL1", name: "DamnDeal Go — Delhi",
    lat: 28.6315, lng: 77.2167, radiusKm: 8,
    city: "New Delhi", state: "Delhi", pincode: "110001",
    address: "Connaught Place, New Delhi",
  },
];

/* Prices are ordinary Indian retail, so the storefront reads like a real shop
   rather than a fixtures file. `cat` is matched to a seeded category by name. */
const ITEMS = [
  { sku: "DDGO-TOM1", name: "Tomato",                 cat: "Vegetables & Fruits", unit: "500 g",  mrp: 30,  price: 24,  cost: 16 },
  { sku: "DDGO-ONI1", name: "Onion",                  cat: "Vegetables & Fruits", unit: "1 kg",   mrp: 45,  price: 38,  cost: 26 },
  { sku: "DDGO-POT1", name: "Potato",                 cat: "Vegetables & Fruits", unit: "1 kg",   mrp: 40,  price: 32,  cost: 22 },
  { sku: "DDGO-BAN1", name: "Banana",                 cat: "Vegetables & Fruits", unit: "6 pcs",  mrp: 60,  price: 49,  cost: 34 },
  { sku: "DDGO-ATT1", name: "Aashirvaad Atta",        cat: "Atta, Dail, Rice",    unit: "5 kg",   mrp: 280, price: 255, cost: 225 },
  { sku: "DDGO-RIC1", name: "India Gate Basmati Rice",cat: "Atta, Dail, Rice",    unit: "1 kg",   mrp: 165, price: 149, cost: 128 },
  { sku: "DDGO-DAL1", name: "Toor Dal",               cat: "Atta, Dail, Rice",    unit: "1 kg",   mrp: 190, price: 172, cost: 150 },
  { sku: "DDGO-TEA1", name: "Tata Tea Gold",          cat: "Tea , Coffee etc",    unit: "500 g",  mrp: 320, price: 289, cost: 255 },
  { sku: "DDGO-COF1", name: "Nescafe Classic",        cat: "Tea , Coffee etc",    unit: "50 g",   mrp: 190, price: 175, cost: 155 },
  { sku: "DDGO-CHI1", name: "Lay's Classic Salted",   cat: "Chips & Namkeen",     unit: "52 g",   mrp: 20,  price: 20,  cost: 15 },
  { sku: "DDGO-NAM1", name: "Haldiram's Bhujia",      cat: "Chips & Namkeen",     unit: "200 g",  mrp: 55,  price: 50,  cost: 40 },
  { sku: "DDGO-COL1", name: "Coca-Cola",              cat: "Beverages & Drinks",  unit: "750 ml", mrp: 45,  price: 42,  cost: 33 },
  { sku: "DDGO-WAT1", name: "Bisleri Water",          cat: "Beverages & Drinks",  unit: "1 L",    mrp: 20,  price: 20,  cost: 13 },
  { sku: "DDGO-SOA1", name: "Dove Beauty Bar",        cat: "Bath & Body",         unit: "100 g",  mrp: 75,  price: 68,  cost: 55 },
  { sku: "DDGO-SHA1", name: "Clinic Plus Shampoo",    cat: "Hair care",           unit: "175 ml", mrp: 120, price: 109, cost: 90 },
  { sku: "DDGO-MAG1", name: "Maggi Noodles",          cat: "Instant Ready Food",  unit: "4 pack", mrp: 60,  price: 56,  cost: 46 },
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
    console.log(`removed ${ds.deletedCount} stores, ${pd.deletedCount} products, ${inv.deletedCount} shelf rows`);
    return mongoose.disconnect();
  }

  // Catalogue rows need an owner. The platform's own stock belongs to an admin
  // account, not to a partner who would then be owed a payout for it.
  const owner = await User.findOne({ role: "admin" }).select("_id").lean();
  if (!owner) { console.log("no admin user to own the products"); return mongoose.disconnect(); }

  const cats = await Category.find({ platform: "ddgo", regions: "IN" }).select("name").lean();
  const catByName = Object.fromEntries(cats.map((c) => [c.name, c._id]));

  console.log("── stores ──");
  const stores = [];
  for (const s of STORES) {
    const doc = await DarkStore.findOneAndUpdate(
      { code: s.code },
      {
        $set: {
          name: s.name,
          location: { type: "Point", coordinates: [s.lng, s.lat] },
          radiusKm: s.radiusKm, city: s.city, state: s.state,
          pincode: s.pincode, address: s.address,
          alwaysOpen: false, opensAtMin: 7 * 60, closesAtMin: 23 * 60,
          prepTimeMins: 8, regions: ["IN"], isActive: true, isAcceptingOrders: true,
        },
        $setOnInsert: { code: s.code },
      },
      { upsert: true, new: true }
    );
    stores.push(doc);
    console.log(`   ${doc.name}  ${s.city}  ${doc.radiusKm}km  07:00-23:00`);
  }

  console.log("\n── products ──");
  const products = [];
  let missingCat = 0;
  for (const it of ITEMS) {
    const category = catByName[it.cat];
    if (!category) { console.log(`   SKIPPED ${it.name} — no category "${it.cat}"`); missingCat++; continue; }
    const doc = await Product.findOneAndUpdate(
      { sku: it.sku },
      {
        $set: {
          name: it.name, category, partner: owner._id,
          platform: "ddgo", regions: ["IN"],
          unit: it.unit, mrp: it.mrp, price: it.mrp, sellingPrice: it.price, costPrice: it.cost,
          stock: 0,               // the shelf holds the real count, not this
          images: [],             // real photos get uploaded from the Products page
          isActive: true, approvalStatus: "approved",
        },
        $setOnInsert: { sku: it.sku },
      },
      { upsert: true, new: true }
    );
    products.push(doc);
  }
  console.log(`   ${products.length} products ready${missingCat ? `, ${missingCat} skipped` : ""}`);

  console.log("\n── shelves ──");
  for (const st of stores) {
    // Not every shop carries everything — Delhi gets the lot, the others a
    // slice, so the storefront shows shops that genuinely differ.
    const slice = st.code === "DD-DEL1" ? products
      : st.code === "DD-PTA1" ? products.slice(0, 12)
      : products.slice(0, 9);
    let n = 0;
    for (const p of slice) {
      await StoreInventory.findOneAndUpdate(
        { store: st._id, product: p._id },
        { $set: { stock: 25, isActive: true, lowStockAt: 5 }, $setOnInsert: { store: st._id, product: p._id } },
        { upsert: true }
      );
      n++;
    }
    console.log(`   ${st.name}: ${n} items`);
  }

  console.log("\ndone. Undo with:  node src/scripts/seed-ddgo-demo.js --undo");
  await mongoose.disconnect();
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
