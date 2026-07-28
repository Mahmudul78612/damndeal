const Ad = require("../../models/Ad");
const Advertiser = require("../../models/Advertiser");
const analytics = require("../analytics/analytics.service");
const { ApiError } = require("../../middleware/error.middleware");

// GET /api/advertiser/me
async function me(req, res) {
  const adv = await Advertiser.findById(req.auth.id);
  res.json({ success: true, data: adv });
}

// GET /api/advertiser/ads
async function myAds(req, res) {
  const ads = await Ad.find({ advertiser: req.auth.id })
    .sort({ createdAt: -1 })
    .select("title type status creativeUrl thumbnailUrl impressions clicks startDate endDate createdAt");
  const base = process.env.PUBLIC_URL || "";
  res.json({
    success: true,
    items: ads.map((a) => ({
      ...a.toObject(),
      creativeUrl: a.creativeUrl ? base + a.creativeUrl : "",
      thumbnailUrl: a.thumbnailUrl ? base + a.thumbnailUrl : "",
      ctr: a.impressions > 0 ? Math.round((a.clicks / a.impressions) * 10000) / 100 : 0,
    })),
  });
}

// GET /api/advertiser/ads/:id   (must own it)
async function myAd(req, res) {
  const ad = await Ad.findOne({ _id: req.params.id, advertiser: req.auth.id });
  if (!ad) throw new ApiError(404, "Ad not found");
  const base = process.env.PUBLIC_URL || "";
  const out = ad.toObject();
  out.creativeUrl = ad.creativeUrl ? base + ad.creativeUrl : "";
  out.thumbnailUrl = ad.thumbnailUrl ? base + ad.thumbnailUrl : "";
  res.json({ success: true, data: out });
}

// GET /api/advertiser/analytics/overview
async function overview(req, res) {
  const base = { advertiser: req.auth.id };
  const [stats, top] = await Promise.all([
    analytics.overview(base, req.query),
    analytics.topAds(base, req.query),
  ]);
  const activeAds = await Ad.countDocuments({ advertiser: req.auth.id, status: "active" });
  res.json({ success: true, data: { ...stats, activeAds, topAds: top } });
}

// GET /api/advertiser/analytics/ads/:id   (state-wise + trend, must own)
async function adAnalytics(req, res) {
  const ad = await Ad.findOne({ _id: req.params.id, advertiser: req.auth.id });
  if (!ad) throw new ApiError(404, "Ad not found");
  const base = { ad: ad._id };
  const [stats, series, states] = await Promise.all([
    analytics.overview(base, req.query),
    analytics.timeSeries(base, req.query),
    analytics.byState(base, req.query),
  ]);
  res.json({ success: true, data: { adId: ad._id, title: ad.title, ...stats, series, states } });
}

module.exports = { me, myAds, myAd, overview, adAnalytics };
