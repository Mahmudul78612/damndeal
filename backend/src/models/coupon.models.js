/**
 * DamnDeal Coupons — marketplace models (region-aware: IN ₹ / US $).
 * One cohesive file: Category, Vendor, Campaign, Claim, Section (admin homepage
 * builder), PackOrder (vendor buys claim quota; admin sets pricing per category).
 */
const mongoose = require("mongoose");

/* ── Category (admin-managed; holds pack pricing per region) ─────────────── */
const couponCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    icon: { type: String, default: "🏷️" }, // emoji or image path
    image: { type: String, default: "" },
    regions: { type: [String], enum: ["IN", "US"], default: ["IN", "US"], index: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    // Pack pricing — admin sets what "100 coupons" costs in this category.
    packs: [
      {
        _id: false,
        claims: { type: Number, required: true }, // e.g. 100
        priceINR: { type: Number, default: 0 },
        priceUSD: { type: Number, default: 0 },
        label: { type: String, default: "" }, // e.g. "Starter"
      },
    ],
  },
  { timestamps: true }
);

/* ── Vendor (brand / doctor / shop — linked to a DamnDeal user account) ───── */
const couponVendorSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    businessName: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    logo: { type: String, default: "" },
    description: { type: String, default: "" },
    website: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    // The company this brand belongs to (roadmap phase 2). Backfilled by
    // scripts/phase2-coupon-orgs.js for every vendor that existed before.
    org: { type: mongoose.Schema.Types.ObjectId, ref: "CouponOrg", default: null, index: true },
    // NOTE: the address fields below are the LEGACY single location. They are
    // kept as the brand's registered address; the real, filterable locations
    // now live in CouponOutlet.
    state: { type: String, default: "" },
    city: { type: String, default: "" },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "CouponCategory" }],
    regions: { type: [String], enum: ["IN", "US"], default: ["IN"], index: true },
    status: { type: String, enum: ["pending", "approved", "suspended"], default: "approved", index: true },
    isVerifiedBadge: { type: Boolean, default: false }, // ✔ shown on cards (admin grants)
    // External verify API (for vendors with their own website/portal)
    // API key is never stored in the clear: only its sha256 hash is kept, plus
    // a short prefix so the portal can show "dck_1a2b…" for recognition.
    // The full key is returned exactly once, at creation/rotation time.
    apiKeyHash: { type: String, default: null, index: true },
    apiKeyPrefix: { type: String, default: null },
    apiKey: { type: String, default: null }, // legacy plaintext — cleared by migration
    apiKeyCreatedAt: { type: Date, default: null },
    // Claim quota credited from pack purchases (campaign creation consumes it)
    claimCredits: { type: Number, default: 50 }, // free starter credits
    totalCreditsPurchased: { type: Number, default: 0 },
  },
  { timestamps: true }
);

