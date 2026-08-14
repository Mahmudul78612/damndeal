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
const { CouponOutlet } = require("../../models/couponOrg.models");
const { deriveLocation, refreshBrandCampaigns } = require("../../services/couponTargeting.service");
const { outletInScope, resolveBrand } = require("../../middleware/couponAuth.middleware");
const billing = require("../../services/couponBilling.service");
const { renderInvoicePdf } = require("../../services/couponInvoice.service");
const { CouponOrg } = require("../../models/couponOrg.models");
const mongoose = require("mongoose");
const isId = (v) => !!v && mongoose.Types.ObjectId.isValid(String(v));

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

/**
 * The brand this request acts on.
 *
 * Team members (cashier, manager…) are NOT the brand's owner user, so the
 * legacy `CouponVendor.findOne({ user })` lookup cannot find their brand.
 * When a membership is attached we resolve through the member's scope
 * instead; the owner lookup stays as the fallback so accounts created before
 * the org model keep working unchanged.
 */
async function requireVendor(req, res) {
  let vendor = null;

  if (req.couponMember && !req.couponMember.legacy) {
    vendor = await resolveBrand(req, res);
    if (!vendor) return null;              // resolveBrand already answered
  } else {
    vendor = await CouponVendor.findOne({ user: req.user.userId });
  }

  if (!vendor) {
    res.status(404).json({ success: false, message: "Vendor profile not found — register first", needsRegistration: true });
    return null;
  }
  if (vendor.status === "suspended") {
    res.status(403).json({ success: false, message: "Your vendor account is suspended" });
    return null;
  }
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
    description = "", instructions = "", terms = "", bannerImage = "", tileImage = "", isOnline = false, redirectUrl = "",
    totalQuota = 50, perUserLimit = 1, claimValidityDays = 0, endAt, location = {},
    scope, outlets = [],
  } = req.body;

  // Manual location targeting — nationwide, or specific states/city (+ geo point).
  // Still supported for brands that have not created outlets yet.
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

  // Outlet-based targeting wins when the brand has outlets: the merchant picks
  // shops, and states/points are derived from them (see couponTargeting).
  const outletIds = (Array.isArray(outlets) ? outlets : []).filter((id) => isId(id));
  let effectiveScope = scope || (isOnline ? "online" : "all_outlets");
  if (effectiveScope === "selected" && !outletIds.length) {
    return res.status(400).json({ success: false, message: "Select at least one outlet, or choose all outlets." });
  }
  const outletCount = await CouponOutlet.countDocuments({ brand: vendor._id, isActive: true });
  let finalLoc = loc;
  if (outletCount > 0 && effectiveScope !== "online") {
    finalLoc = await deriveLocation(
      { vendor: vendor._id, scope: effectiveScope, outlets: outletIds, isOnline },
      loc
    );
  } else if (effectiveScope !== "online") {
    // No outlets yet — fall back to the manual rules, which must still be valid
    if (!loc.nationwide && !loc.states.length && !loc.point) {
      return res.status(400).json({ success: false, message: "Pick at least one state (or your location) for a local offer" });
    }
    effectiveScope = "all_outlets";
  } else {
    finalLoc = { nationwide: true, states: [], city: "", radiusKm: 0 };
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
    description, instructions, terms, bannerImage, tileImage, isOnline: !!isOnline, redirectUrl,
    totalQuota: quota, perUserLimit: Math.max(1, parseInt(perUserLimit) || 1),
    claimValidityDays: Math.max(0, parseInt(claimValidityDays) || 0),
    location: finalLoc,
    scope: effectiveScope,
    outlets: effectiveScope === "selected" ? outletIds : [],
    org: vendor.org || null,
    endAt: new Date(endAt), regions: vendor.regions.length ? vendor.regions : [R(req)],
    status: "pending", // admin approves → active
  });
  vendor.claimCredits -= quota;
  await vendor.save();
  // Nudge before they run out mid-campaign, not after
  billing.lowCreditWarning(vendor).catch(() => {});
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

  // Anything a shopper reads has to pass moderation again. Operational knobs
  // (dates, quota, limits, pause) are the merchant's own business and stay live.
  let needsReview = false;
  const editable = ["description", "instructions", "terms", "bannerImage", "tileImage", "redirectUrl"];
  for (const k of editable) {
    if (req.body[k] === undefined) continue;
    if (String(req.body[k] ?? "") !== String(c[k] ?? "")) needsReview = true;
    c[k] = req.body[k];
  }

  // The headline is what a customer decided to claim on, so it is only
  // editable while nobody has claimed yet — otherwise an offer could be
  // swapped out from under codes already sitting in people's wallets.
  if (c.claimedCount === 0) {
    if (req.body.title !== undefined) {
      const t = String(req.body.title).trim();
      if (!t) return res.status(400).json({ success: false, message: "Title cannot be empty" });
      if (t !== c.title) needsReview = true;
      c.title = t;
    }
    if (req.body.offerText !== undefined) {
      const o = String(req.body.offerText).trim();
      if (!o) return res.status(400).json({ success: false, message: "Offer text cannot be empty" });
      if (o !== c.offerText) needsReview = true;
      c.offerText = o;
    }
  } else if (req.body.title !== undefined || req.body.offerText !== undefined) {
    return res.status(409).json({
      success: false,
      message: "This coupon already has claims, so the title and offer cannot be changed. Pause it and create a new one instead.",
    });
  }

  if (req.body.perUserLimit !== undefined) {
    c.perUserLimit = Math.max(1, parseInt(req.body.perUserLimit, 10) || 1);
  }
  if (req.body.claimValidityDays !== undefined) {
    // Only affects codes claimed from now on — already-issued codes keep the
    // deadline they were given, which is what the customer was shown.
    c.claimValidityDays = Math.max(0, parseInt(req.body.claimValidityDays, 10) || 0);
  }

  // Extending is free; pulling the end date in early is allowed too, but it
  // can never land before what has already been claimed against.
  let revived = false;
  if (req.body.endAt !== undefined) {
    const end = new Date(req.body.endAt);
    if (isNaN(end.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid end date" });
    }
    c.endAt = end;
    if (c.status === "expired" && end > new Date()) { c.status = "active"; revived = true; }
  }

  // Reviving a campaign whose leftover quota was already credited back means
  // buying that quota a second time — otherwise a merchant could bank the
  // refund and keep running the same offer for free.
  if (revived && c.creditsRefundedAt) {
    const owed = Math.max(0, c.totalQuota - c.claimedCount);
    if (owed > vendor.claimCredits) {
      return res.status(402).json({
        success: false, code: "INSUFFICIENT_CREDITS",
        message: `This coupon's ${owed} unused credits were returned when it expired. Restarting it costs ${owed} credits and you have ${vendor.claimCredits} — buy a pack, or lower the quota first.`,
      });
    }
    vendor.claimCredits -= owed;
    await vendor.save();
    c.creditsRefundedAt = null;
  }

  // Growing the quota takes more credits, exactly like creating a campaign.
  // Shrinking is refunded, but never below what customers already claimed.
  if (req.body.totalQuota !== undefined) {
    const next = Math.max(1, parseInt(req.body.totalQuota, 10) || 1);
    if (next < c.claimedCount) {
      return res.status(400).json({
        success: false,
        message: `${c.claimedCount} coupons are already claimed — quota cannot go below that.`,
      });
    }
    const delta = next - c.totalQuota;
    if (delta > 0 && delta > vendor.claimCredits) {
      return res.status(402).json({
        success: false, code: "INSUFFICIENT_CREDITS",
        message: `You have ${vendor.claimCredits} coupon credits — buy a pack to add ${delta} more.`,
      });
    }
    if (delta !== 0) {
      vendor.claimCredits -= delta;
      await vendor.save();
      c.totalQuota = next;
    }
  }

  // Content changed on a coupon that shoppers can already see → back in the
  // queue. A campaign still awaiting its first approval just stays pending,
  // and a rejected one gets a clean slate to be looked at again.
  let resubmitted = false;
  if (needsReview && ["active", "paused", "rejected"].includes(c.status)) {
    c.status = "pending";
    c.rejectReason = "";
    resubmitted = true;
  }

  await c.save();
  return res.json({
    success: true,
    campaign: c,
    resubmitted,
    message: resubmitted
      ? "Saved — your changes are with our team for review and will go live once approved."
      : "Saved",
  });
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

/* ── Outlets (locations of this brand) ───────────────────────────────────── */

function outletPayload(body) {
  const out = {};
  for (const k of ["name", "code", "address", "state", "city", "pincode", "phone", "hours"]) {
    if (body[k] !== undefined) out[k] = String(body[k]).trim();
  }
  if (body.isActive !== undefined) out.isActive = !!body.isActive;
  const lat = parseFloat(body.lat), lng = parseFloat(body.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    out.point = { type: "Point", coordinates: [lng, lat] };
  }
  return out;
}

/* GET /api/coupons/vendor/outlets */
async function listOutlets(req, res) {
  const vendor = await requireVendor(req, res); if (!vendor) return;
  const items = await CouponOutlet.find({ brand: vendor._id }).sort({ createdAt: 1 }).lean();
  return res.json({ success: true, items });
}

/* POST /api/coupons/vendor/outlets */
async function createOutlet(req, res) {
  const vendor = await requireVendor(req, res); if (!vendor) return;
  const payload = outletPayload(req.body);
  if (!payload.name) return res.status(400).json({ success: false, message: "Outlet name is required" });
  const outlet = await CouponOutlet.create({ ...payload, brand: vendor._id, org: vendor.org || null });
  // New location → campaigns targeting "all outlets" must now reach it
  await refreshBrandCampaigns(vendor._id);
  return res.status(201).json({ success: true, outlet });
}

/* PUT /api/coupons/vendor/outlets/:id */
async function updateOutlet(req, res) {
  const vendor = await requireVendor(req, res); if (!vendor) return;
  const outlet = await CouponOutlet.findOneAndUpdate(
    { _id: req.params.id, brand: vendor._id },
    outletPayload(req.body),
    { new: true }
  );
  if (!outlet) return res.status(404).json({ success: false, message: "Outlet not found" });
  await refreshBrandCampaigns(vendor._id);
  return res.json({ success: true, outlet });
}

/* DELETE /api/coupons/vendor/outlets/:id */
async function deleteOutlet(req, res) {
  const vendor = await requireVendor(req, res); if (!vendor) return;
  const gone = await CouponOutlet.findOneAndDelete({ _id: req.params.id, brand: vendor._id });
  if (!gone) return res.status(404).json({ success: false, message: "Outlet not found" });
  // Drop it from any campaign that targeted it explicitly, then re-derive
  await CouponCampaign.updateMany({ vendor: vendor._id, outlets: gone._id }, { $pull: { outlets: gone._id } });
  await refreshBrandCampaigns(vendor._id);
  return res.json({ success: true });
}

/* POST /api/coupons/vendor/outlets/bulk  { rows: [...] }
   Bulk import so a 40-outlet chain is not 40 forms. Accepts the parsed rows
   (the portal parses the CSV client-side and posts JSON). */
async function bulkOutlets(req, res) {
  const vendor = await requireVendor(req, res); if (!vendor) return;
  const rows = Array.isArray(req.body.rows) ? req.body.rows.slice(0, 500) : [];
  if (!rows.length) return res.status(400).json({ success: false, message: "No rows to import" });

  const docs = [];
  const errors = [];
  rows.forEach((r, i) => {
    const payload = outletPayload(r);
    if (!payload.name) { errors.push(`Row ${i + 1}: name is required`); return; }
    docs.push({ ...payload, brand: vendor._id, org: vendor.org || null });
  });
  if (!docs.length) return res.status(400).json({ success: false, message: "Nothing valid to import", errors });

  const created = await CouponOutlet.insertMany(docs, { ordered: false });
  await refreshBrandCampaigns(vendor._id);
  return res.status(201).json({ success: true, imported: created.length, skipped: errors.length, errors });
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
  // Two deadlines can bite: the code's own validity window, and the campaign
  // end. The sweep that flips status runs on a schedule, so read the dates
  // here rather than trusting status alone.
  const now = new Date();
  const expired =
    (claim.expiresAt && claim.expiresAt < now) ||
    (claim.campaign?.endAt && claim.campaign.endAt < now);
  return res.json({
    success: true,
    valid: claim.status === "claimed" && !expired,
    status: expired && claim.status === "claimed" ? "expired" : claim.status,
    claim: {
      code: claim.code, status: claim.status, claimedAt: claim.claimedAt, redeemedAt: claim.redeemedAt,
      expiresAt: claim.expiresAt,
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
  if (claim.expiresAt && claim.expiresAt < new Date()) {
    return res.status(410).json({
      success: false,
      message: `This code was only valid until ${claim.expiresAt.toLocaleDateString()} — ask the customer to claim it again.`,
    });
  }
  if (claim.campaign?.endAt && claim.campaign.endAt < new Date()) return res.status(410).json({ success: false, message: "This coupon has expired" });

  // A cashier is pinned to their outlet: they may only redeem there, and the
  // redemption is attributed to that shop and that person.
  let outletId = req.body.outletId || null;
  const scoped = req.couponMember?.scope?.outlets || [];
  if (scoped.length) {
    if (outletId && !outletInScope(req, outletId)) {
      return res.status(403).json({ success: false, message: "You can only redeem at your own outlet." });
    }
    outletId = outletId || scoped[0];
  }
  if (outletId) {
    const belongs = await CouponOutlet.exists({ _id: outletId, brand: vendor._id });
    if (!belongs) return res.status(400).json({ success: false, message: "That outlet does not belong to this brand." });
  }

  // Single atomic flip — two cashiers scanning the same code at the same
  // moment must produce exactly one redemption.
  const redeemedAt = new Date();
  const billValue = Number(req.body.billValue);
  const won = await CouponClaim.findOneAndUpdate(
    // The expiry guard belongs in the filter too, so a code cannot be redeemed
    // by a request that started a moment before its window closed.
    {
      _id: claim._id,
      status: "claimed",
      $or: [{ expiresAt: null }, { expiresAt: { $gt: redeemedAt } }],
    },
    {
      $set: {
        status: "redeemed", redeemedAt, redeemedVia: "portal",
        redeemedOutlet: outletId || null,
        redeemedBy: req.couponMember?._id || null,
        ...(Number.isFinite(billValue) && billValue > 0 ? { billValue } : {}),
      },
    },
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

/**
 * The one credit price list for the whole marketplace.
 *
 * Credits used to be priced per category, which meant a brand saw a different
 * price depending on which category it sat in. There is now a single list,
 * edited in the admin console and stored in AppSettings.
 */
const DEFAULT_CREDIT_PACKS = [
  { claims: 100, priceINR: 999, priceUSD: 19, label: "Starter" },
  { claims: 500, priceINR: 3999, priceUSD: 79, label: "Growth", popular: true },
  { claims: 2000, priceINR: 12999, priceUSD: 249, label: "Business" },
];
async function creditPacks() {
  const AppSettings = require("../../models/AppSettings");
  const row = await AppSettings.findOne({ key: "coupon_credit_packs" }).lean();
  const list = Array.isArray(row?.value) ? row.value : null;
  const clean = (list || DEFAULT_CREDIT_PACKS)
    .filter((p) => Number(p?.claims) > 0)
    .map((p) => ({
      claims: Number(p.claims),
      priceINR: Number(p.priceINR) || 0,
      priceUSD: Number(p.priceUSD) || 0,
      label: String(p.label || ""),
      popular: !!p.popular,
    }))
    .sort((a, b) => a.claims - b.claims);
  return clean.length ? clean : DEFAULT_CREDIT_PACKS;
}

/* GET /api/coupons/vendor/packs — the single credit price list for this region */
async function packs(req, res) {
  const region = R(req);
  const list = await creditPacks();
  return res.json({
    success: true,
    region,
    currency: region === "US" ? "USD" : "INR",
    packs: list.map((p) => ({
      claims: p.claims,
      label: p.label || "",
      popular: !!p.popular,
      price: region === "US" ? p.priceUSD : p.priceINR,
    })),
  });
}

/* POST /api/coupons/vendor/packs { categoryId, claims } → pending order */
async function buyPack(req, res) {
  const vendor = await requireVendor(req, res); if (!vendor) return;
  const region = R(req);
  const list = await creditPacks();
  const pack = list.find((p) => Number(p.claims) === Number(req.body.claims));
  if (!pack) return res.status(400).json({ success: false, message: "That credit pack is not available" });
  const price = Number(region === "US" ? pack.priceUSD : pack.priceINR) || 0;
  const { taxPercent, taxAmount, totalAmount } = await billing.priceBreakdown(price, region);

  const order = await CouponPackOrder.create({
    vendor: vendor._id, org: vendor.org || null, claims: pack.claims,
    price, currency: region === "US" ? "USD" : "INR", region,
    taxPercent, taxAmount, totalAmount,
  });

  // Open the gateway straight away. Credits are added only when the payment is
  // confirmed by webhook/signature — never here, and never on the return page.
  const origin = req.headers.origin || (region === "US" ? "https://coupon.damndeal.com" : "https://coupon.damndeal.in");
  try {
    const checkout = await billing.startCheckout(order, {
      successUrl: `${origin}/business/billing?paid=${order._id}`,
      cancelUrl: `${origin}/business/billing?cancelled=1`,
    });
    return res.status(201).json({ success: true, order, checkout });
  } catch (e) {
    // Gateway not configured / temporarily down — keep the order so the team
    // can still settle it manually rather than losing the intent.
    console.error("[BILLING] checkout start failed:", e.message);
    return res.status(201).json({
      success: true, order, checkout: null,
      message: "Order created. Online payment is unavailable right now — our team will contact you to complete it.",
    });
  }
}

/* POST /api/coupons/vendor/packs/:id/confirm — Razorpay client callback.
   The signature is verified server-side before a single credit is granted. */
async function confirmPack(req, res) {
  const vendor = await requireVendor(req, res); if (!vendor) return;
  const order = await CouponPackOrder.findOne({ _id: req.params.id, vendor: vendor._id });
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });
  if (order.status === "paid") return res.json({ success: true, alreadyPaid: true, order });

  try {
    await billing.confirmRazorpay(order, {
      razorpayPaymentId: req.body.razorpay_payment_id,
      razorpaySignature: req.body.razorpay_signature,
    });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message });
  }
  const fresh = await CouponPackOrder.findById(order._id).lean();
  return res.json({ success: true, order: fresh, message: `${fresh.claims} credits added.` });
}

/* GET /api/coupons/vendor/packs/:id/invoice — PDF, paid orders only */
async function packInvoice(req, res) {
  const vendor = await requireVendor(req, res); if (!vendor) return;
  const order = await CouponPackOrder.findOne({ _id: req.params.id, vendor: vendor._id })
    .populate("category", "name").lean();
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });
  if (order.status !== "paid") return res.status(400).json({ success: false, message: "Invoice is available once the payment is complete." });

  const org = vendor.org ? await CouponOrg.findById(vendor.org).lean() : null;
  return renderInvoicePdf(res, { order, vendor, org });
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
  listOutlets, createOutlet, updateOutlet, deleteOutlet, bulkOutlets,
  confirmPack, packInvoice,
};
