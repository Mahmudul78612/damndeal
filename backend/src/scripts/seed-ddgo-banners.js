/**
 * Placeholder DDGo promo banners so the home carousel has something to show.
 * Replace the images from Admin -> Banners (platform = ddgo). Tagged so
 * --undo removes exactly these.
 *
 *   node src/scripts/seed-ddgo-banners.js
 *   node src/scripts/seed-ddgo-banners.js --undo
 */
require("dotenv").config();
const mongoose = require("mongoose");

const TAG = "[DDGO-PLACEHOLDER]";
const BANNERS = [
  { title: TAG + " Fresh in minutes", image: "https://loremflickr.com/1200/460/grocery,fresh", linkType: "none", linkValue: "" },
  { title: TAG + " Big savings", image: "https://loremflickr.com/1200/460/supermarket,sale", linkType: "none", linkValue: "" },
  { title: TAG + " Daily essentials", image: "https://loremflickr.com/1200/460/vegetables,fruit", linkType: "none", linkValue: "" },
];

async function main() {
  const undo = process.argv.includes("--undo");
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/damndeal");
  const Banner = require("../models/Banner");

  if (undo) {
    const r = await Banner.deleteMany({ title: new RegExp("\\" + "[DDGO-PLACEHOLDER\]") });
    console.log(`removed ${r.deletedCount} placeholder banners`);
    return mongoose.disconnect();
  }

  let n = 0;
  for (let i = 0; i < BANNERS.length; i++) {
    const b = BANNERS[i];
    await Banner.findOneAndUpdate(
      { title: b.title },
      { $set: { ...b, platform: "ddgo", placement: "home_top", regions: ["IN", "US"], isActive: true, sortOrder: i } },
      { upsert: true }
    );
    n++;
  }
  console.log(`seeded ${n} DDGo placeholder banners (IN + US)`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
