/**
 * Dark store management.
 *
 * The map pin and the radius are the whole product here: everything the
 * storefront decides about "do we deliver to you" comes from these two fields,
 * so they are validated hard rather than trusted.
 */
const DarkStore = require("../../../models/DarkStore");
const { storesCovering } = require("../../../services/serviceability.service");
const { writeAudit } = require("../../../services/audit.service");

const R = (req) => (String(req.headers["x-region"] || "IN").toUpperCase() === "US" ? "US" : "IN");

/** Pull [lng, lat] out of whatever the form sent, rejecting anything impossible. */
function readPoint(body) {
  const lat = parseFloat(body.lat ?? body.latitude);
  const lng = parseFloat(body.lng ?? body.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { error: "Pin the store on the map first" };
  if (lat < -90 || lat > 90) return { error: "Latitude must be between -90 and 90" };
  if (lng < -180 || lng > 180) return { error: "Longitude must be between -180 and 180" };
  // 0,0 is in the Atlantic. It is never a real store, and it is exactly what an
  // empty form produces.
  if (lat === 0 && lng === 0) return { error: "Pin the store on the map first" };
  return { coordinates: [lng, lat] };
}

function readHours(body, target) {
  if (body.alwaysOpen !== undefined) target.alwaysOpen = !!body.alwaysOpen;
  const toMin = (v) => {
    if (v == null || v === "") return null;
    if (typeof v === "number") return v;
    const m = String(v).match(/^(\d{1,2}):(\d{2})$/);      // "08:30"
    if (!m) return null;
    return Math.min(24 * 60, parseInt(m[1], 10) * 60 + parseInt(m[2], 10));
  };
  const o = toMin(body.opensAt ?? body.opensAtMin);
  const c = toMin(body.closesAt ?? body.closesAtMin);
  if (o != null) target.opensAtMin = o;
  if (c != null) target.closesAtMin = c;
  if (Array.isArray(body.closedDays)) {
    target.closedDays = body.closedDays.map(Number).filter((d) => d >= 0 && d <= 6);
  }
}

/* GET /admin/dark-stores */
async function list(req, res) {
  const q = {};
  if (req.query.region) q.regions = String(req.query.region).toUpperCase();
  if (req.query.city) q.city = new RegExp(String(req.query.city), "i");
  if (req.query.active === "true") q.isActive = true;
  if (req.query.active === "false") q.isActive = false;

  const items = await DarkStore.find(q).sort({ isActive: -1, name: 1 }).lean();
  const now = new Date();
  return res.json({
    success: true,
    items: items.map((s) => ({
      ...s,
      lat: s.location?.coordinates?.[1] ?? null,
      lng: s.location?.coordinates?.[0] ?? null,
      // Recomputed here rather than stored, so the list never shows a stale
      // "open" badge for a store that shut ten minutes ago.
      isOpenNow: DarkStore.hydrate(s).isOpenAt(now),
    })),
  });
}

/* GET /admin/dark-stores/:id */
async function getOne(req, res) {
  const s = await DarkStore.findById(req.params.id);
  if (!s) return res.status(404).json({ success: false, message: "Store not found" });
  return res.json({ success: true, store: s });
}

/* POST /admin/dark-stores */
async function create(req, res) {
  const point = readPoint(req.body);
  if (point.error) return res.status(400).json({ success: false, message: point.error });

  const name = String(req.body.name || "").trim();
  const code = String(req.body.code || "").trim().toUpperCase();
  if (!name) return res.status(400).json({ success: false, message: "Store name is required" });
  if (!code) return res.status(400).json({ success: false, message: "Store code is required" });
  if (await DarkStore.exists({ code })) {
    return res.status(409).json({ success: false, message: `Store code "${code}" is already used` });
  }

  const radiusKm = parseFloat(req.body.radiusKm);
  const doc = {
    name, code,
    location: { type: "Point", coordinates: point.coordinates },
    radiusKm: Number.isFinite(radiusKm) ? radiusKm : 5,
    address: req.body.address || "",
    city: req.body.city || "",
    state: req.body.state || "",
    pincode: req.body.pincode || "",
    contactName: req.body.contactName || "",
    contactPhone: req.body.contactPhone || "",
    prepTimeMins: parseInt(req.body.prepTimeMins, 10) || 8,
    minOrderAmount: parseFloat(req.body.minOrderAmount) || 0,
    deliveryFee: parseFloat(req.body.deliveryFee) || 0,
    freeDeliveryAbove: parseFloat(req.body.freeDeliveryAbove) || 0,
    priority: parseInt(req.body.priority, 10) || 0,
    notes: req.body.notes || "",
    regions: Array.isArray(req.body.regions) && req.body.regions.length
      ? req.body.regions
      : [R(req)],
    isActive: req.body.isActive !== false,
  };
  readHours(req.body, doc);

  const store = await DarkStore.create(doc);
  await writeAudit(req, {
    action: "darkstore.create", module: "ddgo", targetType: "DarkStore",
    targetId: store._id, targetLabel: store.name,
    after: { code: store.code, radiusKm: store.radiusKm, city: store.city },
  }).catch(() => {});
  return res.status(201).json({ success: true, store });
}

/* PUT /admin/dark-stores/:id */
async function update(req, res) {
  const store = await DarkStore.findById(req.params.id);
  if (!store) return res.status(404).json({ success: false, message: "Store not found" });

  const before = { radiusKm: store.radiusKm, isActive: store.isActive, coordinates: store.location?.coordinates };

  if (req.body.lat !== undefined || req.body.lng !== undefined) {
    const point = readPoint(req.body);
    if (point.error) return res.status(400).json({ success: false, message: point.error });
    store.location = { type: "Point", coordinates: point.coordinates };
  }
  if (req.body.code !== undefined) {
    const code = String(req.body.code).trim().toUpperCase();
    if (!code) return res.status(400).json({ success: false, message: "Store code is required" });
    if (await DarkStore.exists({ code, _id: { $ne: store._id } })) {
      return res.status(409).json({ success: false, message: `Store code "${code}" is already used` });
    }
    store.code = code;
  }

  const numeric = ["radiusKm", "prepTimeMins", "minOrderAmount", "deliveryFee", "freeDeliveryAbove", "priority"];
  for (const k of numeric) {
    if (req.body[k] !== undefined && req.body[k] !== "") {
      const n = parseFloat(req.body[k]);
      if (Number.isFinite(n)) store[k] = n;
    }
  }
  const text = ["name", "address", "city", "state", "pincode", "contactName", "contactPhone", "notes"];
  for (const k of text) if (req.body[k] !== undefined) store[k] = req.body[k];

  if (req.body.isActive !== undefined) store.isActive = !!req.body.isActive;
  if (req.body.isAcceptingOrders !== undefined) store.isAcceptingOrders = !!req.body.isAcceptingOrders;
  if (Array.isArray(req.body.regions) && req.body.regions.length) store.regions = req.body.regions;
  readHours(req.body, store);

  await store.save();
  await writeAudit(req, {
    action: "darkstore.update", module: "ddgo", targetType: "DarkStore",
    targetId: store._id, targetLabel: store.name,
    before, after: { radiusKm: store.radiusKm, isActive: store.isActive, coordinates: store.location?.coordinates },
  }).catch(() => {});
  return res.json({ success: true, store });
}

/* DELETE /admin/dark-stores/:id */
async function remove(req, res) {
  const store = await DarkStore.findById(req.params.id);
  if (!store) return res.status(404).json({ success: false, message: "Store not found" });
  await store.deleteOne();
  await writeAudit(req, {
    action: "darkstore.delete", module: "ddgo", targetType: "DarkStore",
    targetId: store._id, targetLabel: store.name,
    before: { code: store.code, city: store.city },
  }).catch(() => {});
  return res.json({ success: true, message: "Store deleted" });
}

/* GET /admin/dark-stores/coverage?lat=&lng=
   Lets an admin drop a test pin and see exactly what a customer standing
   there would get — the fastest way to catch a radius that is too small. */
async function coverage(req, res) {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ success: false, message: "lat and lng are required" });
  }
  const stores = await storesCovering({ lat, lng, region: R(req), includeClosed: true });
  return res.json({ success: true, serviceable: stores.some((s) => s.isOpen), stores });
}

module.exports = { list, getOne, create, update, remove, coverage };
