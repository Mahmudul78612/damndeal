/**
 * Throwaway check for per-store shelves.
 *
 * The question this answers: do two stores really hold the same product
 * independently, and does selling the last unit at one leave the other alone.
 * Creates its own stores, its own product and its own shelf rows, then deletes
 * all of them. Nothing pre-existing is written.
 *
 *   node src/scripts/test-store-inventory.js
 */
require("dotenv").config();
const mongoose = require("mongoose");

const TAG = "ZZ-INV-TEST";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/damndeal");
  const DarkStore = require("../models/DarkStore");
  const StoreInventory = require("../models/StoreInventory");
  const Product = require("../models/Product");
  const Category = require("../models/Category");
  const User = require("../models/User");

  const clean = async () => {
    const stores = await DarkStore.find({ code: /^ZZINV/ }).select("_id").lean();
    await StoreInventory.deleteMany({ store: { $in: stores.map((s) => s._id) } });
    await DarkStore.deleteMany({ code: /^ZZINV/ });
    await Product.deleteMany({ name: TAG });
  };
  await clean();

  const cat = await Category.findOne({ platform: "ddgo" }).select("_id").lean();
  const owner = await User.findOne().select("_id").lean();

  const a = await DarkStore.create({
    name: "ZZ Store A", code: "ZZINVA",
    location: { type: "Point", coordinates: [76.3869, 30.3398] },
    radiusKm: 5, city: "Patiala", alwaysOpen: true, regions: ["IN"],
  });
  const b = await DarkStore.create({
    name: "ZZ Store B", code: "ZZINVB",
    location: { type: "Point", coordinates: [76.5000, 30.4500] },
    radiusKm: 5, city: "Patiala", alwaysOpen: true, regions: ["IN"],
  });

  const product = await Product.create({
    name: TAG, platform: "ddgo", category: cat?._id, partner: owner?._id,
    price: 60, mrp: 60, sellingPrice: 50, costPrice: 30,
    stock: 100, images: [], isActive: true, approvalStatus: "approved", regions: ["IN"],
  });
  console.log("catalogue stock:", product.stock, "| catalogue price:", product.sellingPrice, "\n");

  // Store A: 3 units at its own price. Store B: 10 units, catalogue price.
  await StoreInventory.create({ store: a._id, product: product._id, stock: 3, sellingPrice: 55 });
  await StoreInventory.create({ store: b._id, product: product._id, stock: 10, sellingPrice: 0 });

  const show = async (label) => {
    const ra = await StoreInventory.findOne({ store: a._id, product: product._id }).lean();
    const rb = await StoreInventory.findOne({ store: b._id, product: product._id }).lean();
    const p = await Product.findById(product._id).select("stock").lean();
    console.log(`${label}  A=${ra.stock}  B=${rb.stock}  catalogue=${p.stock}`);
  };
  await show("start           ");

  // The guarded decrement the order flow uses.
  const sell = (store, qty) =>
    StoreInventory.findOneAndUpdate(
      { store, product: product._id, stock: { $gte: qty } },
      { $inc: { stock: -qty } },
      { new: true }
    );

  await sell(a._id, 2);
  await show("A sells 2       ");

  const over = await sell(a._id, 5);
  console.log(`A tries to sell 5 with 1 left -> ${over ? "ALLOWED (WRONG)" : "refused, correct"}`);
  await show("after refusal   ");

  await sell(a._id, 1);
  await show("A sells its last");
  console.log("   -> B still has its own stock, and the catalogue never moved\n");

  // Price resolution: 0 means "use the catalogue".
  const ra = await StoreInventory.findOne({ store: a._id, product: product._id }).lean();
  const rb = await StoreInventory.findOne({ store: b._id, product: product._id }).lean();
  console.log("price at A:", ra.sellingPrice > 0 ? ra.sellingPrice : product.sellingPrice, "(own override)");
  console.log("price at B:", rb.sellingPrice > 0 ? rb.sellingPrice : product.sellingPrice, "(falls back to catalogue)");

  // The browse query: only what is on the shelf and in stock.
  const shelfA = await StoreInventory.find({ store: a._id, isActive: true, stock: { $gt: 0 } }).lean();
  const shelfB = await StoreInventory.find({ store: b._id, isActive: true, stock: { $gt: 0 } }).lean();
  console.log(`\nbrowse at A -> ${shelfA.length} item(s) (sold out, so hidden)`);
  console.log(`browse at B -> ${shelfB.length} item(s)`);

  // One row per product per store, enforced by the index.
  let dup = "allowed (WRONG)";
  try {
    await StoreInventory.create({ store: a._id, product: product._id, stock: 99 });
  } catch (e) {
    dup = e.code === 11000 ? "rejected by the unique index, correct" : "rejected: " + e.message;
  }
  console.log("duplicate shelf row ->", dup);

  await clean();
  console.log("\ncleaned up:",
    await DarkStore.countDocuments({ code: /^ZZINV/ }), "stores,",
    await Product.countDocuments({ name: TAG }), "products left");
  await mongoose.disconnect();
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
