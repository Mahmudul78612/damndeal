const Conversion = require("../../models/Conversion");
const Click = require("../../models/Click");
const Impression = require("../../models/Impression");
const Ad = require("../../models/Ad");
const Advertiser = require("../../models/Advertiser");
const Zone = require("../../models/Zone");
const { resolveLocation } = require("../../utils/geo");

// Resolve which ad/advertiser/click a conversion belongs to.
// Priority: dd_click id (exact) > advertiser apiKey + recent click by IP > zone + recent impression by IP.
async function attribute(req, body, loc) {
  // 1. exact click attribution (best — like fbclid/gclid)
  if (body.clickId) {
    const click = await Click.findById(body.clickId).catch(() => null);
    if (click) return { ad: click.ad, advertiser: click.advertiser, zone: click.zone, click: click._id };
  }
  // 2. server-side Conversions API key → find that advertiser's most recent click from this IP (last 30d)
  const apiKey = req.headers["x-api-key"] || body.apiKey;
  if (apiKey) {
    const adv = await Advertiser.findOne({ apiKey });
    if (adv) {
      const since = new Date(Date.now() - 30 * 86400000);
      const click = await Click.findOne({ advertiser: adv._id, ip: loc.ip, createdAt: { $gte: since } }).sort({ createdAt: -1 });
      return { ad: click?.ad || null, advertiser: adv._id, zone: click?.zone || null, click: click?._id || null };
    }
  }
  // 3. zone fallback — last impression from this IP in that zone
  if (body.zone) {
    const zone = await Zone.findOne({ apiKey: body.zone });
    if (zone) {
      const imp = await Impression.findOne({ zone: zone._id, ip: loc.ip }).sort({ createdAt: -1 });
      if (imp) return { ad: imp.ad, advertiser: imp.advertiser, zone: zone._id, click: null };
    }
  }
  return null;
}

// POST /api/event   { event, value, currency, orderId, clickId?|apiKey?|zone? }
// Pixel (browser) sends clickId; server-side Conversions API sends x-api-key header.
async function track(req, res) {
  const body = { ...req.query, ...req.body };
  const loc = resolveLocation(req);

  const attr = await attribute(req, body, loc);
  if (!attr || !attr.advertiser) {
    return res.json({ success: false, message: "Could not attribute event (no matching click)" });
  }

  const event = body.event || "purchase";
  const value = Number(body.value) || 0;
  const currency = (body.currency || "USD").toUpperCase();
  const orderId = (body.orderId || "").toString();
  const source = req.headers["x-api-key"] || body.apiKey ? "api" : "pixel";

  // Dedupe by (advertiser, orderId) so a refreshed thank-you page doesn't double-count.
  if (orderId) {
    const dup = await Conversion.findOne({ advertiser: attr.advertiser, orderId });
    if (dup) return res.json({ success: true, deduped: true, message: "Duplicate order ignored" });
  }

  await Conversion.create({
    ad: attr.ad, advertiser: attr.advertiser, click: attr.click, zone: attr.zone,
    event, value, currency, orderId, source,
    ip: loc.ip, country: loc.country, region: loc.region,
  });

  if (attr.ad) {
    await Ad.updateOne({ _id: attr.ad }, { $inc: { conversions: 1, conversionValue: value } });
  }
  return res.json({ success: true, message: "Conversion recorded", event, value });
}

module.exports = { track };
