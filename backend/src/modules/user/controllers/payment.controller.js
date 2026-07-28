const paymentService = require("../../../services/payment.service");
const stripeService = require("../../../services/stripe.service");
const Order = require("../../../models/Order");
const Payment = require("../../../models/Payment");
const User = require("../../../models/User");
const walletService = require("../../../services/wallet.service");
const { notifyOrderPlaced } = require("../../../services/notification.service");

// POST /user/payments/create — create Razorpay order for an existing order
async function createPayment(req, res) {
  const { orderId, useWallet } = req.body;
  if (!orderId) return res.status(400).json({ success: false, message: "orderId required" });

  const order = await Order.findOne({ _id: orderId, user: req.user.userId });
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });

  if (order.paymentStatus === "paid") {
    return res.status(400).json({ success: false, message: "Order already paid" });
  }

  let amountToPay = order.grandTotal;
  let walletDeducted = 0;

  // Use wallet balance if requested
  if (useWallet) {
    const balance = await walletService.getBalance(req.user.userId);
    if (balance > 0) {
      walletDeducted = Math.min(balance, amountToPay);
      amountToPay -= walletDeducted;
    }
  }

  // If fully covered by wallet
  if (amountToPay <= 0) {
    await walletService.debit(
      req.user.userId, walletDeducted, "order_payment",
      `Payment for order ${order.orderNumber}`, order._id.toString()
    );

    order.paymentStatus = "paid";
    order.paymentMethod = "wallet" ;
    order.walletDeducted = walletDeducted;
    await order.save();

    await Payment.create({
      order: order._id, user: req.user.userId,
      amount: order.grandTotal, method: "wallet",
      walletDeducted, status: "paid",
    });

    return res.json({ success: true, message: "Paid via wallet", fullWallet: true });
  }

  // Create Razorpay order for remaining amount
  const rzData = await paymentService.createRazorpayOrder(order._id, req.user.userId, amountToPay);

  // Store wallet amount to deduct after payment confirmation
  if (walletDeducted > 0) {
    await Payment.findByIdAndUpdate(rzData.paymentId, {
      walletDeducted,
      method: "razorpay+wallet",
    });
  }

  return res.json({
    success: true,
    razorpayOrderId: rzData.razorpayOrderId,
    amount: rzData.amount,
    currency: rzData.currency,
    walletDeducted,
    key: rzData.keyId,
  });
}

// POST /user/payments/verify — verify Razorpay payment
async function verifyPayment(req, res) {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return res.status(400).json({ success: false, message: "All Razorpay fields required" });
  }

  const payment = await paymentService.confirmPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature, req.user.userId);

  // Deduct wallet if hybrid payment
  if (payment.walletDeducted > 0) {
    await walletService.debit(
      payment.user, payment.walletDeducted, "order_payment",
      `Wallet part of order payment`, payment.order.toString()
    );
  }

  // Update order
  const order = await Order.findById(payment.order);
  if (order) {
    const wasUnpaid = order.paymentStatus !== "paid";
    order.paymentStatus = "paid";
    order.paymentMethod = payment.walletDeducted > 0 ? "online" : "online";
    order.walletDeducted = payment.walletDeducted;
    await order.save();

    // Send order-confirmation + forward CJ only after online payment is verified
    if (wasUnpaid) {
      setImmediate(async () => {
        try {
          const u = await User.findById(payment.user).select("name phone email").lean();
          if (u) notifyOrderPlaced(order, u);
        } catch (e) { console.error("notifyOrderPlaced(verify) err:", e.message); }
        try { await require("./order.controller").forwardCJForOrder(order._id); } catch (e) { console.error("CJ forward(verify) err:", e.message); }
      });
    }
  }

  return res.json({ success: true, message: "Payment verified", payment });
}

