const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
    },
    icon: {
      type: String,
      default: null,
    },
    platform: {
      type: String,
      enum: ["ddgo", "damndeal"],
      default: "ddgo",
      index: true,
    },
    regions: {
      type: [String],
      enum: ["IN", "US"],
      default: ["IN"],
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Region-scoped uniqueness: "Electronics" can exist separately for IN and US.
// `regions` is an array (single multikey field), so the unique index treats
// each (platform, name, region) tuple independently — preventing duplicates
// within the same region while allowing the same name across regions.
categorySchema.index({ platform: 1, slug: 1, regions: 1 }, { unique: true });
categorySchema.index({ platform: 1, name: 1, regions: 1 }, { unique: true });

module.exports = mongoose.model("Category", categorySchema);
