/**
 * Migrate the per-user claim slot index to a partial one, and backfill
 * expiresAt on claims made before validity windows existed.
 *
 * Why: {campaign,user,slot} was unique across every claim, so an expired code
 * kept holding its slot and the customer could never claim that offer again.
 * The index now only covers live claims (claimed / redeemed), which is what
 * releases the slot when a code expires unused.
 *
 * Mongoose cannot alter an existing index in place — it has to be dropped and
 * rebuilt, which is what this does. Safe to run more than once.
 *
 *   node src/scripts/reindex-coupon-claim-slot.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { CouponClaim, CouponCampaign } = require("../models/coupon.models");

const OLD = "campaign_1_user_1_slot_1";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/damndeal");
  console.log("connected");

  const coll = CouponClaim.collection;
  const before = await coll.indexes();
  const existing = before.find((i) => i.name === OLD);
  console.log("current slot index:", existing ? JSON.stringify(existing) : "(none)");

  if (existing && !existing.partialFilterExpression) {
    await coll.dropIndex(OLD);
    console.log("dropped the full unique index");
  }

  await coll.createIndex(
    { campaign: 1, user: 1, slot: 1 },
    { unique: true, partialFilterExpression: { status: { $in: ["claimed", "redeemed"] } } }
  );
  console.log("created the partial unique index");

  // Backfill: claims issued before this feature have no deadline of their own,
  // so they inherit their campaign's end date — exactly how they behaved.
  const open = await CouponClaim.find({ status: "claimed", expiresAt: null })
    .select("_id campaign")
    .lean();
  console.log(`backfilling expiresAt on ${open.length} live claims`);

  const ends = new Map();
  let filled = 0;
  for (const claim of open) {
    const key = String(claim.campaign);
    if (!ends.has(key)) {
      const c = await CouponCampaign.findById(claim.campaign).select("endAt").lean();
      ends.set(key, c?.endAt || null);
    }
    const endAt = ends.get(key);
    if (!endAt) continue;
    await CouponClaim.updateOne({ _id: claim._id }, { $set: { expiresAt: endAt } });
    filled++;
  }
  console.log(`backfilled ${filled}`);

  const after = await coll.indexes();
  console.log("final slot index:", JSON.stringify(after.find((i) => i.name === OLD)));
  await mongoose.disconnect();
  console.log("done");
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
