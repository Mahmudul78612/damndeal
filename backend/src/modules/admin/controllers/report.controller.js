const Order = require("../../../models/Order");
const User = require("../../../models/User");
const Payment = require("../../../models/Payment");

// GET /admin/reports/orders — order report with CSV export
async function orderReport(req, res) {
  const { from, to, partner, status, format } = req.query;
  const filter = {};
  if (partner) filter.partner = partner;
  if (status) filter.status = status;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const orders = await Order.find(filter)
    .populate("partner", "name phone")
    .populate("user", "name phone")
    .sort({ createdAt: -1 })
    .limit(5000)
    .lean();

  if (format === "csv") {
    const headers = "Order Number,Date,Partner,User,Subtotal,Discount,Coupon Discount,Delivery Fee,Platform Fee,Grand Total,Status,Payment,Source\n";
    const rows = orders.map((o) =>
      `${o.orderNumber},${o.createdAt.toISOString()},${o.partner?.name || ""},${o.user?.name || ""},${o.subtotal},${o.discount},${o.couponDiscount || 0},${o.deliveryFee},${o.platformFee},${o.grandTotal},${o.status},${o.paymentMethod},${o.source}`
    ).join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=orders-report-${Date.now()}.csv`);
    return res.send(headers + rows);
  }

  // Summary stats
  const [stats] = await Order.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: "$grandTotal" },
        totalDiscount: { $sum: "$discount" },
        totalCouponDiscount: { $sum: "$couponDiscount" },
        totalDeliveryFee: { $sum: "$deliveryFee" },
        totalPlatformFee: { $sum: "$platformFee" },
        avgOrderValue: { $avg: "$grandTotal" },
      },
    },
  ]);

  return res.json({ success: true, stats: stats || {}, orderCount: orders.length, orders });
}

// GET /admin/reports/revenue — daily revenue chart
async function revenueReport(req, res) {
  const { from, to } = req.query;
  const match = { status: { $nin: ["cancelled", "returned"] } };
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) match.createdAt.$lte = new Date(to);
  }

  const daily = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        orders: { $sum: 1 },
        revenue: { $sum: "$grandTotal" },
        platformFee: { $sum: "$platformFee" },
        deliveryFee: { $sum: "$deliveryFee" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return res.json({ success: true, daily });
}

// GET /admin/reports/users — user growth
async function userReport(req, res) {
  const daily = await User.aggregate([
    { $match: { role: "user" } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $limit: 90 },
  ]);

  const totalUsers = await User.countDocuments({ role: "user" });
  const totalPartners = await User.countDocuments({ role: "partner" });

  return res.json({ success: true, totalUsers, totalPartners, daily });
}

// GET /admin/reports/payments
async function paymentReport(req, res) {
  const { from, to, format } = req.query;
  const filter = { status: "paid" };
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const payments = await Payment.find(filter)
    .populate("order", "orderNumber")
    .populate("user", "name phone")
    .sort({ createdAt: -1 })
    .limit(5000)
    .lean();

  if (format === "csv") {
    const headers = "Date,Order,User,Amount,Method,Status,Razorpay ID\n";
    const rows = payments.map((p) =>
      `${p.createdAt.toISOString()},${p.order?.orderNumber || ""},${p.user?.name || ""},${p.amount},${p.method},${p.status},${p.razorpayPaymentId || ""}`
    ).join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=payments-report-${Date.now()}.csv`);
    return res.send(headers + rows);
  }

  return res.json({ success: true, payments });
}

module.exports = { orderReport, revenueReport, userReport, paymentReport };