/* ── Campaign (a coupon listing) ──────────────────────────────────────────── */
const couponCampaignSchema = new mongoose.Schema(
  {
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "CouponVendor", required: true, index: true },
    title: { type: String, required: true, trim: true }, // "30% OFF annual membership"
    slug: { type: String, required: true, unique: true, lowercase: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "CouponCategory", required: true, index: true },
    offerType: { type: String, enum: ["percent", "flat", "bogo", "freebie", "custom"], default: "percent" },
    offerValue: { type: Number, default: 0 }, // 30 (%) or 500 (flat)
    offerText: { type: String, required: true }, // display: "30% OFF", "Buy 1 Get 1"
    description: { type: String, default: "" },
    instructions: { type: String, default: "" }, // how-to-redeem steps (one per line)
    terms: { type: String, default: "" },
    bannerImage: { type: String, default: "" },
    // Online brands: customer clicks through with code; offline: show QR at counter.
    isOnline: { type: Boolean, default: false },
    redirectUrl: { type: String, default: "" },
    totalQuota: { type: Number, default: 50 }, // claims allowed (consumes vendor credits)
    claimedCount: { type: Number, default: 0 },
    redeemedCount: { type: Number, default: 0 },
    perUserLimit: { type: Number, default: 1 },
    startAt: { type: Date, default: Date.now },
    endAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["draft", "pending", "active", "paused", "expired", "rejected"],
      default: "pending",
      index: true,
    },
    rejectReason: { type: String, default: "" },
    // Sponsored/featured — paid top placement (admin toggles after payment)
    featured: {
      active: { type: Boolean, default: false },
      until: { type: Date, default: null },
    },
    regions: { type: [String], enum: ["IN", "US"], default: ["IN"], index: true },
    views: { type: Number, default: 0 },
    inSpin: { type: Boolean, default: false, index: true }, // eligible for the Spin & Win wheel
    // ── Location targeting (a doctor in Punjab shouldn't show in Kerala) ──
    location: {
      nationwide: { type: Boolean, default: true },   // online/brand offers show everywhere
      states: { type: [String], default: [] },        // e.g. ["Punjab", "Delhi"]
      city: { type: String, default: "" },
      radiusKm: { type: Number, default: 0 },         // vendor's service radius (display)
      point: {                                        // GeoJSON for "near me" filtering
        type: { type: String, enum: ["Point"], default: undefined },
        coordinates: { type: [Number], default: undefined }, // [lng, lat]
      },
      // NOTE: outlet coordinates are deliberately NOT duplicated here.
      // MongoDB cannot build a 2dsphere index over an array of GeoJSON
      // objects ("Can't extract geo keys"), so "near me" for multi-outlet
      // campaigns is resolved by querying CouponOutlet first — see
      // locFilter() in public.controller.js. `point` below stays as the
      // legacy single location for campaigns created before outlets existed.
    },

    /* ── Multi-location targeting (roadmap phase 2) ──
       all_outlets : every active outlet of this brand
       selected    : only `outlets`
       online      : no physical location, shows everywhere            */
    scope: {
      type: String,
      enum: ["all_outlets", "selected", "online"],
      default: "all_outlets",
    },
    outlets: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "CouponOutlet" }],
      default: [],
    },
    org: { type: mongoose.Schema.Types.ObjectId, ref: "CouponOrg", default: null, index: true },
  },
  { timestamps: true }
);
couponCampaignSchema.index({ status: 1, regions: 1, "featured.active": 1 });
couponCampaignSchema.index({ "location.states": 1 });
couponCampaignSchema.index({ "location.point": "2dsphere" }, { sparse: true });
couponCampaignSchema.index({ org: 1, status: 1 });
couponCampaignSchema.index({ outlets: 1 });

/* ── Claim (unique code per customer per campaign) ────────────────────────── */
const couponClaimSchema = new mongoose.Schema(
  {
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: "CouponCampaign", required: true, index: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "CouponVendor", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    code: { type: String, required: true, unique: true }, // DD-XXXX-XXXX
    status: { type: String, enum: ["claimed", "redeemed", "expired", "cancelled"], default: "claimed", index: true },
    claimedAt: { type: Date, default: Date.now },
    redeemedAt: { type: Date, default: null },
    redeemedVia: { type: String, enum: [null, "portal", "api"], default: null },
    region: { type: String, enum: ["IN", "US"], default: "IN" },
    // 0-based index of this claim within the user's per-campaign allowance.
    // The unique {campaign,user,slot} index below is what actually enforces
    // perUserLimit — a count() check alone loses to parallel requests.
    slot: { type: Number, default: 0 },

    /* ── Redemption attribution (roadmap phase 2) ──
       Without these, per-outlet reporting and fraud tracing are impossible. */
    org: { type: mongoose.Schema.Types.ObjectId, ref: "CouponOrg", default: null, index: true },
    redeemedOutlet: { type: mongoose.Schema.Types.ObjectId, ref: "CouponOutlet", default: null },
    redeemedBy: { type: mongoose.Schema.Types.ObjectId, ref: "CouponMember", default: null },
    billValue: { type: Number, default: null }, // optional bill amount for ROI
  },
  { timestamps: true }
);
couponClaimSchema.index({ campaign: 1, user: 1, slot: 1 }, { unique: true });
couponClaimSchema.index({ redeemedOutlet: 1, redeemedAt: -1 });
couponClaimSchema.index({ org: 1, status: 1 });
couponClaimSchema.index({ user: 1, createdAt: -1 });      // my-coupons page
couponClaimSchema.index({ vendor: 1, status: 1 });        // vendor redemption lists
couponClaimSchema.index({ campaign: 1, user: 1 });

