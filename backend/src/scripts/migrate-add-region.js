// One-off migration: backfill region/country/currency on existing docs.
// Safe to re-run (uses $exists filters; idempotent).
//
// Run from project root so node_modules resolves:
//   cd /var/www/damndeal && node src/scripts/migrate-add-region.js

require("dotenv").config();
const mongoose = require("mongoose");
const { connectDB } = require("../config/db");

const Product = require("../models/Product");
const Order = require("../models/Order");
const Address = require("../models/Address");

async function main() {
  await connectDB();
  console.log("Connected. Starting Phase-1 region backfill...\n");

  const p = await Product.updateMany(
    { regions: { $exists: false } },
    { $set: { regions: ["IN"] } }
  );
  console.log(`Products  → matched ${p.matchedCount}, modified ${p.modifiedCount}`);

  const o = await Order.updateMany(
    { region: { $exists: false } },
    { $set: { region: "IN", currency: "INR" } }
  );
  console.log(`Orders    → matched ${o.matchedCount}, modified ${o.modifiedCount}`);

  const a = await Address.updateMany(
    { country: { $exists: false } },
    { $set: { country: "IN" } }
  );
  console.log(`Addresses → matched ${a.matchedCount}, modified ${a.modifiedCount}`);

  console.log("\nDone.");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
