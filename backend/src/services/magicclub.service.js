/**
 * Magic Club integration — https://magicclub.damndeal.com/docs/
 *
 * Reward / referral / wallet system. We use it to:
 *   1) Create clubs when an order is delivered (vendor + customer)
 *      with rewardAmount = magicclub_reward_percent% of order.profit.
 *   2) Cancel clubs when an order is cancelled / returned (transfers
 *      ownership to the default user so customer no longer benefits).
 *   3) Let customers redeem their points balance during checkout
 *      (100 points = ₹1, configurable). Redemption is a 2-phase commit:
 *      initiate-debit (returns JWT, 5-min validity) → confirm-debit
 *      after the order is successfully placed. If the order is later
 *      cancelled, we call /api/wallet/reverse to refund the points.
 *
 * All HTTP calls go through this single client. Endpoints, base URL,
 * api-key (if any), reward percent, and "default user" handle are all
 * read from AppSettings (admin → Settings → 🎁 Magic Club).
 *
 * Settings keys (cached for 60 s):
 *   magicclub_enabled         (toggle, default: false)
 *   magicclub_base_url        (default: https://magicclub.damndeal.com)
 *   magicclub_api_key         (★ encrypted; sent as Bearer token if set)
 *   magicclub_reward_percent  (default: 70)
 *   magicclub_points_per_rupee (default: 100)
 *   magicclub_default_user    (default: damndeal)
 */
const https = require("https");
const http = require("http");
const { URL } = require("url");
const AppSettings = require("../models/AppSettings");
const secrets = require("../utils/secrets");

/**
 * Resolve a Mongo user _id (or anything else) to the Magic Club user
 * identifier we want to send: "+91<10-digit-phone>".
 *
 * - If the input already looks like a phone (starts with +, or is 10–15
 *   digits), it's normalized and returned as-is.
 * - Otherwise it's treated as a Mongo _id and looked up in the User
 *   collection.
 * - If lookup fails, the original value is returned (best-effort, never
 *   throws).
 */
async function _resolveUserPhone(idOrPhone) {
  if (!idOrPhone) return idOrPhone;
  const raw = String(idOrPhone).trim();

  // Already a +XX-prefixed phone
  if (raw.startsWith("+")) return raw;

  // Bare digit string (10 → assume Indian, prepend +91; longer → prepend +)
  if (/^\d{10,15}$/.test(raw)) {
    return raw.length === 10 ? `+91${raw}` : `+${raw}`;
  }

  // Otherwise treat as Mongo _id and look up the phone
  try {
    const User = require("../models/User");
    const u = await User.findById(raw).select("phone").lean();
    if (u && u.phone) {
      const ph = String(u.phone).replace(/\D/g, "");
      if (ph.length === 10) return `+91${ph}`;
      if (ph.length > 10) return `+${ph}`;
      return ph || raw;
    }
  } catch (_) { /* fall through */ }
  return raw;
}

const SETTING_KEYS = [
  "magicclub_enabled",
  "magicclub_base_url",
  "magicclub_api_key",
  "magicclub_reward_percent",
  "magicclub_points_per_rupee",
  "magicclub_default_user",
];

let _cache = null;
let _cacheAt = 0;
const CACHE_TTL_MS = 60 * 1000;

async function _getConfig() {
  const now = Date.now();
  if (_cache && (now - _cacheAt) < CACHE_TTL_MS) return _cache;

  let rows = [];
  try {
    rows = await AppSettings.find({ key: { $in: SETTING_KEYS } }).lean();
  } catch (e) {
    console.error("[MAGICCLUB] AppSettings read error:", e.message);
  }
  const map = {};
  rows.forEach((r) => { map[r.key] = secrets.decryptSetting(r.key, r.value); });

  const cfg = {
    enabled: map.magicclub_enabled === true || map.magicclub_enabled === "true",
    baseUrl: (map.magicclub_base_url || process.env.MAGICCLUB_BASE_URL || "https://magicclub.damndeal.com").replace(/\/$/, ""),
    apiKey: map.magicclub_api_key || process.env.MAGICCLUB_API_KEY || "",
    rewardPercent: Number(map.magicclub_reward_percent) > 0 ? Number(map.magicclub_reward_percent) : 70,
    pointsPerRupee: Number(map.magicclub_points_per_rupee) > 0 ? Number(map.magicclub_points_per_rupee) : 100,
    defaultUser: map.magicclub_default_user || "damndeal",
  };
  _cache = cfg;
  _cacheAt = now;
  return cfg;
}

function _invalidateCache() { _cache = null; _cacheAt = 0; }

function _request(method, urlStr, body, apiKey) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const data = body ? JSON.stringify(body) : null;
    const headers = { "accept": "application/json" };
    if (data) {
      headers["content-type"] = "application/json";
      headers["content-length"] = Buffer.byteLength(data);
    }
    if (apiKey) headers["x-api-key"] = apiKey;

    const lib = u.protocol === "http:" ? http : https;
    const req = lib.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === "http:" ? 80 : 443),
      path: u.pathname + u.search,
      method,
      headers,
      timeout: 10000,
    }, (res) => {
      let buf = "";
      res.on("data", (c) => (buf += c));
      res.on("end", () => {
        let json = null;
        try { json = JSON.parse(buf); } catch { json = { raw: buf }; }
        resolve({ statusCode: res.statusCode, body: json });
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(new Error("Magic Club request timeout")); });
    if (data) req.write(data);
    req.end();
  });
}

