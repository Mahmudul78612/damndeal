// One-off: clean up products imported from DeoDap/Shopify CSV that got
//   - weight = shipping grams (Variant Grams) → reset to null
//   - brand = vendor domain (e.g. "ediscountshops.com") → reset to null
require("dotenv").config({ path: "/var/www/damndeal/.env" });
const mongoose = require("mongoose");

(async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/damndeal";
  await mongoose.connect(uri);
  const Product = require("/var/www/damndeal/src/models/Product");

  // Reset weight on every product (we no longer surface package weight)
  const w = await Product.updateMany({ weight: { $ne: null } }, { $set: { weight: null } });

  // Strip domain-looking brands (no spaces + contains a dot)
  const dom = await Product.updateMany(
    { brand: { $regex: /^[^\s]+\.[^\s]+$/ } },
    { $set: { brand: null } }
  );

  console.log("weight cleared:", w.modifiedCount, "domain brand cleared:", dom.modifiedCount);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
