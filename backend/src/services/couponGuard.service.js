// Anti-abuse for coupon claiming and the spin wheel.
//
// Mirrors services/orderGuard.service.js: atomic Redis counters plus the
// datacenter/VPS IP check, applied before any coupon credit is consumed.
// Real shoppers never hit these numbers; claim farmers and bots do.
const { getRedisClient } = require("./otp.service");
const ipcheck = require("./ipcheck.service");

const CLAIM_GAP_SECONDS = 3;      // burst brake between two claims
const CLAIM_MAX_PER_HOUR = 12;
const CLAIM_MAX_PER_DAY = 30;
const SPIN_MAX_PER_DAY = 10;      // on top of the campaign cooldown

function clientIpOf(req) {
  return (
    req.headers["x-real-ip"] ||
    (req.headers["x-forwarded-for"] || "").split(",").pop().trim() ||
    req.ip
  );
}

async function bump(redis, key, ttlSeconds) {
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, ttlSeconds);
  return n;
}

/**
 * Returns a user-facing message when the claim must be refused, else null.
 * Counters are consumed as part of the check, so hammering the endpoint only
 * digs the caller deeper into the limits.
 */
async function checkClaimAllowed(req, userId) {
  const ip = clientIpOf(req);
  if (ip && !ipcheck.isPrivateIp(ip) && ipcheck.isDatacenterIp(ip)) {
    console.log(`[COUPON-BLOCK] datacenter IP ${ip} tried to claim (user ${userId})`);
    return "Coupons cannot be claimed over VPN/proxy or server networks. Please switch to your normal connection.";
  }

  const redis = await getRedisClient();

  const gapFresh = await redis.set(`cpn_gap:${userId}`, "1", { NX: true, EX: CLAIM_GAP_SECONDS });
  if (!gapFresh) return "You are claiming too fast — wait a moment and try again.";

  const hour = await bump(redis, `cpn_hr:${userId}`, 3600);
  if (hour > CLAIM_MAX_PER_HOUR) {
    console.log(`[COUPON-BLOCK] hourly claim cap user ${userId} (${hour})`);
    return "You have claimed a lot of coupons this hour. Please try again later.";
  }

  const day = await bump(redis, `cpn_day:${userId}`, 86400);
  if (day > CLAIM_MAX_PER_DAY) {
    console.log(`[COUPON-BLOCK] daily claim cap user ${userId} (${day})`);
    return "You have reached today's coupon limit. Please come back tomorrow.";
  }

  return null;
}

/** Same idea for the spin wheel, which mints claims for free. */
async function checkSpinAllowed(req, userId) {
  const ip = clientIpOf(req);
  if (ip && !ipcheck.isPrivateIp(ip) && ipcheck.isDatacenterIp(ip)) {
    console.log(`[COUPON-BLOCK] datacenter IP ${ip} tried to spin (user ${userId})`);
    return "Spin is not available over VPN/proxy or server networks.";
  }

  const redis = await getRedisClient();
  const day = await bump(redis, `spin_day:${userId}`, 86400);
  if (day > SPIN_MAX_PER_DAY) {
    console.log(`[COUPON-BLOCK] daily spin cap user ${userId} (${day})`);
    return "You have spun enough for today — come back tomorrow!";
  }
  return null;
}

module.exports = { checkClaimAllowed, checkSpinAllowed, clientIpOf };
