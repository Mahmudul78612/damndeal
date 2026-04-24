const mongoose = require("mongoose");

const referralSchema = new mongoose.Schema(
  {
    referrer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    referee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    referralCode: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "expired"],
      default: "pending",
    },
    // Rewards
    referrerReward: {
      type: Number,
      default: 0,
    },
    refereeReward: {
      type: Number,
      default: 0,
    },
    rewardedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

referralSchema.index({ referrer: 1, referee: 1 }, { unique: true });

module.exports = mongoose.model("Referral", referralSchema);
