const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      default: "Walk-in",
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    totalOrders: {
      type: Number,
      default: 0,
    },
    totalSpent: {
      type: Number,
      default: 0,
    },
    lastOrderAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

customerSchema.index({ partner: 1, phone: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Customer", customerSchema);
