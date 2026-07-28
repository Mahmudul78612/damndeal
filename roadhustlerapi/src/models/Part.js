const mongoose = require("mongoose");

// Inventory item. Stock decremented when used on an invoiced work order,
// incremented when a purchase order is received or via manual adjustment.
const partSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // "Brake Pad Set — Ceramic"
    partNumber: { type: String, trim: true, index: true }, // SKU / manufacturer #
    category: { type: String, trim: true },
    brand: { type: String, trim: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", default: null },
    costPrice: { type: Number, default: 0 }, // what shop pays (USD)
    sellPrice: { type: Number, default: 0 }, // what customer pays (USD)
    quantityInStock: { type: Number, default: 0 },
    reorderLevel: { type: Number, default: 0 }, // low-stock threshold
    location: { type: String }, // shelf/bin
    barcode: { type: String },
    fitsVehicles: { type: String }, // free text compatibility
    taxable: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

partSchema.virtual("isLowStock").get(function () {
  return this.quantityInStock <= this.reorderLevel;
});
partSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Part", partSchema);
