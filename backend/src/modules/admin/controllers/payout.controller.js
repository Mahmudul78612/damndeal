const Payout = require("../../../models/Payout");
const Order = require("../../../models/Order");

// GET /admin/payouts
async function listPayouts(req, res) {
  const { page = 1, limit = 20, status, partner } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (partner) filter.partner = partner;

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [payouts, total] = await Promise.all([
    Payout.find(filter).populate("partner", "name phone")
      .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)),
    Payout.countDocuments(filter),
  ]);

  return res.json({
    success: true, payouts,
    pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total, pages: Math.ceil(total / parseInt(limit, 10)) },
  });
}

// POST /admin/payouts — create payout for a partner
async function createPayout(req, res) {
  const { partner, from, to, commission = 0, tds = 0, paymentMode, note } = req.body;

  // Calculate from delivered orders in period
  const orders = await Order.aggregate([
    {
      $match: {
        partner: require("mongoose").Types.ObjectId.createFromHexString(partner),
        status: "delivered",
        createdAt: { $gte: new Date(from), $lte: new Date(to) },
      },
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: "$grandTotal" },
      },
    },
  ]);

  const stats = orders[0] || { totalOrders: 0, totalRevenue: 0 };
  const commissionAmount = (stats.totalRevenue * commission) / 100;
  const tdsAmount = (stats.totalRevenue * tds) / 100;
  const netPayout = stats.totalRevenue - commissionAmount - tdsAmount;

  const payout = await Payout.create({
    partner,
    amount: stats.totalRevenue,
    period: { from: new Date(from), to: new Date(to) },
    totalOrders: stats.totalOrders,
    totalRevenue: stats.totalRevenue,
    commission: commissionAmount,
    tds: tdsAmount,
    netPayout,
    paymentMode: paymentMode || "bank_transfer",
    note: note || "",
  });

  return res.status(201).json({ success: true, payout });
}

// PUT /admin/payouts/:id/process
async function processPayout(req, res) {
  const { status, transactionId } = req.body;
  if (!["processing", "completed", "failed"].includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status" });
  }

  const payout = await Payout.findById(req.params.id);
  if (!payout) return res.status(404).json({ success: false, message: "Payout not found" });

  payout.status = status;
  if (transactionId) payout.transactionId = transactionId;
  payout.processedBy = req.user.userId;
  payout.processedAt = new Date();
  await payout.save();

  return res.json({ success: true, payout });
}

module.exports = { listPayouts, createPayout, processPayout };
