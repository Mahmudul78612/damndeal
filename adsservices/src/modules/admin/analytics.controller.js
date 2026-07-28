const Ad = require("../../models/Ad");
const Advertiser = require("../../models/Advertiser");
const Zone = require("../../models/Zone");
const analytics = require("../analytics/analytics.service");
const { ApiError } = require("../../middleware/error.middleware");

// GET /api/admin/analytics/overview  — network-wide KPIs
async function overview(req, res) {
  const base = {};
  const [stats, activeAds, advertisers, zones, top] = await Promise.all([
    analytics.overview(base, req.query),
    Ad.countDocuments({ status: "active" }),
    Advertiser.countDocuments({ isActive: true }),
    Zone.countDocuments({ isActive: true }),
    analytics.topAds(base, req.query),
  ]);
  res.json({ success: true, data: { ...stats, activeAds, advertisers, zones, topAds: top } });
}

// GET /api/admin/analytics/ads/:id  — one ad full analytics
async function adAnalytics(req, res) {
  const ad = await Ad.findById(req.params.id).populate("advertiser", "name");
  if (!ad) throw new ApiError(404, "Ad not found");
  const base = { ad: ad._id };
  const [stats, series, states] = await Promise.all([
    analytics.overview(base, req.query),
    analytics.timeSeries(base, req.query),
    analytics.byState(base, req.query),
  ]);
  res.json({ success: true, data: { ad, ...stats, series, states } });
}

// GET /api/admin/analytics/by-state  — state-wise across the whole network
async function byState(req, res) {
  const states = await analytics.byState({}, req.query);
  res.json({ success: true, data: states });
}

module.exports = { overview, adAnalytics, byState };
