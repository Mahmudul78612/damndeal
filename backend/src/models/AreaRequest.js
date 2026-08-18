const mongoose = require("mongoose");

/**
 * "We don't deliver here yet" — recorded instead of discarded.
 *
 * Every out-of-area visitor is a data point about where the next dark store
 * should go. Thrown away, expansion is guesswork; kept, the admin can see that
 * forty people in one neighbourhood asked this month and open there.
 *
 * The pin is the useful part; a phone number is optional because asking for one
 * before we can promise anything loses most of the signal.
 */
const areaRequestSchema = new mongoose.Schema(
  {
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true },   // [lng, lat]
    },
    address: { type: String, default: "" },
    pincode: { type: String, default: "", index: true },
    city: { type: String, default: "" },

    phone: { type: String, default: "", index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    region: { type: String, enum: ["IN", "US"], default: "IN", index: true },
    // Set when a store finally covers this pin and the person was told.
    notifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

areaRequestSchema.index({ location: "2dsphere" });
areaRequestSchema.index({ region: 1, createdAt: -1 });

module.exports = mongoose.model("AreaRequest", areaRequestSchema);
