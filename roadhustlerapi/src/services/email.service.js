/**
 * Email service (SMTP via nodemailer) for RoadHustler.
 * Config from env: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM.
 * If not configured (or the send fails) it logs and returns gracefully — never throws.
 */
const nodemailer = require("nodemailer");

let _transporter = null;
let _warned = false;

function getTransporter() {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    if (!_warned) { console.warn("[EMAIL] SMTP not configured — emails will be skipped."); _warned = true; }
    return null;
  }

  // SMTP_SECURE=true → implicit TLS (465). false → STARTTLS (587).
  const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;

  _transporter = nodemailer.createTransport({
    host, port, secure,
    auth: { user, pass },
    connectionTimeout: 15000,
  });
  return _transporter;
}

async function sendEmail(to, subject, html) {
  if (!to) return { skipped: true, reason: "no recipient" };
  try {
    const tx = getTransporter();
    if (!tx) return { skipped: true, reason: "smtp not configured" };
    const from = process.env.MAIL_FROM || process.env.FROM || process.env.SMTP_USER;
    const info = await tx.sendMail({ from, to, subject, html });
    return { success: true, messageId: info.messageId };
  } catch (e) {
    console.error("[EMAIL] send failed:", e.message);
    return { success: false, error: e.message };
  }
}

// ── Invoice email template ────────────────────────────────────────────────
function money(n, cur) {
  const sym = cur === "USD" ? "$" : (cur || "$");
  return sym + Number(n || 0).toFixed(2);
}

function tplInvoice(invoice, settings = {}, customer = {}, vehicle = null) {
  const shop = settings.shopName || "Road Hustlers";
  const cur = settings.currency || "USD";
  const addr = settings.address || {};
  const addrLine = [addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(", ");
  const vehText = vehicle ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") : "";
  const due = invoice.amountDue > 0;

  const rows = (invoice.lineItems || []).map((li) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#374151">${li.description || li.kind}${li.quantity > 1 ? ` <span style="color:#9ca3af">× ${li.quantity}</span>` : ""}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:right;color:#374151">${money(li.lineTotal, cur)}</td>
    </tr>`).join("");

  const sumRow = (label, val, bold) => `
    <tr>
      <td style="padding:4px 0;text-align:right;color:${bold ? "#111827" : "#6b7280"};${bold ? "font-weight:700" : ""}">${label}</td>
      <td style="padding:4px 0 4px 24px;text-align:right;color:${bold ? "#111827" : "#374151"};${bold ? "font-weight:700" : ""};white-space:nowrap">${money(val, cur)}</td>
    </tr>`;

  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#f4f5f9;padding:24px">
    <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e6e8ef">
      <div style="background:#111827;padding:20px 28px;color:#fff;display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:22px;font-weight:800">${shop}</div>
        <div style="text-align:right;font-size:12px;color:#cbd5e1">
          Invoice<br><span style="font-size:16px;font-weight:700;color:#fff">${invoice.invoiceNumber || ""}</span>
        </div>
      </div>

      <div style="padding:24px 28px">
        <p style="color:#374151;margin:0 0 4px">Hi ${customer.name || "there"},</p>
        <p style="color:#6b7280;font-size:14px;margin:0 0 18px">Here is your invoice from ${shop}${vehText ? ` for your <b>${vehText}</b>` : ""}.</p>

        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:8px">
          <thead><tr>
            <th style="text-align:left;padding:6px 0;border-bottom:2px solid #e5e7eb;color:#9ca3af;font-size:12px;text-transform:uppercase">Item</th>
            <th style="text-align:right;padding:6px 0;border-bottom:2px solid #e5e7eb;color:#9ca3af;font-size:12px;text-transform:uppercase">Amount</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>

        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:8px">
          ${sumRow("Subtotal", invoice.subtotal, false)}
          ${invoice.discount ? sumRow("Discount", -Math.abs(invoice.discount), false) : ""}
          ${invoice.shopSuppliesFee ? sumRow("Shop supplies", invoice.shopSuppliesFee, false) : ""}
          ${invoice.taxAmount ? sumRow(`Sales tax (${invoice.taxRate || 0}%)`, invoice.taxAmount, false) : ""}
          ${sumRow("Total", invoice.total, true)}
          ${invoice.amountPaid ? sumRow("Paid", -Math.abs(invoice.amountPaid), false) : ""}
        </table>

        <div style="margin-top:16px;padding:14px 16px;border-radius:10px;background:${due ? "#fef2f2" : "#ecfdf5"};border:1px solid ${due ? "#fecaca" : "#a7f3d0"};display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:700;color:${due ? "#b91c1c" : "#047857"}">${due ? "Amount Due" : "Paid in Full ✓"}</span>
          <span style="font-weight:800;font-size:18px;color:${due ? "#b91c1c" : "#047857"}">${money(invoice.amountDue, cur)}</span>
        </div>

        ${invoice.notes ? `<p style="color:#6b7280;font-size:12px;margin-top:16px;white-space:pre-line">${invoice.notes}</p>` : ""}
      </div>

      <div style="padding:16px 28px;background:#faf9fe;color:#9aa0b4;font-size:12px;border-top:1px solid #eee">
        <b style="color:#374151">${shop}</b>${addrLine ? ` · ${addrLine}` : ""}<br>
        ${settings.phone ? `${settings.phone} · ` : ""}${settings.email || "info@road-hustlers.com"}
      </div>
    </div>
  </div>`;
}

module.exports = { sendEmail, getTransporter, tplInvoice };
