const AppSettings = require("../models/AppSettings");
const secrets = require("../utils/secrets");

/**
 * Get a single setting value by key, with a fallback default.
 * Auto-decrypts values for keys marked sensitive in utils/secrets.js.
 */
async function getSetting(key, fallback = null) {
  const s = await AppSettings.findOne({ key });
  if (!s) return fallback;
  return secrets.decryptSetting(key, s.value);
}

/**
 * Get multiple settings at once. Returns an object { key: value }.
 * Auto-decrypts sensitive keys.
 */
async function getSettings(keys) {
  const docs = await AppSettings.find({ key: { $in: keys } });
  const map = {};
  for (const d of docs) map[d.key] = secrets.decryptSetting(d.key, d.value);
  return map;
}

/**
 * Calculate distance between two lat/lng points (Haversine formula).
 * Returns distance in kilometers.
 */
function calcDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

/**
 * Calculate delivery fee & platform fee for an order.
 *
 * @param {Object} opts
 * @param {Number} opts.subtotal       - order subtotal (before discount)
 * @param {Number} opts.discount       - discount amount
 * @param {Number} opts.distanceKm     - distance shop→user in km
 * @param {Number} opts.freeDeliveryAbove - partner's free delivery threshold (0 = use platform default)
 * @param {String} opts.platform       - 'ddgo' or 'damndeal' (defaults to 'damndeal')
 *
 * @returns {{ deliveryFee, freeDeliveryApplied, platformFee, distanceKm, estimatedDeliveryMinutes, minOrderAmount }}
 */
async function calculateFees({ subtotal, discount = 0, distanceKm, freeDeliveryAbove = 0, platform = "damndeal", productOverrides = [], paymentMethod = null }) {
  const isDdgo = platform === "ddgo";

  // Fetch both DDGO-specific and default keys
  const keys = [
    "delivery_fee", "delivery_fee_per_km", "free_delivery_above",
    "platform_fee", "max_delivery_radius_km", "min_order_amount",
    "cod_fee",
  ];
  if (isDdgo) {
    keys.push(
      "ddgo_delivery_fee", "ddgo_delivery_fee_per_km", "ddgo_free_delivery_above",
      "ddgo_platform_fee", "ddgo_max_delivery_radius", "ddgo_min_order_amount",
    );
  }
  const settings = await getSettings(keys);

  // DDGO keys take priority, fallback to global defaults
  const baseDeliveryFee = (isDdgo && settings.ddgo_delivery_fee != null) ? settings.ddgo_delivery_fee : (settings.delivery_fee ?? 0);
  const perKmFee = (isDdgo && settings.ddgo_delivery_fee_per_km != null) ? settings.ddgo_delivery_fee_per_km : (settings.delivery_fee_per_km ?? 0);
  const platformFreeDeliveryAbove = (isDdgo && settings.ddgo_free_delivery_above != null) ? settings.ddgo_free_delivery_above : (settings.free_delivery_above ?? 0);
  const platformFee = (isDdgo && settings.ddgo_platform_fee != null) ? settings.ddgo_platform_fee : (settings.platform_fee ?? 0);
  const maxRadius = (isDdgo && settings.ddgo_max_delivery_radius != null) ? settings.ddgo_max_delivery_radius : (settings.max_delivery_radius_km ?? 20);
  const minOrderAmount = (isDdgo && settings.ddgo_min_order_amount != null) ? settings.ddgo_min_order_amount : (settings.min_order_amount ?? 0);
  const codFeeAmount = paymentMethod === "cod" ? Number(settings.cod_fee || 0) : 0;

  // Check radius (only when distance is provided)
  if (distanceKm > 0 && distanceKm > maxRadius) {
    return { error: `Delivery not available beyond ${maxRadius} km (shop is ${distanceKm} km away)` };
  }

  // ── Per-product delivery fee override ──
  // If ANY cart product has product.deliveryFee set explicitly (including 0), use MAX of those overrides
  // and bypass the global rule entirely.
  const overrides = (productOverrides || []).filter((v) => v !== null && v !== undefined && v !== "");
  let deliveryFee;
  let freeDeliveryApplied = false;
  let usedProductOverride = false;

  if (overrides.length > 0) {
    deliveryFee = Math.max(...overrides.map((v) => Number(v) || 0));
    usedProductOverride = true;
    freeDeliveryApplied = deliveryFee === 0;
  } else {
    // Global rule: subtotal-discount >= threshold → FREE, else flat baseDeliveryFee + per-km
    deliveryFee = baseDeliveryFee + perKmFee * (distanceKm || 0);
    deliveryFee = Math.round(deliveryFee * 100) / 100;
    const threshold = freeDeliveryAbove > 0 ? freeDeliveryAbove : platformFreeDeliveryAbove;
    const orderAmount = subtotal - discount;
    if (threshold > 0 && orderAmount >= threshold) {
      freeDeliveryApplied = true;
      deliveryFee = 0;
    }
  }

  // Estimated delivery time: ~5min per km + 15min preparation
  const estimatedDeliveryMinutes = Math.round(15 + (distanceKm || 0) * 5);

  return {
    deliveryFee,
    freeDeliveryApplied,
    usedProductOverride,
    platformFee,
    codFee: codFeeAmount,
    distanceKm,
    estimatedDeliveryMinutes,
    minOrderAmount,
  };
}

module.exports = { getSetting, getSettings, calcDistanceKm, calculateFees };
