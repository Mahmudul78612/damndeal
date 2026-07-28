const mongoose = require("mongoose");

// "Contact Sales" enquiry from the advertise landing page.
const salesLeadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    message: { type: String, trim: true },
    status: { type: String, enum: ["new", "contacted", "closed"], default: "new", index: true },
    ip: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SalesLead", salesLeadSchema);
