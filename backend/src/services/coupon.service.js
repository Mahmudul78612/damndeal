const Coupon = require("../models/Coupon");
const CouponUsage = require("../models/CouponUsage");
const Order = require("../models/Order");

/**
 * Validate and calculate coupon discount.
 * @returns {{ valid, discount, coupon, message }}
 */
async function validateCoupon(code, userId, subtotal, partnerId = null) {
  const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
  if (!coupon) return { valid: false, message: "Invalid coupon code" };

  // Date check
  const now = new Date();
  if (coupon.startDate && now < coupon.startDate) {
    return { valid: false, message: "Coupon is not yet active" };
  }
  if (coupon.endDate && now > coupon.endDate) {
    return { valid: false, message: "Coupon has expired" };
  }

  // Usage limit (global)
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    return { valid: false, message: "Coupon usage limit reached" };
  }

  // Per-user limit
  const userUsageCount = await CouponUsage.countDocuments({ coupon: coupon._id, user: userId });
  if (userUsageCount >= coupon.perUserLimit) {
    return { valid: false, message: "You have already used this coupon" };
  }

  // Min order amount
  if (coupon.minOrderAmount > 0 && subtotal < coupon.minOrderAmount) {
    return { valid: false, message: `Minimum order amount is ₹${coupon.minOrderAmount}` };
  }

  // Scope checks
  if (coupon.scope === "partner" && coupon.partner) {
    if (!partnerId || coupon.partner.toString() !== partnerId.toString()) {
      return { valid: false, message: "Coupon not valid for this shop" };
    }
  }

  if (coupon.scope === "first_order") {
    const orderCount = await Order.countDocuments({ user: userId, status: { $ne: "cancelled" } });
    if (orderCount > 0) {
      return { valid: false, message: "Coupon valid only for first order" };
    }
  }

  // Calculate discount
  let discount = 0;
  if (coupon.discountType === "flat") {
    discount = coupon.discountValue;
  } else {
    discount = (subtotal * coupon.discountValue) / 100;
    if (coupon.maxDiscount > 0 && discount > coupon.maxDiscount) {
      discount = coupon.maxDiscount;
    }
  }

  // Don't exceed subtotal
  if (discount > subtotal) discount = subtotal;
  discount = Math.round(discount * 100) / 100;

  return { valid: true, discount, coupon, message: `₹${discount} off applied!` };
}

/**
 * Record coupon usage after order is placed.
 */
async function recordUsage(couponId, userId, orderId, discountAmount) {
  await CouponUsage.create({
    coupon: couponId,
    user: userId,
    order: orderId,
    discountAmount,
  });
  await Coupon.findByIdAndUpdate(couponId, { $inc: { usedCount: 1 } });
}

module.exports = { validateCoupon, recordUsage };
