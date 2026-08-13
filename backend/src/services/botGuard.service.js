/**
 * Bot / SMS-pump detection.
 *
 * The attack this defends against: someone burns our SMS balance by requesting
 * OTPs from many IPs for many phone numbers. Per-IP and per-number limits alone
 * do not stop it, because both are rotated. So we score every request against
 * several independent signals and stop the ones that look automated, plus a
 * hard platform-wide spend cap that no amount of rotation can get past.
 *
 * Signals (each adds risk; the score decides allow / challenge / block):
 *   - datacenter / VPN / proxy IP                            (rented infra)
 *   - /24 subnet velocity                                    (IP rotation inside one range)
 *   - device fingerprint velocity                            (same browser, many numbers)
 *   - missing or scripted user-agent                         (curl/python/axios)
 *   - human timing: OTP asked for impossibly fast after load
 *   - sequential / patterned phone numbers from one source
 *   - platform-wide velocity spike vs the recent baseline
 *   - honeypot field filled in
 *
 * Everything is Redis counters; nothing blocks on a slow lookup, and any Redis
 * failure fails OPEN so a real user is never locked out by our own outage.
 */
const crypto = require("crypto");
const ipcheck = require("./ipcheck.service");

const DAY = 24 * 60 * 60;
const HOUR = 60 * 60;

// Risk thresholds
const RISK_BLOCK = 70;
const RISK_CHALLENGE = 40;

// Velocity ceilings
const SUBNET_MAX_PER_HOUR = 12;    // distinct sends from one /24 in an hour
const SUBNET_MAX_NUMBERS_PER_DAY = 15;
const DEVICE_MAX_NUMBERS_PER_DAY = 3;   // one browser asking for many numbers
const GLOBAL_SMS_DAILY_CAP = parseInt(process.env.OTP_GLOBAL_DAILY_CAP || "2000", 10);
const MIN_HUMAN_MS = 1500;         // page load → OTP request

let redisRef = null;
function useRedis(getRedisClient) { redisRef = getRedisClient; }

async function redis() {
  if (!redisRef) throw new Error("botGuard: redis accessor not set");
  return redisRef();
}

function clientIp(req) {
  return (
    req.headers["x-real-ip"] ||
    (req.headers["x-forwarded-for"] || "").split(",").pop()?.trim() ||
    req.ip ||
    ""
  );
}

/** /24 for IPv4, /64-ish prefix for IPv6 — the unit an attacker actually rents. */
function subnetOf(ip) {
  const v4 = String(ip).replace(/^::ffff:/i, "");
  const m = v4.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/);
  if (m) return m[1] + ".0/24";
  const parts = String(ip).split(":");
  return parts.length > 4 ? parts.slice(0, 4).join(":") + "::/64" : String(ip);
}

/** Stable-ish device id: client-sent fingerprint, else UA + language + subnet. */
function deviceId(req) {
  const sent = String(req.headers["x-device-id"] || "").slice(0, 64);
  if (sent) return "d:" + sent;
  const basis = [
    req.headers["user-agent"] || "",
    req.headers["accept-language"] || "",
    subnetOf(clientIp(req)),
  ].join("|");
  return "h:" + crypto.createHash("sha1").update(basis).digest("hex").slice(0, 20);
}

const SCRIPTED_UA = /curl|wget|python|go-http|okhttp|axios|node-fetch|libwww|scrapy|httpclient|postman/i;
const BROWSER_UA = /mozilla|applewebkit|chrome|safari|firefox|edge|opera/i;

async function bump(r, key, ttl) {
  const n = await r.incr(key);
  if (n === 1) await r.expire(key, ttl);
  return n;
}

async function addToSet(r, key, member, ttl) {
  await r.sAdd(key, String(member));
  const size = await r.sCard(key);
  if (size === 1) await r.expire(key, ttl);
  return size;
}

/**
 * Score one OTP request.
 * @returns {{ risk:number, reasons:string[], action:'allow'|'challenge'|'block', message?:string }}
 */
