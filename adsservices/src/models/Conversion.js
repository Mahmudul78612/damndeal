const mongoose = require("mongoose");

// A conversion/event fired by the advertiser's site after an ad click
// (like Meta Pixel / Google conversion tracking). Attributed to the click → ad.
const conversionSchema = new mongoose.Schema(
  {
    ad: { type: mongoose.Schema.Types.ObjectId, ref: "Ad", index: true },
    advertiser: { type: mongoose.Schema.Types.ObjectId, ref: "Advertiser", index: true },
    click: { type: mongoose.Schema.Types.ObjectId, ref: "Click", default: null }, // attribution source
    zone: { type: mongoose.Schema.Types.ObjectId, ref: "Zone", default: null },

    event: { type: String, default: "purchase" }, // purchase | lead | signup | add_to_cart | custom
    value: { type: Number, default: 0 }, // sale amount
    currency: { type: String, default: "USD" },
    orderId: { type: String, default: "" }, // advertiser's order/txn id (dedupe)

    ip: { type: String },
    country: { type: String, default: null },
    region: { type: String, default: null },
    source: { type: String, enum: ["pixel", "api"], default: "pixel" }, // browser pixel vs server-side API
  },
  { timestamps: true }
);

conversionSchema.index({ advertiser: 1, createdAt: -1 });
conversionSchema.index({ ad: 1, createdAt: -1 });
// dedupe lookup (non-empty orderId). Dedup is enforced in code (reliable across drivers).
conversionSchema.index({ advertiser: 1, orderId: 1 });

module.exports = mongoose.model("Conversion", conversionSchema);
