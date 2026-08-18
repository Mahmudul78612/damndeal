/**
 * Throwaway check for DDGo store attribution and reporting.
 *
 * Creates one dark store and two orders — one DDGo order inside its radius, one
 * damndeal order — then runs the same aggregations the admin screens use, and
 * removes everything it made. Nothing pre-existing is touched.
 *
 *   node src/scripts/test-store-orders.js
 */
require("dotenv").config();
const mongoose = require("mongoose");

const CODE = "ZZP3STORE";
const TAG = "ZZ-P3-TEST";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/damndeal");
  const DarkStore = require("../models/DarkStore");
  const Order = require("../models/Order");
  const User = require("../models/User");
  const { storesCovering } = require("../services/serviceability.service");

  const LAT = 30.3398, LNG = 76.3869;

  await DarkStore.deleteMany({ code: CODE });
  await Order.deleteMany({ orderNumber: new RegExp("^" + TAG) });

  const store = await DarkStore.create({
    name: "ZZ P3 Store", code: CODE,
    location: { type: "Point", coordinates: [LNG, LAT] },
    radiusKm: 5, city: "Patiala", alwaysOpen: true, regions: ["IN"],
  });
  console.log(`store ${store.name} (${store.radiusKm} km)\n`);

  // The same resolution the order controller performs when an order is placed.
  const covering = await storesCovering({ lat: LAT + 0.01, lng: LNG, region: "IN", includeClosed: true });
  const own = covering.find((c) => c.type === "darkstore");
  console.log(`resolver at ~1.1 km -> ${own ? own.name + " (" + own.distanceKm + " km)" : "NONE"}`);

  const anyUser = await User.findOne().select("_id").lean();
  const base = {
    user: anyUser?._id || null, partner: anyUser?._id, region: "IN", currency: "INR",
    items: [], subtotal: 100, grandTotal: 120, distanceKm: 1.1,
    deliveryAddress: { address: "test", city: "Patiala", lat: LAT + 0.01, lng: LNG },
    paymentMethod: "cod",
  };

  await Order.create({ ...base, orderNumber: `${TAG}-1`, platform: "ddgo", store: store._id, status: "delivered" });
  await Order.create({ ...base, orderNumber: `${TAG}-2`, platform: "ddgo", store: store._id, status: "cancelled", grandTotal: 80 });
  await Order.create({ ...base, orderNumber: `${TAG}-3`, platform: "damndeal", store: null, status: "delivered" });
  console.log("created 3 orders (2 ddgo on the store, 1 damndeal)\n");

  // The performance aggregation, exactly as the admin endpoint runs it.
  const rows = await Order.aggregate([
    { $match: { platform: "ddgo", region: "IN", orderNumber: new RegExp("^" + TAG) } },
    {
      $group: {
        _id: "$store",
        orders: { $sum: 1 },
        revenue: { $sum: "$grandTotal" },
        delivered: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
      },
    },
  ]);
  console.log("performance:", JSON.stringify(rows));

  const ddgoOnly = await Order.countDocuments({ platform: "ddgo", orderNumber: new RegExp("^" + TAG) });
  const dealOnly = await Order.countDocuments({ platform: "damndeal", orderNumber: new RegExp("^" + TAG) });
  const byStore = await Order.countDocuments({ store: store._id });
  console.log(`\nplatform filter -> ddgo ${ddgoOnly}, damndeal ${dealOnly}`);
  console.log(`store filter    -> ${byStore} (the damndeal one must not be here)`);

  await Order.deleteMany({ orderNumber: new RegExp("^" + TAG) });
  await DarkStore.deleteMany({ code: CODE });
  console.log("\ncleaned up:", await Order.countDocuments({ orderNumber: new RegExp("^" + TAG) }), "orders,",
    await DarkStore.countDocuments({ code: CODE }), "stores left");
  await mongoose.disconnect();
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
