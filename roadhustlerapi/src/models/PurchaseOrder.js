const mongoose = require("mongoose");

const poItemSchema = new mongoose.Schema(
  {
    part: { type: mongoose.Schema.Types.ObjectId, ref: "Part" },
    partName: { type: String },
    quantity: { type: Number, default: 1 },
    costPrice: { type: Number, default: 0 },
    lineTotal: { type: Number, default: 0 },
    receivedQty: { type: Number, default: 0 },
  },
  { _id: false }
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: { type: String, unique: true }, // PO-1001
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
    items: [poItemSchema],
    subtotal: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    status: { type: String, enum: ["draft", "ordered", "received", "cancelled"], default: "draft", index: true },
    orderedAt: { type: Date },
    receivedAt: { type: Date },
    notes: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PurchaseOrder", purchaseOrderSchema);