async function _call(method, path, body) {
  const cfg = await _getConfig();
  if (!cfg.enabled) {
    return { skipped: true, reason: "magicclub_disabled" };
  }
  const url = cfg.baseUrl + path;
  try {
    const res = await _request(method, url, body, cfg.apiKey);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return { ok: true, data: res.body?.data ?? res.body, raw: res.body };
    }
    console.warn(`[MAGICCLUB] ${method} ${path} → ${res.statusCode}`, res.body?.msg || res.body?.message || "");
    return { ok: false, status: res.statusCode, msg: res.body?.msg || res.body?.message || "request failed", raw: res.body };
  } catch (e) {
    console.error(`[MAGICCLUB] ${method} ${path} → error:`, e.message);
    return { ok: false, error: e.message };
  }
}

// ── Public API (1:1 with Magic Club docs) ─────────────────────────────────
async function getUserClubs(userId) {
  if (!userId) return { ok: false, msg: "user id is required" };
  const phone = await _resolveUserPhone(userId);
  return _call("GET", `/api/clubs/${encodeURIComponent(String(phone))}`);
}

function getClubsByReference(referenceId) {
  if (!referenceId) return Promise.resolve({ ok: false, msg: "referenceId is required" });
  return _call("GET", `/api/clubs/reference/${encodeURIComponent(String(referenceId))}`);
}

async function validateClubCreation({ userId, referenceId }) {
  const phone = await _resolveUserPhone(userId);
  return _call("POST", "/api/validate-club-creation", { userId: phone, referenceId });
}

async function createVendorClub({ vendorId, customerId, orderId, orderAmount, referenceId, metadata }) {
  const cfg = await _getConfig();
  const customerPhone = await _resolveUserPhone(customerId);
  const body = {
    vendorId: String(cfg.defaultUser || "damndeal"),
    customerId: String(customerPhone),
    orderId: String(orderId),
    orderAmount: Number(orderAmount) || 0,
  };
  if (referenceId) body.referenceId = String(referenceId);
  if (metadata) body.metadata = metadata;
  return _call("POST", "/api/club/vendor", body);
}

function cancelClubByOrder(orderId) {
  if (!orderId) return Promise.resolve({ ok: false, msg: "orderId is required" });
  return _call("POST", "/api/club/cancel", { orderId: String(orderId) });
}

async function getWallet(userId) {
  if (!userId) return { ok: false, msg: "user id is required" };
  const phone = await _resolveUserPhone(userId);
  return _call("GET", `/api/wallet/${encodeURIComponent(String(phone))}`);
}

async function initiateDebit({ userId, points, purpose }) {
  const phone = await _resolveUserPhone(userId);
  return _call("POST", "/api/wallet/initiate-debit", {
    userId: String(phone),
    points: Number(points),
    purpose: purpose || "Order redemption",
  });
}

function confirmDebit(token) {
  return _call("POST", "/api/wallet/confirm-debit", { token });
}

function reverseDebit(transactionId) {
  if (!transactionId) return Promise.resolve({ ok: false, msg: "transactionId is required" });
  return _call("POST", "/api/wallet/reverse", { transactionId: String(transactionId) });
}

// ── Hooks used by the rest of the app ─────────────────────────────────────

/**
 * Convert a money amount (₹) to Magic Club points using the configured
 * conversion rate (default: 100 points = ₹1).
 */
async function rupeesToPoints(rupees) {
  const cfg = await _getConfig();
  return Math.round(Number(rupees || 0) * cfg.pointsPerRupee);
}

async function pointsToRupees(points) {
  const cfg = await _getConfig();
  return Number(points || 0) / cfg.pointsPerRupee;
}

/**
 * Called when an order transitions to "delivered". Best-effort, never
 * throws — order completion must not fail because of a reward call.
 *
 *   rewardAmount (points) = order.profit × rewardPercent% × pointsPerRupee
 */
async function onOrderDelivered(order) {
  try {
    if (!order) return { skipped: true, reason: "no_order" };
    const cfg = await _getConfig();
    if (!cfg.enabled) return { skipped: true, reason: "disabled" };

    const customerId = order.user || order.customer;
    const vendorId = order.partner;
    if (!customerId || !vendorId) {
      return { skipped: true, reason: "missing_vendor_or_customer" };
    }

    const profit = Number(order.profit) || 0;
    const rewardRupees = Math.max(0, (profit * cfg.rewardPercent) / 100);
    const rewardPoints = Math.round(rewardRupees * cfg.pointsPerRupee);
    const orderAmount = Number(order.grandTotal) || 0;

    return await createVendorClub({
      vendorId,
      customerId,
      orderId: order._id,
      orderAmount,
      referenceId: order.referralReferenceId || order.referredBy || undefined,
      metadata: {
        orderNumber: order.orderNumber,
        profit,
        rewardPercent: cfg.rewardPercent,
        rewardRupees: Math.round(rewardRupees * 100) / 100,
        rewardPoints,
      },
    });
  } catch (e) {
    console.error("[MAGICCLUB] onOrderDelivered failed:", e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Called when an order is cancelled or returned. Best-effort.
 */
async function onOrderCancelled(order) {
  try {
    if (!order || !order._id) return { skipped: true };
    return await cancelClubByOrder(order._id);
  } catch (e) {
    console.error("[MAGICCLUB] onOrderCancelled failed:", e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = {
  // raw API
  getUserClubs,
  getClubsByReference,
  validateClubCreation,
  createVendorClub,
  cancelClubByOrder,
  getWallet,
  initiateDebit,
  confirmDebit,
  reverseDebit,
  // hooks
  onOrderDelivered,
  onOrderCancelled,
  // helpers
  rupeesToPoints,
  pointsToRupees,
  _invalidateCache,
};
