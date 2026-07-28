/**
 * Coupons — public marketplace API + customer claim flow.
 * Region comes from req.region (coupon.damndeal.com → US, else IN).
 */
const crypto = require("crypto");
const {
  CouponCategory, CouponVendor, CouponCampaign, CouponClaim, CouponSection, SpinPlay,
} = require("../../models/coupon.models");
const AppSettings = require("../../models/AppSettings");

const R = (req) => (req.region === "US" ? "US" : "IN");
const liveFilter = (region) => ({
  status: "active",
  regions: region,
  endAt: { $gt: new Date() },
  $expr: { $lt: ["$claimedCount", "$totalQuota"] },
});

/** Location targeting: show nationwide offers everywhere; local offers only in
 *  their state — or within the user's chosen radius when lat/lng is shared.
 *  Query params: ?state=Punjab&lat=..&lng=..&radius=25  (all optional) */
function locFilter(req) {
  const state = (req.query.state || "").trim();
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const radiusKm = Math.min(200, parseFloat(req.query.radius) || 25);
  const or = [{ "location.nationwide": true }, { "location.nationwide": { $exists: false } }];
  if (state) or.push({ "location.states": state });
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    or.push({
      "location.point": {
        $geoWithin: { $centerSphere: [[lng, lat], radiusKm / 6378.1] },
      },
    });
  }
  // No location chosen → show everything (nationwide + local both)
  if (!state && !Number.isFinite(lat)) return {};
  return { $or: or };
}

const CAMPAIGN_CARD = "title slug offerText offerType offerValue bannerImage isOnline claimedCount totalQuota endAt featured category";
const VENDOR_CARD = "businessName slug logo isVerifiedBadge";

/* GET /api/coupons/home — admin-built sections, hydrated */
async function home(req, res) {
  const region = R(req);
  const sections = await CouponSection.find({ isActive: true, regions: region }).sort({ sortOrder: 1 }).lean();
  const out = [];
  for (const s of sections) {
    const sec = { _id: s._id, type: s.type, title: s.title, data: s.data || {} };
    if (s.type === "category_rail") {
      sec.items = await CouponCategory.find({ isActive: true, regions: region }).sort({ sortOrder: 1 }).lean();
    } else if (s.type === "sponsored") {
      sec.items = await CouponCampaign.find({ ...liveFilter(region), ...locFilter(req), "featured.active": true })
        .select(CAMPAIGN_CARD).populate("vendor", VENDOR_CARD).populate("category", "name slug")
        .sort({ updatedAt: -1 }).limit(Number(s.data?.limit) || 6).lean();
    } else if (s.type === "coupon_grid") {
      const f = { ...liveFilter(region), ...locFilter(req) };
      if (s.data?.categoryId) f.category = s.data.categoryId;
      sec.items = await CouponCampaign.find(f)
        .select(CAMPAIGN_CARD).populate("vendor", VENDOR_CARD).populate("category", "name slug")
        .sort({ "featured.active": -1, claimedCount: -1, createdAt: -1 })
        .limit(Number(s.data?.limit) || 12).lean();
    } else if (s.type === "brand_row") {
      sec.items = await CouponVendor.find({ status: "approved", regions: region })
        .select(VENDOR_CARD).sort({ isVerifiedBadge: -1, createdAt: -1 })
        .limit(Number(s.data?.limit) || 12).lean();
    }
    out.push(sec);
  }
  return res.json({ success: true, region, sections: out });
}

/* GET /api/coupons/list?category=slug&q=&sort=popular|new|ending&page=&limit= */
async function list(req, res) {
  const region = R(req);
  const { category, q, sort = "popular" } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(48, parseInt(req.query.limit) || 24);
  const filter = { ...liveFilter(region), ...locFilter(req) };
  if (category) {
    const cat = await CouponCategory.findOne({ slug: category }).select("_id");
    if (cat) filter.category = cat._id;
  }
  if (q) filter.title = { $regex: String(q).slice(0, 60), $options: "i" };
  const sortMap = { popular: { "featured.active": -1, claimedCount: -1 }, new: { createdAt: -1 }, ending: { endAt: 1 } };
  const [items, total] = await Promise.all([
    CouponCampaign.find(filter).select(CAMPAIGN_CARD)
      .populate("vendor", VENDOR_CARD).populate("category", "name slug")
      .sort(sortMap[sort] || sortMap.popular).skip((page - 1) * limit).limit(limit).lean(),
    CouponCampaign.countDocuments(filter),
  ]);
  return res.json({ success: true, items, total, page, pages: Math.ceil(total / limit) });
}

