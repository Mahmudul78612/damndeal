/**
 * Throwaway check for the DDGo radius resolver.
 *
 * Creates one dark store, asks the resolver what a customer standing at
 * several distances would get, then deletes it. Nothing else is touched.
 *
 *   node src/scripts/test-serviceability.js
 */
require("dotenv").config();
const mongoose = require("mongoose");

const CODE = "ZZTESTSVC";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/damndeal");
  const DarkStore = require("../models/DarkStore");
  const { resolveServiceability } = require("../services/serviceability.service");

  // Patiala clock tower
  const LAT = 30.3398, LNG = 76.3869;

  await DarkStore.deleteMany({ code: CODE });
  const store = await DarkStore.create({
    name: "ZZ Test Store", code: CODE,
    location: { type: "Point", coordinates: [LNG, LAT] },
    radiusKm: 5, city: "Patiala", alwaysOpen: true, prepTimeMins: 8, regions: ["IN"],
  });
  console.log(`created ${store.name} @ ${LAT},${LNG} radius ${store.radiusKm}km\n`);

  // ~0.009 degrees of latitude is about 1 km.
  const points = [
    ["same spot        (0.0 km)", LAT, LNG],
    ["~2 km north      (in)     ", LAT + 0.018, LNG],
    ["~4.5 km north    (in)     ", LAT + 0.0405, LNG],
    ["~6 km north      (OUT)    ", LAT + 0.054, LNG],
    ["~20 km north     (OUT)    ", LAT + 0.18, LNG],
  ];

  for (const [label, lat, lng] of points) {
    const r = await resolveServiceability({ lat, lng, region: "IN" });
    console.log(
      `${label} -> ${r.serviceable ? "SERVICEABLE" : "no (" + r.reason + ")"}` +
      (r.store ? `  [${r.store.name} ${r.store.distanceKm}km, ETA ${r.store.etaMins}m]` : "")
    );
  }

  console.log("\n-- region isolation --");
  const us = await resolveServiceability({ lat: LAT, lng: LNG, region: "US" });
  console.log(`same spot, region US -> ${us.serviceable ? "SERVICEABLE (WRONG)" : "no (" + us.reason + ") — correct, store is IN-only"}`);

  console.log("\n-- closed store --");
  store.alwaysOpen = false;
  store.opensAtMin = 0;
  store.closesAtMin = 1;      // shut for all but the first minute of the day
  await store.save();
  const closed = await resolveServiceability({ lat: LAT, lng: LNG, region: "IN" });
  console.log(`same spot, store shut -> serviceable=${closed.serviceable} reason=${closed.reason}`);
  console.log(`   message: ${closed.message}`);

  await DarkStore.deleteMany({ code: CODE });
  console.log("\ncleaned up");
  await mongoose.disconnect();
}

main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
