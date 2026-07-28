const Publisher = require("../../models/Publisher");
const Zone = require("../../models/Zone");
const Impression = require("../../models/Impression");
const Click = require("../../models/Click");
const analytics = require("../analytics/analytics.service");
const { ApiError } = require("../../middleware/error.middleware");

// GET /api/publisher/me   (includes apiKey)
async function me(req, res) {
  const pub = await Publisher.findById(req.auth.id);
  res.json({ success: true, data: pub });
}

// GET /api/publisher/zones   (my ad slots + their keys + per-zone counts)
async function myZones(req, res) {
  const zones = await Zone.find({ publisher: req.auth.id }).sort({ createdAt: -1 }).lean();
  // attach per-zone impressions/clicks
  const out = await Promise.all(zones.map(async (z) => {
    const [impressions, clicks] = await Promise.all([
      Impression.countDocuments({ zone: z._id }),
      Click.countDocuments({ zone: z._id }),
    ]);
    return { ...z, impressions, clicks, ctr: impressions ? Math.round((clicks / impressions) * 10000) / 100 : 0 };
  }));
  res.json({ success: true, items: out });
}

// GET /api/publisher/analytics/overview
async function overview(req, res) {
  const base = { publisher: req.auth.id };
  const [stats, series, states] = await Promise.all([
    analytics.overview(base, req.query),
    analytics.timeSeries(base, req.query),
    analytics.byState(base, req.query),
  ]);
  const zones = await Zone.countDocuments({ publisher: req.auth.id });
  res.json({ success: true, data: { ...stats, zones, series, states } });
}

module.exports = { me, myZones, overview };
