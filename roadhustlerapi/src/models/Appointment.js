const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    apptNumber: { type: String, unique: true }, // APPT-1001
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null }, // null = guest/lead
    leadName: { type: String, trim: true }, // if not yet a customer
    leadPhone: { type: String, trim: true },
    leadEmail: { type: String, trim: true, lowercase: true },
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", default: null },
    vehicleText: { type: String, trim: true }, // free-text fallback
    serviceRequested: [{ type: String }], // ["Oil change","Tire rotation"]
    preferredDate: { type: Date },
    timeSlot: { type: String }, // "09:00-10:00"
    status: {
      type: String,
      enum: ["requested", "confirmed", "in_progress", "completed", "cancelled", "no_show"],
      default: "requested",
      index: true,
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    bay: { type: String },
    notes: { type: String },
    workOrder: { type: mongoose.Schema.Types.ObjectId, ref: "WorkOrder", default: null },
    source: { type: String, enum: ["website", "phone", "walk-in"], default: "website" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Appointment", appointmentSchema);
