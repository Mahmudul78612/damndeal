const ProductReview = require("../../../models/ProductReview");
const Order = require("../../../models/Order");
const User = require("../../../models/User");

// POST /user/products/:id/reviews
async function addProductReview(req, res) {
  try {
    const { rating, title, comment, images } = req.body;
    const productId = req.params.id;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Rating 1-5 required" });
    }

    // Optional: check if user has purchased & received it
    const purchased = await Order.findOne({
      user: req.user.userId,
      "items.product": productId,
      status: { $in: ["delivered", "completed"] },
    }).select("_id");

    // Snapshot user info
    const u = await User.findById(req.user.userId).select("name avatar");

    const review = await ProductReview.create({
      user: req.user.userId,
      product: productId,
      order: purchased?._id || null,
      rating: Math.min(5, Math.max(1, parseInt(rating, 10))),
      title: (title || "").slice(0, 120),
      comment: (comment || "").slice(0, 2000),
      images: Array.isArray(images) ? images.slice(0, 5) : [],
      status: "pending",
      userName: u?.name || "User",
      userAvatar: u?.avatar || "",
    });

    return res.status(201).json({ success: true, review, message: "Review submitted for approval" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /user/products/:id/reviews
async function listProductReviews(req, res) {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const productId = req.params.id;

    const [reviews, total, agg] = await Promise.all([
      ProductReview.find({ product: productId, status: "approved" })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      ProductReview.countDocuments({ product: productId, status: "approved" }),
      ProductReview.aggregate([
        { $match: { product: require("mongoose").Types.ObjectId.createFromHexString(productId), status: "approved" } },
        {
          $group: {
            _id: "$rating",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0, count = 0;
    agg.forEach((r) => {
      breakdown[r._id] = r.count;
      sum += r._id * r.count;
      count += r.count;
    });
    const avg = count ? sum / count : 0;

    return res.json({
      success: true,
      reviews,
      summary: { average: Math.round(avg * 10) / 10, total: count, breakdown },
      pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total, pages: Math.ceil(total / parseInt(limit, 10)) },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /user/products/:id/my-review
async function getMyProductReview(req, res) {
  try {
    const review = await ProductReview.findOne({
      user: req.user.userId,
      product: req.params.id,
    }).lean();
    return res.json({ success: true, review });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { addProductReview, listProductReviews, getMyProductReview };
