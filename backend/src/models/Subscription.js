const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true, // Free, Silver, Gold, Platinum
    },
    price: {
      type: Number,
      required: true, // monthly price
    },
    duration: {
      type: Number,
      default: 30, // days
    },
    features: {
      commissionPercent: { type: Number, default: 5 },
      featuredListing: { type: Boolean, default: false },
      maxProducts: { type: Number, default: 50 },
      prioritySupport: { type: Boolean, default: false },
      analyticsAccess: { type: Boolean, default: false },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SubscriptionPlan", planSchema);

// Partner subscription tracking
const subscriptionSchema = new mongoose.Schema(
  {
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    paymentId: {
      type: String,
      default: null,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "expired", "cancelled"],
      default: "active",
    },
    autoRenew: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

subscriptionSchema.index({ partner: 1, status: 1 });

const PartnerSubscription = mongoose.model("PartnerSubscription", subscriptionSchema);

module.exports.PartnerSubscription = PartnerSubscription;
