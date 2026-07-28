/**
 * Coupons — admin API (categories + pack pricing, campaign moderation,
 * featuring/sponsoring, vendors, homepage sections, pack orders).
 * Mounted with authenticate + authorize("admin").
 */
const crypto = require("crypto");
const {
  CouponCategory, CouponVendor, CouponCampaign, CouponClaim, CouponSection, CouponPackOrder,
} = require("../../models/coupon.models");

const slugify = (s) =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) ||
  crypto.randomBytes(4).toString("hex");

/* ── Dashboard ── */
async function dashboard(req, res) {
  const [campaigns, pendingCampaigns, vendors, claims, redeemed, pendingPacks] = await Promise.all([
    CouponCampaign.countDocuments(),
    CouponCampaign.countDocuments({ status: "pending" }),
    CouponVendor.countDocuments(),
    CouponClaim.countDocuments(),
    CouponClaim.countDocuments({ status: "redeemed" }),
    CouponPackOrder.countDocuments({ status: "pending" }),
  ]);
  return res.json({ success: true, stats: { campaigns, pendingCampaigns, vendors, claims, redeemed, pendingPacks } });
}

/* ── Categories + pack pricing ── */
async function listCategories(req, res) {
  const items = await CouponCategory.find().sort({ sortOrder: 1 }).lean();
  return res.json({ success: true, items });
}
async function createCategory(req, res) {
  const { name, icon = "🏷️", regions = ["IN", "US"], sortOrder = 0, packs = [] } = req.body;
  if (!name) return res.status(400).json({ success: false, message: "name required" });
  const item = await CouponCategory.create({ name, slug: slugify(name), icon, regions, sortOrder, packs });
  return res.status(201).json({ success: true, item });
}
async function updateCategory(req, res) {
  const item = await CouponCategory.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!item) return res.status(404).json({ success: false, message: "Not found" });
  return res.json({ success: true, item });
}
async function deleteCategory(req, res) {
  await CouponCategory.findByIdAndDelete(req.params.id);
  return res.json({ success: true });
}

/* ── Campaigns (moderation + featuring) ── */
async function listCampaigns(req, res) {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.region) filter.regions = req.query.region;
  const items = await CouponCampaign.find(filter)
    .populate("vendor", "businessName slug").populate("category", "name")
    .sort({ createdAt: -1 }).limit(200).lean();
  return res.json({ success: true, items });
}
async function moderateCampaign(req, res) {
  const { action, reason = "", featuredDays } = req.body; // approve | reject | feature | unfeature | expire
  const c = await CouponCampaign.findById(req.params.id);
  if (!c) return res.status(404).json({ success: false, message: "Not found" });
  if (action === "approve") { c.status = "active"; c.rejectReason = ""; }
  else if (action === "reject") {
    c.status = "rejected"; c.rejectReason = reason;
    // return the reserved credits to the vendor
    await CouponVendor.updateOne({ _id: c.vendor }, { $inc: { claimCredits: c.totalQuota } });
  }
  else if (action === "feature") {
    c.featured.active = true;
    c.featured.until = new Date(Date.now() + (parseInt(featuredDays) || 7) * 86400000);
  }
  else if (action === "unfeature") { c.featured.active = false; c.featured.until = null; }
  else if (action === "expire") c.status = "expired";
  await c.save();
  return res.json({ success: true, campaign: c });
}

/* PUT /admin/campaigns/:id — direct field updates (inSpin, endAt, quota, etc.) */
async function updateCampaign(req, res) {
  const allowed = {};
  for (const k of ["inSpin", "endAt", "totalQuota", "regions", "title", "description", "instructions", "terms", "offerText", "bannerImage"]) {
    if (req.body[k] !== undefined) allowed[k] = req.body[k];
  }
  const c = await CouponCampaign.findByIdAndUpdate(req.params.id, allowed, { new: true });
  if (!c) return res.status(404).json({ success: false, message: "Not found" });
  return res.json({ success: true, campaign: c });
}

