const mongoose = require("mongoose");

const wishlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // saved shop
    },
  },
  { timestamps: true }
);

wishlistSchema.index({ user: 1, product: 1 }, { unique: true, sparse: true });
wishlistSchema.index({ user: 1, partner: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Wishlist", wishlistSchema);
