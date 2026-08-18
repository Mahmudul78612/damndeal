const crypto = require("crypto");
const https = require("https");
const { createClient } = require("redis");
const ipcheck = require("./ipcheck.service");
const botGuard = require("./botGuard.service");

let redisClient;

async function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL,
    });
    redisClient.on("error", (err) => console.error("Redis error:", err));
    await redisClient.connect();
  }
  return redisClient;
}

botGuard.useRedis(getRedisClient);

// The approved DLT template tells the customer "Expires in 10 minutes", and
// carrier delivery can genuinely take a couple of minutes at peak. Expiring at
// 5 was making late-but-valid messages useless — match the template instead.
const OTP_EXPIRY = 600; // 10 minutes
const MAX_ATTEMPTS = 5;

// ── Anti-abuse limits (progressive backoff, industry standard) ──
// Send #1 free → #2 after 30s → #3 after 60s → #4 after 120s.
// A 5th send within 24h is blocked for the rest of that 24h window.
const OTP_PROGRESSIVE_COOLDOWNS = [30, 60, 120]; // seconds, after send 1/2/3+
const OTP_MAX_SENDS_PER_DAY = 4;
const OTP_IP_MAX_PER_DAY = 10;
const ONE_DAY = 24 * 60 * 60;

function generateOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

function otpKey(phone) {
  return `otp:${phone}`;
}

function attemptKey(phone) {
  return `otp_attempts:${phone}`;
}

function cooldownKey(phone) {
  return `otp_cooldown:${phone}`;
}

function sendsKey(phone) {
  return `otp_sends:${phone}`;
}

function ipKey(ip) {
  return `otp_ip:${ip}`;
}

/**
 * Fixed-OTP numbers (owner/admin testing, Play & App Store review accounts).
 *
 * Two env vars, both optional:
 *   TEST_PHONE_OTPS = "+916002655912:956811,9876543210:600265"   per-number code
 *   TEST_PHONES + TEST_OTP                                       one shared code
 *
 * Numbers are matched on their last 10 digits, so +91xxxxxxxxxx, 91xxxxxxxxxx
 * and xxxxxxxxxx are all the same entry — no more listing every format.
 *
 * These numbers skip every limit AND never send a real SMS: nothing is spent,
 * and repeated testing is never throttled.
 */
function normPhone(p) {
  const digits = String(p || "").replace(/\D/g, "");
  return digits.slice(-10);
}

function fixedOtpFor(phone) {
  const key = normPhone(phone);
  if (!key) return null;

  for (const pair of (process.env.TEST_PHONE_OTPS || "").split(",")) {
    const [num, code] = pair.split(":").map((s) => (s || "").trim());
    if (num && code && normPhone(num) === key) return code;
  }

  const shared = (process.env.TEST_OTP || "").trim();
  if (!shared) return null;
  const list = (process.env.TEST_PHONES || "").split(",").map((p) => normPhone(p)).filter(Boolean);
  return list.includes(key) ? shared : null;
}

// Reject numbers that can never receive an Indian OTP (saves SMS credits):
// wrong length/prefix, all-same-digit (9999999999) or the two obvious sequences.
function isBogusIndianNumber(phone) {
  const local = phone.replace(/^\+?91/, "");
  if (!/^[6-9]\d{9}$/.test(local)) return true;
  if (/^(\d)\1{9}$/.test(local)) return true;
  if (local === "1234567890" || local === "0123456789") return true;
  return false;
}

/**
 * @param {string} phone
 * @param {string|object} ipOrReq  the request (preferred — enables bot scoring)
 *                                 or just the client IP for legacy callers
 */
