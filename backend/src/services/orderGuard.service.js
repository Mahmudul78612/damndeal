// Anti-abuse guards for order placement.
//
// Stops: duplicate orders (double-tap / bot replay), burst ordering, and
// order creation from datacenter/VPS/proxy IPs. All counters are atomic
// Redis ops (INCR / SET NX) so parallel requests can't slip past together.
// Genuine shoppers never notice: 15s gap, 6 orders/hour, 20/day.
const crypto = require("crypto");
const { getRedisClient } = require("./otp.service");
const ipcheck = require("./ipcheck.service");

const ORDER_GAP_SECONDS = 15;
const ORDER_MAX_PER_HOUR = 6;
const ORDER_MAX_PER_DAY = 20;
const DUPLICATE_WINDOW_SECONDS = 60;

function clientIpOf(req) {
  return (
    req.headers["x-real-ip"] ||
    (req.headers["x-forwarded-for"] || "").split(",").pop().trim() ||
    req.ip
  );
}

// Stable signature of "what is being ordered, delivered where".
function orderSignature(userId, items, addressId) {
  const normalized = (items || [])
    .map((i) => [String(i.product), Number(i.quantity) || 1])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return crypto
    .createHash("sha1")
    .update(JSON.stringify({ u: String(userId), a: String(addressId), i: normalized }))
    .digest("hex");
}

// Returns a user-facing message when the order must be rejected, else null.
// Counters are consumed as part of the check (atomic), so hammering the
// endpoint only digs the caller deeper into the limits.
async function checkOrderAllowed(req, userId, items, addressId) {
  const redis = await getRedisClient();

  // 1) No orders from rented server/VPN/proxy networks
  const ip = clientIpOf(req);
  if (ip && !ipcheck.isPrivateIp(ip) && ipcheck.isDatacenterIp(ip)) {
    console.log(`[ORDER-BLOCK] datacenter IP ${ip} tried to order (user ${userId})`);
    return "Orders cannot be placed over VPN/proxy or server networks. Please switch to your normal internet connection and try again.";
  }

  // 2) Identical order (same items + address) within the duplicate window
  const dupKey = `order_dup:${orderSignature(userId, items, addressId)}`;
  const dupFresh = await redis.set(dupKey, "1", { NX: true, EX: DUPLICATE_WINDOW_SECONDS });
  if (!dupFresh) {
    return "This looks like a duplicate of an order you just placed. Please wait a minute if you really want to order the same items again.";
  }

  // 3) Minimum gap between any two orders
  const gapKey = `order_gap:${userId}`;
  const gapFresh = await redis.set(gapKey, "1", { NX: true, EX: ORDER_GAP_SECONDS });
  if (!gapFresh) {
    return "Please wait a few seconds before placing another order.";
  }

  // 4) Hourly and daily caps per user
  const hourKey = `order_hr:${userId}`;
  const hourCount = await redis.incr(hourKey);
  if (hourCount === 1) await redis.expire(hourKey, 60 * 60);
  if (hourCount > ORDER_MAX_PER_HOUR) {
    console.log(`[ORDER-BLOCK] hourly cap user ${userId} (${hourCount})`);
    return "You have reached the order limit for this hour. Please try again a little later.";
  }

  const dayKey = `order_day:${userId}`;
  const dayCount = await redis.incr(dayKey);
  if (dayCount === 1) await redis.expire(dayKey, 24 * 60 * 60);
  if (dayCount > ORDER_MAX_PER_DAY) {
    console.log(`[ORDER-BLOCK] daily cap user ${userId} (${dayCount})`);
    return "You have reached today's order limit. Please try again tomorrow.";
  }

  return null;
}

module.exports = { checkOrderAllowed, clientIpOf };
