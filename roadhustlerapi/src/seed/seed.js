require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const Settings = require("../models/Settings");

// Creates the owner/admin account and the shop settings document.
// Run: npm run seed
async function run() {
  await connectDB();

  // Settings
  const settings = await Settings.get();
  console.log("✓ Settings ready:", settings.shopName);

  // Admin owner
  const email = (process.env.SEED_ADMIN_EMAIL || "info@road-hustlers.com").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || "Daljinder@0987654321";
  const name = process.env.SEED_ADMIN_NAME || "Road Hustlers Admin";

  let admin = await User.findOne({ email });
  if (admin) {
    console.log("• Admin already exists:", email);
  } else {
    admin = new User({ name, email, role: "admin", isActive: true });
    await admin.setPassword(password);
    await admin.save();
    console.log("✓ Admin created:", email, "/ (password from env)");
  }

  await mongoose.disconnect();
  console.log("Seed complete.");
  process.exit(0);
}

run().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
