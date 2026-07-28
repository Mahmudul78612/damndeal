const mongoose = require("mongoose");

const investorPurchaseSchema = new mongoose.Schema({
  investor: { type: mongoose.Schema.Types.ObjectId, ref: "Investor", required: true },
  slotsRequested: { type: Number, required: true, min: 1 },
  pricePerSlot: { type: Number, required: true },   // snapshot at time of purchase
  totalAmount: { type: Number, required: true },
  receiptUrl: { type: String },                      // bank transfer receipt image
  transactionRef: { type: String, trim: true },      // UTR / ref number from investor
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  slotIds: [{ type: String }],                       // Magic Club IDs assigned by admin
  slotsApproved: { type: Number, default: 0 },
  adminNote: { type: String },
  approvedAt: { type: Date },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

module.exports = mongoose.model("InvestorPurchase", investorPurchaseSchema);
