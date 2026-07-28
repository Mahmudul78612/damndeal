// Backfill regions:['IN'] for Category, Banner, HomeSection docs that lack it.
// Run on prod once after deploy:
//   cd /var/www/damndeal && node src/scripts/migrate-region-content.js
require("dotenv").config();
const mongoose = require("mongoose");

const Category = require("../models/Category");
const Banner = require("../models/Banner");
const HomeSection = require("../models/HomeSection");

(async () => {
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017/damndeal";
  await mongoose.connect(uri);
  console.log("Connected:", uri);

  for (const [name, Model] of [["Category", Category], ["Banner", Banner], ["HomeSection", HomeSection]]) {
    const missing = await Model.countDocuments({ $or: [{ regions: { $exists: false } }, { regions: { $size: 0 } }] });
    const r = await Model.updateMany(
      { $or: [{ regions: { $exists: false } }, { regions: { $size: 0 } }] },
      { $set: { regions: ["IN"] } }
    );
    console.log(`${name}: missing=${missing} updated=${r.modifiedCount}`);
  }

  await mongoose.disconnect();
  console.log("Done.");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
