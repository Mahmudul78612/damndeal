/**
 * Reposition the India demo stores for testing across a real distance.
 *
 *  - The Guwahati and Delhi demo stores move to Guwahati (the owner's city),
 *    a little apart so both show as distinct pins.
 *  - The Patiala store stays in Patiala but gets a 5000 km radius, so a client
 *    sitting in Punjab can test it AND the owner in Assam can reach the same
 *    store (5000 km covers the whole country).
 *
 * Idempotent; only touches the DD- demo stores.
 *
 *   node src/scripts/move-ddgo-stores.js
 */
require("dotenv").config();
const mongoose = require("mongoose");

// Guwahati, two pins ~1.5 km apart.
const GHY_A = [91.7362, 26.1445];
const GHY_B = [91.7500, 26.1560];
// Patiala.
const PTA = [76.3869, 30.3398];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/damndeal");
  const DarkStore = require("../models/DarkStore");

  const jobs = [
    { code: "DD-GHY1", coords: GHY_A, radiusKm: 8,    city: "Guwahati", note: "Guwahati (owner)" },
    { code: "DD-DEL1", coords: GHY_B, radiusKm: 8,    city: "Guwahati", note: "moved to Guwahati" },
    { code: "DD-PTA1", coords: PTA,   radiusKm: 5000, city: "Patiala",  note: "Patiala, national radius" },
  ];

  for (const j of jobs) {
    const r = await DarkStore.updateOne(
      { code: j.code },
      { $set: { location: { type: "Point", coordinates: j.coords }, radiusKm: j.radiusKm, city: j.city } }
    );
    console.log(`${j.code}: ${r.matchedCount ? "updated" : "NOT FOUND"} — ${j.note} (radius ${j.radiusKm} km)`);
  }

  console.log("\ncurrent India DDGo stores:");
  const all = await DarkStore.find({ regions: "IN", code: /^DD-/ }).select("code name city radiusKm location").lean();
  for (const s of all) {
    const [lng, lat] = s.location.coordinates;
    console.log(`   ${s.code}  ${s.city}  ${lat.toFixed(4)},${lng.toFixed(4)}  radius ${s.radiusKm} km`);
  }
  await mongoose.disconnect();
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
