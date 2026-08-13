#!/usr/bin/env node
/**
 * Phase 0 migration — run ONCE before deploying the hardened coupon code.
 *
 *   node scripts/phase0-coupon-hardening.js --dry-run
 *   node scripts/phase0-coupon-hardening.js
 *
 * 1. Backfills CouponClaim.slot so the new unique {campaign,user,slot} index
 *    can be built without collisions (a user with 2 claims on one campaign
 *    would otherwise collide on slot:null).
 * 2. Hashes every plaintext CouponVendor.apiKey in place. Existing merchant
 *    integrations keep working — the same key now matches by hash — but the
 *    clear value is removed from the database.
 * 3. Creates the new indexes explicitly so a failure is visible here rather
 *    than silently at boot.
 */
require("dotenv").config();
const crypto = require("crypto");
const mongoose = require("mongoose");

const DRY = process.argv.includes("--dry-run");
const log = (...a) => console.log(DRY ? "[dry-run]" : "[migrate]", ...a);

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const { CouponClaim, CouponVendor } = require("../src/models/coupon.models");

  // ── 1. slot backfill ──────────────────────────────────────────────────────
  const groups = await CouponClaim.aggregate([
    { $group: { _id: { campaign: "$campaign", user: "$user" }, ids: { $push: "$_id" }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 0 } } },
  ]);
  let slotted = 0, multi = 0;
  for (const g of groups) {
    if (g.n > 1) multi++;
    // Deterministic order: oldest claim keeps slot 0
    const docs = await CouponClaim.find({ _id: { $in: g.ids } }).sort({ createdAt: 1 }).select("_id slot").lean();
    for (let i = 0; i < docs.length; i++) {
      if (docs[i].slot === i) continue;
      slotted++;
      if (!DRY) await CouponClaim.updateOne({ _id: docs[i]._id }, { $set: { slot: i } });
    }
  }
  log(`claims: ${groups.length} campaign+user groups, ${multi} with multiple claims, ${slotted} slot values written`);

  // ── 2. API key hashing ────────────────────────────────────────────────────
  const withKeys = await CouponVendor.find({ apiKey: { $ne: null, $exists: true } }).select("_id businessName apiKey apiKeyHash");
  let hashed = 0;
  for (const v of withKeys) {
    if (!v.apiKey) continue;
    const hash = crypto.createHash("sha256").update(v.apiKey).digest("hex");
    const prefix = v.apiKey.slice(0, 12);
    hashed++;
    log(`  hashing key for "${v.businessName}" (${prefix}…) — key keeps working`);
    if (!DRY) {
      await CouponVendor.updateOne(
        { _id: v._id },
        { $set: { apiKeyHash: hash, apiKeyPrefix: prefix, apiKey: null } }
      );
    }
  }
  log(`api keys: ${hashed} hashed`);

  // ── 3. indexes ────────────────────────────────────────────────────────────
  if (!DRY) {
    await CouponClaim.collection.createIndex({ campaign: 1, user: 1, slot: 1 }, { unique: true });
    await CouponClaim.collection.createIndex({ user: 1, createdAt: -1 });
    await CouponClaim.collection.createIndex({ vendor: 1, status: 1 });
    await CouponVendor.collection.createIndex({ apiKeyHash: 1 });
    log("indexes created");
  } else {
    log("indexes: would create {campaign,user,slot} unique, {user,createdAt}, {vendor,status}, {apiKeyHash}");
  }

  log("done");
  process.exit(0);
})().catch((e) => {
  console.error("[migrate] FAILED:", e);
  process.exit(1);
});