async function sendOtp(phone, ipOrReq) {
  const req = ipOrReq && typeof ipOrReq === "object" ? ipOrReq : null;
  const clientIp = req ? botGuard.clientIp(req) : ipOrReq;
  const redis = await getRedisClient();

  /* --- Fixed-OTP numbers (the owner + the app-store review accounts) ---
     Deliberately first: these skip every rate limit, cooldown, daily cap and
     bot check, and never send a real SMS, so repeated testing costs nothing
     and is never throttled.

     Being on the allow-list is NOT by itself safe. The code never changes,
     never expires and cannot be throttled, and the attempt counter resets on
     one unauthenticated send - so it is a permanent six digit password with
     unlimited guesses. That is fine for a shopping account and unacceptable
     for the console, which is why an admin-panel request always takes the
     real SMS path below and handleVerifyOtp refuses these numbers for admin. */
  const wantsAdmin = String(req?.headers?.["x-client-type"] || "").toLowerCase() === "admin";
  const fixed = wantsAdmin ? null : fixedOtpFor(phone);
  if (fixed) {
    await redis.setEx(otpKey(phone), OTP_EXPIRY, fixed);
    await redis.del(attemptKey(phone));
    // Clear any limit state left from earlier real sends to this number
    await redis.del(cooldownKey(phone));
    await redis.del(sendsKey(phone));
    console.log(`[TEST] fixed-OTP bypass for ${phone} (no SMS, no limits)`);
    return { success: true, message: "OTP sent successfully" };
  }

  // 0) Obviously-invalid number — never burns an SMS credit
  if (isBogusIndianNumber(phone)) {
    return { success: false, message: "Please enter a valid mobile number" };
  }

  // 0.1) Bot scoring. Per-IP and per-number caps alone cannot stop an attacker
  // who rotates both, so this looks at the signals rotation cannot hide:
  // subnet velocity, one device asking for many numbers, scripted clients,
  // sequential number patterns, and a platform-wide daily spend cap.
  /* An allow-listed admin phone is never locked out by IP reputation.
     The bot guard exists to stop an attacker burning SMS credit on numbers we
     do not know; here the number is on a fixed list and the code still goes to
     a handset the attacker does not hold, so the IP is not the security
     boundary and blocking on it only risks locking the owner out of the
     console from a VPN or a flagged ISP. Rate limits, real expiry and the
     attempt counter all still apply. */
  // Both sides normalised: the env holds +91XXXXXXXXXX while normPhone yields
  // the last ten digits, so a raw comparison would never match.
  const adminList = (process.env.ADMIN_PHONES || "").split(",").map(normPhone).filter(Boolean);
  const isAllowlistedAdmin = wantsAdmin && adminList.includes(normPhone(phone));

  if (req && !isAllowlistedAdmin) {
    const verdict = await botGuard.assess(req, phone);
    if (verdict.action === "block") {
      await botGuard.recordBlock(req, phone, verdict);
      return {
        success: false,
        code: "BLOCKED",
        message: verdict.message ||
          "We could not verify this request. Please try again from your mobile data, or contact support.",
      };
    }
    if (verdict.action === "challenge") {
      await botGuard.recordBlock(req, phone, verdict);
      return {
        success: false,
        code: "CHALLENGE",
        message: "Please wait a moment and try again — we are verifying this request.",
      };
    }
  }

  // 0.5) Network trust — datacenter/VPS/proxy IPs and non-Indian IPs can't
  // request OTPs (bots rent cloud servers; real users are on ISP networks).
  // Unknown IP/country fails open so no genuine user is ever blocked by a gap.
  if (clientIp && !ipcheck.isPrivateIp(clientIp)) {
    if (ipcheck.isDatacenterIp(clientIp)) {
      console.log(`[OTP-BLOCK] datacenter IP ${clientIp} tried OTP for ${phone}`);
      return {
        success: false,
        message:
          "OTP cannot be sent over VPN/proxy or server networks. Please switch to your mobile data or home Wi-Fi and try again.",
      };
    }
    const allowedCountries = (process.env.OTP_ALLOWED_COUNTRIES || "IN")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (allowedCountries.length && !allowedCountries.includes("ALL")) {
      const country = ipcheck.countryOf(clientIp);
      if (country && !allowedCountries.includes(country)) {
        console.log(`[OTP-BLOCK] foreign IP ${clientIp} (${country}) tried OTP for ${phone}`);
        return {
          success: false,
          message:
            "OTP is available only from India. If you are using a VPN, please turn it off and try again.",
        };
      }
    }
  }

  // 1) Per-IP daily cap (stops number-rotation abuse from one connection)
  if (clientIp) {
    const ipCount = parseInt((await redis.get(ipKey(clientIp))) || "0", 10);
    if (ipCount >= OTP_IP_MAX_PER_DAY) {
      return {
        success: false,
        message: "Too many OTP requests from this network today. Please try again tomorrow.",
      };
    }
  }

  // 2) Per-number daily cap — 5th request within 24h is blocked
  const sendsSoFar = parseInt((await redis.get(sendsKey(phone))) || "0", 10);
  if (sendsSoFar >= OTP_MAX_SENDS_PER_DAY) {
    const ttl = await redis.ttl(sendsKey(phone));
    const hours = Math.max(1, Math.ceil((ttl > 0 ? ttl : ONE_DAY) / 3600));
    return {
      success: false,
      message: `OTP limit reached for this number. Please try again after ${hours} hour${hours > 1 ? "s" : ""}.`,
    };
  }

  // 3) Progressive cooldown between resends (30s → 60s → 120s)
  const onCooldown = await redis.get(cooldownKey(phone));
  if (onCooldown) {
    const ttl = await redis.ttl(cooldownKey(phone));
    return {
      success: false,
      message: `Please wait ${ttl} seconds before requesting a new OTP`,
    };
  }

  const otp = generateOtp();

  // Store OTP in Redis
  await redis.setEx(otpKey(phone), OTP_EXPIRY, otp);
  // Reset attempts
  await redis.del(attemptKey(phone));

  // Count this send (24h rolling window) + set the next progressive cooldown
  const sendCount = await redis.incr(sendsKey(phone));
  if (sendCount === 1) {
    await redis.expire(sendsKey(phone), ONE_DAY);
  }
  if (clientIp) {
    const ipCount = await redis.incr(ipKey(clientIp));
    if (ipCount === 1) {
      await redis.expire(ipKey(clientIp), ONE_DAY);
    }
  }
  const nextCooldown =
    OTP_PROGRESSIVE_COOLDOWNS[Math.min(sendCount - 1, OTP_PROGRESSIVE_COOLDOWNS.length - 1)];
  await redis.setEx(cooldownKey(phone), nextCooldown, "1");

  // --- Deliver: DLT SMS first, WhatsApp as the fallback ---
  //
  // Fired WITHOUT awaiting. The code is already stored, so the customer's
  // "Sending OTP…" spinner should not also wait on the provider's HTTP round
  // trip. Acceptance time is logged so a slow gateway is measurable instead of
  // guessed at.
  const fast2smsKey = process.env.FAST2SMS_API_KEY;
  if (fast2smsKey) {
    const phoneWithout91 = phone.replace(/^\+91/, "");
    const channel = (process.env.OTP_CHANNEL || "sms").toLowerCase();

    (async () => {
      const t0 = Date.now();
      let delivered = false;

      if (channel !== "whatsapp") {
        try {
          await sendFast2SmsSms(fast2smsKey, phoneWithout91, otp);
          delivered = true;
          console.log(`[FAST2SMS] SMS accepted for ${phone} in ${Date.now() - t0}ms`);
        } catch (err) {
          console.error(`[FAST2SMS] SMS failed for ${phone} after ${Date.now() - t0}ms:`, err.message);
        }
      }
      if (!delivered && channel !== "sms-only") {
        try {
          await sendFast2SmsWhatsApp(fast2smsKey, phoneWithout91, otp);
          delivered = true;
          console.log(`[FAST2SMS] WhatsApp accepted for ${phone} in ${Date.now() - t0}ms`);
        } catch (err) {
          console.error(`[FAST2SMS] WhatsApp failed for ${phone}:`, err.message);
          // The OTP is already in Redis, so a late-arriving message still verifies
        }
      }
      if (delivered) botGuard.recordSend();
    })().catch((e) => console.error("[FAST2SMS] delivery task crashed:", e.message));
  } else if (process.env.NODE_ENV !== "production") {
    console.log(`[DEV] OTP for ${phone}: ${otp}`);
  }

  return { success: true, message: "OTP sent successfully" };
}

