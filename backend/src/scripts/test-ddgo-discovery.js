/**
 * End-to-end check of the shop-first DDGo storefront.
 *
 * Temporarily stocks the real store, walks the same two endpoints the website
 * calls, and puts everything back. The store's own settings are never changed.
 *
 *   node src/scripts/test-ddgo-discovery.js
 */
require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/damndeal");
  const DarkStore = require("../models/DarkStore");
  const StoreInventory = require("../models/StoreInventory");
  const Product = require("../models/Product");

  const store = await DarkStore.findOne({ code: "T122" });
  if (!store) { console.log("no store T122"); return mongoose.disconnect(); }
  const [lng, lat] = store.location.coordinates;
  const region = store.regions[0];
  console.log(`store: ${store.name}  ${lat},${lng}  region ${region}  open=${store.isOpenAt(new Date())}\n`);

  const product = await Product.findOne({ platform: "ddgo", isActive: true, approvalStatus: "approved" });
  if (!product) { console.log("no sellable ddgo product"); return mongoose.disconnect(); }

  const had = await StoreInventory.findOne({ store: store._id, product: product._id }).lean();
  await StoreInventory.findOneAndUpdate(
    { store: store._id, product: product._id },
    { $set: { stock: 7, sellingPrice: 0, isActive: true }, $setOnInsert: { store: store._id, product: product._id } },
    { upsert: true }
  );
  console.log(`stocked "${product.name}" x7\n`);

  // Exactly what GET /user/ddgo/stores does.
  const { storesCovering } = require("../services/serviceability.service");
  const covering = await storesCovering({ lat, lng, region, includeClosed: true });
  console.log("stores covering the pin:");
  for (const c of covering) {
    const n = c.type === "darkstore"
      ? await StoreInventory.countDocuments({ store: c.id, isActive: true, stock: { $gt: 0 } })
      : await Product.countDocuments({ partner: c.partner, platform: "ddgo", isActive: true, approvalStatus: "approved", stock: { $gt: 0 } });
    console.log(`   ${c.name} (${c.type})  ${c.distanceKm}km  ETA ${c.etaMins}m  open=${c.isOpen}  items=${n}`
      + (n === 0 ? "   <- hidden, nothing to sell" : ""));
  }

  // Store detail, and the re-check that stops a bookmarked link working.
  const far = await storesCovering({ lat: lat + 0.2, lng, region, includeClosed: true });
  const stillThere = far.some((c) => String(c.id) === String(store._id));
  console.log(`\nsame store from 22 km away -> ${stillThere ? "VISIBLE (wrong)" : "refused, correct"}`);

  const otherRegion = await storesCovering({ lat, lng, region: region === "IN" ? "US" : "IN", includeClosed: true });
  console.log(`same pin, other region      -> ${otherRegion.length ? "visible (wrong)" : "not visible, correct"}`);

  // Restore
  if (had) {
    await StoreInventory.updateOne({ _id: had._id },
      { $set: { stock: had.stock, sellingPrice: had.sellingPrice, isActive: had.isActive } });
    console.log("\nshelf row restored");
  } else {
    await StoreInventory.deleteOne({ store: store._id, product: product._id });
    console.log("\ntest shelf row removed");
  }
  console.log("shelf rows now:", await StoreInventory.countDocuments({ store: store._id }));
  await mongoose.disconnect();
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
