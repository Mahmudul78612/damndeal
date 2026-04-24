const mongoose = require("mongoose");

const deliveryBoySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    // null = platform delivery boy, set = partner's own delivery boy
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      default: null,
    },
    photo: {
      type: String,
      default: null,
    },
    aadhaarNumber: {
      type: String,
      default: null,
    },
    vehicleType: {
      type: String,
      enum: ["bicycle", "bike", "scooter", "car", "walk"],
      default: "bike",
    },
    vehicleNumber: {
      type: String,
      default: null,
    },
    // Realtime location
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lng, lat]
        default: [0, 0],
      },
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    totalDeliveries: {
      type: Number,
      default: 0,
    },
    totalEarnings: {
      type: Number,
      default: 0,
    },
    rating: {
      type: Number,
      default: 0,
    },
    ratingCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

deliveryBoySchema.index({ location: "2dsphere" });

module.exports = mongoose.model("DeliveryBoy", deliveryBoySchema);
