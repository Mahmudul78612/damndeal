const mongoose = require("mongoose");

const investorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, required: true, unique: true, trim: true },
  region: { type: String, enum: ["IN", "US"], default: "IN", index: true },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  kycStatus: { type: String, enum: ["not_submitted", "submitted", "approved", "rejected"], default: "not_submitted" },
  kycDocuments: [{
    docType: { type: String }, // pan, aadhaar, passport, gst
    url: { type: String },
    uploadedAt: { type: Date, default: Date.now },
  }],
  bankDetails: {
    accountHolder: String,
    accountNumber: String,
    ifsc: String,
    bankName: String,
    upiId: String,
  },
  totalSlotsOwned: { type: Number, default: 0 },
  pointsBalance: { type: Number, default: 0 },
  totalEarned: { type: Number, default: 0 },
  totalWithdrawn: { type: Number, default: 0 },
  adminNote: { type: String },
}, { timestamps: true });

module.exports = mongoose.model("Investor", investorSchema);
