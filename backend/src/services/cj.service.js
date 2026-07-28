/**
 * CJ Dropshipping API Service
 * Handles: Auth token, Product search, Order creation, Order tracking
 */

const https = require("https");
const http = require("http");
const AppSettings = require("../models/AppSettings");
const secrets = require("../utils/secrets");

const CJ_BASE = "https://developers.cjdropshipping.com/api2.0/v1";

// ── In-memory token cache ──────────────────────────────────────────────────
let _tokenCache = null; // { accessToken, expiresAt }

// ── HTTP helper ────────────────────────────────────────────────────────────
function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(CJ_BASE + path);
    const isHttps = url.protocol === "https:";
    const lib = isHttps ? https : http;

    const payload = body ? JSON.stringify(body) : null;
    const headers = { "Content-Type": "application/json" };
    if (token) headers["CJ-Access-Token"] = token;
    if (payload) headers["Content-Length"] = Buffer.byteLength(payload);

    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers,
    };

    const req = lib.request(opts, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ code: 0, message: "JSON parse error", raw: data });
        }
      });
    });

    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── Get / Refresh Access Token ─────────────────────────────────────────────
async function getAccessToken() {
  // Return cached if still valid (with 1-hour buffer)
  if (_tokenCache && _tokenCache.expiresAt > Date.now() + 3600_000) {
    return _tokenCache.accessToken;
  }

  // Load API key from DB (cj_api_key is stored ENCRYPTED — decrypt before use)
  const apiKeySetting = await AppSettings.findOne({ key: "cj_api_key" });
  if (!apiKeySetting || !apiKeySetting.value) {
    throw new Error("CJ API Key not configured. Set 'cj_api_key' in Settings.");
  }
  const apiKey = secrets.decryptSetting("cj_api_key", apiKeySetting.value);

  const res = await request("POST", "/authentication/getAccessToken", {
    apiKey,
  });

  if (!res.result || !res.data?.accessToken) {
    throw new Error(`CJ Auth failed: ${res.message || "Unknown error"}`);
  }

  const expiresAt = new Date(res.data.accessTokenExpiryDate).getTime();
  _tokenCache = { accessToken: res.data.accessToken, expiresAt };

  return _tokenCache.accessToken;
}

// Clear cached token (force re-auth)
function clearTokenCache() {
  _tokenCache = null;
}

// ── Product Search ─────────────────────────────────────────────────────────
async function searchProducts({ keyword, page = 1, size = 20, categoryId, countryCode, minPrice, maxPrice }) {
  const token = await getAccessToken();

  const params = new URLSearchParams({
    page,
    size,
    ...(keyword && { keyWord: keyword }),
    ...(categoryId && { categoryId }),
    ...(countryCode && { countryCode }),
    ...(minPrice && { startSellPrice: minPrice }),
    ...(maxPrice && { endSellPrice: maxPrice }),
    features: ["enable_description", "enable_category"],
  });

  const res = await request("GET", `/product/listV2?${params.toString()}`, null, token);

  if (!res.result) throw new Error(`CJ product search failed: ${res.message}`);

  const content = res.data?.content?.[0] || {};
  return {
    products: content.productList || [],
    total: res.data?.totalRecords || 0,
    page: res.data?.pageNumber || page,
    pages: res.data?.totalPages || 1,
  };
}

// ── Product Details ────────────────────────────────────────────────────────
async function getProductDetails(pid) {
  const token = await getAccessToken();
  const res = await request("GET", `/product/query?pid=${pid}&features=enable_combine,enable_inventory`, null, token);
  if (!res.result) throw new Error(`CJ product detail failed: ${res.message}`);
  return res.data;
}

// ── Get Categories ─────────────────────────────────────────────────────────
async function getCategories() {
  const token = await getAccessToken();
  const res = await request("GET", "/product/getCategory", null, token);
  if (!res.result) throw new Error(`CJ categories failed: ${res.message}`);
  return res.data || [];
}

// ── Create Order on CJ ─────────────────────────────────────────────────────
/**
 * @param {Object} order - DamnDeal order object (populated)
 * @param {Array}  cjItems - [{ cj_variant_id, quantity }]
 */
async function createCJOrder(order, cjItems) {
  const token = await getAccessToken();

  // Ship to the order's actual country (US for damndeal.com, else India).
  const isUS = (order.region || "IN") === "US";
  const addr = order.deliveryAddress || order.shippingAddress || order.address || {};
  const customer = order.user || order.customer || {};

  const body = {
    orderNumber: order._id.toString(),
    shippingCountryCode: isUS ? "US" : "IN",
    shippingCountry: isUS ? "United States" : "India",
    shippingProvince: addr.state || "",
    shippingCity: addr.city || "",
    shippingZip: addr.pincode || addr.zip || "",
    shippingPhone: customer.phone || addr.phone || "",
    shippingCustomerName: customer.name || addr.name || "Customer",
    shippingAddress: [addr.line1, addr.line2, addr.landmark].filter(Boolean).join(", ") || addr.address || "",
    // US products ship from the US warehouse; India from China. Omit logisticName
    // for US so CJ auto-selects a valid domestic carrier.
    fromCountryCode: isUS ? "US" : "CN",
    ...(isUS ? {} : { logisticName: "CJPacket Ordinary" }),
    payType: 2, // balance deduction
    products: cjItems.map((item) => ({
      vid: item.cj_variant_id,
      quantity: item.quantity,
    })),
  };

  const res = await request("POST", "/shopping/order/createOrderV2", body, token);
  return res;
}

