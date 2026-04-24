require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./src/models/Product');
const AppSettings = require('./src/models/AppSettings');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const rateDoc = await AppSettings.findOne({ key: 'cj_usd_inr_rate' });
  const usdRate = Number.parseFloat(rateDoc?.value || '84');
  const safeRate = Number.isFinite(usdRate) && usdRate > 0 ? usdRate : 84;

  const products = await Product.find({ source: 'cj', cjCostPrice: { $ne: null } }).select('_id cjCostPrice costPrice name');
  let updated = 0;

  for (const p of products) {
    const usd = Number.parseFloat(p.cjCostPrice);
    if (!Number.isFinite(usd) || usd <= 0) continue;
    const inr = Math.round(usd * safeRate * 100) / 100;
    if (Number.parseFloat(p.costPrice || 0) !== inr) {
      p.costPrice = inr;
      await p.save();
      updated += 1;
    }
  }

  console.log(JSON.stringify({ total: products.length, updated, usdRate: safeRate }));
  process.exit(0);
})();
