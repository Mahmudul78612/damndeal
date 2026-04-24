const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      enum: ["ddgo", "damndeal"],
      default: "ddgo",
      index: true,
    },
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    sku: {
      type: String,
      trim: true,
      default: null,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
      default: null,
    },
    images: [
      {
        type: String, // file path / URL
      },
    ],
    // Pricing
    costPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    mrp: {
      type: Number,
      required: true,
      min: 0,
    },
    // GST
    gstPercent: {
      type: Number,
      required: true,
      enum: [0, 5, 12, 18, 28],
      default: 18,
    },
    gstInclusive: {
      type: Boolean,
      default: true, // true = sellingPrice includes GST
    },
    hsnCode: {
      type: String,
      default: null,
    },
    // Inventory
    unit: {
      type: String,
      enum: ["piece", "kg", "g", "litre", "ml", "metre", "cm", "pack", "box", "dozen", "bottle", "packet", "pair", "set"],
      default: "piece",
    },
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
    lowStockThreshold: {
      type: Number,
      default: 5,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    barcode: {
      type: String,
      default: null,
    },
    weight: {
      type: Number,
      default: null, // in grams
    },
    tags: [String],

    // ── DamnDeal e-commerce fields ──
    brand: { type: String, trim: true, default: null },
    model: { type: String, trim: true, default: null },
    color: { type: String, trim: true, default: null },
    size: { type: String, trim: true, default: null },
    material: { type: String, trim: true, default: null },
    warranty: { type: String, trim: true, default: null },
    manufacturer: { type: String, trim: true, default: null },
    countryOfOrigin: { type: String, trim: true, default: "India" },
    returnPolicy: { type: String, trim: true, default: null },
    highlights: [String],
    specifications: [
      {
        key: { type: String },
        value: { type: String },
      },
    ],
    // ── Variants (universal: size/qty/pack with individual pricing & stock) ──
    hasVariants: { type: Boolean, default: false },
    variants: [
      {
        label: { type: String, trim: true },     // e.g. "S", "M", "1kg", "1 Pack", "500ml"
        sku: { type: String, trim: true, default: null },
        barcode: { type: String, trim: true, default: null },
        costPrice: { type: Number, min: 0, default: 0 },
        sellingPrice: { type: Number, min: 0, default: 0 },
        mrp: { type: Number, min: 0, default: 0 },
        stock: { type: Number, min: 0, default: 0 },
        isActive: { type: Boolean, default: true },
      },
    ],
    packageContents: { type: String, trim: true, default: null },
    shelfLife: { type: String, trim: true, default: null },
    minOrderQty: { type: Number, default: 1, min: 1 },
    maxOrderQty: { type: Number, default: null },
    length: { type: Number, default: null },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    isFeatured: { type: Boolean, default: false },
    isReturnable: { type: Boolean, default: true },
    isCOD: { type: Boolean, default: true },
    // Per-product delivery fee override (null = use global rule from settings).
    // 0 = explicitly free for this product. Any positive value = flat fee for the order.
    deliveryFee: { type: Number, default: null, min: 0 },

    // ── CJ Dropshipping source ──
    source: {
      type: String,
      enum: ["manual", "cj"],
      default: "manual",
      index: true,
    },
    cjProductId: { type: String, default: null },      // CJ pid
    cjVariantId: { type: String, default: null },      // CJ vid (default/first variant)
    cjVariantSku: { type: String, default: null },     // CJ variant SKU
    cjCostPrice: { type: Number, default: null },      // CJ cost in USD
    cjVariants: [                                       // All CJ variants mapped
      {
        label: { type: String },         // e.g. "Black-XL"
        cjVid: { type: String },
        cjSku: { type: String },
        cjCostUsd: { type: Number },
        sellingPrice: { type: Number },
        mrp: { type: Number },
        stock: { type: Number, default: 999 },
        isActive: { type: Boolean, default: true },
      },
    ],
    cjLastSyncAt: { type: Date, default: null },

    // Admin approval
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    approvalNote: {
      type: String,
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

productSchema.index({ partner: 1, category: 1 });
productSchema.index({ partner: 1, isActive: 1 });
productSchema.index({ name: "text", description: "text", tags: "text" });

module.exports = mongoose.model("Product", productSchema);
