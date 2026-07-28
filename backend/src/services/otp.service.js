const crypto = require("crypto");
const https = require("https");
const { createClient } = require("redis");

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

const OTP_EXPIRY = 300; // 5 minutes
const OTP_COOLDOWN = 60; // 1 minute between resends
const MAX_ATTEMPTS = 5;

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

async function sendOtp(phone) {
  const redis = await getRedisClient();

  // --- Whitelisted test phone bypass (dev + Play/App Store review accounts) ---
  // Only the exact numbers in TEST_PHONES with the fixed TEST_OTP are affected;
  // no real SMS is sent for them. Safe in production because it's a fixed allow-list.
  const testPhones = (process.env.TEST_PHONES || "").split(",").map((p) => p.trim()).filter(Boolean);
  const testOtp = process.env.TEST_OTP;
  if (testOtp && testPhones.includes(phone)) {
    await redis.setEx(otpKey(phone), OTP_EXPIRY, testOtp);
    await redis.del(attemptKey(phone));
    console.log(`[TEST] OTP bypass for whitelisted ${phone}`);
    return { success: true, message: "OTP sent successfully" };
  }

  // Check cooldown
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
  // Set cooldown
  await redis.setEx(cooldownKey(phone), OTP_COOLDOWN, "1");

  // --- Send OTP via Fast2SMS WhatsApp ---
  const fast2smsKey = process.env.FAST2SMS_API_KEY;
  if (fast2smsKey) {
    const phoneWithout91 = phone.replace(/^\+91/, "");
    try {
      await sendFast2SmsWhatsApp(fast2smsKey, phoneWithout91, otp);
      console.log(`[FAST2SMS] WhatsApp OTP sent to ${phone}`);
    } catch (err) {
      console.error(`[FAST2SMS] Failed to send OTP to ${phone}:`, err.message);
      // OTP is already stored in Redis, so user can still verify if SMS reaches later
    }
  } else if (process.env.NODE_ENV !== "production") {
    console.log(`[DEV] OTP for ${phone}: ${otp}`);
  }

  return { success: true, message: "OTP sent successfully" };
}

async function verifyOtp(phone, otp) {
  const redis = await getRedisClient();

  // --- Whitelisted test phone bypass (dev + Play/App Store review accounts) ---
  const testPhones = (process.env.TEST_PHONES || "").split(",").map((p) => p.trim()).filter(Boolean);
  const testOtp = process.env.TEST_OTP;
  if (testOtp && testPhones.includes(phone) && otp === testOtp) {
    await redis.del(otpKey(phone));
    await redis.del(attemptKey(phone));
    await redis.del(cooldownKey(phone));
    console.log(`[TEST] OTP verified for whitelisted ${phone}`);
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
function sendFast2SmsWhatsApp(apiKey, phone, otp) {
  return new Promise((resolve, reject) => {
    const messageId = process.env.FAST2SMS_MESSAGE_ID || "16945";
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

module.exports = { sendOtp, verifyOtp, getRedisClient };
