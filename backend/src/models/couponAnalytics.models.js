const mongoose = require("mongoose");

/**
 * Coupon analytics — two collections with deliberately different shapes.
 *
 * CouponEvent      one row per meaningful action (view / click / claim /
 *                  redeem). Low volume, keeps the user dimension, so we can
 *                  answer "who claimed this" and build cohorts later.
 *                  Impressions are NOT stored here: a single home page render
 *                  shows ~20 coupons, which at 50k views/day would be a
 *                  million rows a day for information we only ever read as a
 *                  count. Those are counted in Redis and rolled up instead
 *                  (see services/couponEvents.service.js).
 *
 * CouponDailyStat  one pre-aggregated row per campaign per day. This is what
 *                  merchant dashboards read, so a date-range query never
 *                  touches the raw event collection.
 */

const couponEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["view", "click", "claim", "redeem"],
      required: true,
    },
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: "CouponCampaign", required: true, index: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "CouponVendor", default: null, index: true },
    // Reserved for the Organization -> Brand -> Outlet model (roadmap phase 2).
    org: { type: mongoose.Schema.Types.ObjectId, default: null },
    outlet: { type: mongoose.Schema.Types.ObjectId, default: null },

    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    region: { type: String, enum: ["IN", "US"], default: "IN" },
    source: { type: String, default: "" },   // home | list | detail | spin | api
    at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);
couponEventSchema.index({ campaign: 1, type: 1, at: -1 });
couponEventSchema.index({ vendor: 1, at: -1 });
couponEventSchema.index({ user: 1, type: 1, at: -1 });
// Raw events are only needed until they have been rolled up and analysed.
couponEventSchema.index({ at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 400 });

const couponDailyStatSchema = new mongoose.Schema(
  {
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: "CouponCampaign", required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "CouponVendor", default: null, index: true },
    date: { type: String, required: true },   // YYYY-MM-DD (UTC)
    region: { type: String, default: "IN" },

    impressions: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    claims: { type: Number, default: 0 },
    redemptions: { type: Number, default: 0 },
  },
  { timestamps: true }
);
couponDailyStatSchema.index({ campaign: 1, date: 1 }, { unique: true });
couponDailyStatSchema.index({ vendor: 1, date: -1 });

module.exports = {
  CouponEvent: mongoose.model("CouponEvent", couponEventSchema),
  CouponDailyStat: mongoose.model("CouponDailyStat", couponDailyStatSchema),
};
