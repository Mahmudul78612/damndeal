const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    // recipientType lets us notify staff (User) or customers (Customer)
    recipientType: { type: String, enum: ["User", "Customer", "role"], default: "role" },
    recipient: { type: mongoose.Schema.Types.ObjectId, refPath: "recipientType", default: null },
    role: { type: String, default: null }, // when broadcasting to a role e.g. "manager"
    type: { type: String }, // new_lead, appointment_requested, estimate_approved, low_stock, invoice_paid, overdue
    title: { type: String },
    body: { type: String },
    link: { type: String }, // frontend route to open
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
