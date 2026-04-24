require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const S = mongoose.connection.collection('settings');
  await S.updateOne({ key: 'support_phone' }, { $set: { value: '+91-76968-27211' } }, { upsert: true });
  await S.updateOne({ key: 'support_email' }, { $set: { value: 'info@damndeal.in' } }, { upsert: true });
  const r = await S.find({ key: { $in: ['support_phone', 'support_email'] } }).toArray();
  console.log(r);
  process.exit(0);
})();
