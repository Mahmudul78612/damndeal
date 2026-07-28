const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    year: { type: Number },
    make: { type: String, trim: true }, // Ford
    model: { type: String, trim: true }, // F-150
    trim: { type: String, trim: true }, // XLT
    vin: { type: String, trim: true, uppercase: true },
    licensePlate: { type: String, trim: true, uppercase: true },
    color: { type: String, trim: true },
    mileage: { type: Number, default: 0 }, // current odometer (miles)
    engine: { type: String, trim: true }, // 3.5L V6 EcoBoost
    transmission: { type: String, enum: ["automatic", "manual", "cvt", "other", ""], default: "" },
    notes: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

vehicleSchema.virtual("label").get(function () {
  return [this.year, this.make, this.model].filter(Boolean).join(" ");
});
vehicleSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Vehicle", vehicleSchema);
