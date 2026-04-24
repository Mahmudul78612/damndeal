/**
 * Field-level encryption for sensitive AppSettings values.
 *
 * Uses AES-256-GCM (authenticated encryption). Stored format:
 *   enc:v1:<iv-b64>:<authTag-b64>:<ciphertext-b64>
 *
 * Master key is read from process.env.SETTINGS_ENCRYPTION_KEY
 *   - 64-char hex (32 bytes), OR
 *   - base64 of 32 raw bytes
 *
 * If the key is missing, encrypt() is a no-op (graceful fallback) and a
 * one-time warning is printed. decrypt() returns the value as-is.
 *
 * SECRET_KEYS: AppSettings keys whose `value` should be encrypted at rest.
 */
const crypto = require("crypto");

const SECRET_KEYS = new Set([
  // Fast2SMS / WhatsApp
  "fast2sms_api_key",
  "fast2sms_phone_number_id",
  // Razorpay
  "razorpay_key_id",
  "razorpay_key_secret",
  // Couriers
  "delhivery_api_token",
  "fship_api_key",
  "fship_api_secret",
  // CJ Dropshipping
  "cj_api_key",
  "cj_api_email",
  "cj_password",
  // SMTP
  "smtp_pass",
  "smtp_user",
]);

const PREFIX = "enc:v1:";
const MASK = "••••";

let _cachedKey = null;
let _warned = false;

function getKey() {
  if (_cachedKey) return _cachedKey;
  const k = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!k) return null;
  let buf;
  if (/^[0-9a-fA-F]{64}$/.test(k)) buf = Buffer.from(k, "hex");
  else {
    try { buf = Buffer.from(k, "base64"); } catch { return null; }
  }
  if (buf.length !== 32) return null;
  _cachedKey = buf;
  return buf;
}

function isSecretKey(key) { return SECRET_KEYS.has(String(key)); }
function isEncrypted(value) { return typeof value === "string" && value.startsWith(PREFIX); }
function isMasked(value) { return typeof value === "string" && value.startsWith(MASK); }

function encrypt(plaintext) {
  if (typeof plaintext !== "string" || plaintext === "") return plaintext;
  if (isEncrypted(plaintext)) return plaintext;
  const key = getKey();
  if (!key) {
    if (!_warned) {
      console.warn("[SECRETS] SETTINGS_ENCRYPTION_KEY is not set — sensitive AppSettings will be stored as PLAINTEXT.");
      _warned = true;
    }
    return plaintext;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + iv.toString("base64") + ":" + tag.toString("base64") + ":" + enc.toString("base64");
}

function decrypt(stored) {
  if (typeof stored !== "string" || !isEncrypted(stored)) return stored;
  const key = getKey();
  if (!key) return stored;
  try {
    const parts = stored.slice(PREFIX.length).split(":");
    if (parts.length !== 3) return stored;
    const iv = Buffer.from(parts[0], "base64");
    const tag = Buffer.from(parts[1], "base64");
    const ct = Buffer.from(parts[2], "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch (e) {
    console.error("[SECRETS] decrypt failed:", e.message);
    return "";
  }
}

function mask(plaintext) {
  if (typeof plaintext !== "string" || !plaintext) return "";
  const last = plaintext.length > 8 ? plaintext.slice(-4) : "";
  return MASK + last;
}

// Decrypt only if key is in SECRET_KEYS list (otherwise pass-through)
function decryptSetting(key, value) {
  if (!isSecretKey(key)) return value;
  return decrypt(value);
}

// Encrypt only if key is in SECRET_KEYS list (otherwise pass-through)
function encryptSetting(key, value) {
  if (!isSecretKey(key)) return value;
  return encrypt(value);
}

// Generate a fresh 32-byte hex key (utility for first-time setup)
function generateKey() {
  return crypto.randomBytes(32).toString("hex");
}

module.exports = {
  SECRET_KEYS,
  isSecretKey,
  isEncrypted,
  isMasked,
  encrypt,
  decrypt,
  encryptSetting,
  decryptSetting,
  mask,
  generateKey,
};
