/**
 * Coupons — vendor portal API (brand/doctor/shop side).
 * Vendors sign in with their DamnDeal account; a CouponVendor profile is
 * linked to the user. Verification of customer codes happens here (portal)
 * or via API key (verifyApi.controller).
 */
const crypto = require("crypto");
const {
  CouponCategory, CouponVendor, CouponCampaign, CouponClaim, CouponPackOrder,
} = require("../../models/coupon.models");
const events = require("../../services/couponEvents.service");
const { CouponDailyStat } = require("../../models/couponAnalytics.models");

const R = (req) => (req.region === "US" ? "US" : "IN");
const slugify = (s) =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) ||
  crypto.randomBytes(4).toString("hex");

async function uniqueSlug(Model, base) {
  let slug = base, i = 1;
  while (await Model.exists({ slug })) slug = `${base}-${++i}`;
  return slug;
}

/* POST /api/coupons/vendor/register */
async function register(req, res) {
  const userId = req.user.userId;
  const existing = await CouponVendor.findOne({ user: userId });
  if (existing) return res.json({ success: true, vendor: existing, existed: true });
  const { businessName, description = "", website = "", phone = "", email = "", address = "", state = "", city = "", categories = [], logo = "" } = req.body;
  if (!businessName || !String(businessName).trim()) {
    return res.status(400).json({ success: false, message: "Business name is required" });
  }
  const vendor = await CouponVendor.create({
    user: userId,
    businessName: String(businessName).trim(),
    slug: await uniqueSlug(CouponVendor, slugify(businessName)),
    description, website, phone, email, address, state, city, logo,
    categories: Array.isArray(categories) ? categories : [],
    regions: [R(req)],
  });
  return res.status(201).json({ success: true, vendor });
}

async function requireVendor(req, res) {
  const vendor = await CouponVendor.findOne({ user: req.user.userId });
  if (!vendor) { res.status(404).json({ success: false, message: "Vendor profile not found — register first", needsRegistration: true }); return null; }
  if (vendor.status === "suspended") { res.status(403).json({ success: false, message: "Your vendor account is suspended" }); return null; }
  return vendor;
}

/* GET /api/coupons/vendor/me */
async function me(req, res) {
  const vendor = await CouponVendor.findOne({ user: req.user.userId }).populate("categories", "name slug");
  if (!vendor) return res.json({ success: true, vendor: null });
  return res.json({ success: true, vendor });
}

/* PUT /api/coupons/vendor/me */
async function updateMe(req, res) {
  const vendor = await requireVendor(req, res); if (!vendor) return;
  const allowed = ["businessName", "description", "website", "phone", "email", "address", "state", "city", "lat", "lng", "logo", "categories"];
  for (const k of allowed) if (req.body[k] !== undefined) vendor[k] = req.body[k];
  await vendor.save();
  return res.json({ success: true, vendor });
}

/* ── Campaigns ────────────────────────────────────────────────────────────── */

/* POST /api/coupons/vendor/campaigns */
async function createCampaign(req, res) {
  const vendor = await requireVendor(req, res); if (!vendor) return;
  const {
    title, category, offerType = "percent", offerValue = 0, offerText,
    description = "", instructions = "", terms = "", bannerImage = "", isOnline = false, redirectUrl = "",
    totalQuota = 50, perUserLimit = 1, endAt, location = {},
  } = req.body;

  // Location targeting — nationwide, or specific states/city (+ optional geo point)
  const loc = {
    nationwide: location.nationwide !== false,
    states: Array.isArray(location.states) ? location.states.filter(Boolean).slice(0, 10) : [],
    city: String(location.city || "").trim(),
    radiusKm: Math.min(200, Math.max(0, parseFloat(location.radiusKm) || 0)),
  };
  const lat = parseFloat(location.lat), lng = parseFloat(location.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    loc.point = { type: "Point", coordinates: [lng, lat] };
  }
  if (!loc.nationwide && !loc.states.length && !loc.point) {
    return res.status(400).json({ success: false, message: "Pick at least one state (or your location) for a local offer" });
  }
  if (!title || !offerText || !category || !endAt) {
    return res.status(400).json({ success: false, message: "title, offerText, category and endAt are required" });
  }
  const quota = Math.max(1, parseInt(totalQuota) || 50);
  if (quota > vendor.claimCredits) {
    return res.status(402).json({
      success: false, code: "INSUFFICIENT_CREDITS",
      message: `You have ${vendor.claimCredits} coupon credits — buy a pack to list ${quota} coupons.`,
    });
  }
  const campaign = await CouponCampaign.create({
    vendor: vendor._id, title: String(title).trim(),
    slug: await uniqueSlug(CouponCampaign, slugify(`${vendor.businessName}-${title}`)),
    category, offerType, offerValue, offerText: String(offerText).trim(),
    description, instructions, terms, bannerImage, isOnline: !!isOnline, redirectUrl,
    totalQuota: quota, perUserLimit: Math.max(1, parseInt(perUserLimit) || 1),
    location: loc,
    endAt: new Date(endAt), regions: vendor.regions.length ? vendor.regions : [R(req)],
    status: "pending", // admin approves → active
  });
  vendor.claimCredits -= quota;
  await vendor.save();
  return res.status(201).json({ success: true, campaign, message: "Submitted for review" });
}

