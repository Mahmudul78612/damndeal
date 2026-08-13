/**
 * Coupons — admin API (categories + pack pricing, campaign moderation,
 * featuring/sponsoring, vendors, homepage sections, pack orders).
 * Mounted with authenticate + authorize("admin").
 */
const crypto = require("crypto");
const mongoose = require("mongoose");
const {
  CouponCategory, CouponVendor, CouponCampaign, CouponClaim, CouponSection, CouponPackOrder,
} = require("../../models/coupon.models");
const { writeAudit, diff } = require("../../services/audit.service");
const billing = require("../../services/couponBilling.service");

const slugify = (s) =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) ||
  crypto.randomBytes(4).toString("hex");

const isId = (v) => !!v && mongoose.Types.ObjectId.isValid(String(v));

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
  await writeAudit(req, { action: 'coupon.category.create', module: 'coupons', targetType: 'CouponCategory', targetId: item._id, targetLabel: item.name, after: { name, regions, packs } });
  return res.status(201).json({ success: true, item });
}
async function updateCategory(req, res) {
  const prev = await CouponCategory.findById(req.params.id).lean();
  const item = await CouponCategory.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!item) return res.status(404).json({ success: false, message: "Not found" });
  const d = diff(prev, item.toObject(), ["name", "icon", "regions", "sortOrder", "packs", "isActive"]);
  if (d) await writeAudit(req, { action: "coupon.category.update", module: "coupons", targetType: "CouponCategory", targetId: item._id, targetLabel: item.name, ...d });
  return res.json({ success: true, item });
}
async function deleteCategory(req, res) {
  const gone = await CouponCategory.findByIdAndDelete(req.params.id);
  if (gone) await writeAudit(req, { action: "coupon.category.delete", module: "coupons", targetType: "CouponCategory", targetId: gone._id, targetLabel: gone.name, before: { name: gone.name, regions: gone.regions } });
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
  const prevStatus = c.status;
  const prevFeatured = c.featured?.active === true;
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
  await writeAudit(req, {
    action: `coupon.campaign.${action}`,
    module: "coupons",
    targetType: "CouponCampaign",
    targetId: c._id,
    targetLabel: c.title,
    before: { status: prevStatus, featured: prevFeatured },
    after: { status: c.status, featured: c.featured?.active === true },
    note: reason || "",
  });
  return res.json({ success: true, campaign: c });
}

/* GET /admin/campaigns/search?q=&limit=20&status=&region=&categoryId=
   Lightweight picker feed for the homepage builder's "manual" coupon sections. */
async function searchCampaigns(req, res) {
  const q = String(req.query.q || "").trim().slice(0, 60);
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.region) filter.regions = req.query.region;
  if (isId(req.query.categoryId)) filter.category = req.query.categoryId;
  if (q) {
    const rx = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    filter.$or = [{ title: rx }, { offerText: rx }, { slug: rx }];
  }
  const rows = await CouponCampaign.find(filter)
    .select("title offerText bannerImage status")
    .populate("vendor", "businessName").populate("category", "name")
    .sort({ createdAt: -1 }).limit(limit).lean();
  const campaigns = rows.map((c) => ({
    _id: c._id,
    title: c.title,
    offerText: c.offerText || "",
    bannerImage: c.bannerImage || "",
    vendorName: c.vendor?.businessName || "",
    categoryName: c.category?.name || "",
    status: c.status,
  }));
  return res.json({ success: true, campaigns });
}

/* PUT /admin/campaigns/:id — direct field updates (inSpin, endAt, quota, etc.) */
async function updateCampaign(req, res) {
  const allowed = {};
  for (const k of ["inSpin", "endAt", "totalQuota", "regions", "title", "description", "instructions", "terms", "offerText", "bannerImage", "tileImage"]) {
    if (req.body[k] !== undefined) allowed[k] = req.body[k];
  }
  const prev = await CouponCampaign.findById(req.params.id).lean();
  const c = await CouponCampaign.findByIdAndUpdate(req.params.id, allowed, { new: true });
  if (!c) return res.status(404).json({ success: false, message: "Not found" });
  const d = diff(prev, c.toObject(), Object.keys(allowed));
  if (d) await writeAudit(req, { action: "coupon.campaign.update", module: "coupons", targetType: "CouponCampaign", targetId: c._id, targetLabel: c.title, ...d });
  return res.json({ success: true, campaign: c });
}

