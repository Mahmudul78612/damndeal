const mongoose = require("mongoose");

const staffSchema = new mongoose.Schema(
  {
    // Linked login account. Null until the staff member signs in for the first
    // time (verify-otp creates the User and back-fills this).
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      unique: true,
      sparse: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    // Phone is the login identity (OTP on the admin panel). Mirrored from the
    // linked User so staff can be looked up before a User doc even exists.
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    department: {
      type: String,
      default: "general",
    },
    // Preset name from config/permissions ROLE_PRESETS ("custom" = manual list)
    roleName: {
      type: String,
      default: "custom",
    },
    permissions: {
      type: [String],
      default: [],
      // keys from config/permissions.js — e.g. ["manage_orders","manage_products"]
    },
    // Which storefronts this staff member may work on. Empty = both.
    regions: {
      type: [String],
      enum: ["IN", "US"],
      default: ["IN"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Staff", staffSchema);
