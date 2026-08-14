/**
 * Coupons — external verify API (x-api-key).
 * For vendors who have their own website/portal: they call these endpoints
 * from their backend to verify and redeem DamnDeal coupon codes.
 *
 *   POST /api/coupons/api/verify  { code }   header: x-api-key: dck_...
 *   POST /api/coupons/api/redeem  { code }
 */
const crypto = require("crypto");
const { CouponVendor, CouponClaim, CouponCampaign } = require("../../models/coupon.models");
const events = require("../../services/couponEvents.service");

const hashKey = (key) => crypto.createHash("sha256").update(String(key)).digest("hex");

async function requireApiVendor(req, res) {
  const key = req.headers["x-api-key"];
  if (!key) { res.status(401).json({ success: false, message: "Missing x-api-key header" }); return null; }
  // Keys are stored hashed; the legacy plaintext lookup stays as a fallback
  // only until the migration has cleared every old apiKey value.
  const vendor =
    (await CouponVendor.findOne({ apiKeyHash: hashKey(key) })) ||
    (await CouponVendor.findOne({ apiKey: key }));
  if (!vendor) { res.status(401).json({ success: false, message: "Invalid API key" }); return null; }
  if (vendor.status !== "approved") { res.status(403).json({ success: false, message: "Vendor account is not active" }); return null; }
  return vendor;
}

async function findClaim(vendor, code) {
  return CouponClaim.findOne({ code: String(code || "").trim().toUpperCase(), vendor: vendor._id })
    .populate("campaign", "title offerText offerType offerValue endAt");
}

/* POST /api/coupons/api/verify */
async function verify(req, res) {
  const vendor = await requireApiVendor(req, res); if (!vendor) return;
  const claim = await findClaim(vendor, req.body.code);
  if (!claim) return res.status(404).json({ success: false, valid: false, message: "Code not found" });
  const nowTs = new Date();
  const expired =
    (claim.expiresAt && claim.expiresAt < nowTs) ||
    (claim.campaign?.endAt && claim.campaign.endAt < nowTs);
  return res.json({
    success: true,
    valid: claim.status === "claimed" && !expired,
    status: expired && claim.status === "claimed" ? "expired" : claim.status,
    offer: {
      title: claim.campaign?.title,
      offerText: claim.campaign?.offerText,
      offerType: claim.campaign?.offerType,
      offerValue: claim.campaign?.offerValue,
      expiresAt: claim.expiresAt || claim.campaign?.endAt,
    },
    claimedAt: claim.claimedAt,
    redeemedAt: claim.redeemedAt,
  });
}

/* POST /api/coupons/api/redeem — single-use consume */
async function redeem(req, res) {
  const vendor = await requireApiVendor(req, res); if (!vendor) return;
  const claim = await findClaim(vendor, req.body.code);
  if (!claim) return res.status(404).json({ success: false, message: "Code not found" });
  if (claim.status === "redeemed") return res.status(409).json({ success: false, message: "Code already redeemed", redeemedAt: claim.redeemedAt });
  if (claim.status !== "claimed") return res.status(410).json({ success: false, message: `Code is ${claim.status}` });
  if (claim.expiresAt && claim.expiresAt < new Date()) return res.status(410).json({ success: false, message: "Code validity window has passed" });
  if (claim.campaign?.endAt && claim.campaign.endAt < new Date()) return res.status(410).json({ success: false, message: "Coupon expired" });

  // Single atomic flip — concurrent POS calls must yield exactly one redemption.
  const won = await CouponClaim.findOneAndUpdate(
    { _id: claim._id, status: "claimed", $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] },
    { $set: { status: "redeemed", redeemedAt: new Date(), redeemedVia: "api" } },
    { new: true }
  );
  if (!won) {
    const now = await CouponClaim.findById(claim._id).select("redeemedAt").lean();
    return res.status(409).json({ success: false, message: "Code already redeemed", redeemedAt: now?.redeemedAt || null });
  }

  await CouponCampaign.updateOne({ _id: claim.campaign._id }, { $inc: { redeemedCount: 1 } });
  events.track("redeem", {
    campaign: claim.campaign._id, vendor: vendor._id, user: claim.user, region: won.region, source: "api",
  });
  return res.json({
    success: true, redeemed: true, redeemedAt: won.redeemedAt,
    offer: { title: claim.campaign?.title, offerText: claim.campaign?.offerText, offerType: claim.campaign?.offerType, offerValue: claim.campaign?.offerValue },
  });
}

module.exports = { verify, redeem };
