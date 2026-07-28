const Order = require("../../../models/Order");
const User = require("../../../models/User");
const Product = require("../../../models/Product");
const Payout = require("../../../models/Payout");
const DeliveryBoy = require("../../../models/DeliveryBoy");

// GET /admin/dashboard
async function getDashboard(req, res) {
  const { from, to } = req.query;
  const dateFilter = {};
  if (from) dateFilter.$gte = new Date(from);
  if (to) dateFilter.$lte = new Date(to);

  const orderMatch = {};
  if (Object.keys(dateFilter).length) orderMatch.createdAt = dateFilter;

  // Region scope so INR & USD revenue never get summed together.
  // ?region=all bypasses; otherwise the admin's current region (x-region).
  const regionQ = req.query.region ? String(req.query.region).toUpperCase() : (req.region || "IN");
  if (regionQ !== "ALL") {
    orderMatch.region = regionQ === "IN" ? { $in: ["IN", null] } : regionQ;
  }
  const dashRegion = regionQ === "ALL" ? "ALL" : regionQ;
  const dashCurrency = dashRegion === "US" ? "USD" : "INR";
  const regionOnly = orderMatch.region ? { region: orderMatch.region } : {};

  const [orderStats] = await Order.aggregate([
    { $match: { ...orderMatch, status: { $nin: ["cancelled", "returned"] } } },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: "$grandTotal" },
        // Profit only realized on delivered orders
        totalProfit: {
          $sum: { $cond: [{ $eq: ["$status", "delivered"] }, "$profit", 0] },
        },
        deliveredOrders: {
          $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
        },
        deliveredRevenue: {
          $sum: { $cond: [{ $eq: ["$status", "delivered"] }, "$grandTotal", 0] },
        },
        pendingRevenue: {
          $sum: { $cond: [{ $ne: ["$status", "delivered"] }, "$grandTotal", 0] },
        },
        pendingOrders: {
          $sum: { $cond: [{ $ne: ["$status", "delivered"] }, 1, 0] },
        },
        totalGst: { $sum: "$totalGst" },
        avgOrderValue: { $avg: "$grandTotal" },
      },
    },
  ]);

  const [userCount, partnerCount, deliveryCount, productCount, pendingKyc, pendingProducts] = await Promise.all([
    User.countDocuments({ role: "user" }),
    User.countDocuments({ role: "partner" }),
    DeliveryBoy.countDocuments(),
    Product.countDocuments({ isActive: true, approvalStatus: "approved" }),
    require("../../../models/PartnerKyc").countDocuments({ status: "pending" }),
    Product.countDocuments({ approvalStatus: "pending" }),
  ]);

  const pendingPayouts = await Payout.aggregate([
    { $match: { status: "pending" } },
    { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$netPayout" } } },
  ]);

  // Daily revenue (30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dailyRevenue = await Order.aggregate([
    { $match: { ...regionOnly, createdAt: { $gte: thirtyDaysAgo }, status: { $nin: ["cancelled", "returned"] } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        revenue: { $sum: "$grandTotal" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Top partners
  const topPartners = await Order.aggregate([
    { $match: { ...regionOnly, status: { $nin: ["cancelled", "returned"] } } },
    { $group: { _id: "$partner", totalRevenue: { $sum: "$grandTotal" }, totalOrders: { $sum: 1 } } },
    { $sort: { totalRevenue: -1 } },
    { $limit: 10 },
    { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "partner" } },
    { $unwind: "$partner" },
    { $project: { _id: 1, totalRevenue: 1, totalOrders: 1, "partner.name": 1, "partner.phone": 1 } },
  ]);

  // Recent orders
  const recentOrders = await Order.find(regionOnly)
    .populate("partner", "name phone")
    .populate("user", "name phone")
    .sort({ createdAt: -1 }).limit(15);

  return res.json({
    success: true,
    dashboard: {
      region: dashRegion,
      currency: dashCurrency,
      orders: orderStats || {
        totalOrders: 0,
        totalRevenue: 0,
        totalProfit: 0,
        deliveredOrders: 0,
        deliveredRevenue: 0,
        pendingRevenue: 0,
        pendingOrders: 0,
        totalGst: 0,
        avgOrderValue: 0,
      },
      counts: { users: userCount, partners: partnerCount, deliveryBoys: deliveryCount, products: productCount },
      pending: { kyc: pendingKyc, products: pendingProducts, payouts: pendingPayouts[0] || { count: 0, total: 0 } },
      dailyRevenue,
      topPartners,
      recentOrders,
    },
  });
}

module.exports = { getDashboard };
