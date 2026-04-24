const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: "",
    },
    // "flat" = ₹50 off, "percent" = 10% off
    discountType: {
      type: String,
      enum: ["flat", "percent"],
      default: "flat",
    },
    discountValue: {
      type: Number,
      required: true,
    },
    maxDiscount: {
      type: Number,
      default: 0, // for percent type — cap. 0 = no cap
    },
    minOrderAmount: {
      type: Number,
      default: 0,
    },
    // scope
    scope: {
      type: String,
      enum: ["global", "partner", "first_order", "category"],
      default: "global",
    },
    // if scope=partner, which partner
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // if scope=category
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    usageLimit: {
      type: Number,
      default: 0, // 0 = unlimited
    },
    perUserLimit: {
      type: Number,
      default: 1,
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Coupon", couponSchema);
