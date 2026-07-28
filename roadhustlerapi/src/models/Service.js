const mongoose = require("mongoose");

// Priced labor/services the shop offers (catalog).
const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // "Front Brake Pad Replacement"
    category: { type: String, trim: true }, // Brakes, Engine, Maintenance
    description: { type: String },
    laborHours: { type: Number, default: 0 }, // standard book hours
    laborRate: { type: Number, default: 0 }, // USD/hr (0 = use shop default)
    flatPrice: { type: Number, default: null }, // overrides hours*rate when set
    taxable: { type: Boolean, default: false }, // labor taxability varies by state
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Service", serviceSchema);