/* ── Spin settings (AppSettings-backed) ── */
const AppSettings = require("../../models/AppSettings");
async function getSpinSettings(req, res) {
  const rows = await AppSettings.find({ key: { $in: ["coupon_spin_enabled", "coupon_spin_cooldown_hours", "coupon_max_per_user_day", "coupon_max_per_user_active"] } }).lean();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const inSpinCount = await CouponCampaign.countDocuments({ inSpin: true, status: "active" });
  return res.json({
    success: true,
    enabled: map.coupon_spin_enabled !== false && map.coupon_spin_enabled !== "false",
    cooldownHours: Number(map.coupon_spin_cooldown_hours) > 0 ? Number(map.coupon_spin_cooldown_hours) : 24,
    inSpinCount,
    maxPerUserDay: Number(map.coupon_max_per_user_day) > 0 ? Number(map.coupon_max_per_user_day) : 0,
    maxPerUserActive: Number(map.coupon_max_per_user_active) > 0 ? Number(map.coupon_max_per_user_active) : 0,
  });
}
async function updateSpinSettings(req, res) {
  const { enabled, cooldownHours, maxPerUserDay, maxPerUserActive } = req.body;
  if (enabled !== undefined) {
    await AppSettings.findOneAndUpdate({ key: "coupon_spin_enabled" }, { key: "coupon_spin_enabled", value: !!enabled }, { upsert: true });
  }
  if (cooldownHours !== undefined) {
    await AppSettings.findOneAndUpdate({ key: "coupon_spin_cooldown_hours" }, { key: "coupon_spin_cooldown_hours", value: Number(cooldownHours) || 24 }, { upsert: true });
  }
  // Marketplace-wide claim rules (0 = unlimited). These cap how many coupons
  // one person may take across the whole marketplace, on top of each
  // campaign's own perUserLimit.
  const rules = { coupon_max_per_user_day: maxPerUserDay, coupon_max_per_user_active: maxPerUserActive };
  for (const [key, v] of Object.entries(rules)) {
    if (v === undefined) continue;
    await AppSettings.findOneAndUpdate(
      { key },
      { key, value: Math.max(0, parseInt(v, 10) || 0) },
      { upsert: true }
    );
  }
  await writeAudit(req, {
    action: "coupon.rules.update", module: "coupons", targetType: "AppSettings",
    targetLabel: "Spin & claim rules",
    after: { enabled, cooldownHours, maxPerUserDay, maxPerUserActive },
  });
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
  const prev = await CouponVendor.findById(req.params.id).lean();
  const v = await CouponVendor.findByIdAndUpdate(req.params.id, allowed, { new: true });
  if (!v) return res.status(404).json({ success: false, message: "Not found" });
  // Credit changes and suspensions are the two things support disputes are about
  const d = diff(prev, v.toObject(), Object.keys(allowed));
  if (d) await writeAudit(req, { action: "coupon.vendor.update", module: "coupons", targetType: "CouponVendor", targetId: v._id, targetLabel: v.businessName, ...d });
  return res.json({ success: true, vendor: v });
}

/* ── Homepage sections (customizable UI) ── */
async function listSections(req, res) {
  const filter = {};
  if (req.query.region) filter.regions = req.query.region;
  const items = await CouponSection.find(filter).sort({ sortOrder: 1 }).lean();
  return res.json({ success: true, items });
}
/** Whitelist for section.data (schema v2 — see coupon.models.js).
 *  Unknown keys are dropped; legacy keys (text/link/bgColor/image/style) stay. */
const SECTION_SORTS = ["newest", "popular", "ending", "discount"];
const CARD_STYLES = ["ticket", "tile", "list", "compact"];
const BGS = ["white", "band", "gradient"];
const BANNER_STYLES = ["plain", "coupon", "rounded"];
const ASPECTS = ["16:9", "3:1", "3:4", "1:1"];

const pick = (v, allowed) => (allowed.includes(v) ? v : undefined);
const str = (v, max = 300) => (v === undefined || v === null ? undefined : String(v).slice(0, max));

