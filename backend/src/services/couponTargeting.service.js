// Derives a campaign's geo targeting from the outlets it applies to.
//
// Merchants should never type coordinates: they pick outlets, and the states
// and points used by the public location filter are computed from those. The
// derived shape is written back onto campaign.location so the existing
// locFilter() query keeps working unchanged for old and new campaigns alike.
const { CouponOutlet } = require("../models/couponOrg.models");

/**
 * @param {Object} campaign  a CouponCampaign doc (or plain object) with
 *                           vendor/brand, scope and outlets
 * @returns {Object} the location sub-document to store
 */
async function deriveLocation(campaign, fallback = {}) {
  const scope = campaign.scope || "all_outlets";

  // Online offers have no physical location — they show everywhere.
  if (scope === "online" || campaign.isOnline) {
    return {
      nationwide: true,
      states: [],
      city: "",
      radiusKm: 0,
      point: undefined,
    };
  }

  const filter = { brand: campaign.vendor, isActive: true };
  if (scope === "selected") {
    const ids = (campaign.outlets || []).filter(Boolean);
    // "selected" with nothing selected must not silently become nationwide
    if (!ids.length) return { ...fallback, nationwide: false };
    filter._id = { $in: ids };
  }

  const outlets = await CouponOutlet.find(filter).select("state city point").lean();
  if (!outlets.length) {
    // Brand has no outlets yet — fall back to whatever the merchant supplied
    // (or the legacy vendor address) rather than showing the offer nowhere.
    return { ...fallback };
  }

  const states = [...new Set(outlets.map((o) => o.state).filter(Boolean))];
  const cities = [...new Set(outlets.map((o) => o.city).filter(Boolean))];
  const points = outlets
    .filter((o) => Array.isArray(o.point?.coordinates) && o.point.coordinates.length === 2)
    .map((o) => ({ type: "Point", coordinates: o.point.coordinates }));

  return {
    nationwide: false,
    states,
    city: cities.length === 1 ? cities[0] : "",
    radiusKm: fallback.radiusKm || 0,
    // Single legacy point only. Multi-outlet "near me" is resolved through
    // CouponOutlet's own 2dsphere index in locFilter(), because a 2dsphere
    // index cannot be built over an array of GeoJSON objects.
    point: points[0] || undefined,
  };
}

/** Re-derive every campaign of a brand — call after outlets change. */
async function refreshBrandCampaigns(brandId) {
  const { CouponCampaign } = require("../models/coupon.models");
  const campaigns = await CouponCampaign.find({
    vendor: brandId,
    status: { $in: ["active", "paused", "pending"] },
    scope: { $in: ["all_outlets", "selected"] },
  }).select("vendor scope outlets location isOnline");

  let updated = 0;
  for (const c of campaigns) {
    const loc = await deriveLocation(c, c.location || {});
    await CouponCampaign.updateOne({ _id: c._id }, { $set: { location: loc } });
    updated++;
  }
  return updated;
}

module.exports = { deriveLocation, refreshBrandCampaigns };
