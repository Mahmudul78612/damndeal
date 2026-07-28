/**
 * Notification service — SMS / Email / Push
 * Plain SMS still stub; WhatsApp transactional templates use Fast2SMS.
 * All Fast2SMS credentials & template IDs are pulled from AppSettings
 * (admin panel → Settings → WhatsApp / Fast2SMS) with .env fallback.
 */
const https = require("https");
const AppSettings = require("../models/AppSettings");
const secrets = require("../utils/secrets");
const emailSvc = require("./email.service");

// US (damndeal.com) customers are reached by email; India by Fast2SMS WhatsApp.
function _isUS(order) { return (order?.region || "IN") === "US"; }

// ── Fast2SMS config cache (refreshed every 60s) ───────────────────────────
let _f2sCache = null;
let _f2sCacheAt = 0;
const F2S_CACHE_TTL_MS = 60 * 1000;

async function _getFast2SmsConfig() {
  const now = Date.now();
  if (_f2sCache && (now - _f2sCacheAt) < F2S_CACHE_TTL_MS) return _f2sCache;

  let rows = [];
  try {
    rows = await AppSettings.find({
      key: {
        $in: [
          "fast2sms_enabled",
          "fast2sms_api_key",
          "fast2sms_phone_number_id",
          "fast2sms_tpl_order_confirm",
          "fast2sms_tpl_on_the_way",
          "fast2sms_tpl_order_cancel",
        ],
      },
    }).lean();
  } catch (e) {
    console.error("[NOTIFY] AppSettings read error:", e.message);
  }
  const map = {};
  rows.forEach((r) => { map[r.key] = secrets.decryptSetting(r.key, r.value); });

  const cfg = {
    enabled: map.fast2sms_enabled !== false && map.fast2sms_enabled !== "false",
    apiKey: map.fast2sms_api_key || process.env.FAST2SMS_API_KEY || "",
    phoneNumberId: map.fast2sms_phone_number_id || process.env.FAST2SMS_PHONE_NUMBER_ID || "",
    templates: {
      orderconfirm: map.fast2sms_tpl_order_confirm || process.env.FAST2SMS_TPL_ORDER_CONFIRM || "",
      ontheway:     map.fast2sms_tpl_on_the_way    || process.env.FAST2SMS_TPL_ON_THE_WAY    || "",
      ordercancel:  map.fast2sms_tpl_order_cancel  || process.env.FAST2SMS_TPL_ORDER_CANCEL  || "",
    },
  };
  _f2sCache = cfg;
  _f2sCacheAt = now;
  return cfg;
}

// Allow admin controller to invalidate cache after a settings update
function _invalidateFast2SmsCache() { _f2sCache = null; _f2sCacheAt = 0; }

function _normalizePhone(raw) {
  if (!raw) return null;
  let p = String(raw).replace(/[^\d]/g, "");
  if (p.length > 10 && p.startsWith("91")) p = p.slice(p.length - 10);
  if (p.length === 11 && p.startsWith("0")) p = p.slice(1);
  return p.length === 10 ? p : null;
}

async function _sendFast2SmsWhatsApp(messageId, phone, vars) {
  const cfg = await _getFast2SmsConfig();
  if (!cfg.enabled) {
    console.log(`[NOTIFY] Fast2SMS disabled — skip msg ${messageId} → ${phone}`);
    return { skipped: true, reason: "disabled" };
  }
  if (!cfg.apiKey) {
    console.log(`[NOTIFY] Fast2SMS API key not configured — skip msg ${messageId} → ${phone}`);
    return { skipped: true, reason: "no-api-key" };
  }
  if (!messageId) {
    console.log(`[NOTIFY] Fast2SMS template id missing — skip → ${phone}`);
    return { skipped: true, reason: "no-template" };
  }
  return new Promise((resolve) => {
    const variables_values = vars
      .map((v) => String(v == null ? "" : v).replace(/\|/g, "/"))
      .join("|");
    const params = new URLSearchParams({
      authorization: cfg.apiKey,
      message_id: messageId,
      phone_number_id: cfg.phoneNumberId,
      numbers: phone,
      variables_values,
    });
    const req = https.request({
      hostname: "www.fast2sms.com",
      path: `/dev/whatsapp?${params.toString()}`,
      method: "GET",
      headers: { accept: "application/json" },
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.return === true || json.success === true || json.status_code === 200) {
            console.log(`[NOTIFY] tpl=${messageId} → ${phone} OK`);
            resolve(json);
          } else {
            console.error(`[NOTIFY] tpl=${messageId} → ${phone} FAIL:`, json.message || data);
            resolve({ error: json.message || data });
          }
        } catch {
          console.error(`[NOTIFY] tpl=${messageId} bad response:`, data);
          resolve({ error: data });
        }
      });
    });
    req.on("error", (err) => {
      console.error(`[NOTIFY] tpl=${messageId} request error:`, err.message);
      resolve({ error: err.message });
    });
    req.end();
  });
}