/* ── Section (admin-customizable homepage, like home-sections) ────────────── */
/**
 * `data` is Mixed on purpose — the admin homepage builder writes a small config
 * blob per section. Schema v2 keys (all optional, every reader MUST default):
 *
 *   ── content source (coupon-listing sections) ──
 *   source        'auto' | 'manual'      manual = admin hand-picked coupons
 *   campaignIds   [ObjectId]             used when source === 'manual', order preserved
 *   categoryId    ObjectId | null        auto filter
 *   vendorId      ObjectId | null        auto filter
 *   sort          'newest' | 'popular' | 'ending' | 'discount'
 *   limit         Number                 default 12 (sponsored 6), capped at 30
 *
 *   ── presentation ──
 *   cardStyle     'ticket' | 'tile' | 'list' | 'compact'   (legacy: data.style)
 *   columns       2 | 3 | 4 | 5          desktop columns, default 3
 *   bg            'white' | 'band' | 'gradient'
 *
 *   ── banner sections ──
 *   banners       [{ image, link, title, badge }]
 *   bannerStyle   'plain' | 'coupon' | 'rounded'   ('coupon' = ticket frame)
 *   aspect        '16:9' | '3:1' | '3:4' | '1:1'
 *   autoplay      Boolean
 *
 *   ── legacy keys that stay supported ──
 *   text, link, bgColor (top_strip), image (banner_single), style (→ cardStyle)
 *
 * BACK-COMPAT: rows created before v2 have none of these keys. Defaults are
 * source 'auto', cardStyle (data.style || 'ticket'), columns 3, bg 'white',
 * bannerStyle 'rounded', aspect '16:9'.
 */
const couponSectionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "top_strip",      // announcement bar: { text, link, bgColor }
        "hero_banner",    // banners: [{ image, link, title, badge }]
        "category_rail",  // auto categories row
        "sponsored",      // featured campaigns { limit }
        "coupon_grid",    // coupons { source, campaignIds|categoryId|vendorId, sort, limit }
        "brand_row",      // vendors row { limit, title }
        "banner_single",  // { image, link } / banners[0]
        "banner_grid",    // banners: [{ image, link, title, badge }] laid out as a grid
        "countdown_deal", // coupons ending soonest (future endAt only)
      ],
      required: true,
    },
    title: { type: String, default: "" },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    regions: { type: [String], enum: ["IN", "US"], default: ["IN", "US"], index: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/* ── PackOrder (vendor buys claim quota; v1 admin-approves payment) ───────── */
const couponPackOrderSchema = new mongoose.Schema(
  {
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "CouponVendor", required: true, index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "CouponCategory", required: true },
    claims: { type: Number, required: true },
    price: { type: Number, required: true },
    currency: { type: String, enum: ["INR", "USD"], default: "INR" },
    region: { type: String, enum: ["IN", "US"], default: "IN" },
    status: { type: String, enum: ["pending", "paid", "rejected", "failed"], default: "pending", index: true },
    paymentRef: { type: String, default: "" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    /* ── Real payments (roadmap phase 4) ──
       Credits are granted ONLY from a verified gateway callback, never from a
       browser redirect, and `creditsGrantedAt` makes that grant idempotent so
       a replayed webhook cannot double-credit an account. */
    org: { type: mongoose.Schema.Types.ObjectId, ref: "CouponOrg", default: null, index: true },
    gateway: { type: String, enum: [null, "razorpay", "stripe", "manual"], default: null },
    gatewayOrderId: { type: String, default: null, index: true },  // rzp order / stripe session
    gatewayPaymentId: { type: String, default: null },
    taxPercent: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },   // price + tax, what was charged
    creditsGrantedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    invoiceNumber: { type: String, default: null, index: true },
    autoTopUp: { type: Boolean, default: false },
  },
  { timestamps: true }
);

/* ── SpinPlay (one spin per user per cooldown window) ── */
const spinPlaySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: "CouponCampaign" },
    claim: { type: mongoose.Schema.Types.ObjectId, ref: "CouponClaim" },
    region: { type: String, enum: ["IN", "US"], default: "IN" },
  },
  { timestamps: true }
);

module.exports = {
  CouponCategory: mongoose.model("CouponCategory", couponCategorySchema),
  CouponVendor: mongoose.model("CouponVendor", couponVendorSchema),
  CouponCampaign: mongoose.model("CouponCampaign", couponCampaignSchema),
  CouponClaim: mongoose.model("CouponClaim", couponClaimSchema),
  CouponSection: mongoose.model("CouponSection", couponSectionSchema),
  CouponPackOrder: mongoose.model("CouponPackOrder", couponPackOrderSchema),
  SpinPlay: mongoose.model("SpinPlay", spinPlaySchema),
};
