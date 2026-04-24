const DeliveryBoy = require("../../../models/DeliveryBoy");
const Order = require("../../../models/Order");

// GET /delivery/earnings
async function getEarnings(req, res) {
  const boy = await DeliveryBoy.findOne({ user: req.user.userId });
  if (!boy) return res.status(404).json({ success: false, message: "Profile not found" });

  const { from, to } = req.query;
  const dateFilter = { deliveryBoy: req.user.userId, deliveryStatus: "delivered" };
  if (from || to) {
    dateFilter.deliveredAt = {};
    if (from) dateFilter.deliveredAt.$gte = new Date(from);
    if (to) dateFilter.deliveredAt.$lte = new Date(to);
  }

  const [stats] = await Order.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: null,
        deliveries: { $sum: 1 },
        totalCollected: { $sum: "$grandTotal" },
        codCollected: {
          $sum: { $cond: [{ $eq: ["$paymentMethod", "cod"] }, "$grandTotal", 0] },
        },
      },
    },
  ]);

  // Daily breakdown (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const daily = await Order.aggregate([
    { $match: { deliveryBoy: req.user.userId, deliveryStatus: "delivered", deliveredAt: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$deliveredAt" } },
        deliveries: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return res.json({
    success: true,
    earnings: {
      totalDeliveries: boy.totalDeliveries,
      totalEarnings: boy.totalEarnings,
      rating: boy.rating,
      ratingCount: boy.ratingCount,
      period: stats || { deliveries: 0, totalCollected: 0, codCollected: 0 },
      daily,
    },
  });
}

module.exports = { getEarnings };