/**
 * @param {Object} [opts]
 * @param {Boolean} [opts.allowFixed=true]  accept this number's fixed test code.
 *   The admin console passes false: it is served a real, expiring, rate-limited
 *   OTP by sendOtp, so the permanent code must not also open it. Refusing the
 *   number outright would lock the owner out instead, since the real code is
 *   the one they are now holding.
 */
async function verifyOtp(phone, otp, opts = {}) {
  const redis = await getRedisClient();
  const allowFixed = opts.allowFixed !== false;

  // --- Fixed-OTP numbers: their code always verifies, with no attempt limit ---
  const fixed = allowFixed ? fixedOtpFor(phone) : null;
  if (fixed && String(otp) === fixed) {
    await redis.del(otpKey(phone));
    await redis.del(attemptKey(phone));
    await redis.del(cooldownKey(phone));
    await redis.del(sendsKey(phone));
    console.log(`[TEST] fixed-OTP verified for ${phone}`);
    return { success: true };
  }

  // Check attempts
  const attempts = parseInt((await redis.get(attemptKey(phone))) || "0", 10);
  if (attempts >= MAX_ATTEMPTS) {
    await redis.del(otpKey(phone));
    return { success: false, message: "Too many failed attempts. Request a new OTP." };
  }

  const storedOtp = await redis.get(otpKey(phone));
  if (!storedOtp) {
    return { success: false, message: "OTP expired or not found. Request a new one." };
  }

  // Constant-time compare to thwart timing-side-channel attacks
  const a = Buffer.from(String(storedOtp));
  const b = Buffer.from(String(otp || ""));
  const equal = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!equal) {
    await redis.incr(attemptKey(phone));
    await redis.expire(attemptKey(phone), OTP_EXPIRY);
    return { success: false, message: "Invalid OTP" };
  }

  // OTP valid — clean up
  await redis.del(otpKey(phone));
  await redis.del(attemptKey(phone));
  await redis.del(cooldownKey(phone));

  return { success: true };
}

