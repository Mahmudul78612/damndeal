const mongoose = require("mongoose");

// Labor line on a job
const laborItemSchema = new mongoose.Schema(
  {
    service: { type: mongoose.Schema.Types.ObjectId, ref: "Service", default: null },
    description: { type: String, required: true },
    hours: { type: Number, default: 0 },
    rate: { type: Number, default: 0 }, // USD/hr
    flatPrice: { type: Number, default: null },
    tech: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    taxable: { type: Boolean, default: false },
    lineTotal: { type: Number, default: 0 },
  },
  { _id: true }
);

// Part line on a job
const partItemSchema = new mongoose.Schema(
  {
    part: { type: mongoose.Schema.Types.ObjectId, ref: "Part", default: null },
    partNumber: { type: String },
    description: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    costPrice: { type: Number, default: 0 },
    sellPrice: { type: Number, default: 0 },
    taxable: { type: Boolean, default: true },
    lineTotal: { type: Number, default: 0 },
    stockDeducted: { type: Boolean, default: false }, // guards double-deduction
  },
  { _id: true }
);

const timeLogSchema = new mongoose.Schema(
  {
    tech: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    startedAt: { type: Date },
    stoppedAt: { type: Date },
    minutes: { type: Number, default: 0 },
  },
  { _id: true }
);

// The job card — central document of the whole system.
const workOrderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true }, // WO-2001
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    mileageIn: { type: Number },
    status: {
      type: String,
      enum: ["estimate", "approved", "in_progress", "on_hold", "completed", "invoiced", "cancelled"],
      default: "estimate",
      index: true,
    },
    priority: { type: String, enum: ["low", "normal", "high", "urgent"], default: "normal" },
    assignedTechs: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    bay: { type: String },

    complaint: { type: String }, // customer's reported problem
    diagnosis: { type: String }, // technician findings
    recommendation: { type: String }, // future work

    laborItems: [laborItemSchema],
    partItems: [partItemSchema],

    laborSubtotal: { type: Number, default: 0 },
    partsSubtotal: { type: Number, default: 0 },
    discountType: { type: String, enum: ["amount", "percent"], default: "amount" },
    discount: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 }, // %
    taxAmount: { type: Number, default: 0 },
    shopSuppliesFee: { type: Number, default: 0 },
    total: { type: Number, default: 0 },

    estimateApproved: { type: Boolean, default: false },
    approvedAt: { type: Date },
    approvalMethod: { type: String, enum: ["in_person", "email", "sms", "portal", ""], default: "" },

    timeLog: [timeLogSchema],
    photos: [{ type: String }],

    invoice: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", default: null },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WorkOrder", workOrderSchema);
