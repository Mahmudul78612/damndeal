const mongoose = require("mongoose");

const inventoryLogSchema = new mongoose.Schema(
  {
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["add", "remove", "sale", "return", "adjustment"],
      required: true,
    },
    quantity: {
      type: Number,
      required: true, // positive for add, negative for remove
    },
    stockAfter: {
      type: Number,
      required: true,
    },
    note: {
      type: String,
      default: "",
    },
    reference: {
      type: String,
      default: null, // orderId or adjustment reason
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("InventoryLog", inventoryLogSchema);
