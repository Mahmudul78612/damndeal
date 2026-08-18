/**
 * Six more DDGo stores around Guwahati, each with a cover photo and a logo,
 * stocked from the existing DDGO- India products, so the owner sees a full
 * store list while testing from Guwahati.
 *
 * All pins are within ~6 km of the owner's location, so an 8 km radius reaches
 * every one of them. Tagged DD-GHY* and safe to re-run / undo.
 *
 *   node src/scripts/seed-ddgo-ghy-stores.js
 *   node src/scripts/seed-ddgo-ghy-stores.js --undo
 */
require("dotenv").config();
const mongoose = require("mongoose");

const cover = (kw) => `https://loremflickr.com/900/500/${kw}`;
const logo = (kw) => `https://loremflickr.com/200/200/${kw}`;

const STORES = [
  { code: "DD-GHY2", name: "DamnDeal Go — Chandmari",   lat: 26.1620, lng: 91.7300, area: "Chandmari",   cover: cover("grocery,store"),    logo: logo("grocery") },
  { code: "DD-GHY3", name: "DamnDeal Go — Ganeshguri",  lat: 26.1350, lng: 91.7555, area: "Ganeshguri",  cover: cover("supermarket"),      logo: logo("shop") },
  { code: "DD-GHY4", name: "DamnDeal Go — Paltan Bazaar",lat: 26.1700, lng: 91.7450, area: "Paltan Bazaar",cover: cover("market,vegetables"),logo: logo("market") },
  { code: "DD-GHY5", name: "DamnDeal Go — Kahilipara",  lat: 26.1300, lng: 91.7255, area: "Kahilipara",  cover: cover("grocery,shelf"),    logo: logo("store") },
  { code: "DD-GHY6", name: "DamnDeal Go — Maligaon",    lat: 26.1500, lng: 91.7150, area: "Maligaon",    cover: cover("groceries"),        logo: logo("basket") },
  { code: "DD-GHY7", name: "DamnDeal Go — Beltola",     lat: 26.1250, lng: 91.7450, area: "Beltola",     cover: cover("supermarket,fruit"),logo: logo("fruit") },
];

async function main() {
  const undo = process.argv.includes("--undo");
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/damndeal");
  const DarkStore = require("../models/DarkStore");
  const StoreInventory = require("../models/StoreInventory");
  const Product = require("../models/Product");

  if (undo) {
    const codes = STORES.map((s) => s.code);
    const stores = await DarkStore.find({ code: { $in: codes } }).select("_id").lean();
    const inv = await StoreInventory.deleteMany({ store: { $in: stores.map((s) => s._id) } });
    const ds = await DarkStore.deleteMany({ code: { $in: codes } });
    console.log(`removed ${ds.deletedCount} stores, ${inv.deletedCount} shelf rows`);
    return mongoose.disconnect();
  }

  const products = await Product.find({ sku: /^DDGO-/, regions: "IN", platform: "ddgo" }).select("_id").lean();
  if (!products.length) { console.log("no DDGO- India products — run seed-ddgo-demo.js first"); return mongoose.disconnect(); }

  let i = 0;
  for (const s of STORES) {
    const doc = await DarkStore.findOneAndUpdate(
      { code: s.code },
      {
        $set: {
          name: s.name, logo: s.logo, coverImage: s.cover, image: s.logo,
          location: { type: "Point", coordinates: [s.lng, s.lat] },
          radiusKm: 8, city: "Guwahati", state: "Assam", address: `${s.area}, Guwahati`,
          alwaysOpen: false, opensAtMin: 7 * 60, closesAtMin: 23 * 60,
          prepTimeMins: 8, regions: ["IN"], isActive: true, isAcceptingOrders: true,
        },
        $setOnInsert: { code: s.code },
      },
      { upsert: true, new: true }
    );
    // Each store carries a rotating slice so shelves differ.
    const slice = products.slice(0, 9 + (i % 8));
    for (const p of slice) {
      await StoreInventory.findOneAndUpdate(
        { store: doc._id, product: p._id },
        { $set: { stock: 20 + (i % 5) * 5, isActive: true, lowStockAt: 5 }, $setOnInsert: { store: doc._id, product: p._id } },
        { upsert: true }
      );
    }
    console.log(`${s.code}  ${s.area}  ${slice.length} items`);
    i++;
  }

  // Give the two original Guwahati stores photos too, so the list is uniform.
  await DarkStore.updateOne({ code: "DD-GHY1" }, { $set: { logo: logo("grocery,green"), coverImage: cover("grocery,fresh") } });
  await DarkStore.updateOne({ code: "DD-DEL1" }, { $set: { logo: logo("supermarket"), coverImage: cover("market,store") } });
  console.log("photos set on DD-GHY1 and DD-DEL1");

  console.log("\ndone. Undo with:  node src/scripts/seed-ddgo-ghy-stores.js --undo");
  await mongoose.disconnect();
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
