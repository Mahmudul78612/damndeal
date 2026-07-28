const mongoose = require("mongoose");

const investorWithdrawalSchema = new mongoose.Schema({
  investor: { type: mongoose.Schema.Types.ObjectId, ref: "Investor", required: true },
  pointsRequested: { type: Number, required: true, min: 1 },
  amountInRupees: { type: Number, required: true },  // pointsRequested / 100
  bankDetails: {                                      // snapshot at time of request
    accountHolder: String,
    accountNumber: String,
    ifsc: String,
    bankName: String,
    upiId: String,
  },
  status: { type: String, enum: ["pending", "approved", "rejected", "processed"], default: "pending" },
  adminNote: { type: String },
  utrNumber: { type: String },                        // payment reference from admin
  processedAt: { type: Date },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

module.exports = mongoose.model("InvestorWithdrawal", investorWithdrawalSchema);
