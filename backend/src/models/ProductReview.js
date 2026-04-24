const mongoose = require("mongoose");

const productReviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, default: "", maxlength: 120 },
    comment: { type: String, trim: true, default: "", maxlength: 2000 },
    images: [{ type: String }],
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    rejectionReason: { type: String, default: "" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    helpfulCount: { type: Number, default: 0 },
    userName: { type: String, default: "" }, // snapshot
    userAvatar: { type: String, default: "" }, // snapshot
  },
  { timestamps: true }
);

productReviewSchema.index({ product: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("ProductReview", productReviewSchema);