// ── Get Order Status from CJ ───────────────────────────────────────────────
async function getCJOrderStatus(cjOrderId) {
  const token = await getAccessToken();
  const res = await request("GET", `/shopping/order/getOrderDetail?orderId=${cjOrderId}`, null, token);
  if (!res.result) throw new Error(`CJ order query failed: ${res.message}`);
  return res.data;
}

// ── Cancel a CJ order (so we aren't charged for a cancelled order) ──────────
// Best-effort: returns {ok, message}; never throws so it can't block a cancel.
async function cancelCJOrder(cjOrderId) {
  try {
    if (!cjOrderId) return { ok: false, message: "no CJ order id" };
    const token = await getAccessToken();
    const res = await request("PATCH", "/shopping/order/cancelOrder", { orderId: String(cjOrderId) }, token);
    if (res && res.result) return { ok: true, message: res.message || "cancelled" };
    return { ok: false, message: (res && res.message) || "CJ cancel failed" };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

// ── Freight Calculation ────────────────────────────────────────────────────
async function calculateFreight({ startCountryCode = "CN", endCountryCode = "IN", quantity = 1, weight = 100, vid }) {
  const token = await getAccessToken();

  const body = {
    startCountryCode,
    endCountryCode,
    products: [
      {
        quantity: parseInt(quantity, 10) || 1,
        weight: parseFloat(weight) || 100,
        ...(vid && { vid }),
      },
    ],
  };

  const res = await request("POST", `/logistic/freightCalculate`, body, token);
  console.log("[CJ Freight Raw]", JSON.stringify(res).slice(0, 1500));
  return res.data || [];
}

function _toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function _extractDays(option) {
  const min = _toNum(option.minAging ?? option.minDay ?? option.minDays);
  const max = _toNum(option.maxAging ?? option.maxDay ?? option.maxDays);
  if (min != null && max != null) return { minDays: min, maxDays: max };
  if (min != null) return { minDays: min, maxDays: min };
  if (max != null) return { minDays: max, maxDays: max };

  const text = String(
    option.logisticAging || option.aging || option.deliveryTime || option.deliveryDays || ""
  );
  const m = text.match(/(\d+)\s*[-~to]+\s*(\d+)/i);
  if (m) return { minDays: parseInt(m[1], 10), maxDays: parseInt(m[2], 10) };
  const s = text.match(/(\d+)/);
  if (s) {
    const d = parseInt(s[1], 10);
    return { minDays: d, maxDays: d };
  }
  return { minDays: null, maxDays: null };
}

function _extractFeeUsd(option) {
  const keys = [
    "logisticPrice", "totalPostageFee", "logisticFreight", "freight",
    "finalFreight", "totalFreight", "freightAmount", "price", "amount", "cost",
  ];
  for (const k of keys) {
    const n = _toNum(option[k]);
    if (n != null) return n;
  }
  return null;
}

function _normalizeFreightList(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];
  if (Array.isArray(raw.list)) return raw.list;
  if (Array.isArray(raw.content)) return raw.content;
  if (Array.isArray(raw.records)) return raw.records;
  return [];
}

async function estimateFreightSummary({ startCountryCode = "CN", endCountryCode = "IN", quantity = 1, weight = 100, vid }) {
  const raw = await calculateFreight({ startCountryCode, endCountryCode, quantity, weight, vid });
  const list = _normalizeFreightList(raw);
  if (!list.length) return { feeUsd: 0, minDays: null, maxDays: null, raw };

  const candidates = list
    .map((opt) => {
      const feeUsd = _extractFeeUsd(opt);
      const { minDays, maxDays } = _extractDays(opt);
      return { feeUsd, minDays, maxDays, opt };
    })
    .filter((x) => x.feeUsd != null);

  if (!candidates.length) return { feeUsd: 0, minDays: null, maxDays: null, raw };

  candidates.sort((a, b) => a.feeUsd - b.feeUsd);
  const best = candidates[0];
  return {
    feeUsd: best.feeUsd,
    minDays: best.minDays,
    maxDays: best.maxDays,
    raw,
  };
}

module.exports = {
  getAccessToken,
  clearTokenCache,
  searchProducts,
  getProductDetails,
  getCategories,
  createCJOrder,
  getCJOrderStatus,
  cancelCJOrder,
  calculateFreight,
  estimateFreightSummary,
};
