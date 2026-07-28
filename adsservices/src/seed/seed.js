require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const AdminUser = require("../models/AdminUser");

async function run() {
  await connectDB();
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@adsservices.com").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || "Admin@123456";
  const name = process.env.SEED_ADMIN_NAME || "Ads Admin";

  let admin = await AdminUser.findOne({ email });
  if (admin) {
    console.log("• Admin already exists:", email);
  } else {
    admin = new AdminUser({ name, email, role: "admin" });
    await admin.setPassword(password);
    await admin.save();
    console.log("✓ Admin created:", email);
  }
  await mongoose.disconnect();
  console.log("Seed complete.");
  process.exit(0);
}
run().catch((e) => { console.error("Seed failed:", e); process.exit(1); });
