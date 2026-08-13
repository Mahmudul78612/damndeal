const mongoose = require("mongoose");

/**
 * Multi-location / multi-brand hierarchy.
 *
 *   CouponOrg      the COMPANY. Owns billing, people and one or more brands.
 *     └── CouponVendor (= BRAND, the existing collection — gains an `org` ref;
 *          its slug/logo/description stay the public identity behind
 *          /brands/[slug], which is why it was not renamed)
 *           └── CouponOutlet   the physical locations
 *   CouponMember   a person who may act for an org, with a role and a scope
 *
 * Credits deliberately stay on CouponVendor for now — moving the live balance
 * is a billing change and belongs to roadmap phase 4, not to this structural
 * one. CouponOrg carries the billing IDENTITY (legal name, tax id) so phase 4
 * has somewhere to attach invoices without another migration.
 */

const couponOrgSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    legalName: { type: String, default: "" },
    taxId: { type: String, default: "" },          // GSTIN (IN) / EIN (US)
    billingEmail: { type: String, default: "", lowercase: true, trim: true },
    billingPhone: { type: String, default: "" },

    ownerUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    region: { type: String, enum: ["IN", "US"], default: "IN", index: true },
    plan: { type: String, default: "free" },
    status: { type: String, enum: ["active", "suspended"], default: "active", index: true },
    note: { type: String, default: "" },           // internal ops note
  },
  { timestamps: true }
);
couponOrgSchema.index({ region: 1, status: 1 });

const couponOutletSchema = new mongoose.Schema(
  {
    org: { type: mongoose.Schema.Types.ObjectId, ref: "CouponOrg", required: true, index: true },
    brand: { type: mongoose.Schema.Types.ObjectId, ref: "CouponVendor", required: true, index: true },

    name: { type: String, required: true, trim: true },   // "Sector 17 Branch"
    code: { type: String, default: "", trim: true },      // merchant's own store code
    address: { type: String, default: "" },
    state: { type: String, default: "", index: true },
    city: { type: String, default: "" },
    pincode: { type: String, default: "" },
    phone: { type: String, default: "" },
    hours: { type: String, default: "" },                 // free text, e.g. "10am-9pm"

    point: {                                              // GeoJSON [lng, lat]
      type: { type: String, enum: ["Point"], default: undefined },
      coordinates: { type: [Number], default: undefined },
    },

    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);
couponOutletSchema.index({ brand: 1, isActive: 1 });
couponOutletSchema.index({ state: 1, city: 1 });
couponOutletSchema.index({ point: "2dsphere" }, { sparse: true });

/**
 * A person's membership of an org.
 *
 * role      what they may do (see config/couponPermissions.js)
 * scope     which brands/outlets they may do it to. Empty arrays mean
 *           "the whole org" — a cashier must always have outlets set.
 */
const couponMemberSchema = new mongoose.Schema(
  {
    org: { type: mongoose.Schema.Types.ObjectId, ref: "CouponOrg", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },

    // Identity used for the invite before the account exists
    name: { type: String, default: "" },
    email: { type: String, default: "", lowercase: true, trim: true },
    phone: { type: String, default: "", trim: true, index: true },

    role: {
      type: String,
      enum: ["owner", "manager", "marketer", "cashier", "accountant"],
      default: "cashier",
    },
    scope: {
      brands: { type: [mongoose.Schema.Types.ObjectId], default: [] },
      outlets: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    },

    // Business logins are email + password (bcrypt). Phone OTP still works for
    // the owner through the consumer account; a cashier on a shared till
    // device needs credentials that do not depend on someone's personal phone.
    passwordHash: { type: String, default: null, select: false },

    status: { type: String, enum: ["invited", "active", "disabled"], default: "invited", index: true },
    inviteToken: { type: String, default: null, index: true },
    inviteExpiresAt: { type: Date, default: null },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);
// One membership per person per org. Sparse so several pending invites can
// coexist before their user accounts exist.
couponMemberSchema.index({ org: 1, user: 1 }, { unique: true, sparse: true });
couponMemberSchema.index({ org: 1, role: 1 });

module.exports = {
  CouponOrg: mongoose.model("CouponOrg", couponOrgSchema),
  CouponOutlet: mongoose.model("CouponOutlet", couponOutletSchema),
  CouponMember: mongoose.model("CouponMember", couponMemberSchema),
};
