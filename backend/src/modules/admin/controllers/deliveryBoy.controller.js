const User = require("../../../models/User");
const DeliveryBoy = require("../../../models/DeliveryBoy");

// GET /admin/delivery-boys
async function listDeliveryBoys(req, res) {
  const { page = 1, limit = 20, isVerified, isOnline } = req.query;
  const filter = {};
  if (isVerified !== undefined) filter.isVerified = isVerified === "true";
  if (isOnline !== undefined) filter.isOnline = isOnline === "true";

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [boys, total] = await Promise.all([
    DeliveryBoy.find(filter).populate("user", "phone isActive lastLogin")
      .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)),
    DeliveryBoy.countDocuments(filter),
  ]);

  return res.json({
    success: true, deliveryBoys: boys,
    pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total, pages: Math.ceil(total / parseInt(limit, 10)) },
  });
}

// PUT /admin/delivery-boys/:id/verify
async function verifyDeliveryBoy(req, res) {
  const boy = await DeliveryBoy.findById(req.params.id);
  if (!boy) return res.status(404).json({ success: false, message: "Delivery boy not found" });

  boy.isVerified = true;
  boy.verifiedBy = req.user.userId;
  await boy.save();

  return res.json({ success: true, deliveryBoy: boy });
}

// PUT /admin/delivery-boys/:id/toggle
async function toggleDeliveryBoy(req, res) {
  const boy = await DeliveryBoy.findById(req.params.id);
  if (!boy) return res.status(404).json({ success: false, message: "Delivery boy not found" });

  const user = await User.findById(boy.user);
  user.isActive = !user.isActive;
  await user.save();

  return res.json({ success: true, isActive: user.isActive });
}

module.exports = { listDeliveryBoys, verifyDeliveryBoy, toggleDeliveryBoy };
