const mongoose = require("mongoose");

// Snapshot line (frozen at invoicing time so later WO edits don't change history)
const lineSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["labor", "part", "fee"], required: true },
    description: { type: String },
    quantity: { type: Number, default: 1 },
    unitPrice: { type: Number, default: 0 },
    taxable: { type: Boolean, default: false },
    lineTotal: { type: Number, default: 0 },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, unique: true }, // INV-3001
    workOrder: { type: mongoose.Schema.Types.ObjectId, ref: "WorkOrder", index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle" },

    lineItems: [lineSchema],
    subtotal: { type: Number, default: 0 },
    discountType: { type: String, enum: ["amount", "percent"], default: "amount" },
    discount: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    shopSuppliesFee: { type: Number, default: 0 },
    total: { type: Number, default: 0 },

    amountPaid: { type: Number, default: 0 },
    amountDue: { type: Number, default: 0 },
    status: { type: String, enum: ["draft", "sent", "partial", "paid", "overdue", "void"], default: "draft", index: true },

    dueDate: { type: Date },
    payments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Payment" }],
    pdfUrl: { type: String },
    sentAt: { type: Date },
    notes: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Invoice", invoiceSchema);
