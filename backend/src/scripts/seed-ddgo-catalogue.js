/**
 * A full grocery catalogue for the DDGo demo, and every store stocked deep.
 *
 * Adds ~55 products with keyword-matched photos across the India grocery
 * categories, three more Guwahati stores, and then fills every DD- India store
 * with a large slice (35-55 items) so each shop looks like a real shop.
 *
 * Tagged DDGO-C* (products) and DD-GHY8/9/10 (stores); re-runnable and --undo.
 *
 *   node src/scripts/seed-ddgo-catalogue.js
 *   node src/scripts/seed-ddgo-catalogue.js --undo
 */
require("dotenv").config();
const mongoose = require("mongoose");

const img = (kw) => `https://loremflickr.com/480/480/${kw}`;
const cover = (kw) => `https://loremflickr.com/900/500/${kw}`;
const logo = (kw) => `https://loremflickr.com/200/200/${kw}`;

// name, category (must match a ddgo IN category name), unit, mrp, price, keyword
const CATALOGUE = [
  // Vegetables & Fruits
  ["Fresh Tomato", "Vegetables & Fruits", "500 g", 30, 24, "tomato"],
  ["Onion", "Vegetables & Fruits", "1 kg", 45, 38, "onion"],
  ["Potato", "Vegetables & Fruits", "1 kg", 40, 32, "potato"],
  ["Banana", "Vegetables & Fruits", "6 pcs", 60, 49, "banana"],
  ["Apple Shimla", "Vegetables & Fruits", "1 kg", 180, 149, "apple"],
  ["Green Capsicum", "Vegetables & Fruits", "250 g", 35, 28, "capsicum"],
  ["Carrot", "Vegetables & Fruits", "500 g", 40, 30, "carrot"],
  ["Lady Finger", "Vegetables & Fruits", "500 g", 45, 34, "okra"],
  ["Cauliflower", "Vegetables & Fruits", "1 pc", 40, 32, "cauliflower"],
  ["Lemon", "Vegetables & Fruits", "4 pcs", 30, 22, "lemon"],
  // Atta, Dail, Rice
  ["Aashirvaad Atta", "Atta, Dail, Rice", "5 kg", 280, 255, "flour,wheat"],
  ["India Gate Basmati", "Atta, Dail, Rice", "1 kg", 165, 149, "rice"],
  ["Toor Dal", "Atta, Dail, Rice", "1 kg", 190, 172, "lentils"],
  ["Moong Dal", "Atta, Dail, Rice", "1 kg", 160, 145, "lentils,yellow"],
  ["Chana Dal", "Atta, Dail, Rice", "1 kg", 120, 108, "chickpea"],
  ["Sona Masoori Rice", "Atta, Dail, Rice", "5 kg", 420, 389, "rice,bag"],
  ["Besan", "Atta, Dail, Rice", "500 g", 70, 62, "gram,flour"],
  // Tea, Coffee
  ["Tata Tea Gold", "Tea , Coffee etc", "500 g", 320, 289, "tea"],
  ["Nescafe Classic", "Tea , Coffee etc", "50 g", 190, 175, "coffee"],
  ["Red Label Tea", "Tea , Coffee etc", "250 g", 140, 128, "tea,leaves"],
  ["Bru Instant Coffee", "Tea , Coffee etc", "100 g", 260, 239, "coffee,jar"],
  ["Green Tea Bags", "Tea , Coffee etc", "25 bags", 180, 159, "green,tea"],
  // Chips & Namkeen
  ["Lay's Classic Salted", "Chips & Namkeen", "52 g", 20, 20, "chips"],
  ["Haldiram's Bhujia", "Chips & Namkeen", "200 g", 55, 50, "snack,indian"],
  ["Kurkure Masala", "Chips & Namkeen", "90 g", 20, 20, "snack"],
  ["Bingo Mad Angles", "Chips & Namkeen", "80 g", 20, 18, "chips,triangle"],
  ["Aloo Bhujia", "Chips & Namkeen", "400 g", 110, 99, "namkeen"],
  ["Peanuts Masala", "Chips & Namkeen", "200 g", 60, 52, "peanuts"],
  // Beverages & Drinks
  ["Coca-Cola", "Beverages & Drinks", "750 ml", 45, 42, "cola,drink"],
  ["Bisleri Water", "Beverages & Drinks", "1 L", 20, 20, "water,bottle"],
  ["Real Mixed Fruit Juice", "Beverages & Drinks", "1 L", 120, 109, "juice"],
  ["Sprite", "Beverages & Drinks", "750 ml", 45, 42, "lemon,soda"],
  ["Frooti", "Beverages & Drinks", "600 ml", 40, 36, "mango,drink"],
  ["Red Bull", "Beverages & Drinks", "250 ml", 125, 118, "energy,drink"],
  // Sweets & Chocolates
  ["Cadbury Dairy Milk", "Sweets & Chocolets", "50 g", 45, 42, "chocolate"],
  ["KitKat", "Sweets & Chocolets", "37 g", 40, 38, "chocolate,bar"],
  ["Haldiram Soan Papdi", "Sweets & Chocolets", "500 g", 160, 145, "sweet,indian"],
  ["Gulab Jamun Tin", "Sweets & Chocolets", "1 kg", 250, 225, "gulab,jamun"],
  // Instant Ready Food
  ["Maggi Noodles", "Instant Ready Food", "4 pack", 60, 56, "noodles"],
  ["Top Ramen", "Instant Ready Food", "4 pack", 56, 50, "instant,noodles"],
  ["MTR Poha", "Instant Ready Food", "200 g", 65, 58, "poha"],
  ["Knorr Soup", "Instant Ready Food", "45 g", 55, 49, "soup"],
  // Sauces
  ["Kissan Tomato Ketchup", "Sauces", "950 g", 140, 125, "ketchup"],
  ["Maggi Hot & Sweet", "Sauces", "500 g", 130, 118, "sauce"],
  ["Ching's Soy Sauce", "Sauces", "200 g", 60, 52, "soy,sauce"],
  ["Veeba Mayonnaise", "Sauces", "250 g", 99, 89, "mayonnaise"],
  // Bath & Body
  ["Dove Beauty Bar", "Bath & Body", "100 g", 75, 68, "soap"],
  ["Dettol Handwash", "Bath & Body", "200 ml", 99, 89, "handwash"],
  ["Lifebuoy Soap Pack", "Bath & Body", "4x100 g", 140, 125, "soap,bar"],
  ["Colgate MaxFresh", "Bath & Body", "150 g", 95, 85, "toothpaste"],
  // Hair care
  ["Clinic Plus Shampoo", "Hair care", "175 ml", 120, 109, "shampoo"],
  ["Head & Shoulders", "Hair care", "180 ml", 165, 149, "shampoo,bottle"],
  ["Parachute Coconut Oil", "Hair care", "200 ml", 90, 82, "coconut,oil"],
  // Cleaning essentials
  ["Surf Excel", "Cleaning essentials", "1 kg", 140, 128, "detergent"],
  ["Vim Dishwash Bar", "Cleaning essentials", "3x200 g", 60, 52, "dishwash"],
  ["Harpic Toilet Cleaner", "Cleaning essentials", "500 ml", 99, 89, "cleaner,bottle"],
  ["Colin Glass Cleaner", "Cleaning essentials", "500 ml", 95, 85, "spray,clean"],
];

