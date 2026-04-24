const cron = require("node-cron");
const Order = require("../models/Order");
const { PartnerSubscription } = require("../models/Subscription");

function initCronJobs() {
  // Auto-cancel unpaid online orders after 30 minutes
  cron.schedule("*/5 * * * *", async () => {
    try {
      const cutoff = new Date(Date.now() - 30 * 60 * 1000);
      const result = await Order.updateMany(
        {
          paymentMethod: { $in: ["online", "card", "upi"] },
          paymentStatus: { $ne: "paid" },
          status: "placed",
          createdAt: { $lt: cutoff },
        },
        { $set: { status: "cancelled", cancelReason: "auto_cancel_unpaid" } }
      );
      if (result.modifiedCount > 0) {
        console.log(`[CRON] Auto-cancelled ${result.modifiedCount} unpaid orders`);
      }
    } catch (err) {
      console.error("[CRON] Auto-cancel error:", err.message);
    }
  });

  // Auto-reject orders not accepted by partner within 15 minutes
  cron.schedule("*/5 * * * *", async () => {
    try {
      const cutoff = new Date(Date.now() - 15 * 60 * 1000);
      const result = await Order.updateMany(
        {
          status: "placed",
          acceptedAt: { $exists: false },
          rejectedAt: { $exists: false },
          createdAt: { $lt: cutoff },
        },
        {
          $set: {
            status: "cancelled",
            rejectedAt: new Date(),
            rejectedReason: "auto_reject_timeout",
          },
        }
      );
      if (result.modifiedCount > 0) {
        console.log(`[CRON] Auto-rejected ${result.modifiedCount} unaccepted orders`);
      }
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
