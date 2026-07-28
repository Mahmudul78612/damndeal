require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");

// Wipes all OPERATIONAL data (test/dummy records) but keeps the admin login
// and shop Settings. Counters are reset so numbering starts fresh.
// Run: npm run clean
const OPERATIONAL = [
  "customers", "vehicles", "leads", "appointments",
  "services", "suppliers", "parts", "purchaseorders",
  "workorders", "invoices", "payments", "notifications",
];

async function run() {
  await connectDB();
  const db = mongoose.connection;

  for (const c of OPERATIONAL) {
    const res = await db.collection(c).deleteMany({}).catch(() => ({ deletedCount: 0 }));
    if (res.deletedCount) console.log(`✓ cleared ${c}: ${res.deletedCount}`);
  }

  // Reset auto-increment counters so WO/INV/PO numbers start fresh
  await db.collection("counters").deleteMany({}).catch(() => {});
  console.log("✓ counters reset");

  const users = await db.collection("users").countDocuments();
  const settings = await db.collection("settings").countDocuments();
  console.log(`• kept: users=${users}, settings=${settings}`);

  await mongoose.disconnect();
  console.log("Clean complete — dummy data removed, admin + settings preserved.");
  process.exit(0);
}

run().catch((e) => { console.error("Clean failed:", e); process.exit(1); });
