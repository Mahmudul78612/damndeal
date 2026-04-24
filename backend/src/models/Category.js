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

categorySchema.index({ platform: 1, slug: 1 }, { unique: true });
categorySchema.index({ platform: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Category", categorySchema);
