const cron = require("node-cron");
const Order = require("../models/Order");
const Product = require("../models/Product");
const InventoryLog = require("../models/InventoryLog");
const { PartnerSubscription } = require("../models/Subscription");
const magicClub = require("./magicclub.service");
const { refundPaidOrder } = require("./refund.service");

// Put the order's stock back (it was deducted when the order was placed).
async function _restoreStock(order) {
  for (const item of (order.items || [])) {
    try {
      const p = await Product.findById(item.product);
      if (!p) continue;
      p.stock += item.quantity;
      await p.save();
      await InventoryLog.create({
        partner: order.partner, product: p._id, type: "return",
        quantity: item.quantity, stockAfter: p.stock, reference: order.orderNumber,
      });
    } catch (_) { /* ignore per-item failures */ }
  }
}

async function _reverseMagicClub(order) {
  try {
    if (order.magicClub?.debit?.transactionId && !order.magicClub.debit.reversedAt) {
      const r = await magicClub.reverseDebit(order.magicClub.debit.transactionId);
      if (r.ok) { order.magicClub.debit.reversedAt = new Date(); await order.save(); }
    }
    magicClub.onOrderCancelled(order).catch(() => {});
  } catch (e) { console.error("[CRON] magic-club reverse err:", e.message); }
}

// Cancel a stale order the right way: restore stock, refund if paid + cancel the
// CJ order (via refund.service), reverse Magic Club, then mark it cancelled.
async function _autoCancel(order, reason) {
  await _restoreStock(order);
  try { await refundPaidOrder(order, reason); }
  catch (e) { console.error(`[CRON] refund/CJ-cancel err ${order.orderNumber}:`, e.message); }
  order.status = "cancelled";
  order.cancelReason = reason;
  if (reason === "auto_reject_timeout") { order.rejectedAt = new Date(); order.rejectedReason = reason; }
  await order.save();
  await _reverseMagicClub(order);
}

function initCronJobs() {
  // ── Auto-cancel UNPAID online orders after 30 min ──────────────────────────
  // Any non-COD method that never got paid (Stripe, Razorpay, etc.). Restores
  // stock; unpaid so nothing to refund.
  cron.schedule("*/5 * * * *", async () => {
    try {
      const cutoff = new Date(Date.now() - 30 * 60 * 1000);
      const orders = await Order.find({
        status: "placed",
        paymentStatus: { $ne: "paid" },
        paymentMethod: { $ne: "cod" },
        createdAt: { $lt: cutoff },
      }).limit(100);
      for (const o of orders) await _autoCancel(o, "auto_cancel_unpaid");
      if (orders.length) console.log(`[CRON] Auto-cancelled ${orders.length} unpaid orders (stock restored)`);
    } catch (err) {
      console.error("[CRON] Auto-cancel error:", err.message);
    }
  });

  // ── Auto-reject PARTNER orders not accepted within 15 min ──────────────────
  // India quick-commerce only. Platform/CJ orders (US + dropshipping) have NO
  // partner acceptance step, so they are excluded and never auto-rejected.
  // Refunds a paid order back to the customer.
  cron.schedule("*/5 * * * *", async () => {
    try {
      const cutoff = new Date(Date.now() - 15 * 60 * 1000);
      const orders = await Order.find({
        status: "placed",
        region: "IN",
        fulfillmentType: { $nin: ["platform"] },
        acceptedAt: null,
        rejectedAt: null,
        createdAt: { $lt: cutoff },
      }).limit(100);
      for (const o of orders) await _autoCancel(o, "auto_reject_timeout");
      if (orders.length) console.log(`[CRON] Auto-rejected ${orders.length} unaccepted partner orders`);
    } catch (err) {
      console.error("[CRON] Auto-reject error:", err.message);
    }
  });

  // Expire partner subscriptions — daily at midnight
  cron.schedule("0 0 * * *", async () => {
    try {
      const result = await PartnerSubscription.updateMany(
        { status: "active", endDate: { $lt: new Date() } },
        { $set: { status: "expired" } }
      );
      if (result.modifiedCount > 0) {
        console.log(`[CRON] Expired ${result.modifiedCount} partner subscriptions`);
      }
    } catch (err) {
      console.error("[CRON] Subscription expiry error:", err.message);
    }
  });

  // Expire coupons — daily at midnight
  cron.schedule("0 0 * * *", async () => {
    try {
      const Coupon = require("../models/Coupon");
      const result = await Coupon.updateMany(
        { isActive: true, endDate: { $lt: new Date() } },
        { $set: { isActive: false } }
      );
      if (result.modifiedCount > 0) {
        console.log(`[CRON] Deactivated ${result.modifiedCount} expired coupons`);
      }
    } catch (err) {
      console.error("[CRON] Coupon expiry error:", err.message);
    }
  });

  // Expire offers — daily at midnight
  cron.schedule("0 0 * * *", async () => {
    try {
      const Offer = require("../models/Offer");
      const result = await Offer.updateMany(
        { isActive: true, endDate: { $lt: new Date() } },
        { $set: { isActive: false } }
      );
      if (result.modifiedCount > 0) {
        console.log(`[CRON] Deactivated ${result.modifiedCount} expired offers`);
      }
    } catch (err) {
      console.error("[CRON] Offer expiry error:", err.message);
    }
  });

  console.log("[CRON] All cron jobs initialized");
}

module.exports = { initCronJobs };
