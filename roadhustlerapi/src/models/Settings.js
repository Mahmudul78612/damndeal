const mongoose = require("mongoose");

// Single config document (always _id "shop").
const settingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "shop" },
    shopName: { type: String, default: "Road Hustlers" },
    logo: { type: String, default: "" },
    address: {
      street: String,
      city: String,
      state: String,
      zip: String,
    },
    phone: { type: String, default: "" },
    email: { type: String, default: "info@road-hustlers.com" },
    website: { type: String, default: "https://road-hustlers.com" },

    currency: { type: String, default: "USD" },
    taxRate: { type: Number, default: 8.25 }, // default sales tax %
    taxLabor: { type: Boolean, default: false }, // is labor taxable in your state
    defaultLaborRate: { type: Number, default: 120 }, // USD/hr
    shopSuppliesFeePercent: { type: Number, default: 5 }, // % of labor
    shopSuppliesFeeCap: { type: Number, default: 50 }, // max USD

    invoicePrefix: { type: String, default: "INV" },
    woPrefix: { type: String, default: "WO" },
    poPrefix: { type: String, default: "PO" },
    leadPrefix: { type: String, default: "LEAD" },
    apptPrefix: { type: String, default: "APPT" },
    invoiceStartNumber: { type: Number, default: 3001 },
    woStartNumber: { type: Number, default: 2001 },
    poStartNumber: { type: Number, default: 1001 },

    invoiceTerms: { type: String, default: "Payment due upon receipt. Thank you for your business." },
    invoiceDueDays: { type: Number, default: 0 }, // 0 = due on receipt
    businessHours: [
      {
        day: String, // Mon..Sun
        open: String, // "08:00"
        close: String, // "18:00"
        closed: { type: Boolean, default: false },
      },
    ],
    bays: { type: Number, default: 4 },

    stripePublicKey: { type: String, default: "" },
    // secret keys read from env, never stored here in plaintext for this build
  },
  { timestamps: true }
);

// Convenience getter that always returns the single doc (creates if missing).
settingsSchema.statics.get = async function () {
  let doc = await this.findById("shop");
  if (!doc) doc = await this.create({ _id: "shop" });
  return doc;
};

module.exports = mongoose.model("Settings", settingsSchema);
