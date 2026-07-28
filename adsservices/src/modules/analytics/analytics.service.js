const Impression = require("../../models/Impression");
const Click = require("../../models/Click");
const Conversion = require("../../models/Conversion");
const Ad = require("../../models/Ad");

function ctr(impr, clk) { return impr > 0 ? Math.round((clk / impr) * 10000) / 100 : 0; }
function rate(num, den) { return den > 0 ? Math.round((num / den) * 10000) / 100 : 0; }

function rangeMatch(query) {
  const m = {};
  if (query.from || query.to) {
    m.createdAt = {};
    if (query.from) m.createdAt.$gte = new Date(query.from);
    if (query.to) m.createdAt.$lte = new Date(query.to);
  }
  return m;
}

// base = scope filter, e.g. { advertiser: id } or { ad: id } or {}
async function overview(base, query = {}) {
  const match = { ...base, ...rangeMatch(query) };
  const [impr, clk, convAgg] = await Promise.all([
    Impression.countDocuments(match),
    Click.countDocuments(match),
    Conversion.aggregate([{ $match: match }, { $group: { _id: null, n: { $sum: 1 }, value: { $sum: "$value" } } }]),
  ]);
  const conversions = convAgg[0]?.n || 0;
  const conversionValue = Math.round((convAgg[0]?.value || 0) * 100) / 100;
  return {
    impressions: impr, clicks: clk, ctr: ctr(impr, clk),
    conversions, conversionValue,
    convRate: rate(conversions, clk), // conversions per click %
  };
}

// daily time series of impressions + clicks
async function timeSeries(base, query = {}) {
  const match = { ...base, ...rangeMatch(query) };
  const fmt = query.groupBy === "month" ? "%Y-%m" : query.groupBy === "hour" ? "%Y-%m-%d %H:00" : "%Y-%m-%d";
  const group = (Model) =>
    Model.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: fmt, date: "$createdAt" } }, n: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
  const [imp, clk] = await Promise.all([group(Impression), group(Click)]);
  const map = {};
  imp.forEach((r) => { map[r._id] = { date: r._id, impressions: r.n, clicks: 0 }; });
  clk.forEach((r) => { map[r._id] = map[r._id] || { date: r._id, impressions: 0, clicks: 0 }; map[r._id].clicks = r.n; });
  return Object.values(map).map((r) => ({ ...r, ctr: ctr(r.impressions, r.clicks) }));
}

// state-wise breakdown (the recommendation table)
async function byState(base, query = {}) {
  const match = { ...base, ...rangeMatch(query) };
  const agg = (Model) =>
    Model.aggregate([
      { $match: match },
      { $group: { _id: { country: "$country", region: "$region" }, n: { $sum: 1 } } },
    ]);
  const [imp, clk] = await Promise.all([agg(Impression), agg(Click)]);
  const map = {};
  const key = (x) => `${x._id.country || "?"}|${x._id.region || "?"}`;
  imp.forEach((r) => { map[key(r)] = { country: r._id.country, state: r._id.region, impressions: r.n, clicks: 0 }; });
  clk.forEach((r) => { const k = key(r); map[k] = map[k] || { country: r._id.country, state: r._id.region, impressions: 0, clicks: 0 }; map[k].clicks = r.n; });
  return Object.values(map)
    .map((r) => ({ ...r, ctr: ctr(r.impressions, r.clicks) }))
    .sort((a, b) => b.impressions - a.impressions);
}

// top ads by impressions within scope
async function topAds(base, query = {}) {
  const adFilter = base.advertiser ? { advertiser: base.advertiser } : {};
  const ads = await Ad.find(adFilter).sort({ impressions: -1 }).limit(10)
    .select("title type impressions clicks status advertiser").populate("advertiser", "name");
  return ads.map((a) => ({
    id: a._id, title: a.title, type: a.type, status: a.status,
    advertiser: a.advertiser?.name, impressions: a.impressions, clicks: a.clicks, ctr: ctr(a.impressions, a.clicks),
  }));
}

module.exports = { overview, timeSeries, byState, topAds, ctr };
