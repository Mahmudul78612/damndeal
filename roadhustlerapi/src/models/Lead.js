const mongoose = require("mongoose");

// Inbound enquiry from the website / phone — not yet a customer.
const leadSchema = new mongoose.Schema(
  {
    leadNumber: { type: String, unique: true }, // LEAD-1001
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    vehicle: { type: String, trim: true }, // free text "2018 Toyota Camry"
    service: { type: String, trim: true }, // "Brake inspection"
    message: { type: String },
    source: { type: String, enum: ["website", "phone", "walk-in", "google_ads", "facebook", "referral", "other"], default: "website" },
    status: { type: String, enum: ["new", "contacted", "quoted", "converted", "lost"], default: "new", index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    estimatedValue: { type: Number, default: 0 }, // USD
    followUpDate: { type: Date },
    convertedCustomer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Lead", leadSchema);
