const mongoose = require("mongoose");

const desktopHomeSectionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: [
        "hero_carousel",       // full-width slider
        "banner_2col",         // 2 banners side by side
        "banner_3col",         // 3 banners in a row
        "banner_single",       // full-width single banner
        "category_products",   // category header + product grid
        "product_grid",        // product grid (2-6 cols)
        "deal_strip",          // horizontal deal cards
        "promo_full",          // full-width promo image
        "featured_categories", // category showcase row
      ],
      required: true,
    },
    platform: { type: String, enum: ["ddgo", "damndeal"], default: "damndeal" },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      // hero_carousel: { bannerIds: [] }
      // banner_2col / banner_3col: { banners: [{ image, link, linkType, linkValue }] }
      // banner_single: { image, link, linkType, linkValue }
      // category_products: { categoryId, limit, columns, sortBy, sortDir }
      // product_grid: { categoryId, limit, columns, sortBy, sortDir, productIds }
      // deal_strip: { categoryId, limit, sortBy }
      // promo_full: { image, link, bgColor }
      // featured_categories: { categoryIds: [] }
    },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DesktopHomeSection", desktopHomeSectionSchema);
