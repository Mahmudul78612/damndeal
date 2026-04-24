const mongoose = require("mongoose");

const walletTxnSchema = new mongoose.Schema(
  {
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["credit", "debit"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    source: {
      type: String,
      enum: ["refund", "cashback", "referral", "admin", "order_payment", "topup"],
      required: true,
    },
    reference: {
      type: String,
      default: null, // order id, referral id, etc.
    },
    description: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WalletTransaction", walletTxnSchema);