// POST /user/payments/stripe/create-intent — create Stripe PaymentIntent (US)
async function createStripeIntent(req, res) {
  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ success: false, message: "orderId required" });

  const order = await Order.findOne({ _id: orderId, user: req.user.userId });
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });
  if (order.paymentStatus === "paid") return res.status(400).json({ success: false, message: "Order already paid" });

  const { clientSecret, intentId } = await stripeService.createPaymentIntent(order._id, order.grandTotal, "usd");

  await Payment.create({
    order: order._id, user: req.user.userId,
    amount: order.grandTotal, method: "stripe",
    stripeIntentId: intentId, status: "pending",
  });

  return res.json({ success: true, clientSecret });
}

// POST /user/payments/stripe/confirm — mark order paid after Stripe confirms (US)
async function confirmStripePayment(req, res) {
  const { orderId, intentId } = req.body;
  if (!orderId || !intentId) return res.status(400).json({ success: false, message: "orderId and intentId required" });

  const order = await Order.findOne({ _id: orderId, user: req.user.userId });
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });

  const payment = await Payment.findOneAndUpdate(
    { order: order._id, stripeIntentId: intentId },
    { status: "paid" },
    { new: true }
  );
  if (!payment) return res.status(404).json({ success: false, message: "Payment record not found" });

  const wasUnpaid = order.paymentStatus !== "paid";
  order.paymentStatus = "paid";
  order.paymentMethod = "stripe";
  await order.save();

  if (wasUnpaid) {
    setImmediate(async () => {
      try {
        const u = await User.findById(req.user.userId).select("name phone").lean();
        if (u) notifyOrderPlaced(order, u);
      } catch (e) { console.error("notifyOrderPlaced(stripe) err:", e.message); }
    });
  }

  return res.json({ success: true, message: "Payment confirmed", order });
}

// POST /user/payments/stripe/checkout — create a hosted Stripe Checkout session (US)
async function createStripeCheckout(req, res) {
  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ success: false, message: "orderId required" });

  const order = await Order.findOne({ _id: orderId, user: req.user.userId });
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });
  if (order.paymentStatus === "paid") return res.status(400).json({ success: false, message: "Order already paid" });

  const origin = req.headers.origin || "https://damndeal.com";
  const successUrl = `${origin}/order-success/${order._id}?stripe_session={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/checkout?stripe_cancelled=1`;

  const { url, sessionId } = await stripeService.createCheckoutSession(order, successUrl, cancelUrl, "usd");

  await Payment.create({
    order: order._id, user: req.user.userId,
    amount: order.grandTotal, method: "stripe",
    stripeIntentId: sessionId, status: "pending",
  });

  return res.json({ success: true, url, sessionId });
}

// POST /user/payments/stripe/verify-checkout — confirm a Checkout session and mark order paid (US)
async function verifyStripeCheckout(req, res) {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ success: false, message: "sessionId required" });

  const session = await stripeService.retrieveSession(sessionId);
  const orderId = session?.metadata?.orderId;
  if (!orderId) return res.status(400).json({ success: false, message: "Invalid session" });

  const order = await Order.findOne({ _id: orderId, user: req.user.userId });
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });

  if (session.payment_status !== "paid") {
    return res.status(402).json({ success: false, message: "Payment not completed", paymentStatus: session.payment_status });
  }

  await Payment.findOneAndUpdate(
    { order: order._id, stripeIntentId: sessionId },
    { status: "paid" }
  );

  const wasUnpaid = order.paymentStatus !== "paid";
  if (wasUnpaid) {
    order.paymentStatus = "paid";
    order.paymentMethod = "stripe";
    if (session.payment_intent) order.stripePaymentIntentId = String(session.payment_intent);
    await order.save();
    setImmediate(async () => {
      try {
        const u = await User.findById(req.user.userId).select("name phone email").lean();
        if (u) notifyOrderPlaced(order, u);
      } catch (e) { console.error("notifyOrderPlaced(stripe-checkout) err:", e.message); }
      try { await require("./order.controller").forwardCJForOrder(order._id); } catch (e) { console.error("CJ forward(stripe) err:", e.message); }
    });
  }

  return res.json({ success: true, message: "Payment confirmed", order });
}

module.exports = { createPayment, verifyPayment, createStripeIntent, confirmStripePayment, createStripeCheckout, verifyStripeCheckout };
