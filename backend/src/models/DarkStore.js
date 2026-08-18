const mongoose = require("mongoose");

/**
 * A DamnDeal-run fulfilment point for DDGo (quick commerce / grocery).
 *
 * Deliberately separate from PartnerKyc: a partner shop is a business we
 * onboard and verify, while this is our own store with no owner, no KYC and no
 * payout. What the two share is the only thing serviceability cares about — a
 * pin on the map and a radius around it — so the resolver treats them alike
 * (see services/serviceability.service.js) without forcing one schema to mean
 * two different things.
 *
 * The radius lives here, per store, rather than in a single platform-wide
 * setting: 5 km covers a dense city block, an outskirts store needs 12, and one
 * global number cannot be right for both.
 */
const darkStoreSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Short human code used on order labels and in the picking app.
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },

    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: {
        type: [Number],           // [lng, lat] — GeoJSON order, not lat/lng
        required: true,
      },
    },
    // How far this store delivers, measured straight from its pin.
    radiusKm: { type: Number, default: 5, min: 0.5, max: 50 },

    // Storefront photo shown on the customer-facing store list. A URL or an
    // uploaded path — imgUrl on the client handles both.
    image: { type: String, default: "" },
    address: { type: String, default: "" },
    city: { type: String, default: "", index: true },
    state: { type: String, default: "" },
    pincode: { type: String, default: "" },

    contactName: { type: String, default: "" },
    contactPhone: { type: String, default: "" },

    /* ── Opening hours ──
       Kept as minutes-from-midnight so a comparison is arithmetic, and
       closesAt < opensAt reads as "runs past midnight" rather than a bug. */
    alwaysOpen: { type: Boolean, default: false },
    opensAtMin: { type: Number, default: 8 * 60 },    // 08:00
    closesAtMin: { type: Number, default: 23 * 60 },  // 23:00
    // 0 = Sunday … 6 = Saturday. Empty means every day.
    closedDays: { type: [Number], default: [] },

    // Minutes added to the distance-based estimate — picking and packing.
    prepTimeMins: { type: Number, default: 8 },

    /* ── Money, per store ──
       0 means "use the platform DDGo setting", so a store only overrides what
       it actually needs to. */
    minOrderAmount: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    freeDeliveryAbove: { type: Number, default: 0 },

    isActive: { type: Boolean, default: true, index: true },
    // Manual switch for a store that is temporarily swamped or out of staff.
    isAcceptingOrders: { type: Boolean, default: true },

    regions: { type: [String], enum: ["IN", "US"], default: ["IN"], index: true },
    // When two stores both cover an address, higher wins before distance does.
    priority: { type: Number, default: 0 },

    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

darkStoreSchema.index({ location: "2dsphere" });
darkStoreSchema.index({ isActive: 1, regions: 1 });

/** True when the store is open at `now` in server time. */
darkStoreSchema.methods.isOpenAt = function (now = new Date()) {
  if (!this.isActive || !this.isAcceptingOrders) return false;
  if (this.alwaysOpen) return true;
  if ((this.closedDays || []).includes(now.getDay())) return false;

  const mins = now.getHours() * 60 + now.getMinutes();
  const open = this.opensAtMin ?? 0;
  const close = this.closesAtMin ?? 24 * 60;
  // A window that ends before it starts wraps past midnight (22:00 → 02:00).
  return close >= open ? mins >= open && mins < close : mins >= open || mins < close;
};

module.exports = mongoose.model("DarkStore", darkStoreSchema);
