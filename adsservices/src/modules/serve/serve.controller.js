const Ad = require("../../models/Ad");
const Zone = require("../../models/Zone");
const Impression = require("../../models/Impression");
const Click = require("../../models/Click");
const { resolveLocation, clientIp } = require("../../utils/geo");

const PUBLIC_URL = () => process.env.PUBLIC_URL || "";

// Build a Mongo filter that matches ACTIVE, in-date, geo-targeted, capped ads.
function buildAdFilter(loc, zone) {
  const now = new Date();
  const filter = {
    status: "active",
    $and: [
      { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
      { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
    ],
  };

  if (zone) {
    filter.type = zone.type; // banner zone serves banner ads, etc.
    // ad.zones empty (any) OR includes this zone
    filter.$and.push({ $or: [{ zones: { $size: 0 } }, { zones: zone._id }] });
  }

  // Geo targeting: empty array = no restriction; otherwise must include viewer value.
  const geoCond = (field, value) =>
    value
      ? { $or: [{ [field]: { $size: 0 } }, { [field]: value } ] }
      : { [field]: { $size: 0 } }; // unknown geo → only untargeted ads

  filter.$and.push(geoCond("targeting.countries", loc.country));
  filter.$and.push(geoCond("targeting.states", loc.region));
  // cities optional — only restrict when ad has cities AND we know the city
  if (loc.city) {
    filter.$and.push({ $or: [{ "targeting.cities": { $size: 0 } }, { "targeting.cities": loc.city }] });
  } else {
    filter.$and.push({ "targeting.cities": { $size: 0 } });
  }

  return filter;
}

// Weighted random pick (higher weight = more likely). Also respects impressionCap.
function pickWeighted(ads) {
  const eligible = ads.filter((a) => !a.impressionCap || a.impressions < a.impressionCap);
  if (!eligible.length) return null;
  const total = eligible.reduce((s, a) => s + (a.weight || 1), 0);
  let r = Math.random() * total;
  for (const a of eligible) {
    r -= a.weight || 1;
    if (r <= 0) return a;
  }
  return eligible[0];
}

async function logImpression(ad, zone, loc, req) {
  await Impression.create({
    ad: ad._id, advertiser: ad.advertiser, publisher: zone?.publisher || null, zone: zone?._id || null,
    app: req.query.app || zone?.app || "",
    ip: loc.ip, country: loc.country, region: loc.region, city: loc.city,
    userAgent: req.headers["user-agent"] || "",
  });
  await Ad.updateOne({ _id: ad._id }, { $inc: { impressions: 1 } });
}

function adPayload(ad, zone, req) {
  const base = PUBLIC_URL();
  const clickUrl = `${base}/api/click/${ad._id}?zone=${zone?.apiKey || ""}&app=${req.query.app || zone?.app || ""}`;
  return {
    id: ad._id,
    type: ad.type,
    title: ad.title,
    creativeUrl: base + ad.creativeUrl,
    thumbnailUrl: ad.thumbnailUrl ? base + ad.thumbnailUrl : "",
    width: ad.width, height: ad.height, duration: ad.duration,
    cta: ad.ctaText || "Learn More",
    clickUrl,
  };
}

async function resolveZone(req) {
  const key = req.query.zone;
  if (!key) return null;
  return Zone.findOne({ apiKey: key, isActive: true });
}

// GET /api/serve?zone=<apiKey>&ip=&country=&state=&app=
async function serve(req, res) {
  const zone = await resolveZone(req);
  if (req.query.zone && !zone) return res.json({ success: true, ad: null, reason: "zone not found" });

  const loc = resolveLocation(req);
  const filter = buildAdFilter(loc, zone);

  // pull a candidate set, then weighted-pick in app
  const candidates = await Ad.find(filter).limit(50);
  const ad = pickWeighted(candidates);
  if (!ad) return res.json({ success: true, ad: null });

  await logImpression(ad, zone, loc, req);
  res.json({ success: true, ad: adPayload(ad, zone, req), location: { country: loc.country, state: loc.region, city: loc.city } });
}

// GET /api/serve/multi?zone=&count=3   — several distinct ads
async function serveMulti(req, res) {
  const zone = await resolveZone(req);
  if (req.query.zone && !zone) return res.json({ success: true, ads: [] });
  const count = Math.min(Math.max(parseInt(req.query.count) || 3, 1), 10);

  const loc = resolveLocation(req);
  const candidates = await Ad.find(buildAdFilter(loc, zone)).limit(50);

  const chosen = [];
  const pool = [...candidates];
  while (chosen.length < count && pool.length) {
    const ad = pickWeighted(pool);
    if (!ad) break;
    chosen.push(ad);
    pool.splice(pool.indexOf(ad), 1);
  }
  for (const ad of chosen) await logImpression(ad, zone, loc, req);
  res.json({ success: true, ads: chosen.map((a) => adPayload(a, zone, req)) });
}

// GET /api/click/:adId?zone=&app=   — log click, then redirect to target
async function click(req, res) {
  const ad = await Ad.findById(req.params.adId);
  if (!ad) return res.status(404).send("Ad not found");

  const zone = req.query.zone ? await Zone.findOne({ apiKey: req.query.zone }) : null;
  const loc = resolveLocation(req);
  const clickDoc = await Click.create({
    ad: ad._id, advertiser: ad.advertiser, publisher: zone?.publisher || null, zone: zone?._id || null,
    app: req.query.app || zone?.app || "",
    ip: loc.ip, country: loc.country, region: loc.region, city: loc.city,
  });
  await Ad.updateOne({ _id: ad._id }, { $inc: { clicks: 1 } });

  if (ad.targetUrl) {
    // Append our click id so the advertiser's site can attribute a later conversion.
    const sep = ad.targetUrl.includes("?") ? "&" : "?";
    return res.redirect(302, ad.targetUrl + sep + "dd_click=" + clickDoc._id);
  }
  res.json({ success: true, message: "Click recorded (no target URL set)" });
}

module.exports = { serve, serveMulti, click };
