const mongoose = require("mongoose");

const payoutSchema = new mongoose.Schema(
  {
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    period: {
      from: { type: Date, required: true },
      to: { type: Date, required: true },
    },
    totalOrders: {
      type: Number,
      default: 0,
    },
    totalRevenue: {
      type: Number,
      default: 0,
    },
    commission: {
      type: Number,
      default: 0,
    },
    tds: {
      type: Number,
      default: 0,
    },
    netPayout: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    transactionId: {
      type: String,
      default: null,
    },
    paymentMode: {
      type: String,
      enum: ["bank_transfer", "upi", "cheque"],
      default: "bank_transfer",
    },
    note: {
      type: String,
      default: "",
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

payoutSchema.index({ partner: 1, createdAt: -1 });

module.exports = mongoose.model("Payout", payoutSchema);
