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


/* PUT /admin/partners/:id/commission  { percent, flat }
   The negotiated rate for one shop. Zero on both hands the shop back to the
   platform default. Applies to orders placed from now on - what an existing
   order owes was frozen when it was placed. */
async function setCommission(req, res) {
  const kyc = await PartnerKyc.findOne({ partner: req.params.id });
  if (!kyc) return res.status(404).json({ success: false, message: "This partner has no KYC record yet" });

  const pct = parseFloat(req.body.percent);
  const flat = parseFloat(req.body.flat);
  if (req.body.percent !== undefined) {
    if (!Number.isFinite(pct) || pct < 0 || pct > 50) {
      return res.status(400).json({ success: false, message: "Percent must be between 0 and 50" });
    }
    kyc.commissionPercent = pct;
  }
  if (req.body.flat !== undefined) {
    if (!Number.isFinite(flat) || flat < 0) {
      return res.status(400).json({ success: false, message: "Flat fee must be 0 or more" });
    }
    kyc.commissionFlat = flat;
  }
  await kyc.save();
  return res.json({
    success: true,
    commission: { percent: kyc.commissionPercent, flat: kyc.commissionFlat },
    message: "Applies to new orders from now on.",
  });
}

/* GET /admin/partners/:id/settlement?from=&to=
   What this shop is owed for a period: delivered orders, minus the commission
   frozen on each order, minus what has already been paid out. This is the
   number an admin types into "create payout" - computed, not guessed. */
async function settlement(req, res) {
  const Payout = require("../../../models/Payout");
  const to = req.query.to ? new Date(req.query.to + "T23:59:59") : new Date();
  const from = req.query.from
    ? new Date(req.query.from)
    : new Date(to.getTime() - 30 * 86400000);

  const [rows] = await Order.aggregate([
    { $match: {
        partner: new (require("mongoose").Types.ObjectId)(req.params.id),
        status: "delivered",
        createdAt: { $gte: from, $lte: to },
    } },
    { $group: {
        _id: null,
        orders: { $sum: 1 },
        gross: { $sum: "$subtotal" },
        commission: { $sum: { $ifNull: ["$commissionAmount", 0] } },
        codCollected: { $sum: { $cond: [{ $eq: ["$paymentMethod", "cod"] }, "$grandTotal", 0] } },
    } },
  ]);

  const paidAgg = await Payout.aggregate([
    { $match: { partner: new (require("mongoose").Types.ObjectId)(req.params.id), status: { $in: ["processing", "completed"] } } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const gross = rows?.gross || 0;
  const commission = rows?.commission || 0;
  return res.json({
    success: true,
    period: { from, to },
    orders: rows?.orders || 0,
    gross: Math.round(gross * 100) / 100,
    commission: Math.round(commission * 100) / 100,
    net: Math.round((gross - commission) * 100) / 100,
    codCollectedByShop: Math.round((rows?.codCollected || 0) * 100) / 100,
    alreadyPaidAllTime: Math.round((paidAgg[0]?.total || 0) * 100) / 100,
  });
}

module.exports = { listPartners, getPartner, togglePartner, setCommission, settlement };
