const crypto = require("crypto");
const Payment = require("../models/Payment");
const { getSettings } = require("./fee.service");

// Razorpay SDK — instance cached per (keyId, keySecret) pair
let cachedInstance = null;
let cachedKeyId = null;
let cachedKeySecret = null;

async function getRazorpayCreds() {
  // Prefer keys saved in AppSettings (admin panel); fall back to env vars.
  const s = await getSettings(["razorpay_key_id", "razorpay_key_secret", "razorpay_enabled"]);
  const keyId = (s.razorpay_key_id && String(s.razorpay_key_id).trim()) || process.env.RAZORPAY_KEY_ID || "";
  const keySecret = (s.razorpay_key_secret && String(s.razorpay_key_secret).trim()) || process.env.RAZORPAY_KEY_SECRET || "";
  const enabled = s.razorpay_enabled !== false; // default ON if not explicitly disabled
  return { keyId, keySecret, enabled };
}

async function getRazorpay() {
  const { keyId, keySecret, enabled } = await getRazorpayCreds();
  if (!enabled) throw new Error("Razorpay payments are disabled in admin settings");
  if (!keyId || !keySecret) throw new Error("Razorpay keys are not configured. Please set them in admin settings.");
  if (cachedInstance && cachedKeyId === keyId && cachedKeySecret === keySecret) return cachedInstance;
  const Razorpay = require("razorpay");
  cachedInstance = new Razorpay({ key_id: keyId, key_secret: keySecret });
  cachedKeyId = keyId;
  cachedKeySecret = keySecret;
  return cachedInstance;
}

/**
 * Create Razorpay order.
 */
async function createRazorpayOrder(orderId, userId, amount) {
  const rz = await getRazorpay();
  const rzOrder = await rz.orders.create({
    amount: Math.round(amount * 100), // paise
    currency: "INR",
    receipt: orderId.toString(),
  });

  const payment = await Payment.create({
    order: orderId,
    user: userId,
    amount,
    method: "razorpay",
    razorpayOrderId: rzOrder.id,
    status: "created",
  });

  const { keyId } = await getRazorpayCreds();

  return {
    razorpayOrderId: rzOrder.id,
    amount: rzOrder.amount,
    currency: rzOrder.currency,
    paymentId: payment._id,
    keyId,
  };
}

/**
 * Verify Razorpay payment signature.
 */
async function verifySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature) {
  const { keySecret } = await getRazorpayCreds();
  const body = razorpayOrderId + "|" + razorpayPaymentId;
  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(body)
    .digest("hex");

  return expectedSignature === razorpaySignature;
}

/**
 * Confirm payment after Razorpay callback.
 * Verifies signature AND fetches payment from Razorpay to ensure
 * status=captured and amount matches the original order amount.
 */
async function confirmPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature, expectedUserId = null) {
  const isValid = await verifySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
  if (!isValid) {
    throw new Error("Invalid payment signature");
  }

  const payment = await Payment.findOne({ razorpayOrderId });
  if (!payment) throw new Error("Payment record not found");

  // Bind to the same user who created the payment (prevent payment hijack)
  if (expectedUserId && String(payment.user) !== String(expectedUserId)) {
    throw new Error("Payment does not belong to this user");
  }

  // Already paid? Idempotent return.
  if (payment.status === "paid") {
    return payment;
  }

  // Cross-check with Razorpay: status must be captured/authorized AND amount must match
  try {
    const rz = await getRazorpay();
    const rzPay = await rz.payments.fetch(razorpayPaymentId);
    if (!rzPay) throw new Error("Razorpay payment not found");
    if (rzPay.order_id !== razorpayOrderId) {
      throw new Error("Payment order_id mismatch");
    }
    if (!["captured", "authorized"].includes(rzPay.status)) {
      throw new Error(`Payment not captured (status=${rzPay.status})`);
    }
    // amount in paise; payment.amount in INR
    const expectedPaise = Math.round(payment.amount * 100);
    if (rzPay.amount !== expectedPaise) {
      throw new Error(`Amount mismatch: expected ${expectedPaise}, got ${rzPay.amount}`);
    }
  } catch (e) {
    // Re-throw – do NOT mark paid if Razorpay verification fails
    throw new Error(`Razorpay verification failed: ${e.message}`);
  }

  payment.razorpayPaymentId = razorpayPaymentId;
  payment.razorpaySignature = razorpaySignature;
  payment.status = "paid";
  await payment.save();

  return payment;
}

/**
 * Refund via Razorpay.
 */
async function refundPayment(paymentId, amount) {
  const payment = await Payment.findById(paymentId);
  if (!payment || !payment.razorpayPaymentId) {
    throw new Error("No Razorpay payment to refund");
  }

  const rz = await getRazorpay();
  const refund = await rz.payments.refund(payment.razorpayPaymentId, {
    amount: Math.round(amount * 100),
  });

  payment.refundId = refund.id;
  payment.refundAmount = amount;
  payment.status = "refunded";
  await payment.save();

  return payment;
}

module.exports = { createRazorpayOrder, verifySignature, confirmPayment, refundPayment, getRazorpayCreds };