// Fast2SMS WhatsApp OTP sender (Simple API - GET method)
/**
 * Fast2SMS DLT SMS — the approved transactional route.
 *
 *   Template : "Dear Customer Your One Time Password is {#VAR#} to login
 *               into your account . Damndeal India"
 *   Sender   : DAMNPY   ·  Message ID 222884  ·  Entity: Damndeal India Pvt Ltd
 *
 * SMS is the primary channel because it needs no WhatsApp install and is the
 * DLT-registered path; WhatsApp stays as the fallback when SMS fails.
 */
function sendFast2SmsSms(apiKey, phone, otp) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      authorization: apiKey,
      route: "dlt",
      sender_id: process.env.FAST2SMS_SENDER_ID || "DAMNPY",
      message: process.env.FAST2SMS_SMS_MESSAGE_ID || "222884",
      variables_values: otp,
      numbers: phone,
      flash: "0",
    });
    const entityId = process.env.FAST2SMS_ENTITY_ID;
    if (entityId) params.append("entity_id", entityId);

    const req = https.request(
      {
        hostname: "www.fast2sms.com",
        path: `/dev/bulkV2?${params.toString()}`,
        method: "GET",
        headers: { accept: "application/json" },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (json.return === true || json.status_code === 200) resolve(json);
            else reject(new Error(json.message || JSON.stringify(json)));
          } catch {
            reject(new Error(`Fast2SMS invalid response: ${data.slice(0, 160)}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function sendFast2SmsWhatsApp(apiKey, phone, otp) {
  return new Promise((resolve, reject) => {
    // Approved WhatsApp authentication template "new_authv" (Fast2SMS message id)
    const messageId = process.env.FAST2SMS_MESSAGE_ID || "27300";
    const phoneNumberId = process.env.FAST2SMS_PHONE_NUMBER_ID || "1100495616475226";

    const params = new URLSearchParams({
      authorization: apiKey,
      message_id: messageId,
      phone_number_id: phoneNumberId,
      numbers: phone,
      variables_values: otp,
    });

    const url = `/dev/whatsapp?${params.toString()}`;

    const options = {
      hostname: "www.fast2sms.com",
      path: url,
      method: "GET",
      headers: {
        "accept": "application/json",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.return === true || json.success === true || json.status_code === 200) {
            resolve(json);
          } else {
            reject(new Error(json.message || JSON.stringify(json)));
          }
        } catch {
          reject(new Error(`Fast2SMS invalid response: ${data}`));
        }
      });
    });

    req.on("error", reject);
    req.end();
  });
}

module.exports = { sendOtp, verifyOtp, getRedisClient, fixedOtpFor, normPhone };
