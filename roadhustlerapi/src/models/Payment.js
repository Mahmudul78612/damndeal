const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", index: true },
    amount: { type: Number, required: true }, // USD
    method: { type: String, enum: ["cash", "card", "check", "ach", "online", "other"], default: "cash" },
    reference: { type: String }, // txn id / check number
    stripePaymentIntent: { type: String },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // null = online
    note: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
