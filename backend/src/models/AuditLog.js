const mongoose = require("mongoose");

/**
 * Immutable record of every privileged mutation.
 *
 * Written by services/audit.service.js — never write to this collection
 * directly and never update a row after it is created. Kept for 2 years
 * (TTL below) which covers a full financial-year dispute cycle.
 */
const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actorRole: { type: String, default: "" },      // admin | staff | vendor | system
    actorLabel: { type: String, default: "" },     // name/phone snapshot at the time

    action: { type: String, required: true, index: true }, // e.g. "coupon.campaign.approve"
    module: { type: String, default: "", index: true },    // coupons | orders | settings …

    targetType: { type: String, default: "" },     // CouponCampaign, CouponVendor …
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    targetLabel: { type: String, default: "" },    // human-readable snapshot

    // Only the fields that actually changed, so rows stay small and readable.
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },

    region: { type: String, default: "" },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    note: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ module: 1, action: 1, createdAt: -1 });
// Retain two years
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 730 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