/* ── Spin settings (AppSettings-backed) ── */
const AppSettings = require("../../models/AppSettings");
async function getSpinSettings(req, res) {
  const rows = await AppSettings.find({ key: { $in: ["coupon_spin_enabled", "coupon_spin_cooldown_hours"] } }).lean();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const inSpinCount = await CouponCampaign.countDocuments({ inSpin: true, status: "active" });
  return res.json({
    success: true,
    enabled: map.coupon_spin_enabled !== false && map.coupon_spin_enabled !== "false",
    cooldownHours: Number(map.coupon_spin_cooldown_hours) > 0 ? Number(map.coupon_spin_cooldown_hours) : 24,
    inSpinCount,
  });
}
async function updateSpinSettings(req, res) {
  const { enabled, cooldownHours } = req.body;
  if (enabled !== undefined) {
    await AppSettings.findOneAndUpdate({ key: "coupon_spin_enabled" }, { key: "coupon_spin_enabled", value: !!enabled }, { upsert: true });
  }
  if (cooldownHours !== undefined) {
    await AppSettings.findOneAndUpdate({ key: "coupon_spin_cooldown_hours" }, { key: "coupon_spin_cooldown_hours", value: Number(cooldownHours) || 24 }, { upsert: true });
  }
  return res.json({ success: true });
}

/* ── Vendors ── */
async function listVendors(req, res) {
  const items = await CouponVendor.find().populate("user", "name phone email")
    .sort({ createdAt: -1 }).limit(200).lean();
  return res.json({ success: true, items });
}
async function updateVendor(req, res) {
  const allowed = {};
  for (const k of ["status", "isVerifiedBadge", "claimCredits", "regions"]) {
    if (req.body[k] !== undefined) allowed[k] = req.body[k];
  }
  const v = await CouponVendor.findByIdAndUpdate(req.params.id, allowed, { new: true });
  if (!v) return res.status(404).json({ success: false, message: "Not found" });
  return res.json({ success: true, vendor: v });
}

/* ── Homepage sections (customizable UI) ── */
async function listSections(req, res) {
  const filter = {};
  if (req.query.region) filter.regions = req.query.region;
  const items = await CouponSection.find(filter).sort({ sortOrder: 1 }).lean();
  return res.json({ success: true, items });
}
async function createSection(req, res) {
  const { type, title = "", data = {}, regions = ["IN", "US"], sortOrder = 0, isActive = true } = req.body;
  if (!type) return res.status(400).json({ success: false, message: "type required" });
  const item = await CouponSection.create({ type, title, data, regions, sortOrder, isActive });
  return res.status(201).json({ success: true, item });
}
async function updateSection(req, res) {
  const item = await CouponSection.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!item) return res.status(404).json({ success: false, message: "Not found" });
  return res.json({ success: true, item });
}
async function deleteSection(req, res) {
  await CouponSection.findByIdAndDelete(req.params.id);
  return res.json({ success: true });
}

/* ── Pack orders (v1: admin marks paid → credits added) ── */
async function listPackOrders(req, res) {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const items = await CouponPackOrder.find(filter)
    .populate("vendor", "businessName phone email").populate("category", "name")
    .sort({ createdAt: -1 }).limit(200).lean();
  return res.json({ success: true, items });
}
async function decidePackOrder(req, res) {
  const { action, paymentRef = "" } = req.body; // paid | reject
  const order = await CouponPackOrder.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: "Not found" });
  if (order.status !== "pending") return res.status(409).json({ success: false, message: "Already decided" });
  if (action === "paid") {
    order.status = "paid"; order.paymentRef = paymentRef; order.approvedBy = req.user.userId;
    await CouponVendor.updateOne(
      { _id: order.vendor },
      { $inc: { claimCredits: order.claims, totalCreditsPurchased: order.claims } }
    );
  } else if (action === "reject") order.status = "rejected";
  await order.save();
  return res.json({ success: true, order });
}

module.exports = {
  dashboard,
  listCategories, createCategory, updateCategory, deleteCategory,
  listCampaigns, moderateCampaign, updateCampaign,
  getSpinSettings, updateSpinSettings,
  listVendors, updateVendor,
  listSections, createSection, updateSection, deleteSection,
  listPackOrders, decidePackOrder,
};