/* GET /api/coupons/vendor/campaigns */
async function myCampaigns(req, res) {
  const vendor = await requireVendor(req, res); if (!vendor) return;
  const items = await CouponCampaign.find({ vendor: vendor._id })
    .populate("category", "name slug").sort({ createdAt: -1 }).lean();
  return res.json({ success: true, items, claimCredits: vendor.claimCredits });
}

/* PATCH /api/coupons/vendor/campaigns/:id — pause/resume/edit basic fields */
async function updateCampaign(req, res) {
  const vendor = await requireVendor(req, res); if (!vendor) return;
  const c = await CouponCampaign.findOne({ _id: req.params.id, vendor: vendor._id });
  if (!c) return res.status(404).json({ success: false, message: "Campaign not found" });
  const { action } = req.body;
  if (action === "pause" && c.status === "active") c.status = "paused";
  else if (action === "resume" && c.status === "paused") c.status = "active";
  const editable = ["description", "instructions", "terms", "bannerImage", "redirectUrl", "endAt"];
  for (const k of editable) if (req.body[k] !== undefined) c[k] = req.body[k];
  await c.save();
  return res.json({ success: true, campaign: c });
}

/* GET /api/coupons/vendor/stats */
async function stats(req, res) {
  const vendor = await requireVendor(req, res); if (!vendor) return;
  const [campaigns, claims, redeemed, recent] = await Promise.all([
    CouponCampaign.countDocuments({ vendor: vendor._id }),
    CouponClaim.countDocuments({ vendor: vendor._id }),
    CouponClaim.countDocuments({ vendor: vendor._id, status: "redeemed" }),
    CouponClaim.find({ vendor: vendor._id }).populate("campaign", "title offerText")
      .sort({ createdAt: -1 }).limit(10).select("code status claimedAt redeemedAt campaign").lean(),
  ]);
  return res.json({
    success: true,
    stats: { campaigns, claims, redeemed, redemptionRate: claims ? Math.round((redeemed / claims) * 100) : 0, claimCredits: vendor.claimCredits },
    recent,
  });
}

/* GET /api/coupons/vendor/analytics?days=30
   Funnel from the pre-aggregated daily rows, plus a per-campaign breakdown.
   Reads CouponDailyStat only — never the raw event collection — so the range
   query stays cheap as volume grows. Today is not rolled up yet, so live
   counters are added on top for the current day. */
async function analytics(req, res) {
  const vendor = await requireVendor(req, res); if (!vendor) return;
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
  const since = new Date(Date.now() - (days - 1) * 86400000);
  const sinceStr = since.toISOString().slice(0, 10);

  const rows = await CouponDailyStat.find({ vendor: vendor._id, date: { $gte: sinceStr } })
    .sort({ date: 1 }).lean();

  const totals = { impressions: 0, views: 0, clicks: 0, claims: 0, redemptions: 0 };
  const byDate = {};
  const byCampaign = {};
  for (const r of rows) {
    for (const k of Object.keys(totals)) totals[k] += r[k] || 0;
    const d = (byDate[r.date] = byDate[r.date] || { date: r.date, impressions: 0, views: 0, clicks: 0, claims: 0, redemptions: 0 });
    const c = (byCampaign[r.campaign] = byCampaign[r.campaign] || { campaign: r.campaign, impressions: 0, views: 0, clicks: 0, claims: 0, redemptions: 0 });
    for (const k of Object.keys(totals)) { d[k] += r[k] || 0; c[k] += r[k] || 0; }
  }

  // Attach campaign titles for the breakdown table
  const ids = Object.keys(byCampaign);
  if (ids.length) {
    const titles = await CouponCampaign.find({ _id: { $in: ids } }).select("title offerText").lean();
    const map = Object.fromEntries(titles.map((t) => [String(t._id), t]));
    for (const id of ids) {
      byCampaign[id].title = map[id]?.title || "(deleted)";
      byCampaign[id].offerText = map[id]?.offerText || "";
    }
  }

  return res.json({
    success: true,
    days,
    totals: {
      ...totals,
      claimRate: totals.views ? Math.round((totals.claims / totals.views) * 100) : 0,
      redemptionRate: totals.claims ? Math.round((totals.redemptions / totals.claims) * 100) : 0,
    },
    series: Object.values(byDate),
    campaigns: Object.values(byCampaign).sort((a, b) => b.claims - a.claims),
  });
}

/* ── Verify / redeem (vendor portal — for shops without a website) ────────── */

async function findClaimForVendor(vendor, code) {
  return CouponClaim.findOne({ code: String(code).trim().toUpperCase(), vendor: vendor._id })
    .populate("campaign", "title offerText endAt")
    .populate("user", "name phone");
}

