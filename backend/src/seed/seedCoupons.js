/**
 * Seed the coupon marketplace: categories (+pack pricing), default homepage
 * sections, a demo vendor and demo campaigns (both regions) so the site has
 * content on day one. Idempotent — safe to re-run.
 *
 *   cd /var/www/damndeal && node src/seed/seedCoupons.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const {
  CouponCategory, CouponVendor, CouponCampaign, CouponSection,
} = require("../models/coupon.models");

const CATS = [
  { name: "Food & Drink", icon: "🍔", sortOrder: 1 },
  { name: "Health", icon: "🩺", sortOrder: 2 },
  { name: "Beauty & Salon", icon: "💇", sortOrder: 3 },
  { name: "Fitness", icon: "💪", sortOrder: 4 },
  { name: "Shopping", icon: "🛍️", sortOrder: 5 },
  { name: "Services", icon: "🔧", sortOrder: 6 },
  { name: "Travel", icon: "✈️", sortOrder: 7 },
  { name: "Education", icon: "📚", sortOrder: 8 },
  { name: "Entertainment", icon: "🎬", sortOrder: 9 },
  { name: "Pets", icon: "🐾", sortOrder: 10 },
];
const PACKS = [
  { claims: 100, priceINR: 999, priceUSD: 29, label: "Starter" },
  { claims: 500, priceINR: 3999, priceUSD: 119, label: "Growth" },
  { claims: 1000, priceINR: 6999, priceUSD: 199, label: "Scale" },
];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("connected");

  // 1) Categories
  const catMap = {};
  for (const c of CATS) {
    const doc = await CouponCategory.findOneAndUpdate(
      { slug: slug(c.name) },
      { $setOnInsert: { name: c.name, slug: slug(c.name), icon: c.icon, sortOrder: c.sortOrder, packs: PACKS, regions: ["IN", "US"] } },
      { upsert: true, new: true }
    );
    catMap[c.name] = doc;
  }
  console.log("categories:", Object.keys(catMap).length);

  // 2) Demo vendor (linked to a system user)
  let demoUser = await User.findOne({ phone: "+910000000001", role: "user" });
  if (!demoUser) demoUser = await User.create({ phone: "+910000000001", role: "user", name: "DamnDeal Demo Brands" });
  let vendor = await CouponVendor.findOne({ user: demoUser._id });
  if (!vendor) {
    vendor = await CouponVendor.create({
      user: demoUser._id, businessName: "DamnDeal Picks", slug: "damndeal-picks",
      description: "Hand-picked launch offers from the DamnDeal team.",
      regions: ["IN", "US"], isVerifiedBadge: true, claimCredits: 100000,
    });
  }
  console.log("demo vendor:", vendor.businessName);

  // 3) Demo campaigns (both regions; marked via vendor "DamnDeal Picks")
  const end = new Date(Date.now() + 90 * 86400000);
  const CAMPAIGNS = [
    { title: "Flat 20% OFF on your first DamnDeal order", cat: "Shopping", offerType: "percent", offerValue: 20, offerText: "20% OFF", desc: "Welcome offer for new customers — flat 20% off your first order on DamnDeal.", online: true, url: "https://damndeal.in", featured: true, regions: ["IN"] },
    { title: "Flat $5 OFF sitewide at DamnDeal USA", cat: "Shopping", offerType: "flat", offerValue: 5, offerText: "$5 OFF", desc: "Launch celebration — $5 off any order at damndeal.com.", online: true, url: "https://damndeal.com", featured: true, regions: ["US"] },
    { title: "Buy 1 Get 1 Free — Hand-tossed Pizza", cat: "Food & Drink", offerType: "bogo", offerValue: 0, offerText: "Buy 1 Get 1", desc: "Show your coupon QR at the counter and get a second pizza free. Dine-in only.", featured: true, regions: ["IN", "US"] },
    { title: "Free dental consultation + 20% off cleaning", cat: "Health", offerType: "freebie", offerValue: 0, offerText: "FREE Consult", desc: "First visit free for new patients, plus 20% off scaling & polishing.", regions: ["IN", "US"] },
    { title: "₹500 OFF salon styling packages", cat: "Beauty & Salon", offerType: "flat", offerValue: 500, offerText: "₹500 OFF", desc: "On any styling package above ₹1,500. Weekdays only.", regions: ["IN"] },
    { title: "30% OFF annual gym membership", cat: "Fitness", offerType: "percent", offerValue: 30, offerText: "30% OFF", desc: "Unlimited access + 2 free PT sessions for new members.", regions: ["IN", "US"] },
    { title: "Free diagnostics on phone & laptop repair", cat: "Services", offerType: "freebie", offerValue: 0, offerText: "FREE Check", desc: "Diagnostics fee waived when you repair with us. All brands.", regions: ["IN", "US"] },
    { title: "2 movie tickets for the price of 1", cat: "Entertainment", offerType: "bogo", offerValue: 0, offerText: "2-for-1", desc: "Any show Monday to Thursday. Excludes premium formats.", regions: ["IN", "US"] },
    { title: "First vet visit free for your pet", cat: "Pets", offerType: "freebie", offerValue: 0, offerText: "FREE Visit", desc: "Complete check-up for cats & dogs. Vaccination charged separately.", regions: ["IN", "US"] },
  ];
  let made = 0;
  for (const c of CAMPAIGNS) {
    const s = slug(`damndeal-picks-${c.title}`).slice(0, 60);
    const exists = await CouponCampaign.findOne({ slug: s });
    if (exists) continue;
    await CouponCampaign.create({
      vendor: vendor._id, title: c.title, slug: s, category: catMap[c.cat]._id,
      offerType: c.offerType, offerValue: c.offerValue, offerText: c.offerText,
      description: c.desc, terms: "One coupon per customer. Cannot be combined with other offers. Valid till expiry shown.",
      isOnline: !!c.online, redirectUrl: c.url || "",
      totalQuota: 1000, perUserLimit: 1, endAt: end, status: "active",
      featured: { active: !!c.featured, until: end }, regions: c.regions,
    });
    made++;
  }
  console.log("demo campaigns created:", made);

  // 4) Default homepage sections (only if none exist)
  const haveSections = await CouponSection.countDocuments();
  if (!haveSections) {
    await CouponSection.insertMany([
      { type: "top_strip", title: "", data: { text: "🎉 Launch week — claim any coupon free. Vendors list free too!", link: "/list-your-coupon", bgColor: "#7C3AED" }, sortOrder: 0 },
      { type: "hero_banner", title: "", data: { banners: [] }, sortOrder: 1 },
      { type: "category_rail", title: "Browse by category", data: {}, sortOrder: 2 },
      { type: "sponsored", title: "Featured coupons", data: { limit: 6 }, sortOrder: 3 },
      { type: "coupon_grid", title: "All coupons", data: { limit: 24 }, sortOrder: 4 },
      { type: "brand_row", title: "Popular brands", data: { limit: 12 }, sortOrder: 5 },
    ]);
    console.log("default sections created");
  } else console.log("sections already exist:", haveSections);

  await mongoose.disconnect();
  console.log("done ✅");
}
run().catch((e) => { console.error("SEED ERR:", e); process.exit(1); });
