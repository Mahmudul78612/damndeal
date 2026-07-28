const mongoose = require("mongoose");

const adSchema = new mongoose.Schema(
  {
    advertiser: { type: mongoose.Schema.Types.ObjectId, ref: "Advertiser", required: true, index: true },
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: ["banner", "video"], default: "banner" },

    creativeUrl: { type: String, required: true }, // image/video path
    thumbnailUrl: { type: String, default: "" }, // poster for video
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    duration: { type: Number, default: 0 }, // seconds (video)

    targetUrl: { type: String, default: "" }, // click destination
    ctaText: { type: String, default: "Learn More" }, // CTA button label (Google/Meta style)

    status: { type: String, enum: ["pending", "active", "paused", "expired"], default: "active", index: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },

    targeting: {
      countries: [{ type: String, uppercase: true }], // ISO codes; empty = all
      states: [{ type: String }], // region codes/names; empty = all
      cities: [{ type: String }], // empty = all
    },

    zones: [{ type: mongoose.Schema.Types.ObjectId, ref: "Zone" }], // empty = any matching type
    weight: { type: Number, default: 5, min: 1, max: 10 }, // rotation priority
    impressionCap: { type: Number, default: 0 }, // 0 = unlimited

    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
    conversionValue: { type: Number, default: 0 }, // total sale value attributed

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
  },
  { timestamps: true }
);

adSchema.index({ status: 1, type: 1 });

module.exports = mongoose.model("Ad", adSchema);
