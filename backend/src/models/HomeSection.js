const mongoose = require("mongoose");

const homeSectionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: [
        "banner_carousel",
        "category_grid",
        "featured_partners",
        "popular_products",
        "deal_of_day",
        "custom_banner",
        "recently_ordered",
        "product_grid",
        "category_section",
        "horizontal_products",
        "grid_products",
        "promo_section",
      ],
      required: true,
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
    // Optional filter
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      // e.g. { categoryId: "...", limit: 10, productIds: [...], gridColumns: 4, gridRows: 3 }
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

module.exports = mongoose.model("HomeSection", homeSectionSchema);