/* GET /api/coupons/categories */
async function categories(req, res) {
  const items = await CouponCategory.find({ isActive: true, regions: R(req) }).sort({ sortOrder: 1 }).lean();
  return res.json({ success: true, items });
}

/* GET /api/coupons/c/:slug — campaign detail */
async function detail(req, res) {
  const c = await CouponCampaign.findOne({ slug: req.params.slug })
    .populate("vendor", "businessName slug logo isVerifiedBadge description website address")
    .populate("category", "name slug").lean();
  if (!c || !["active", "paused", "expired"].includes(c.status)) {
    return res.status(404).json({ success: false, message: "Coupon not found" });
  }
  CouponCampaign.updateOne({ _id: c._id }, { $inc: { views: 1 } }).catch(() => {});
  return res.json({ success: true, campaign: c });
}

/* GET /api/coupons/vendors/:slug — brand page */
async function vendorPage(req, res) {
  const v = await CouponVendor.findOne({ slug: req.params.slug, status: "approved" })
    .select("businessName slug logo description website address isVerifiedBadge").lean();
  if (!v) return res.status(404).json({ success: false, message: "Brand not found" });
  const campaigns = await CouponCampaign.find({ ...liveFilter(R(req)), vendor: v._id })
    .select(CAMPAIGN_CARD).populate("category", "name slug").lean();
  return res.json({ success: true, vendor: v, campaigns });
}

/* ── Claim flow (auth) ────────────────────────────────────────────────────── */
function genCode() {
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no confusing 0/O/1/I/L
  let s = "";
  for (let i = 0; i < 8; i++) s += abc[crypto.randomInt(abc.length)];
  return `DD-${s.slice(0, 4)}-${s.slice(4)}`;
}

/* Core claim logic (shared by direct claim + spin wheel). Returns
   { error } | { alreadyClaimed, claim } | { claim } */
async function claimForUser(c, userId, region) {
  if (!c || c.status !== "active") return { error: "This coupon is not available" };
  if (c.endAt < new Date()) return { error: "This coupon has expired" };
  if (c.claimedCount >= c.totalQuota) return { error: "All coupons have been claimed" };

  const mine = await CouponClaim.countDocuments({ campaign: c._id, user: userId, status: { $ne: "cancelled" } });
  if (mine >= (c.perUserLimit || 1)) {
    const existing = await CouponClaim.findOne({ campaign: c._id, user: userId }).sort({ createdAt: -1 }).lean();
    return { alreadyClaimed: true, claim: existing };
  }

  // Atomic quota take (prevents over-claim under load)
  const took = await CouponCampaign.updateOne(
    { _id: c._id, status: "active", $expr: { $lt: ["$claimedCount", "$totalQuota"] } },
    { $inc: { claimedCount: 1 } }
  );
  if (!took.modifiedCount) return { error: "All coupons have been claimed" };

  let code, tries = 0;
  do { code = genCode(); tries++; } while (tries < 5 && (await CouponClaim.exists({ code })));

  const doc = await CouponClaim.create({ campaign: c._id, vendor: c.vendor, user: userId, code, region });
  return { claim: doc };
}

/* POST /api/coupons/claim { campaignId } */
async function claim(req, res) {
  const c = await CouponCampaign.findById(req.body.campaignId);
  const out = await claimForUser(c, req.user.userId, R(req));
  if (out.error) return res.status(400).json({ success: false, message: out.error });
  if (out.alreadyClaimed) return res.json({ success: true, alreadyClaimed: true, claim: out.claim });
  return res.status(201).json({ success: true, claim: out.claim, redirectUrl: c.isOnline ? c.redirectUrl : null });
}

/* ── Spin & Win ───────────────────────────────────────────────────────────── */

async function spinSettings() {
  const rows = await AppSettings.find({ key: { $in: ["coupon_spin_enabled", "coupon_spin_cooldown_hours"] } }).lean();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    enabled: map.coupon_spin_enabled !== false && map.coupon_spin_enabled !== "false",
    cooldownHours: Number(map.coupon_spin_cooldown_hours) > 0 ? Number(map.coupon_spin_cooldown_hours) : 24,
  };
}

/* GET /api/coupons/spin — wheel segments (public) */
async function spinWheel(req, res) {
  const region = R(req);
  const cfg = await spinSettings();
  if (!cfg.enabled) return res.json({ success: true, enabled: false, segments: [] });
  const segments = await CouponCampaign.find({ ...liveFilter(region), ...locFilter(req), inSpin: true })
    .select("title offerText slug")
    .populate("vendor", "businessName logo")
    .limit(10).lean();
  return res.json({ success: true, enabled: segments.length >= 2, cooldownHours: cfg.cooldownHours, segments });
}

