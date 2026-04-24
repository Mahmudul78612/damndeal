const paymentService = require("../../../services/payment.service");
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

    // Send WhatsApp order-confirmation only after online payment is verified
    if (wasUnpaid) {
      setImmediate(async () => {
        try {
          const u = await User.findById(payment.user).select("name phone").lean();
          if (u) notifyOrderPlaced(order, u);
        } catch (e) { console.error("notifyOrderPlaced(verify) err:", e.message); }
      });
    }
  }

  return res.json({ success: true, message: "Payment verified", payment });
}

module.exports = { createPayment, verifyPayment };
