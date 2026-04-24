const User = require("../../../models/User");
const PartnerKyc = require("../../../models/PartnerKyc");
const Order = require("../../../models/Order");

// GET /admin/partners — list all partners
async function listPartners(req, res) {
  const { page = 1, limit = 20, search, status } = req.query;
  const userFilter = { role: "partner" };
  if (search) {
    userFilter.$or = [
      { name: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
    ];
  }
  if (status === "active") userFilter.isActive = true;
  if (status === "inactive") userFilter.isActive = false;

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [partners, total] = await Promise.all([
    User.find(userFilter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)).select("-__v"),
    User.countDocuments(userFilter),
  ]);

  return res.json({
    success: true, partners,
    pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total, pages: Math.ceil(total / parseInt(limit, 10)) },
  });
}

// GET /admin/partners/:id
async function getPartner(req, res) {
  const partner = await User.findOne({ _id: req.params.id, role: "partner" }).select("-__v");
  if (!partner) return res.status(404).json({ success: false, message: "Partner not found" });

  const kyc = await PartnerKyc.findOne({ partner: req.params.id }).populate("category", "name");
  const orderStats = await Order.aggregate([
    { $match: { partner: partner._id, status: { $nin: ["cancelled", "returned"] } } },
    { $group: { _id: null, totalOrders: { $sum: 1 }, totalRevenue: { $sum: "$grandTotal" }, totalProfit: { $sum: "$profit" } } },
  ]);

  return res.json({ success: true, partner, kyc, orderStats: orderStats[0] || { totalOrders: 0, totalRevenue: 0, totalProfit: 0 } });
}

// PUT /admin/partners/:id/toggle
async function togglePartner(req, res) {
  const partner = await User.findOne({ _id: req.params.id, role: "partner" });
  if (!partner) return res.status(404).json({ success: false, message: "Partner not found" });

  partner.isActive = !partner.isActive;
  await partner.save();
  return res.json({ success: true, isActive: partner.isActive });
}

module.exports = { listPartners, getPartner, togglePartner };
