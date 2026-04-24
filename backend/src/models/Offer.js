const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    // "flash_deal", "combo", "deal_of_day", "buy_x_get_y"
    type: {
      type: String,
      enum: ["flash_deal", "combo", "deal_of_day", "buy_x_get_y", "flat_discount"],
      required: true,
    },
    // Products in this offer
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    // Partner who created (null = admin global offer)
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    discountType: {
      type: String,
      enum: ["flat", "percent"],
      default: "percent",
    },
    discountValue: {
      type: Number,
      required: true,
    },
    maxDiscount: {
      type: Number,
      default: 0,
    },
    // buy_x_get_y
    buyQuantity: {
      type: Number,
      default: 0,
    },
    getQuantity: {
      type: Number,
      default: 0,
    },
    // combo price
    comboPrice: {
      type: Number,
      default: 0,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    image: {
      type: String,
      default: null,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

offerSchema.index({ endDate: 1, isActive: 1 });

module.exports = mongoose.model("Offer", offerSchema);
