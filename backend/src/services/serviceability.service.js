/**
 * "Kya hum yahan deliver karte hain?" — one answer, one place.
 *
 * DDGo is served by two kinds of fulfilment point: our own dark stores
 * (DarkStore) and onboarded partner shops (PartnerKyc). They are different
 * businesses with different schemas, but serviceability only ever asks the same
 * two things — where is the pin, and how far does it reach — so both are
 * normalised into the same shape here and everything downstream stops caring
 * which is which.
 *
 * The radius belongs to the STORE, not the platform. MongoDB cannot filter on
 * "distance < that document's own field" inside a geo query, so this asks for
 * everything inside the widest radius any store could have and then keeps the
 * ones whose own radius actually reaches. At real store counts that is a small
 * list; the 2dsphere index does the expensive part.
 */
const DarkStore = require("../models/DarkStore");
const PartnerKyc = require("../models/PartnerKyc");
// One distance function for the whole app — a second implementation here would
// eventually disagree with the one checkout uses. The dependency only points
// this way: fee.service must never require this file, or the two would cycle.
const { getSettings, calcDistanceKm } = require("./fee.service");

// Nothing can serve further than this, so it bounds the geo query.
const MAX_POSSIBLE_RADIUS_KM = 50;

/** Rider time, rounded to something a customer can believe. */
function etaMinutes(distanceKm, prepMins) {
  const RIDER_KMPH = 18;                     // city average, not highway
  const travel = (distanceKm / RIDER_KMPH) * 60;
  const total = (prepMins || 8) + travel;
  return Math.max(10, Math.round(total / 5) * 5);
}

function isPartnerOpen(kyc) {
  return kyc.isAcceptingOrders !== false;
}

/**
 * Every store that can reach this point, nearest first.
 *
 * @param {Object} opts
 * @param {Number} opts.lat
 * @param {Number} opts.lng
 * @param {String} opts.region       "IN" | "US"
 * @param {Boolean} opts.includeClosed  keep stores that are shut right now
 * @returns {Promise<Array>} normalised stores with distanceKm + etaMins
 */
async function storesCovering({ lat, lng, region = "IN", includeClosed = false }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];

  const near = {
    $near: {
      $geometry: { type: "Point", coordinates: [lng, lat] },
      $maxDistance: MAX_POSSIBLE_RADIUS_KM * 1000,
    },
  };

  // A shop that never set its own radius falls back to the platform default,
  // which is exactly what applied to it before this feature existed.
  const settings = await getSettings(["ddgo_max_delivery_radius", "max_delivery_radius_km"]);
  const fallbackRadius =
    Number(settings.ddgo_max_delivery_radius) || Number(settings.max_delivery_radius_km) || 20;

  const [darkStores, partnerShops] = await Promise.all([
    DarkStore.find({ isActive: true, regions: region, location: near }).limit(50),
    PartnerKyc.find({ status: "approved", regions: region, location: near })
      .populate("partner", "name phone")
      .limit(50),
  ]);

  const now = new Date();
  const out = [];

  for (const s of darkStores) {
    const [lng2, lat2] = s.location?.coordinates || [];
    if (lat2 == null) continue;
    const distanceKm = calcDistanceKm(lat, lng, lat2, lng2);
    if (distanceKm > s.radiusKm) continue;          // its own reach, not a global one
    const open = s.isOpenAt(now);
    if (!open && !includeClosed) continue;
    out.push({
      id: String(s._id),
      type: "darkstore",
      name: s.name,
      code: s.code,
      partner: null,
      city: s.city,
      address: s.address,
      distanceKm: Math.round(distanceKm * 10) / 10,
      radiusKm: s.radiusKm,
      isOpen: open,
      etaMins: etaMinutes(distanceKm, s.prepTimeMins),
      minOrderAmount: s.minOrderAmount || 0,
      deliveryFee: s.deliveryFee || 0,
      freeDeliveryAbove: s.freeDeliveryAbove || 0,
      priority: s.priority || 0,
    });
  }

  for (const k of partnerShops) {
    const [lng2, lat2] = k.location?.coordinates || [];
    if (lat2 == null || (lat2 === 0 && lng2 === 0)) continue;   // pin never set
    const radiusKm = k.deliveryRadiusKm > 0 ? k.deliveryRadiusKm : fallbackRadius;
    const distanceKm = calcDistanceKm(lat, lng, lat2, lng2);
    if (distanceKm > radiusKm) continue;
    const open = isPartnerOpen(k);
    if (!open && !includeClosed) continue;
    out.push({
      id: String(k.partner?._id || k.partner),
      type: "partner",
      name: k.organizationName || k.name,
      code: "",
      partner: String(k.partner?._id || k.partner),
      city: k.city,
      address: k.shopAddress,
      distanceKm: Math.round(distanceKm * 10) / 10,
      radiusKm,
      isOpen: open,
      etaMins: etaMinutes(distanceKm, 12),          // a shop packs slower than a dark store
      minOrderAmount: 0,
      deliveryFee: 0,
      freeDeliveryAbove: k.freeDeliveryAbove || 0,
      priority: 0,
    });
  }

  // Our own store wins a tie: same distance, but stock and ETA we control.
  out.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (a.type !== b.type) return a.type === "darkstore" ? -1 : 1;
    return a.distanceKm - b.distanceKm;
  });
  return out;
}

/**
 * The one call the storefront makes: can we deliver here, and from where.
 *
 * A closed-but-covering store is NOT the same as no coverage — the customer
 * should be told "opens at 8 AM", not "we don't deliver to your area".
 */
async function resolveServiceability({ lat, lng, region = "IN" }) {
  const open = await storesCovering({ lat, lng, region });
  if (open.length) {
    return { serviceable: true, store: open[0], stores: open, reason: null };
  }

  const all = await storesCovering({ lat, lng, region, includeClosed: true });
  if (all.length) {
    return {
      serviceable: false,
      store: all[0],
      stores: all,
      reason: "closed",
      message: "Our store near you is closed right now. Please check back during opening hours.",
    };
  }

  return {
    serviceable: false,
    store: null,
    stores: [],
    reason: "out_of_area",
    message: "We are not delivering to your area yet. We are expanding fast — check back soon.",
  };
}

/** Radius that applies to one specific store, for the checkout guard. */
async function radiusForPartner(partnerId) {
  const kyc = await PartnerKyc.findOne({ partner: partnerId }).select("deliveryRadiusKm").lean();
  if (kyc && kyc.deliveryRadiusKm > 0) return kyc.deliveryRadiusKm;
  const settings = await getSettings(["ddgo_max_delivery_radius", "max_delivery_radius_km"]);
  return Number(settings.ddgo_max_delivery_radius) || Number(settings.max_delivery_radius_km) || 20;
}

module.exports = {
  storesCovering,
  resolveServiceability,
  radiusForPartner,
  calcDistanceKm,
  etaMinutes,
};
