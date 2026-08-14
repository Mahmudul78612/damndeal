/**
 * Coupon lifecycle sweeps.
 *
 * Two deadlines are enforced here rather than at read time, because both have
 * to move money-like state (quota slots and vendor credits) exactly once:
 *
 *   1. A claimed code that was never redeemed inside its validity window
 *      expires, and its slot goes back to the campaign's quota — the offer
 *      keeps circulating instead of being held hostage by no-shows.
 *
 *   2. A campaign that reaches its end date expires, and whatever quota was
 *      never claimed is credited back to the vendor. `creditsRefundedAt`
 *      makes that payout idempotent: a re-run, a later reject, or a restart
 *      all read the same flag.
 *
 * Both sweeps are safe to run as often as you like and safe to interrupt.
 */
const { CouponCampaign, CouponClaim, CouponVendor } = require("../models/coupon.models");

/**
 * Expire claims whose validity window has passed, returning each slot to its
 * campaign. Claims are handled one at a time on purpose — the campaign
 * decrement has to pair with exactly one claim flip, and a bulk updateMany
 * cannot tell us which campaigns to credit back.
 */
async function expireStaleClaims(limit = 500) {
  const now = new Date();
  const due = await CouponClaim.find({
    status: "claimed",
    expiresAt: { $ne: null, $lt: now },
  })
    .select("_id campaign")
    .limit(limit)
    .lean();

  let expired = 0;
  for (const claim of due) {
    // Guarded flip: if a cashier redeemed it a moment ago, this matches
    // nothing and the slot correctly stays spent.
    const won = await CouponClaim.updateOne(
      { _id: claim._id, status: "claimed" },
      { $set: { status: "expired" } }
    );
    if (!won.modifiedCount) continue;
    await CouponCampaign.updateOne(
      { _id: claim.campaign, claimedCount: { $gt: 0 } },
      { $inc: { claimedCount: -1 } }
    );
    expired++;
  }
  return { expired, scanned: due.length };
}

/**
 * Expire finished campaigns and pay the unclaimed quota back as credits.
 */
async function expireFinishedCampaigns(limit = 200) {
  const now = new Date();
  const due = await CouponCampaign.find({
    status: { $in: ["active", "paused"] },
    endAt: { $lt: now },
  })
    .select("_id vendor totalQuota claimedCount creditsRefundedAt")
    .limit(limit)
    .lean();

  let closed = 0;
  let refunded = 0;
  for (const c of due) {
    // Only the transition to expired may trigger a refund, and only from a
    // document that has not been refunded yet — two workers racing here leave
    // exactly one winner.
    const won = await CouponCampaign.findOneAndUpdate(
      { _id: c._id, status: { $in: ["active", "paused"] }, creditsRefundedAt: null },
      { $set: { status: "expired", creditsRefundedAt: now } },
      { new: false }
    ).lean();

    if (!won) {
      // Already expired elsewhere, or previously refunded — just close it.
      await CouponCampaign.updateOne(
        { _id: c._id, status: { $in: ["active", "paused"] } },
        { $set: { status: "expired" } }
      );
      continue;
    }

    closed++;
    const owed = Math.max(0, (won.totalQuota || 0) - (won.claimedCount || 0));
    if (owed > 0) {
      await CouponVendor.updateOne({ _id: won.vendor }, { $inc: { claimCredits: owed } });
      refunded += owed;
    }
  }
  return { closed, refunded };
}

async function runCouponLifecycle() {
  const claims = await expireStaleClaims();
  const campaigns = await expireFinishedCampaigns();
  return { claims, campaigns };
}

module.exports = { runCouponLifecycle, expireStaleClaims, expireFinishedCampaigns };
