const ProductReview = require("../../../models/ProductReview");
const Product = require("../../../models/Product");
const mongoose = require("mongoose");

async function recomputeProductRating(productId) {
  const agg = await ProductReview.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId), status: "approved" } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  const avg = agg[0]?.avg || 0;
  const count = agg[0]?.count || 0;
  await Product.findByIdAndUpdate(productId, {
    rating: Math.round(avg * 10) / 10,
    reviewCount: count,
  });
}

// GET /admin/user-reviews?status=pending&page=1
async function listReviews(req, res) {
  try {
    const { status = "pending", page = 1, limit = 20, productId, q } = req.query;
    const filter = {};
    if (status && status !== "all") filter.status = status;
    if (productId) filter.product = productId;
    if (q) filter.$or = [{ title: new RegExp(q, "i") }, { comment: new RegExp(q, "i") }, { userName: new RegExp(q, "i") }];

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [reviews, total, counts] = await Promise.all([
      ProductReview.find(filter)
        .populate("product", "name images")
        .populate("user", "name avatar phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      ProductReview.countDocuments(filter),
      ProductReview.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ]);

    const statusCounts = { pending: 0, approved: 0, rejected: 0 };
    counts.forEach((c) => (statusCounts[c._id] = c.count));

    return res.json({
      success: true,
      reviews,
      statusCounts,
      pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total, pages: Math.ceil(total / parseInt(limit, 10)) },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /admin/user-reviews/:id/moderate
async function moderateReview(req, res) {
  try {
    const { action, reason } = req.body;
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ success: false, message: "action must be approve or reject" });
    }
    const review = await ProductReview.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: "Review not found" });

    review.status = action === "approve" ? "approved" : "rejected";
    review.rejectionReason = action === "reject" ? (reason || "") : "";
    review.reviewedBy = req.user.userId;
    review.reviewedAt = new Date();
    await review.save();
    await recomputeProductRating(review.product);

    return res.json({ success: true, review });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// DELETE /admin/user-reviews/:id
async function deleteReview(req, res) {
  try {
    const review = await ProductReview.findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: "Review not found" });
    if (review.status === 'approved') await recomputeProductRating(review.product);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// POST /admin/user-reviews/seed
async function seedReview(req, res) {
  try {
    const { productId, rating, title, comment, userName, userAvatar } = req.body;
    if (!productId || !rating) return res.status(400).json({ success: false, message: "productId & rating required" });

    const review = await ProductReview.create({
      user: req.user.userId,
      product: productId,
      rating: Math.min(5, Math.max(1, parseInt(rating, 10))),
      title: (title || "").slice(0, 120),
      comment: (comment || "").slice(0, 2000),
      userName: userName || "Verified Buyer",
      userAvatar: userAvatar || "",
      status: "approved",
      reviewedBy: req.user.userId,
      reviewedAt: new Date(),
    });
    await recomputeProductRating(productId);
    return res.status(201).json({ success: true, review });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { listReviews, moderateReview, deleteReview, seedReview };