/* POST /api/coupons/spin/play (auth) — server picks the prize + claims it */
async function spinPlay(req, res) {
  const userId = req.user.userId;
  const region = R(req);
  const cfg = await spinSettings();
  if (!cfg.enabled) return res.status(400).json({ success: false, message: "Spin is not available right now" });

  // Cooldown: one spin per window
  const since = new Date(Date.now() - cfg.cooldownHours * 3600000);
  const last = await SpinPlay.findOne({ user: userId, createdAt: { $gt: since } }).sort({ createdAt: -1 });
  if (last) {
    const nextAt = new Date(last.createdAt.getTime() + cfg.cooldownHours * 3600000);
    return res.status(429).json({ success: false, code: "COOLDOWN", nextSpinAt: nextAt, message: "You already spun — come back later!" });
  }

  const pool = await CouponCampaign.find({ ...liveFilter(region), ...locFilter(req), inSpin: true }).limit(10);
  if (pool.length < 2) return res.status(400).json({ success: false, message: "Spin is not available right now" });

  // Try random picks until a claim succeeds (skips per-user-limit hits)
  const shuffled = pool.sort(() => crypto.randomInt(3) - 1);
  for (const c of shuffled) {
    const out = await claimForUser(c, userId, region);
    if (out.claim && !out.error) {
      await SpinPlay.create({ user: userId, campaign: c._id, claim: out.claim._id, region });
      const vendor = await CouponVendor.findById(c.vendor).select("businessName logo slug").lean();
      return res.status(201).json({
        success: true,
        won: { campaignId: c._id, slug: c.slug, title: c.title, offerText: c.offerText, vendor },
        claim: out.claim, alreadyClaimed: !!out.alreadyClaimed,
      });
    }
  }
  return res.status(400).json({ success: false, message: "No prizes left right now — try again later" });
}

/* GET /api/coupons/my-claims */
async function myClaims(req, res) {
  const items = await CouponClaim.find({ user: req.user.userId })
    .populate({ path: "campaign", select: "title slug offerText bannerImage endAt isOnline redirectUrl" })
    .populate({ path: "vendor", select: VENDOR_CARD })
    .sort({ createdAt: -1 }).limit(100).lean();
  return res.json({ success: true, items });
}

/* ── IP → location (auto-detect for first-time visitors) ─────────────────── */
const IN_REGIONS = {
  AP: "Andhra Pradesh", AR: "Arunachal Pradesh", AS: "Assam", BR: "Bihar", CT: "Chhattisgarh",
  CH: "Chandigarh", DL: "Delhi", GA: "Goa", GJ: "Gujarat", HR: "Haryana", HP: "Himachal Pradesh",
  JK: "Jammu & Kashmir", JH: "Jharkhand", KA: "Karnataka", KL: "Kerala", MP: "Madhya Pradesh",
  MH: "Maharashtra", MN: "Manipur", ML: "Meghalaya", MZ: "Mizoram", NL: "Nagaland", OR: "Odisha",
  PB: "Punjab", PY: "Puducherry", RJ: "Rajasthan", SK: "Sikkim", TN: "Tamil Nadu", TG: "Telangana",
  TR: "Tripura", UP: "Uttar Pradesh", UT: "Uttarakhand", WB: "West Bengal",
};
const US_REGIONS = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho",
  IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
  ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas",
  UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia",
  WI: "Wisconsin", WY: "Wyoming", DC: "Washington DC",
};

/* GET /api/coupons/geo — best-effort location from the caller's IP */
async function geo(req, res) {
  try {
    const geoip = require("geoip-lite");
    const raw = (req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || req.ip || "")
      .toString().split(",")[0].trim().replace(/^::ffff:/, "");
    const hit = raw ? geoip.lookup(raw) : null;
    if (!hit) return res.json({ success: true, found: false });
    const state = hit.country === "IN" ? IN_REGIONS[hit.region] : hit.country === "US" ? US_REGIONS[hit.region] : "";
    return res.json({
      success: true, found: !!state,
      country: hit.country, state: state || "", city: hit.city || "",
      lat: hit.ll?.[0] ?? null, lng: hit.ll?.[1] ?? null,
    });
  } catch {
    return res.json({ success: true, found: false });
  }
}

module.exports = { home, list, categories, detail, vendorPage, claim, myClaims, spinWheel, spinPlay, geo };
