/**
 * Coupon pack billing.
 *
 * Two rules everything else follows from:
 *   1. Credits are granted ONLY from a verified gateway callback (webhook or
 *      signature check) — never from a browser redirect, which a user can
 *      replay or forge.
 *   2. Granting is idempotent. `creditsGrantedAt` is set inside the same
 *      atomic update that adds the credits, so a replayed webhook, a retry,
 *      or a user refreshing the return page cannot double-credit an account.
 *
 * Gateways: Razorpay for India, Stripe Checkout for the US — the same two
 * integrations the storefront already uses, with their existing key handling.
 */
const crypto = require("crypto");
const { CouponPackOrder, CouponVendor, CouponCategory } = require("../models/coupon.models");
const { CouponOrg } = require("../models/couponOrg.models");
const paymentService = require("./payment.service");
const stripeService = require("./stripe.service");
const { getSettings } = require("./fee.service");
const { sendEmail } = require("./email.service");

// India: GST on digital services. US: sales tax on advertising services is
// generally not collected here — configurable per region from admin settings.
const DEFAULT_TAX = { IN: 18, US: 0 };

async function taxPercentFor(region) {
  const s = await getSettings(["coupon_tax_percent_in", "coupon_tax_percent_us"]);
  const key = region === "US" ? "coupon_tax_percent_us" : "coupon_tax_percent_in";
  const v = parseFloat(s[key]);
  return Number.isFinite(v) ? v : DEFAULT_TAX[region] || 0;
}

/** price → { taxPercent, taxAmount, totalAmount } rounded to 2dp. */
async function priceBreakdown(price, region) {
  const taxPercent = await taxPercentFor(region);
  const taxAmount = Math.round(price * (taxPercent / 100) * 100) / 100;
  const totalAmount = Math.round((price + taxAmount) * 100) / 100;
  return { taxPercent, taxAmount, totalAmount };
}

/**
 * Start a checkout for a pending pack order.
 * Returns what the portal needs to open the gateway.
 */
async function startCheckout(order, { successUrl, cancelUrl }) {
  if (order.status === "paid") throw new Error("This order is already paid");

  if (order.currency === "USD") {
    const session = await stripeService.createCheckoutSessionGeneric({
      name: `${order.claims} coupon credits`,
      amount: order.totalAmount || order.price,
      currency: "usd",
      successUrl, cancelUrl,
      metadata: { packOrderId: String(order._id) },
    });
    order.gateway = "stripe";
    order.gatewayOrderId = session.sessionId;
    await order.save();
    return { gateway: "stripe", url: session.url };
  }

  const rz = await paymentService.getRazorpay();
  const rzOrder = await rz.orders.create({
    amount: Math.round((order.totalAmount || order.price) * 100), // paise
    currency: "INR",
    receipt: `pack_${order._id}`,
    notes: { packOrderId: String(order._id) },
  });
  order.gateway = "razorpay";
  order.gatewayOrderId = rzOrder.id;
  await order.save();

  const { keyId } = await paymentService.getRazorpayCreds();
  return {
    gateway: "razorpay",
    keyId,
    razorpayOrderId: rzOrder.id,
    amount: rzOrder.amount,
    currency: "INR",
  };
}

/**
 * Grant credits for a paid order — the ONLY place credits are added.
 * Idempotent: the guard on creditsGrantedAt is part of the update itself, so
 * two concurrent callbacks cannot both win.
 */
async function grantCredits(orderId, { gatewayPaymentId, gateway } = {}) {
  const claimed = await CouponPackOrder.findOneAndUpdate(
    { _id: orderId, creditsGrantedAt: null },
    {
      $set: {
        status: "paid",
        creditsGrantedAt: new Date(),
        paidAt: new Date(),
        ...(gatewayPaymentId ? { gatewayPaymentId } : {}),
        ...(gateway ? { gateway } : {}),
      },
    },
    { new: true }
  );
  if (!claimed) return { alreadyGranted: true };

  await CouponVendor.updateOne(
    { _id: claimed.vendor },
    { $inc: { claimCredits: claimed.claims, totalCreditsPurchased: claimed.claims } }
  );

  if (!claimed.invoiceNumber) {
    claimed.invoiceNumber = await nextInvoiceNumber(claimed.region);
    await claimed.save();
  }

  emailReceipt(claimed).catch((e) => console.error("[BILLING] receipt email failed:", e.message));
  console.log(`[BILLING] granted ${claimed.claims} credits to vendor ${claimed.vendor} (${claimed.invoiceNumber})`);
  return { granted: true, order: claimed };
}

