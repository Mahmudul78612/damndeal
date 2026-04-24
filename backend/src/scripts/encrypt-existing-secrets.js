/**
 * One-shot migration: encrypt all existing plaintext secret AppSettings.
 * Safe to run multiple times — already-encrypted values are skipped.
 *
 * Usage on server:
 *   cd /var/www/damndeal && node src/scripts/encrypt-existing-secrets.js
 */
require("dotenv").config({ path: "/var/www/damndeal/.env" });
const mongoose = require("mongoose");
const AppSettings = require("../models/AppSettings");
const secrets = require("../utils/secrets");

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI missing");
    process.exit(1);
  }
  if (!process.env.SETTINGS_ENCRYPTION_KEY) {
    console.error("SETTINGS_ENCRYPTION_KEY missing — refusing to run.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  let scanned = 0, encrypted = 0, alreadyEnc = 0, skippedEmpty = 0;
  const docs = await AppSettings.find({ key: { $in: Array.from(secrets.SECRET_KEYS) } });
  for (const d of docs) {
    scanned++;
    if (typeof d.value !== "string" || d.value === "") { skippedEmpty++; continue; }
    if (secrets.isEncrypted(d.value)) { alreadyEnc++; continue; }
    const enc = secrets.encrypt(d.value);
    if (enc === d.value) { console.warn("! could not encrypt", d.key); continue; }
    await AppSettings.updateOne({ _id: d._id }, { $set: { value: enc } });
    console.log("✓ encrypted", d.key, "→", enc.slice(0, 30) + "...");
    encrypted++;
  }
  console.log(`\nDone. scanned=${scanned} encrypted=${encrypted} alreadyEncrypted=${alreadyEnc} empty=${skippedEmpty}`);
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