const NEW_STORES = [
  { code: "DD-GHY8", area: "Zoo Road",   lat: 26.1720, lng: 91.7690 },
  { code: "DD-GHY9", area: "Six Mile",   lat: 26.1290, lng: 91.8010 },
  { code: "DD-GHY10", area: "Dispur",    lat: 26.1410, lng: 91.7900 },
];

function rint(seed) { // deterministic pseudo-random from an integer seed
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

async function main() {
  const undo = process.argv.includes("--undo");
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/damndeal");
  const DarkStore = require("../models/DarkStore");
  const StoreInventory = require("../models/StoreInventory");
  const Product = require("../models/Product");
  const Category = require("../models/Category");
  const User = require("../models/User");

  if (undo) {
    const prods = await Product.find({ sku: /^DDGO-C/ }).select("_id").lean();
    const stores = await DarkStore.find({ code: { $in: NEW_STORES.map((s) => s.code) } }).select("_id").lean();
    const inv = await StoreInventory.deleteMany({
      $or: [{ product: { $in: prods.map((p) => p._id) } }, { store: { $in: stores.map((s) => s._id) } }],
    });
    const pd = await Product.deleteMany({ sku: /^DDGO-C/ });
    const ds = await DarkStore.deleteMany({ code: { $in: NEW_STORES.map((s) => s.code) } });
    console.log(`removed ${pd.deletedCount} products, ${ds.deletedCount} stores, ${inv.deletedCount} shelf rows`);
    return mongoose.disconnect();
  }

  const owner = await User.findOne({ role: "admin" }).select("_id").lean();
  const cats = await Category.find({ platform: "ddgo", regions: "IN" }).select("name").lean();
  const catByName = Object.fromEntries(cats.map((c) => [c.name, c._id]));

  console.log("── products ──");
  const products = [];
  let skipped = 0;
  for (let i = 0; i < CATALOGUE.length; i++) {
    const [name, catName, unit, mrp, price, kw] = CATALOGUE[i];
    const category = catByName[catName];
    if (!category) { skipped++; continue; }
    const sku = "DDGO-C" + String(i + 1).padStart(3, "0");
    const doc = await Product.findOneAndUpdate(
      { sku },
      {
        $set: {
          name, category, partner: owner._id, platform: "ddgo", regions: ["IN"],
          unit, mrp, price: mrp, sellingPrice: price, costPrice: Math.round(price * 0.75),
          stock: 0, images: [img(kw)], isActive: true, approvalStatus: "approved",
          description: `${name} — ${unit}. Fresh stock delivered from a store near you.`,
        },
        $setOnInsert: { sku },
      },
      { upsert: true, new: true }
    );
    products.push(doc);
  }
  console.log(`   ${products.length} products ready${skipped ? `, ${skipped} skipped (missing category)` : ""}`);

  console.log("\n── new Guwahati stores ──");
  for (const s of NEW_STORES) {
    await DarkStore.findOneAndUpdate(
      { code: s.code },
      {
        $set: {
          name: `DamnDeal Go — ${s.area}`, logo: logo("grocery"), image: logo("grocery"),
          coverImage: cover("supermarket,grocery"),
          location: { type: "Point", coordinates: [s.lng, s.lat] },
          radiusKm: 8, city: "Guwahati", state: "Assam", address: `${s.area}, Guwahati`,
          alwaysOpen: false, opensAtMin: 7 * 60, closesAtMin: 23 * 60,
          prepTimeMins: 8, regions: ["IN"], isActive: true, isAcceptingOrders: true,
        },
        $setOnInsert: { code: s.code },
      },
      { upsert: true }
    );
    console.log(`   ${s.code}  ${s.area}`);
  }

  // Every India dark store gets a big slice of the whole catalogue (old + new).
  const allInProducts = await Product.find({ sku: /^DDGO-/, regions: "IN", platform: "ddgo" }).select("_id").lean();
  const inStores = await DarkStore.find({ code: /^DD-/, regions: "IN" }).select("_id code").lean();

  console.log(`\n── stocking ${inStores.length} stores from ${allInProducts.length} products ──`);
  for (let si = 0; si < inStores.length; si++) {
    const st = inStores[si];
    const ops = [];
    for (let pi = 0; pi < allInProducts.length; pi++) {
      // Each store carries ~75-95% of the catalogue, chosen deterministically
      // so shelves differ but every store is deep.
      if (rint((si + 1) * 1000 + pi) > 0.85) continue;
      const stock = 15 + Math.floor(rint((si + 7) * 500 + pi) * 40);
      ops.push({
        updateOne: {
          filter: { store: st._id, product: allInProducts[pi]._id },
          update: { $set: { stock, isActive: true, lowStockAt: 5 }, $setOnInsert: { store: st._id, product: allInProducts[pi]._id } },
          upsert: true,
        },
      });
    }
    const r = await StoreInventory.bulkWrite(ops, { ordered: false });
    console.log(`   ${st.code}: ${(r.upsertedCount || 0) + (r.modifiedCount || 0)} items on shelf`);
  }

  console.log("\ndone. Undo with:  node src/scripts/seed-ddgo-catalogue.js --undo");
  await mongoose.disconnect();
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
