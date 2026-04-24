const mongoose = require("mongoose");

// Singleton-ish settings doc — one per key or one global doc
const appSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AppSettings", appSettingsSchema);

/*
  Example settings keys:
  - "delivery_radius_km" : 10
  - "delivery_fee" : 30
  - "min_order_amount" : 99
  - "commission_percent" : 5
  - "app_maintenance" : false
  - "support_phone" : "+911234567890"
  - "support_email" : "help@damndeal.com"
  - "terms_url" : "https://..."
  - "privacy_url" : "https://..."
*/