function cleanSectionData(raw) {
  const d = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const out = {};
  const set = (k, v) => { if (v !== undefined) out[k] = v; };

  /* content source */
  set("source", pick(d.source, ["auto", "manual"]));
  if (Array.isArray(d.campaignIds)) {
    out.campaignIds = d.campaignIds.map(String).filter(isId).slice(0, 30);
  }
  if (d.categoryId !== undefined) out.categoryId = isId(d.categoryId) ? String(d.categoryId) : null;
  if (d.vendorId !== undefined) out.vendorId = isId(d.vendorId) ? String(d.vendorId) : null;
  set("sort", pick(d.sort, SECTION_SORTS));
  if (d.limit !== undefined) {
    const n = parseInt(d.limit, 10);
    if (Number.isFinite(n) && n > 0) out.limit = Math.min(30, n);
  }

  /* presentation */
  set("cardStyle", pick(d.cardStyle, CARD_STYLES));
  if (d.columns !== undefined) {
    const c = parseInt(d.columns, 10);
    if ([2, 3, 4, 5].includes(c)) out.columns = c;
  }
  set("bg", pick(d.bg, BGS));

  /* banners */
  if (Array.isArray(d.banners)) {
    out.banners = d.banners.slice(0, 20).filter((b) => b && typeof b === "object").map((b) => ({
      image: str(b.image, 500) || "",
      link: str(b.link, 500) || "",
      title: str(b.title, 120) || "",
      badge: str(b.badge, 40) || "",
    }));
  }
  set("bannerStyle", pick(d.bannerStyle, BANNER_STYLES));
  set("aspect", pick(d.aspect, ASPECTS));
  if (d.autoplay !== undefined) out.autoplay = !!d.autoplay;

  /* legacy keys that must keep working */
  set("text", str(d.text, 500));
  set("link", str(d.link, 500));
  set("bgColor", str(d.bgColor, 40));
  set("image", str(d.image, 500));
  set("style", pick(d.style, CARD_STYLES)); // legacy alias of cardStyle
  return out;
}

async function createSection(req, res) {
  const { type, title = "", data = {}, regions = ["IN", "US"], sortOrder = 0, isActive = true } = req.body;
  if (!type) return res.status(400).json({ success: false, message: "type required" });
  const item = await CouponSection.create({
    type, title, data: cleanSectionData(data), regions, sortOrder, isActive,
  });
  return res.status(201).json({ success: true, item });
}

/* PUT /admin/sections/:id — partial update; only known fields are written and
   `data` is passed through the v2 whitelist. */
async function updateSection(req, res) {
  const patch = {};
  for (const k of ["type", "title", "regions", "sortOrder", "isActive"]) {
    if (req.body[k] !== undefined) patch[k] = req.body[k];
  }
  if (req.body.data !== undefined) patch.data = cleanSectionData(req.body.data);
  const prev = await CouponSection.findById(req.params.id).lean();
  const item = await CouponSection.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true });
  if (!item) return res.status(404).json({ success: false, message: "Not found" });
  const changed = diff(prev, item.toObject(), Object.keys(patch));
  if (changed) await writeAudit(req, { action: "coupon.section.update", module: "coupons", targetType: "CouponSection", targetId: item._id, targetLabel: item.title || item.type, ...changed });
  return res.json({ success: true, item });
}
async function deleteSection(req, res) {
  const gone = await CouponSection.findByIdAndDelete(req.params.id);
  if (gone) await writeAudit(req, { action: "coupon.section.delete", module: "coupons", targetType: "CouponSection", targetId: gone._id, targetLabel: gone.title || gone.type, before: { type: gone.type, title: gone.title } });
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
    // Route through the same idempotent grant the gateways use, so a manual
    // approval after a webhook already landed cannot credit the account twice.
    order.paymentRef = paymentRef;
    order.approvedBy = req.user.userId;
    await order.save();
    const out = await billing.grantCredits(order._id, { gateway: order.gateway || "manual" });
    if (out.alreadyGranted) {
      return res.json({ success: true, order, message: "Already paid — credits were granted earlier." });
    }
  } else if (action === "reject") {
    order.status = "rejected";
    await order.save();
  }
  await writeAudit(req, {
    action: `coupon.packorder.${action}`,
    module: "coupons",
    targetType: "CouponPackOrder",
    targetId: order._id,
    targetLabel: `${order.claims} claims · ${order.currency} ${order.price}`,
    before: { status: "pending" },
    after: { status: order.status, paymentRef: order.paymentRef || "" },
  });
  return res.json({ success: true, order });
}

module.exports = {
  dashboard,
  listCategories, createCategory, updateCategory, deleteCategory,
  listCampaigns, searchCampaigns, moderateCampaign, updateCampaign,
  getSpinSettings, updateSpinSettings,
  listVendors, updateVendor,
  listSections, createSection, updateSection, deleteSection,
  listPackOrders, decidePackOrder,
};