// SMS via provider (stub — kept for in-app/system messages)
async function sendSMS(phone, message) {
  // TODO: Integrate plain-text SMS provider if needed
  console.log(`[SMS] To: ${phone} | Message: ${message}`);
  return { success: true, provider: "stub" };
}

// ── Order WhatsApp notifications (Fast2SMS templates) ─────────────────────
async function notifyOrderPlaced(order, user) {
  try {
    if (_isUS(order)) {
      const name = (user?.name || "there").trim().split(/\s+/)[0];
      await emailSvc.sendEmail(user?.email, "Your DamnDeal order is confirmed", emailSvc.tplOrderPlaced(order, name));
      return;
    }
    const phone = _normalizePhone(user?.phone);
    if (!phone) return;
    const cfg = await _getFast2SmsConfig();
    const name  = (user?.name || "Customer").trim().split(/\s+/)[0];
    const items = Array.isArray(order.items) ? order.items : [];
    const firstName = items[0]?.name || items[0]?.productName || "your item";
    const itemText = items.length > 1 ? `${firstName} +${items.length - 1} more` : firstName;
    const amount = Number(order.grandTotal || 0).toFixed(0);
    const a = order.deliveryAddress || {};
    const addr = [a.address, a.city, a.pincode].filter(Boolean).join(", ").slice(0, 60) || "your address";
    const orderNo = order.orderNumber || String(order._id || "").slice(-6);
    await _sendFast2SmsWhatsApp(cfg.templates.orderconfirm, phone, [name, orderNo, itemText, amount, addr]);
  } catch (e) { console.error("[NOTIFY] orderPlaced err:", e.message); }
}

async function notifyOrderShipped(order, user, opts = {}) {
  try {
    if (_isUS(order)) {
      const name = (user?.name || "there").trim().split(/\s+/)[0];
      await emailSvc.sendEmail(user?.email, "Your DamnDeal order has shipped", emailSvc.tplOrderShipped(order, name, opts));
      return;
    }
    const phone = _normalizePhone(user?.phone);
    if (!phone) return;
    const cfg = await _getFast2SmsConfig();
    const name = (user?.name || "Customer").trim().split(/\s+/)[0];
    const orderNo = order.orderNumber || String(order._id || "").slice(-6);
    const tracking = opts.trackingId || order.shipping?.awb || "—";
    const courier  = opts.courierName || order.shipping?.courierName || "Our courier partner";
    let eta = opts.expectedDelivery;
    if (!eta) {
      const mins = order.estimatedDeliveryMinutes || 0;
      if (mins > 0) {
        const d = new Date(Date.now() + mins * 60 * 1000);
        eta = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      } else eta = "3-5 days";
    }
    await _sendFast2SmsWhatsApp(cfg.templates.ontheway, phone, [name, orderNo, tracking, courier, eta]);
  } catch (e) { console.error("[NOTIFY] orderShipped err:", e.message); }
}

async function notifyOrderCancelled(order, user, opts = {}) {
  try {
    if (_isUS(order)) {
      const name = (user?.name || "there").trim().split(/\s+/)[0];
      await emailSvc.sendEmail(user?.email, "Your DamnDeal order was cancelled", emailSvc.tplOrderCancelled(order, name, opts));
      return;
    }
    const phone = _normalizePhone(user?.phone);
    if (!phone) return;
    const cfg = await _getFast2SmsConfig();
    const name = (user?.name || "Customer").trim().split(/\s+/)[0];
    const orderNo = order.orderNumber || String(order._id || "").slice(-6);
    const refundDays = opts.refundDays || process.env.REFUND_DAYS || "5-7";
    await _sendFast2SmsWhatsApp(cfg.templates.ordercancel, phone, [name, orderNo, refundDays]);
  } catch (e) { console.error("[NOTIFY] orderCancelled err:", e.message); }
}

// Manual test send — fired from admin panel "Send test" action
async function sendTestWhatsApp(phone, vars = []) {
  const cfg = await _getFast2SmsConfig();
  const norm = _normalizePhone(phone);
  if (!norm) return { success: false, message: "Invalid phone" };
  const filled = (vars && vars.length) ? vars : ["Test User", "TEST123", "Sample Item", "100", "Test Address"];
  const result = await _sendFast2SmsWhatsApp(cfg.templates.orderconfirm, norm, filled);
  return { success: !result.error && !result.skipped, result };
}

