const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: String,
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unit: String,
    price: {
      type: Number,
      required: true,
    },
    gstPercent: Number,
    gstAmount: Number,
    total: {
      type: Number,
      required: true,
    },
    cjVid: { type: String, default: null },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // Who placed the order (app user)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
    items: [orderItemSchema],
    subtotal: {
      type: Number,
      required: true,
    },
    totalGst: {
      type: Number,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      default: null,
    },
    couponCode: {
      type: String,
      default: null,
    },
    couponDiscount: {
      type: Number,
      default: 0,
    },
    walletDeducted: {
      type: Number,
      default: 0,
    },
    deliveryFee: {
      type: Number,
      default: 0,
    },
    freeDeliveryApplied: {
      type: Boolean,
      default: false,
    },
    platformFee: {
      type: Number,
      default: 0,
    },
    codFee: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
    },
    costTotal: {
      type: Number,
      default: 0,
    },
    profit: {
      type: Number,
      default: 0,
    },
    // Delivery
    fulfillmentType: {
      type: String,
      enum: ["platform", "self"],
      default: "platform",
    },
    deliveryAddress: {
      label: String,
      address: String,
      landmark: String,
      city: String,
      state: String,
      pincode: String,
      lat: Number,
      lng: Number,
    },
    deliveryBoy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    deliveryStatus: {
      type: String,
      enum: ["pending", "assigned", "picked_up", "on_the_way", "delivered", "failed"],
      default: "pending",
    },
    deliveryOtp: {
      type: String,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    distanceKm: {
      type: Number,
      default: 0,
    },
    estimatedDeliveryMinutes: {
      type: Number,
      default: 0,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    rejectedReason: {
      type: String,
      default: null,
    },
    // Payment
    paymentMethod: {
      type: String,
      enum: ["cash", "upi", "card", "online", "credit", "cod", "razorpay", "wallet"],
      default: "cash",
    },
    paymentStatus: {
      type: String,
      enum: ["paid", "pending", "partial", "refunded"],
      default: "paid",
    },
    status: {
      type: String,
      enum: ["placed", "confirmed", "processing", "ready", "shipped", "delivered", "cancelled", "returned"],
      default: "placed",
    },
    cancelReason: {
      type: String,
      default: null,
    },
    note: {
      type: String,
      default: "",
    },
    // Source: "app" (user ordered from app) or "pos" (partner created in-store)
    source: {
      type: String,
      enum: ["app", "pos", "web"],
      default: "pos",
    },
    // ── CJ Dropshipping ──
    cjOrderId: { type: String, default: null },
    cjOrderStatus: { type: String, default: null },
    // ── Shipping (3rd-party courier) ──
    shipping: {
      provider: { type: String, enum: ["delhivery", "fship", null], default: null },
      awb: { type: String, default: null },        // Airway bill / tracking number
      shipmentId: { type: String, default: null },  // Provider's shipment ID
      label: { type: String, default: null },       // Label/manifest URL
      trackingUrl: { type: String, default: null },
      courierName: { type: String, default: null }, // Actual courier (for aggregators like FShip)
      status: { type: String, default: null },      // Raw status from provider
      statusDetail: { type: String, default: null },// Detailed status description
      estimatedDelivery: { type: Date, default: null },
      shippedAt: { type: Date, default: null },
      weight: { type: Number, default: 0 },         // grams
      dimensions: {
        length: { type: Number, default: 0 },       // cm
        width: { type: Number, default: 0 },
        height: { type: Number, default: 0 },
      },
      events: [{
        status: String,
        location: String,
        timestamp: Date,
        description: String,
      }],
    },
  },
  { timestamps: true }
);

orderSchema.index({ partner: 1, createdAt: -1 });
orderSchema.index({ partner: 1, status: 1 });
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ deliveryBoy: 1, deliveryStatus: 1 });

module.exports = mongoose.model("Order", orderSchema);
