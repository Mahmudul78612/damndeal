const mongoose = require("mongoose");
const crypto = require("crypto");

// A placement slot inside one of our apps. Apps request ads by the zone's apiKey.
const zoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // "DamnDeal Home Banner"
    publisher: { type: mongoose.Schema.Types.ObjectId, ref: "Publisher", default: null, index: true },
    app: { type: String, trim: true }, // damndeal | damnpay | roadhustler | ...
    type: { type: String, enum: ["banner", "video"], default: "banner" },
    size: { type: String, default: "" }, // "320x50", "300x250", "video"
    apiKey: { type: String, unique: true, index: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

zoneSchema.pre("validate", function (next) {
  if (!this.apiKey) this.apiKey = "zone_" + crypto.randomBytes(8).toString("hex");
  next();
});

module.exports = mongoose.model("Zone", zoneSchema);
