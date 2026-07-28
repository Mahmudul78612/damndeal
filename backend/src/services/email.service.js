/**
 * Email service (SMTP via nodemailer). Used for US (damndeal.com) order
 * notifications. SMTP config from env (or AppSettings fallback). If not
 * configured, sends are skipped gracefully (logged, never throws).
 */
const nodemailer = require("nodemailer");
const { getSetting } = require("./fee.service");

let _transporter = null;
let _warned = false;

async function getTransporter() {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST || (await getSetting("smtp_host"));
  const port = Number(process.env.SMTP_PORT || (await getSetting("smtp_port")) || 587);
  const user = process.env.SMTP_USER || (await getSetting("smtp_user"));
  const pass = process.env.SMTP_PASS || (await getSetting("smtp_pass"));

  if (!host || !user || !pass) {
    if (!_warned) { console.warn("[EMAIL] SMTP not configured — emails will be skipped."); _warned = true; }
    return null;
  }

  _transporter = nodemailer.createTransport({
    host, port, secure: port === 465,
    auth: { user, pass },
  });
  return _transporter;
}

async function sendEmail(to, subject, html) {
  if (!to) return { skipped: true, reason: "no recipient" };
  try {
    const tx = await getTransporter();
    if (!tx) return { skipped: true, reason: "smtp not configured" };
    const from = process.env.FROM_EMAIL || process.env.MAIL_FROM || (await getSetting("from_email")) || "DamnDeal <info@damndeal.com>";
    const info = await tx.sendMail({ from, to, subject, html });
    return { success: true, messageId: info.messageId };
  } catch (e) {
    console.error("[EMAIL] send failed:", e.message);
    return { success: false, error: e.message };
  }
}

// ── Branded HTML templates ──────────────────────────────────────────────────
function shell(title, bodyHtml) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#f4f5f9;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e6e8ef">
      <div style="background:#6C2FD9;padding:18px 24px;color:#fff;font-size:20px;font-weight:800">DamnDeal</div>
      <div style="padding:24px">
        <h2 style="margin:0 0 12px;font-size:18px;color:#15131f">${title}</h2>
        ${bodyHtml}
      </div>
      <div style="padding:14px 24px;background:#faf9fe;color:#9aa0b4;font-size:12px;border-top:1px solid #eee">
        DamnDeal · This is an automated message about your order.
      </div>
    </div>
  </div>`;
}

function money(n, cur) { return (cur === "USD" ? "$" : "₹") + Number(n || 0).toFixed(2); }

function orderRows(order) {
  const cur = order.currency || "USD";
  const items = (order.items || []).map(i =>
    `<tr><td style="padding:6px 0;color:#374151">${(i.name || i.productName || "Item")} × ${i.quantity}</td>
     <td style="padding:6px 0;text-align:right;color:#374151">${money((i.price || 0) * (i.quantity || 1), cur)}</td></tr>`
  ).join("");
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0">
    ${items}
    <tr><td style="padding:10px 0 0;border-top:1px solid #eee;font-weight:700">Total</td>
    <td style="padding:10px 0 0;border-top:1px solid #eee;text-align:right;font-weight:700">${money(order.grandTotal, cur)}</td></tr>
  </table>`;
}

function tplOrderPlaced(order, name) {
  const orderNo = order.orderNumber || String(order._id).slice(-6);
  return shell(`Order confirmed 🎉`, `
    <p style="color:#374151">Hi ${name}, thanks for your order <b>#${orderNo}</b>. We're getting it ready.</p>
    ${orderRows(order)}
    <p style="color:#6b7280;font-size:13px">We'll email you again when it ships.</p>`);
}

function tplOrderShipped(order, name, opts) {
  const orderNo = order.orderNumber || String(order._id).slice(-6);
  const tracking = opts.trackingId || order.shipping?.awb || "";
  const courier = opts.courierName || order.shipping?.courierName || "the carrier";
  const trackLine = tracking
    ? `<p style="color:#374151">Tracking number: <b>${tracking}</b> (${courier})</p>`
    : `<p style="color:#374151">Your order is on its way via ${courier}.</p>`;
  return shell(`Your order has shipped 🚚`, `
    <p style="color:#374151">Hi ${name}, order <b>#${orderNo}</b> is on the way.</p>
    ${trackLine}
    ${opts.expectedDelivery ? `<p style="color:#6b7280">Estimated delivery: ${opts.expectedDelivery}</p>` : ""}`);
}

function tplOrderCancelled(order, name, opts) {
  const orderNo = order.orderNumber || String(order._id).slice(-6);
  return shell(`Order cancelled`, `
    <p style="color:#374151">Hi ${name}, your order <b>#${orderNo}</b> has been cancelled.</p>
    ${order.paymentStatus === "paid" ? `<p style="color:#6b7280">A refund of ${money(order.grandTotal, order.currency)} will be processed to your original payment method within ${opts.refundDays || "5-10"} business days.</p>` : ""}`);
}

module.exports = { sendEmail, tplOrderPlaced, tplOrderShipped, tplOrderCancelled };
