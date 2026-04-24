const Review = require("../../../models/Review");
const Order = require("../../../models/Order");
const DeliveryBoy = require("../../../models/DeliveryBoy");

// POST /user/reviews
async function addReview(req, res) {
  const { orderId, rating, deliveryRating, comment } = req.body;
  if (!orderId || !rating) return res.status(400).json({ success: false, message: "orderId and rating required" });

  const order = await Order.findOne({ _id: orderId, user: req.user.userId, status: "delivered" });
  if (!order) return res.status(404).json({ success: false, message: "Delivered order not found" });

  const existing = await Review.findOne({ user: req.user.userId, order: orderId });
  if (existing) return res.status(409).json({ success: false, message: "Already reviewed" });

  const review = await Review.create({
    user: req.user.userId, order: orderId,
    partner: order.partner,
    deliveryBoy: order.deliveryBoy || null,
    rating: Math.min(5, Math.max(1, rating)),
    deliveryRating: deliveryRating ? Math.min(5, Math.max(1, deliveryRating)) : null,
    comment: comment || "",
  });

  // Update delivery boy rating if applicable
  if (order.deliveryBoy && deliveryRating) {
    const boy = await DeliveryBoy.findOne({ user: order.deliveryBoy });
    if (boy) {
      const newCount = boy.ratingCount + 1;
      boy.rating = ((boy.rating * boy.ratingCount) + deliveryRating) / newCount;
      boy.ratingCount = newCount;
      await boy.save();
    }
  }

  return res.status(201).json({ success: true, review });
}

// GET /user/shops/:id/reviews
async function getShopReviews(req, res) {
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const [reviews, total] = await Promise.all([
    Review.find({ partner: req.params.id }).populate("user", "name avatar")
      .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)),
    Review.countDocuments({ partner: req.params.id }),
  ]);

  return res.json({
    success: true, reviews,
    pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total, pages: Math.ceil(total / parseInt(limit, 10)) },
  });
}

module.exports = { addReview, getShopReviews };
