const mongoose = require("mongoose");

const impressionSchema = new mongoose.Schema(
  {
    ad: { type: mongoose.Schema.Types.ObjectId, ref: "Ad", required: true, index: true },
    advertiser: { type: mongoose.Schema.Types.ObjectId, ref: "Advertiser", index: true },
    publisher: { type: mongoose.Schema.Types.ObjectId, ref: "Publisher", default: null, index: true },
    zone: { type: mongoose.Schema.Types.ObjectId, ref: "Zone", default: null },
    app: { type: String, default: "" },
    ip: { type: String },
    country: { type: String, default: null, index: true },
    region: { type: String, default: null, index: true }, // state
    city: { type: String, default: null },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true }
);

// Fast time-range + grouping queries
impressionSchema.index({ ad: 1, createdAt: -1 });
impressionSchema.index({ advertiser: 1, createdAt: -1 });

module.exports = mongoose.model("Impression", impressionSchema);
