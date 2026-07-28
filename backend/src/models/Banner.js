const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      required: true,
    },
    linkType: {
      type: String,
      enum: ["none", "category", "product", "partner", "url"],
      default: "none",
    },
    linkValue: {
      type: String,
      default: null, // category id, product id, partner id, or URL
    },
    placement: {
      type: String,
      enum: ["home_top", "home_middle", "home_bottom", "home_square", "category_page", "partner_page"],
      default: "home_top",
    },
    platform: {
      type: String,
      enum: ["ddgo", "damndeal"],
      default: "ddgo",
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
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    subCategories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
    }],
    productIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Banner", bannerSchema);
