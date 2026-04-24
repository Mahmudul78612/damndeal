const mongoose = require("mongoose");

const addressBlock = {
  address: { type: String, default: "" },
  city: { type: String, default: "" },
  state: { type: String, default: "" },
  pincode: { type: String, default: "" },
};

const kycSchema = new mongoose.Schema(
  {
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    // ── Step 1: Personal & Business ──
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    organizationName: { type: String, required: true, trim: true },
    photo: { type: String, required: true }, // shop / business photo

    // ── Step 2: GST & Tax ──
    gstNumber: { type: String, required: true, trim: true, uppercase: true },
    gstRegisteredName: { type: String, required: true, trim: true },
    gstCertificateImage: { type: String, default: null }, // upload
    panNumber: { type: String, required: true, trim: true, uppercase: true },

    // ── Step 3: Bank Details ──
    bankAccountNumber: { type: String, default: "" },
    bankIfscCode: { type: String, default: "", uppercase: true },
    bankBeneficiaryName: { type: String, default: "", trim: true },
    bankName: { type: String, default: "" },
    passbookImage: { type: String, default: null }, // upload

    // ── Step 4: Pickup Address ──
    shopAddress: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    pincode: { type: String, default: "" },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
    },

    // ── Step 5: Billing Address ──
    billingAddress: addressBlock,
    billingAddressSameAsShop: { type: Boolean, default: false },

    // ── Delivery Preferences ──
    selfDeliveryEnabled: { type: Boolean, default: false },
    freeDeliveryAbove: { type: Number, default: 0 },

    // ── Review ──
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    rejectionReason: { type: String, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

kycSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("PartnerKyc", kycSchema);
