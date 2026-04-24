const Order = require("../../../models/Order");
const Product = require("../../../models/Product");
const Customer = require("../../../models/Customer");

async function getDashboard(req, res) {
  const partnerId = req.user.userId;
  const { from, to } = req.query;

  const dateFilter = {};
  if (from) dateFilter.$gte = new Date(from);
  if (to) dateFilter.$lte = new Date(to);

  const orderMatch = { partner: partnerId };
  if (Object.keys(dateFilter).length) orderMatch.createdAt = dateFilter;

  const [orderStats] = await Order.aggregate([
    { $match: { ...orderMatch, status: { $nin: ["cancelled", "returned"] } } },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 }, totalRevenue: { $sum: "$grandTotal" },
        totalProfit: { $sum: "$profit" }, totalGst: { $sum: "$totalGst" },
        avgOrderValue: { $avg: "$grandTotal" },
      },
    },
  ]);

  const [productStats] = await Product.aggregate([
    { $match: { partner: partnerId, isActive: true } },
    {
      $group: {
        _id: null, totalProducts: { $sum: 1 },
        lowStockProducts: { $sum: { $cond: [{ $lte: ["$stock", "$lowStockThreshold"] }, 1, 0] } },
        outOfStock: { $sum: { $cond: [{ $eq: ["$stock", 0] }, 1, 0] } },
        pendingApproval: { $sum: { $cond: [{ $eq: ["$approvalStatus", "pending"] }, 1, 0] } },
      },
    },
  ]);

  const totalCustomers = await Customer.countDocuments({ partner: partnerId });

  const recentOrders = await Order.find({ partner: partnerId })
    .populate("customer", "name phone").populate("user", "name phone")
    .sort({ createdAt: -1 }).limit(10);

  const topProducts = await Order.aggregate([
    { $match: { ...orderMatch, status: { $nin: ["cancelled", "returned"] } } },
    { $unwind: "$items" },
    { $group: { _id: "$items.product", name: { $first: "$items.name" }, totalQty: { $sum: "$items.quantity" }, totalRevenue: { $sum: "$items.total" } } },
    { $sort: { totalQty: -1 } }, { $limit: 10 },
  ]);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dailyRevenue = await Order.aggregate([
    { $match: { partner: partnerId, createdAt: { $gte: thirtyDaysAgo }, status: { $nin: ["cancelled", "returned"] } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, revenue: { $sum: "$grandTotal" }, profit: { $sum: "$profit" }, orders: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  return res.json({
    success: true,
    dashboard: {
      orders: orderStats || { totalOrders: 0, totalRevenue: 0, totalProfit: 0, totalGst: 0, avgOrderValue: 0 },
      products: productStats || { totalProducts: 0, lowStockProducts: 0, outOfStock: 0, pendingApproval: 0 },
      totalCustomers, recentOrders, topProducts, dailyRevenue,
    },
  });
}

module.exports = { getDashboard };
