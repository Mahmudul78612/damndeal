const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    label: {
      type: String,
      enum: ["home", "work", "other"],
      default: "home",
    },
    address: {
      type: String,
      required: true,
    },
    landmark: {
      type: String,
      default: null,
    },
    city: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    pincode: {
      type: String,
      default: null,
    },
    // US ZIP code (5 or 9 digit). Either pincode (IN) or zip (US) must exist.
    zip: {
      type: String,
      default: null,
    },
    country: {
      type: String,
      enum: ["IN", "US"],
      default: "IN",
      index: true,
    },
    lat: {
      type: Number,
      default: null,
    },
    lng: {
      type: Number,
      default: null,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Address", addressSchema);
