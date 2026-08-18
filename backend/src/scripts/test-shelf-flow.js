/**
 * End-to-end check of the stocking flow, against the real store the owner made.
 *
 * Stocks a product, confirms a customer standing inside the radius sees it with
 * the store's own price, confirms someone outside sees nothing, then puts the
 * shelf back exactly as it was. The store itself is never modified.
 *
 *   node src/scripts/test-shelf-flow.js
 */
require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/damndeal");
  const DarkStore = require("../models/DarkStore");
  const StoreInventory = require("../models/StoreInventory");
  const Product = require("../models/Product");
  const { storesCovering } = require("../services/serviceability.service");

  const store = await DarkStore.findOne({ code: "T122" });
  if (!store) { console.log("store T122 not found"); return mongoose.disconnect(); }

  const [lng, lat] = store.location.coordinates;
  console.log(`store: ${store.name} [${store.code}]  ${lat},${lng}  radius ${store.radiusKm}km  region ${store.regions}\n`);

  const product = await Product.findOne({ platform: "ddgo", isActive: true });
  if (!product) { console.log("no active ddgo product to stock"); return mongoose.disconnect(); }
  console.log(`product: ${product.name}  catalogue price ${product.sellingPrice}\n`);

  const had = await StoreInventory.findOne({ store: store._id, product: product._id }).lean();

  // Stock it the way the picker does.
  await StoreInventory.findOneAndUpdate(
    { store: store._id, product: product._id },
    { $set: { stock: 12, sellingPrice: product.sellingPrice + 5, isActive: true },
      $setOnInsert: { store: store._id, product: product._id } },
    { upsert: true, new: true }
  );
  console.log("stocked 12 units at catalogue+5\n");

  // What a customer standing at the store's own pin would be offered.
  for (const [label, plat] of [["store region", store.regions[0]], ["other region", store.regions[0] === "IN" ? "US" : "IN"]]) {
    const covering = await storesCovering({ lat, lng, region: plat });
    const mine = covering.find((c) => String(c.id) === String(store._id));
    console.log(`at the pin, region ${plat} (${label}) -> ${mine ? "SERVICEABLE, ETA " + mine.etaMins + "m" : "not covered"}`);
  }

  const far = await storesCovering({ lat: lat + 0.2, lng, region: store.regions[0] });
  console.log(`~22 km away -> ${far.length ? "covered (unexpected)" : "not covered, correct"}\n`);

  const shelf = await StoreInventory.find({ store: store._id, isActive: true, stock: { $gt: 0 } })
    .populate("product", "name sellingPrice").lean();
  console.log("browse would list:");
  shelf.forEach((r) => console.log(`   ${r.product.name}  stock ${r.stock}  price ${r.sellingPrice > 0 ? r.sellingPrice : r.product.sellingPrice}`));

  // Restore
  if (had) {
    await StoreInventory.updateOne({ _id: had._id },
      { $set: { stock: had.stock, sellingPrice: had.sellingPrice, isActive: had.isActive } });
    console.log("\nrestored the shelf row to what it was");
  } else {
    await StoreInventory.deleteOne({ store: store._id, product: product._id });
    console.log("\nremoved the test shelf row");
  }
  console.log("shelf rows now:", await StoreInventory.countDocuments({ store: store._id }));
  await mongoose.disconnect();
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
