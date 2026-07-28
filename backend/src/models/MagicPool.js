const mongoose = require("mongoose");

const participantSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null, index: true },
    // Magic Club document id (from magicclub.damndeal.com), if available
    clubId: { type: String, default: null },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const magicPoolSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    // What the winner gets — free-form ("₹500 cashback", "iPhone 15", etc.)
    prizeDescription: { type: String, default: "" },
    // Optional: points credited via Magic Club wallet to the winner.
    prizePoints: { type: Number, default: 0, min: 0 },
    // Image / banner (admin-uploaded URL) — primary hero image
    imageUrl: { type: String, default: "" },
    // Optional gallery (slideshow on web)
    images: { type: [String], default: [] },
    // Short tagline shown above the title (e.g. "Mega Festival Draw")
    tagline: { type: String, default: "" },
    // Visual theme preset (controls gradient colors). Defaults to "fuchsia".
    theme: {
      type: String,
      enum: ["fuchsia", "amber", "emerald", "sky", "violet", "rose", "cosmic", "gold"],
      default: "fuchsia",
    },
    capacity: { type: Number, required: true, min: 2, max: 10000 },
    // Which storefront this pool is for (optional filter)
    platform: {
      type: String,
      enum: ["damndeal", "ddgo", "any"],
      default: "any",
    },
    status: {
      type: String,
      enum: ["open", "drawing", "drawn", "cancelled"],
      default: "open",
      index: true,
    },
    isActive: { type: Boolean, default: true },
    participants: [participantSchema],
    winner: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      participantId: { type: mongoose.Schema.Types.ObjectId, default: null },
      drawnAt: { type: Date, default: null },
      // Random seed used (audit trail)
      seed: { type: String, default: null },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

magicPoolSchema.index({ status: 1, isActive: 1, platform: 1 });

magicPoolSchema.virtual("participantsCount").get(function () {
  return Array.isArray(this.participants) ? this.participants.length : 0;
});
magicPoolSchema.virtual("seatsLeft").get(function () {
  return Math.max(0, this.capacity - (this.participants?.length || 0));
});
magicPoolSchema.virtual("isFull").get(function () {
  return (this.participants?.length || 0) >= this.capacity;
});

magicPoolSchema.set("toJSON", { virtuals: true });
magicPoolSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("MagicPool", magicPoolSchema);
