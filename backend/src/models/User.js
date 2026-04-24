const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      default: null,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    role: {
      type: String,
      enum: ["user", "partner", "admin", "delivery", "staff"],
      default: "user",
    },
    avatar: {
      type: String,
      default: null,
    },
    isProfileComplete: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    fcmToken: {
      type: String,
      default: null,
    },
    referralCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    referredBy: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Same phone can have different roles (user on app, partner on portal)
userSchema.index({ phone: 1, role: 1 }, { unique: true });

module.exports = mongoose.model("User", userSchema);