async function assess(req, phone) {
  const reasons = [];
  let risk = 0;

  const ip = clientIp(req);
  const subnet = subnetOf(ip);
  const device = deviceId(req);
  const ua = String(req.headers["user-agent"] || "");

  // ── Signals that need no Redis ──────────────────────────────────────────
  if (!ua) { risk += 35; reasons.push("no user-agent"); }
  else if (SCRIPTED_UA.test(ua)) { risk += 75; reasons.push("scripted client"); }
  else if (!BROWSER_UA.test(ua)) { risk += 25; reasons.push("unrecognised client"); }

  // Honeypot: a field no human ever fills because it is hidden.
  if (req.body && typeof req.body === "object") {
    const trap = req.body.company || req.body.website_url || req.body.hp || req.headers["x-hp"];
    if (trap) { risk += 80; reasons.push("honeypot filled"); }
  }

  // Human timing — the client stamps when the form was shown.
  const openedAt = parseInt(req.headers["x-form-opened"] || req.body?.formOpenedAt || "0", 10);
  if (openedAt > 0) {
    const delta = Date.now() - openedAt;
    if (delta >= 0 && delta < MIN_HUMAN_MS) { risk += 30; reasons.push("submitted too fast"); }
  }

  if (ip && !ipcheck.isPrivateIp(ip) && ipcheck.isDatacenterIp(ip)) {
    risk += 70; reasons.push("datacenter/VPN network");
  }

  // ── Velocity signals ────────────────────────────────────────────────────
  try {
    const r = await redis();
    const day = new Date().toISOString().slice(0, 10);

    // Platform-wide spend cap — the backstop rotation cannot defeat.
    const globalCount = parseInt((await r.get(`otp_global:${day}`)) || "0", 10);
    if (globalCount >= GLOBAL_SMS_DAILY_CAP) {
      return {
        risk: 100, reasons: ["global daily cap"], action: "block",
        message: "OTP service is busy right now. Please try again later.",
      };
    }

    if (!ipcheck.isPrivateIp(ip)) {
      const subHits = await bump(r, `bot_sub:${subnet}`, HOUR);
      if (subHits > SUBNET_MAX_PER_HOUR) { risk += 45; reasons.push("subnet burst"); }
      else if (subHits > SUBNET_MAX_PER_HOUR / 2) { risk += 15; reasons.push("subnet busy"); }

      const subNumbers = await addToSet(r, `bot_subnum:${subnet}`, phone, DAY);
      if (subNumbers > SUBNET_MAX_NUMBERS_PER_DAY) { risk += 50; reasons.push("many numbers from one network"); }
    }

    const devNumbers = await addToSet(r, `bot_dev:${device}`, phone, DAY);
    if (devNumbers > DEVICE_MAX_NUMBERS_PER_DAY) { risk += 45; reasons.push("many numbers from one device"); }

    // Sequential numbers are the giveaway of a generated list.
    const local = String(phone).replace(/^\+?91/, "");
    const prefix = local.slice(0, 6);
    const prefixCount = await addToSet(r, `bot_pfx:${subnet}:${prefix}`, local, DAY);
    if (prefixCount > 2) { risk += 40; reasons.push("sequential number pattern"); }

    // Sudden platform-wide spike vs the last hour's baseline.
    const thisMin = Math.floor(Date.now() / 60000);
    const minuteRate = await bump(r, `otp_rate:${thisMin}`, 300);
    if (minuteRate > 40) { risk += 30; reasons.push("platform-wide spike"); }
  } catch (e) {
    // Redis trouble must never lock out real users.
    console.error("[BOTGUARD] velocity check unavailable:", e.message);
  }

  const action = risk >= RISK_BLOCK ? "block" : risk >= RISK_CHALLENGE ? "challenge" : "allow";
  return { risk, reasons, action };
}

/** Count a message that actually cost money (called after a successful send). */
async function recordSend() {
  try {
    const r = await redis();
    const day = new Date().toISOString().slice(0, 10);
    await bump(r, `otp_global:${day}`, DAY + HOUR);
  } catch { /* accounting only */ }
}

/** Persisted record of a refusal, so the admin can see attacks. */
async function recordBlock(req, phone, assessment) {
  try {
    const r = await redis();
    const day = new Date().toISOString().slice(0, 10);
    await bump(r, `otp_blocked:${day}`, DAY * 7);
    const entry = JSON.stringify({
      at: new Date().toISOString(),
      phone: String(phone).slice(0, 4) + "****" + String(phone).slice(-3),
      ip: clientIp(req),
      subnet: subnetOf(clientIp(req)),
      ua: String(req.headers["user-agent"] || "").slice(0, 120),
      risk: assessment.risk,
      reasons: assessment.reasons,
    });
    await r.lPush("otp_block_log", entry);
    await r.lTrim("otp_block_log", 0, 499);
    await r.expire("otp_block_log", DAY * 7);
  } catch { /* logging only */ }
  console.log(
    `[BOTGUARD] blocked risk=${assessment.risk} ip=${clientIp(req)} reasons=${assessment.reasons.join("|")}`
  );
}

/** Snapshot for the admin security panel. */
async function stats() {
  const r = await redis();
  const day = new Date().toISOString().slice(0, 10);
  const [sent, blocked, raw] = await Promise.all([
    r.get(`otp_global:${day}`),
    r.get(`otp_blocked:${day}`),
    r.lRange("otp_block_log", 0, 49),
  ]);
  return {
    date: day,
    sentToday: parseInt(sent || "0", 10),
    blockedToday: parseInt(blocked || "0", 10),
    dailyCap: GLOBAL_SMS_DAILY_CAP,
    recentBlocks: raw.map((s) => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean),
  };
}

module.exports = {
  useRedis, assess, recordSend, recordBlock, stats,
  clientIp, subnetOf, deviceId,
  RISK_BLOCK, RISK_CHALLENGE,
};