/* POST /api/coupons/vendor/verify { code } — look up, don't consume */
async function verifyCode(req, res) {
  const vendor = await requireVendor(req, res); if (!vendor) return;
  const claim = await findClaimForVendor(vendor, req.body.code || "");
  if (!claim) return res.status(404).json({ success: false, valid: false, message: "Code not found for your business" });
  const expired = claim.campaign?.endAt && claim.campaign.endAt < new Date();
  return res.json({
    success: true,
    valid: claim.status === "claimed" && !expired,
    status: expired && claim.status === "claimed" ? "expired" : claim.status,
    claim: {
      code: claim.code, status: claim.status, claimedAt: claim.claimedAt, redeemedAt: claim.redeemedAt,
      customer: { name: claim.user?.name || "Customer", phone: claim.user?.phone || "" },
      campaign: { title: claim.campaign?.title, offerText: claim.campaign?.offerText, endAt: claim.campaign?.endAt },
    },
  });
}

/* POST /api/coupons/vendor/redeem { code } — consume (single use) */
async function redeemCode(req, res) {
  const vendor = await requireVendor(req, res); if (!vendor) return;
  const claim = await findClaimForVendor(vendor, req.body.code || "");
  if (!claim) return res.status(404).json({ success: false, message: "Code not found for your business" });
  if (claim.status === "redeemed") return res.status(409).json({ success: false, message: `Already redeemed on ${claim.redeemedAt?.toLocaleString()}` });
  if (claim.status !== "claimed") return res.status(410).json({ success: false, message: `This coupon is ${claim.status}` });
  if (claim.campaign?.endAt && claim.campaign.endAt < new Date()) return res.status(410).json({ success: false, message: "This coupon has expired" });

  // Single atomic flip — two cashiers scanning the same code at the same
  // moment must produce exactly one redemption.
  const redeemedAt = new Date();
  const won = await CouponClaim.findOneAndUpdate(
    { _id: claim._id, status: "claimed" },
    { $set: { status: "redeemed", redeemedAt, redeemedVia: "portal" } },
    { new: true }
  );
  if (!won) {
    const now = await CouponClaim.findById(claim._id).select("redeemedAt").lean();
    return res.status(409).json({
      success: false,
      message: `Already redeemed${now?.redeemedAt ? ` on ${now.redeemedAt.toLocaleString()}` : ""}`,
    });
  }

  await CouponCampaign.updateOne({ _id: claim.campaign._id }, { $inc: { redeemedCount: 1 } });
  events.track("redeem", {
    campaign: claim.campaign._id, vendor: vendor._id,
    user: claim.user?._id || claim.user, region: won.region, source: "portal",
  });
  return res.json({ success: true, message: "Redeemed — apply the offer!", claim: { code: won.code, redeemedAt: won.redeemedAt } });
}

/* ── API key + packs ──────────────────────────────────────────────────────── */

/* POST /api/coupons/vendor/api-key — generate/rotate */
async function rotateApiKey(req, res) {
  const vendor = await requireVendor(req, res); if (!vendor) return;
  // Generate once, hand it back once — only the hash is persisted.
  const key = "dck_" + crypto.randomBytes(24).toString("hex");
  vendor.apiKeyHash = crypto.createHash("sha256").update(key).digest("hex");
  vendor.apiKeyPrefix = key.slice(0, 12);
  vendor.apiKey = null; // never store the clear key again
  vendor.apiKeyCreatedAt = new Date();
  await vendor.save();
  return res.json({
    success: true,
    apiKey: key,
    message: "Copy this key now — it is shown only once and cannot be recovered.",
  });
}

/* GET /api/coupons/vendor/packs — category pack pricing for vendor's region */
async function packs(req, res) {
  const region = R(req);
  const cats = await CouponCategory.find({ isActive: true, regions: region, "packs.0": { $exists: true } })
    .select("name slug icon packs").lean();
  return res.json({ success: true, region, currency: region === "US" ? "USD" : "INR", categories: cats });
}

/* POST /api/coupons/vendor/packs { categoryId, claims } → pending order */
async function buyPack(req, res) {
  const vendor = await requireVendor(req, res); if (!vendor) return;
  const region = R(req);
  const cat = await CouponCategory.findById(req.body.categoryId);
  const pack = cat?.packs?.find((p) => p.claims === Number(req.body.claims));
  if (!cat || !pack) return res.status(400).json({ success: false, message: "Pack not found" });
  const order = await CouponPackOrder.create({
    vendor: vendor._id, category: cat._id, claims: pack.claims,
    price: region === "US" ? pack.priceUSD : pack.priceINR,
    currency: region === "US" ? "USD" : "INR", region,
  });
  return res.status(201).json({
    success: true, order,
    message: "Pack order placed — our team will contact you to complete payment, then credits are added instantly.",
  });
}

/* GET /api/coupons/vendor/pack-orders */
async function myPackOrders(req, res) {
  const vendor = await requireVendor(req, res); if (!vendor) return;
  const items = await CouponPackOrder.find({ vendor: vendor._id }).populate("category", "name").sort({ createdAt: -1 }).lean();
  return res.json({ success: true, items });
}

module.exports = {
  register, me, updateMe, createCampaign, myCampaigns, updateCampaign, stats, analytics,
  verifyCode, redeemCode, rotateApiKey, packs, buyPack, myPackOrders,
};
