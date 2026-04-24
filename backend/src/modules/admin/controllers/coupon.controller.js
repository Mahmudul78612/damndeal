const Coupon = require("../../../models/Coupon");

// POST /admin/coupons
async function createCoupon(req, res) {
  const data = { ...req.body, createdBy: req.user.userId };
  if (data.code) data.code = data.code.toUpperCase().trim();
  const coupon = await Coupon.create(data);
  return res.status(201).json({ success: true, coupon });
}

// GET /admin/coupons
async function listCoupons(req, res) {
  const { page = 1, limit = 20, scope, active } = req.query;
  const filter = {};
  if (scope) filter.scope = scope;
  if (active !== undefined) filter.isActive = active === "true";

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [coupons, total] = await Promise.all([
    Coupon.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)),
    Coupon.countDocuments(filter),
  ]);

  return res.json({
    success: true, coupons,
    pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total, pages: Math.ceil(total / parseInt(limit, 10)) },
  });
}

// PUT /admin/coupons/:id
async function updateCoupon(req, res) {
  const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!coupon) return res.status(404).json({ success: false, message: "Coupon not found" });
  return res.json({ success: true, coupon });
}

// DELETE /admin/coupons/:id
async function deleteCoupon(req, res) {
  await Coupon.findByIdAndDelete(req.params.id);
  return res.json({ success: true, message: "Coupon deleted" });
}

module.exports = { createCoupon, listCoupons, updateCoupon, deleteCoupon };