/** Sequential, region-prefixed invoice numbers: DD-IN-2026-000123 */
async function nextInvoiceNumber(region) {
  const year = new Date().getUTCFullYear();
  const prefix = `DD-${region || "IN"}-${year}-`;
  const last = await CouponPackOrder.findOne({ invoiceNumber: { $regex: `^${prefix}` } })
    .sort({ invoiceNumber: -1 }).select("invoiceNumber").lean();
  const n = last ? parseInt(String(last.invoiceNumber).slice(prefix.length), 10) + 1 : 1;
  return prefix + String(n).padStart(6, "0");
}

/** Verify a Razorpay client callback, then grant. */
async function confirmRazorpay(order, { razorpayPaymentId, razorpaySignature }) {
  const { keySecret } = await paymentService.getRazorpayCreds();
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${order.gatewayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
  if (expected !== razorpaySignature) {
    throw new Error("Payment could not be verified");
  }
  return grantCredits(order._id, { gatewayPaymentId: razorpayPaymentId, gateway: "razorpay" });
}

async function emailReceipt(order) {
  const vendor = await CouponVendor.findById(order.vendor).select("businessName email org").lean();
  const org = vendor?.org ? await CouponOrg.findById(vendor.org).select("name billingEmail legalName").lean() : null;
  const to = org?.billingEmail || vendor?.email;
  if (!to) return;
  const sym = order.currency === "USD" ? "$" : "₹";
  await sendEmail(
    to,
    `Payment received — ${order.claims} coupon credits (${order.invoiceNumber})`,
    `<p>Hi ${org?.name || vendor?.businessName || "there"},</p>
     <p>We have received your payment. <b>${order.claims} coupon credits</b> have been added to your account.</p>
     <table style="font-size:14px;border-collapse:collapse">
       <tr><td style="padding:3px 12px 3px 0;color:#666">Invoice</td><td><b>${order.invoiceNumber}</b></td></tr>
       <tr><td style="padding:3px 12px 3px 0;color:#666">Credits</td><td>${order.claims}</td></tr>
       <tr><td style="padding:3px 12px 3px 0;color:#666">Amount</td><td>${sym}${order.price}</td></tr>
       ${order.taxAmount ? `<tr><td style="padding:3px 12px 3px 0;color:#666">Tax (${order.taxPercent}%)</td><td>${sym}${order.taxAmount}</td></tr>` : ""}
       <tr><td style="padding:3px 12px 3px 0;color:#666">Total paid</td><td><b>${sym}${order.totalAmount || order.price}</b></td></tr>
     </table>
     <p style="color:#666;font-size:13px">You can download the invoice from your business console under Credits &amp; Billing.</p>`
  );
}

/** Warn once a day when a brand is nearly out of credits. */
async function lowCreditWarning(vendor) {
  if (!vendor || vendor.claimCredits > 25) return;
  const org = vendor.org ? await CouponOrg.findById(vendor.org).select("name billingEmail").lean() : null;
  const to = org?.billingEmail || vendor.email;
  if (!to) return;
  await sendEmail(
    to,
    `Only ${vendor.claimCredits} coupon credits left`,
    `<p>Your brand <b>${vendor.businessName}</b> has <b>${vendor.claimCredits}</b> coupon credits left.</p>
     <p>Top up from the business console so your live coupons keep running.</p>`
  );
}

module.exports = {
  priceBreakdown, startCheckout, grantCredits, confirmRazorpay,
  nextInvoiceNumber, lowCreditWarning,
};
