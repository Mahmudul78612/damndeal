const Order = require("../../../models/Order");
const User = require("../../../models/User");
const Product = require("../../../models/Product");
const PartnerKyc = require("../../../models/PartnerKyc");
const Review = require("../../../models/Review");
const CouponUsage = require("../../../models/CouponUsage");
const WalletTransaction = require("../../../models/WalletTransaction");
const SupportTicket = require("../../../models/SupportTicket");
const ReturnRequest = require("../../../models/ReturnRequest");

// GET /admin/analytics
async function getAnalytics(req, res) {
  try {
    const { from, to } = req.query;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const last7 = new Date(today.getTime() - 7 * 86400000);
    const last30 = new Date(today.getTime() - 30 * 86400000);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Date range filter
    const rangeFilter = {};
    if (from || to) {
      rangeFilter.createdAt = {};
      if (from) rangeFilter.createdAt.$gte = new Date(from);
      if (to) rangeFilter.createdAt.$lte = new Date(to);
    }

    const validStatuses = { $nin: ["cancelled", "returned"] };

    // ═══════════════════════════════════════
    // Run all aggregations in parallel
    // ═══════════════════════════════════════
    const [
      // 1. Revenue overview
      revenueOverview,
      // 2. Today vs Yesterday comparison
      todayOrders,
      yesterdayOrders,
      // 3. This month vs last month
      thisMonthStats,
      lastMonthStats,
      // 4. Order status distribution
      orderStatusDist,
      // 5. Top 10 products by revenue
      topProducts,
      // 6. Top 10 products by quantity sold
      topProductsByQty,
      // 7. Top 10 partners by revenue
      topPartners,
      // 8. Top 10 customers (users by spend)
      topCustomers,
      // 9. Revenue by day (last 30 days chart)
      revenueByDay,
      // 10. Orders by day (last 30 days chart)
      ordersByDay,
      // 11. Revenue by hour of day (heatmap)
      revenueByHour,
      // 12. Payment method breakdown
      paymentMethods,
      // 13. Order source breakdown (app/pos/web)
      orderSources,
      // 14. Category-wise revenue
      categoryRevenue,
      // 15. Average order value trend (last 30 days)
      aovTrend,
      // 16. User growth (last 30 days)
      userGrowth,
      // 17. User counts
      userCounts,
      // 18. Platform revenue split (ddgo vs damndeal)
      platformRevenue,
      // 19. Coupon usage stats
      couponStats,
      // 20. Delivery metrics
      deliveryMetrics,
      // 21. Return & cancel rate
      returnCancelStats,
      // 22. Average rating
      avgRating,
      // 23. Partner growth (last 30 days)
      partnerGrowth,
      // 24. Stock alerts (low stock products)
      lowStockProducts,
      // 25. Repeat customer rate
      repeatCustomers,
    ] = await Promise.all([
      // 1. Revenue overview (all time)
      Order.aggregate([
        { $match: { status: validStatuses } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$grandTotal" },
            totalOrders: { $sum: 1 },
            // Profit realized only after delivery
            totalProfit: {
              $sum: { $cond: [{ $eq: ["$status", "delivered"] }, "$profit", 0] },
            },
            deliveredRevenue: {
              $sum: { $cond: [{ $eq: ["$status", "delivered"] }, "$grandTotal", 0] },
            },
            deliveredOrders: {
              $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
            },
            pendingRevenue: {
              $sum: { $cond: [{ $ne: ["$status", "delivered"] }, "$grandTotal", 0] },
            },
            pendingOrders: {
              $sum: { $cond: [{ $ne: ["$status", "delivered"] }, 1, 0] },
            },
            totalDeliveryFee: { $sum: "$deliveryFee" },
            totalPlatformFee: { $sum: "$platformFee" },
            totalDiscount: { $sum: "$discount" },
            totalCouponDiscount: { $sum: "$couponDiscount" },
            avgOrderValue: { $avg: "$grandTotal" },
          },
        },
      ]),

      // 2. Today's orders
      Order.aggregate([
        { $match: { createdAt: { $gte: today }, status: validStatuses } },
        { $group: { _id: null, revenue: { $sum: "$grandTotal" }, orders: { $sum: 1 }, avg: { $avg: "$grandTotal" } } },
      ]),
      // Yesterday's orders
      Order.aggregate([
        { $match: { createdAt: { $gte: new Date(today.getTime() - 86400000), $lt: today }, status: validStatuses } },
        { $group: { _id: null, revenue: { $sum: "$grandTotal" }, orders: { $sum: 1 }, avg: { $avg: "$grandTotal" } } },
      ]),

      // 3. This month
      Order.aggregate([
        { $match: { createdAt: { $gte: thisMonthStart }, status: validStatuses } },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$grandTotal" },
            orders: { $sum: 1 },
            profit: {
              $sum: { $cond: [{ $eq: ["$status", "delivered"] }, "$profit", 0] },
            },
            deliveredRevenue: {
              $sum: { $cond: [{ $eq: ["$status", "delivered"] }, "$grandTotal", 0] },
            },
          },
        },
      ]),
      // Last month
      Order.aggregate([
        { $match: { createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd }, status: validStatuses } },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$grandTotal" },
            orders: { $sum: 1 },
            profit: {
              $sum: { $cond: [{ $eq: ["$status", "delivered"] }, "$profit", 0] },
            },
            deliveredRevenue: {
              $sum: { $cond: [{ $eq: ["$status", "delivered"] }, "$grandTotal", 0] },
            },
          },
        },
      ]),

      // 4. Order status distribution
      Order.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 }, revenue: { $sum: "$grandTotal" } } },
        { $sort: { count: -1 } },
      ]),

      // 5. Top products by revenue
      Order.aggregate([
        { $match: { status: validStatuses } },
        { $unwind: "$items" },
        { $group: { _id: "$items.product", name: { $first: "$items.name" }, revenue: { $sum: "$items.total" }, qty: { $sum: "$items.quantity" }, orders: { $sum: 1 } } },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
      ]),

      // 6. Top products by quantity
      Order.aggregate([
        { $match: { status: validStatuses } },
        { $unwind: "$items" },
        { $group: { _id: "$items.product", name: { $first: "$items.name" }, qty: { $sum: "$items.quantity" }, revenue: { $sum: "$items.total" } } },
        { $sort: { qty: -1 } },
        { $limit: 10 },
      ]),

      // 7. Top partners by revenue
      Order.aggregate([
        { $match: { status: validStatuses } },
        { $group: { _id: "$partner", revenue: { $sum: "$grandTotal" }, orders: { $sum: 1 }, avgOrder: { $avg: "$grandTotal" } } },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
        { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "p" } },
        { $unwind: { path: "$p", preserveNullAndEmptyArrays: true } },
        { $project: { revenue: 1, orders: 1, avgOrder: 1, name: "$p.name", phone: "$p.phone" } },
      ]),

      // 8. Top customers by spend
      Order.aggregate([
        { $match: { status: validStatuses, user: { $ne: null } } },
        { $group: { _id: "$user", spent: { $sum: "$grandTotal" }, orders: { $sum: 1 }, avgOrder: { $avg: "$grandTotal" } } },
        { $sort: { spent: -1 } },
        { $limit: 10 },
        { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "u" } },
        { $unwind: { path: "$u", preserveNullAndEmptyArrays: true } },
        { $project: { spent: 1, orders: 1, avgOrder: 1, name: "$u.name", phone: "$u.phone" } },
      ]),

      // 9. Revenue by day (last 30)
      Order.aggregate([
        { $match: { createdAt: { $gte: last30 }, status: validStatuses } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, revenue: { $sum: "$grandTotal" }, orders: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),

      // 10. Orders by day (last 30)
      Order.aggregate([
        { $match: { createdAt: { $gte: last30 } } },
        { $group: { _id: { date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, status: "$status" }, count: { $sum: 1 } } },
        { $sort: { "_id.date": 1 } },
      ]),

      // 11. Revenue by hour
      Order.aggregate([
        { $match: { createdAt: { $gte: last30 }, status: validStatuses } },
        { $group: { _id: { $hour: "$createdAt" }, revenue: { $sum: "$grandTotal" }, orders: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),

      // 12. Payment methods
      Order.aggregate([
        { $match: { status: validStatuses } },
        { $group: { _id: "$paymentMethod", count: { $sum: 1 }, revenue: { $sum: "$grandTotal" } } },
        { $sort: { revenue: -1 } },
      ]),

      // 13. Order sources
      Order.aggregate([
        { $match: { status: validStatuses } },
        { $group: { _id: "$source", count: { $sum: 1 }, revenue: { $sum: "$grandTotal" } } },
        { $sort: { revenue: -1 } },
      ]),

      // 14. Category revenue
      Order.aggregate([
        { $match: { status: validStatuses } },
        { $unwind: "$items" },
        { $lookup: { from: "products", localField: "items.product", foreignField: "_id", as: "prod" } },
        { $unwind: { path: "$prod", preserveNullAndEmptyArrays: true } },
        { $lookup: { from: "categories", localField: "prod.category", foreignField: "_id", as: "cat" } },
        { $unwind: { path: "$cat", preserveNullAndEmptyArrays: true } },
        { $group: { _id: "$cat.name", revenue: { $sum: "$items.total" }, qty: { $sum: "$items.quantity" } } },
        { $sort: { revenue: -1 } },
        { $limit: 15 },
      ]),

      // 15. AOV trend (last 30 days)
      Order.aggregate([
        { $match: { createdAt: { $gte: last30 }, status: validStatuses } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, aov: { $avg: "$grandTotal" }, orders: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),

      // 16. User growth (last 30 days)
      User.aggregate([
        { $match: { role: "user", createdAt: { $gte: last30 } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),

      // 17. User/partner/delivery counts
      User.aggregate([
        { $group: { _id: "$role", count: { $sum: 1 }, active: { $sum: { $cond: ["$isActive", 1, 0] } } } },
      ]),

      // 18. Platform split (app orders have user, pos don't — approximate by source)
      Order.aggregate([
        { $match: { status: validStatuses } },
        { $group: { _id: "$source", revenue: { $sum: "$grandTotal" }, orders: { $sum: 1 }, avgOrder: { $avg: "$grandTotal" } } },
        { $sort: { revenue: -1 } },
      ]),

      // 19. Coupon stats
      CouponUsage.aggregate([
        { $group: { _id: null, totalUsages: { $sum: 1 }, totalDiscount: { $sum: "$discountAmount" } } },
      ]),

      // 20. Delivery metrics
      Order.aggregate([
        { $match: { status: "delivered", deliveredAt: { $ne: null }, acceptedAt: { $ne: null } } },
        {
          $project: {
            deliveryTime: { $subtract: ["$deliveredAt", "$acceptedAt"] },
            distanceKm: 1,
          },
        },
        {
          $group: {
            _id: null,
            avgDeliveryMinutes: { $avg: { $divide: ["$deliveryTime", 60000] } },
            avgDistanceKm: { $avg: "$distanceKm" },
            totalDelivered: { $sum: 1 },
          },
        },
      ]),

      // 21. Return & cancel stats
      Order.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
            returned: { $sum: { $cond: [{ $eq: ["$status", "returned"] }, 1, 0] } },
          },
        },
      ]),

      // 22. Average rating
      Review.aggregate([
        { $group: { _id: null, avgRating: { $avg: "$rating" }, totalReviews: { $sum: 1 } } },
      ]),

      // 23. Partner growth (last 30 days)
      User.aggregate([
        { $match: { role: "partner", createdAt: { $gte: last30 } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),

      // 24. Low stock products (top 10)
      Product.find({ isActive: true, $expr: { $lte: ["$stock", "$lowStockThreshold"] } })
        .select("name stock lowStockThreshold partner")
        .populate("partner", "name phone")
        .sort({ stock: 1 })
        .limit(10)
        .lean(),

      // 25. Repeat customer rate
      Order.aggregate([
        { $match: { status: validStatuses, user: { $ne: null } } },
        { $group: { _id: "$user", orders: { $sum: 1 } } },
        {
          $group: {
            _id: null,
            totalCustomers: { $sum: 1 },
            repeatCustomers: { $sum: { $cond: [{ $gt: ["$orders", 1] }, 1, 0] } },
          },
        },
      ]),
    ]);

    // ═══════════════════════════════════════
    // Format response
    // ═══════════════════════════════════════
    const rv = revenueOverview[0] || {};
    const todayD = todayOrders[0] || { revenue: 0, orders: 0, avg: 0 };
    const yesterdayD = yesterdayOrders[0] || { revenue: 0, orders: 0, avg: 0 };
    const thisM = thisMonthStats[0] || { revenue: 0, orders: 0, profit: 0 };
    const lastM = lastMonthStats[0] || { revenue: 0, orders: 0, profit: 0 };
    const couponD = couponStats[0] || { totalUsages: 0, totalDiscount: 0 };
    const deliveryD = deliveryMetrics[0] || { avgDeliveryMinutes: 0, avgDistanceKm: 0, totalDelivered: 0 };
    const rcStats = returnCancelStats[0] || { total: 0, cancelled: 0, returned: 0 };
    const ratingD = avgRating[0] || { avgRating: 0, totalReviews: 0 };
    const repeatD = repeatCustomers[0] || { totalCustomers: 0, repeatCustomers: 0 };

    // Growth percentages
    const revenueGrowth = lastM.revenue ? (((thisM.revenue - lastM.revenue) / lastM.revenue) * 100).toFixed(1) : 0;
    const ordersGrowth = lastM.orders ? (((thisM.orders - lastM.orders) / lastM.orders) * 100).toFixed(1) : 0;
    const todayGrowth = yesterdayD.revenue ? (((todayD.revenue - yesterdayD.revenue) / yesterdayD.revenue) * 100).toFixed(1) : 0;

    // User counts map
    const uc = {};
    userCounts.forEach((r) => { uc[r._id] = { count: r.count, active: r.active }; });

    return res.json({
      success: true,
      analytics: {
        // Summary cards
        overview: {
          totalRevenue: rv.totalRevenue || 0,
          totalOrders: rv.totalOrders || 0,
          totalProfit: rv.totalProfit || 0,
          avgOrderValue: Math.round(rv.avgOrderValue || 0),
          totalDeliveryFee: rv.totalDeliveryFee || 0,
          totalPlatformFee: rv.totalPlatformFee || 0,
          totalDiscount: rv.totalDiscount || 0,
          totalCouponDiscount: rv.totalCouponDiscount || 0,
        },
        // Today vs yesterday
        today: { revenue: todayD.revenue, orders: todayD.orders, aov: Math.round(todayD.avg || 0), growthPercent: Number(todayGrowth) },
        // Month comparison
        thisMonth: { revenue: thisM.revenue, orders: thisM.orders, profit: thisM.profit, revenueGrowth: Number(revenueGrowth), ordersGrowth: Number(ordersGrowth) },
        lastMonth: { revenue: lastM.revenue, orders: lastM.orders, profit: lastM.profit },
        // Users
        users: {
          total: uc.user?.count || 0,
          active: uc.user?.active || 0,
          partners: uc.partner?.count || 0,
          activePartners: uc.partner?.active || 0,
          deliveryBoys: uc.delivery?.count || 0,
        },
        // Charts
        orderStatusDist,
        topProducts,
        topProductsByQty,
        topPartners,
        topCustomers,
        revenueByDay,
        ordersByDay,
        revenueByHour,
        aovTrend,
        userGrowth,
        partnerGrowth,
        // Breakdowns
        paymentMethods,
        orderSources,
        categoryRevenue,
        platformRevenue,
        // Operational
        coupon: couponD,
        delivery: { avgMinutes: Math.round(deliveryD.avgDeliveryMinutes || 0), avgDistanceKm: (deliveryD.avgDistanceKm || 0).toFixed(1), totalDelivered: deliveryD.totalDelivered },
        returnCancel: { total: rcStats.total, cancelled: rcStats.cancelled, returned: rcStats.returned, cancelRate: rcStats.total ? ((rcStats.cancelled / rcStats.total) * 100).toFixed(1) : 0, returnRate: rcStats.total ? ((rcStats.returned / rcStats.total) * 100).toFixed(1) : 0 },
        rating: { avg: (ratingD.avgRating || 0).toFixed(1), totalReviews: ratingD.totalReviews },
        repeatCustomerRate: repeatD.totalCustomers ? ((repeatD.repeatCustomers / repeatD.totalCustomers) * 100).toFixed(1) : 0,
        lowStockProducts,
      },
    });
  } catch (err) {
    console.error("Analytics error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { getAnalytics };
