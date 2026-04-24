const { validateCoupon } = require("../../../services/coupon.service");
const Coupon = require("../../../models/Coupon");

// POST /user/coupons/validate — check coupon before placing order
async function validateCouponCode(req, res) {
  const { code, subtotal, partnerId } = req.body;
  if (!code || !subtotal) {
    return res.status(400).json({ success: false, message: "code and subtotal required" });
  }

  const result = await validateCoupon(code, req.user.userId, subtotal, partnerId);
  return res.json({ success: result.valid, ...result });
}

// GET /user/coupons — list available coupons for user
async function listAvailableCoupons(req, res) {
  const { partnerId } = req.query;
  const now = new Date();

  const filter = {
    isActive: true,
    $or: [{ endDate: null }, { endDate: { $gte: now } }],
    $and: [{ $or: [{ startDate: null }, { startDate: { $lte: now } }] }],
  };

  // Show global + first_order + partner-specific coupons
  const scopeFilter = [{ scope: "global" }, { scope: "first_order" }, { scope: "category" }];
  if (partnerId) scopeFilter.push({ scope: "partner", partner: partnerId });
  filter.$and.push({ $or: scopeFilter });

  const coupons = await Coupon.find(filter)
    .select("code description discountType discountValue maxDiscount minOrderAmount scope endDate")
    .sort({ createdAt: -1 })
    .limit(50);

  return res.json({ success: true, coupons });
}

module.exports = { validateCouponCode, listAvailableCoupons };