// Email via SMTP (nodemailer) — see email.service.js
async function sendEmail(to, subject, html) {
  return emailSvc.sendEmail(to, subject, html);
}

// Push notification via FCM (stub)
async function sendPush(fcmToken, title, body, data = {}) {
  // TODO: Integrate firebase-admin
  console.log(`[PUSH] Token: ${fcmToken?.substring(0, 20)}... | Title: ${title}`);
  return { success: true, provider: "stub" };
}

// Template-based notifications
const templates = {
  orderPlaced: (order) => ({
    sms: `Your DamnDeal order #${order.orderNumber} has been placed! Total: ₹${order.grandTotal}`,
    push: { title: "Order Placed!", body: `Order #${order.orderNumber} — ₹${order.grandTotal}` },
  }),
  orderAccepted: (order) => ({
    sms: `Your order #${order.orderNumber} has been accepted and is being prepared.`,
    push: { title: "Order Accepted", body: `Order #${order.orderNumber} is being prepared` },
  }),
  orderReady: (order) => ({
    sms: `Your order #${order.orderNumber} is ready for pickup/delivery!`,
    push: { title: "Order Ready!", body: `Order #${order.orderNumber} is ready` },
  }),
  orderDelivered: (order) => ({
    sms: `Your order #${order.orderNumber} has been delivered. Thank you!`,
    push: { title: "Order Delivered", body: `Order #${order.orderNumber} delivered successfully` },
  }),
  orderCancelled: (order) => ({
    sms: `Your order #${order.orderNumber} has been cancelled.`,
    push: { title: "Order Cancelled", body: `Order #${order.orderNumber} was cancelled` },
  }),
  newOrderForPartner: (order) => ({
    sms: `New order #${order.orderNumber} received! Amount: ₹${order.grandTotal}. Accept within 15 min.`,
    push: { title: "New Order!", body: `Order #${order.orderNumber} — ₹${order.grandTotal}` },
  }),
  deliveryAssigned: (order) => ({
    sms: `New delivery assigned: Order #${order.orderNumber}. Check app for details.`,
    push: { title: "Delivery Assigned", body: `Deliver order #${order.orderNumber}` },
  }),
  otpMessage: (otp) => ({
    sms: `Your DamnDeal verification code is ${otp}. Valid for 5 minutes. Do not share.`,
  }),
  walletCredit: (amount, reason) => ({
    push: { title: "Wallet Credited", body: `₹${amount} added to wallet — ${reason}` },
  }),
  returnApproved: (order) => ({
    push: { title: "Return Approved", body: `Return for order #${order.orderNumber} approved. Refund initiated.` },
  }),
  // Shipping notifications
  orderShipped: (order) => ({
    sms: `Your order #${order.orderNumber} has been shipped via ${order.shipping?.courierName || 'courier'}! AWB: ${order.shipping?.awb || ''}`,
    push: { title: "Order Shipped! 📦", body: `Order #${order.orderNumber} shipped via ${order.shipping?.courierName || 'courier'}. Track: ${order.shipping?.awb || ''}` },
  }),
  shipmentUpdate: (order, status) => ({
    push: { title: "Shipping Update", body: `Order #${order.orderNumber}: ${status}` },
  }),
  shipmentOutForDelivery: (order) => ({
    sms: `Your order #${order.orderNumber} is out for delivery! Track: ${order.shipping?.trackingUrl || ''}`,
    push: { title: "Out for Delivery! 🚚", body: `Order #${order.orderNumber} is on its way to you` },
  }),
  shipmentDelivered: (order) => ({
    sms: `Your order #${order.orderNumber} has been delivered. Thank you for shopping with DamnDeal!`,
    push: { title: "Delivered! ✅", body: `Order #${order.orderNumber} delivered successfully` },
  }),
};

// Send order notification to user
async function notifyUser(user, templateName, ...args) {
  const tmpl = templates[templateName];
  if (!tmpl) return;

  const content = tmpl(...args);
  const promises = [];

  if (content.sms && user.phone) {
    promises.push(sendSMS(user.phone, content.sms));
  }
  if (content.push && user.fcmToken) {
    promises.push(sendPush(user.fcmToken, content.push.title, content.push.body));
  }

  await Promise.allSettled(promises);
}

module.exports = {
  sendSMS, sendEmail, sendPush, templates, notifyUser,
  notifyOrderPlaced, notifyOrderShipped, notifyOrderCancelled,
  sendTestWhatsApp,
  _normalizePhone,
  _invalidateFast2SmsCache,
  _sendFast2SmsWhatsApp,
};
