const mongoose = require("mongoose");

/**
 * What one dark store actually has on its shelf.
 *
 * Until now stock lived on the Product, which is fine for a marketplace where
 * one seller ships everything, and wrong for quick commerce: two stores stock
 * the same milk independently, and one running out must not empty the other.
 * Price is per store for the same reason — the same product can cost more where
 * rent and wastage are higher.
 *
 * A product with no row here is simply not carried by that store. That is the
 * default on purpose: a new store starts empty and is stocked deliberately,
 * rather than silently claiming to have the entire catalogue.
 */
const storeInventorySchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DarkStore",
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    stock: { type: Number, default: 0, min: 0 },

    /* 0 means "use the product's own price". Kept as an override rather than a
       copy so a catalogue-wide price change still reaches every store that has
       not deliberately set its own. */
    sellingPrice: { type: Number, default: 0, min: 0 },
    mrp: { type: Number, default: 0, min: 0 },

    /* Taken off the shelf without losing the stock count — a store stops
       selling bread at 9pm but still has eleven loaves in the morning. */
    isActive: { type: Boolean, default: true },

    // Warn the store before it runs out, not after.
    lowStockAt: { type: Number, default: 5, min: 0 },

    lastRestockedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One row per product per store, enforced by the database rather than by
// whoever remembers to check first.
storeInventorySchema.index({ store: 1, product: 1 }, { unique: true });
storeInventorySchema.index({ store: 1, isActive: 1, stock: 1 });

module.exports = mongoose.model("StoreInventory", storeInventorySchema);
