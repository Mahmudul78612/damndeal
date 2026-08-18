/**
 * Commission + settlement, end to end, without touching real money.
 *
 * No shop has finished KYC yet, so the test brings its own approved shop,
 * fabricates two delivered orders with the commission frozen the way
 * placeOrder freezes it, runs the settlement aggregation, then removes
 * everything it made.
 *
 *   node src/scripts/test-commission.js
 */
require("dotenv").config();
const mongoose = require("mongoose");

const TAG = "ZZ-COMM-TEST";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/damndeal");
  const PartnerKyc = require("../models/PartnerKyc");
  const Order = require("../models/Order");
  const User = require("../models/User");

  const partnerUser = await User.findOne({ role: "partner" }).select("_id").lean();
  if (!partnerUser) { console.log("no partner user"); return mongoose.disconnect(); }

  await PartnerKyc.deleteMany({ organizationName: TAG });
  await Order.deleteMany({ orderNumber: new RegExp("^" + TAG) });

  const kyc = await PartnerKyc.create({
    partner: partnerUser._id, organizationName: TAG, status: "approved",
    commissionPercent: 10, commissionFlat: 5,
    location: { type: "Point", coordinates: [76.4, 30.3] },
    // KYC requires the paperwork fields; the test fills them with tagged noise.
    name: TAG, email: "zz@test.local", photo: "zz.jpg",
    panNumber: "ZZZZZ9999Z", gstNumber: "22ZZZZZ9999Z1Z5", gstRegisteredName: TAG,
  });
  console.log("temp shop with rate 10% + 5 flat\n");

  const user = await User.findOne({ role: "user" }).select("_id").lean();
  const mk = (n, subtotal, method) => ({
    orderNumber: `${TAG}-${n}`,
    user: user?._id || null, partner: kyc.partner,
    platform: "ddgo", region: "IN", currency: "INR",
    items: [], subtotal,
    // exactly the placement formula
    commissionAmount: Math.round((subtotal * 10 / 100 + 5) * 100) / 100,
    grandTotal: subtotal + 20, deliveryFee: 20,
    deliveryAddress: { address: "t", city: "t" },
    paymentMethod: method, status: "delivered",
  });
  await Order.create(mk(1, 500, "cod"));      // commission 55
  await Order.create(mk(2, 300, "razorpay")); // commission 35
  console.log("orders: 500 (COD) + 300 (online)  -> expected commission 55 + 35 = 90");

  const [rows] = await Order.aggregate([
    { $match: { partner: kyc.partner, status: "delivered", orderNumber: new RegExp("^" + TAG) } },
    { $group: {
        _id: null, orders: { $sum: 1 }, gross: { $sum: "$subtotal" },
        commission: { $sum: { $ifNull: ["$commissionAmount", 0] } },
        codCollected: { $sum: { $cond: [{ $eq: ["$paymentMethod", "cod"] }, "$grandTotal", 0] } },
    } },
  ]);
  console.log(`\nsettlement: orders=${rows.orders}  gross=${rows.gross}  commission=${rows.commission}  net=${rows.gross - rows.commission}`);
  console.log(`COD already with the shop: ${rows.codCollected}`);
  console.log(rows.commission === 90 ? "commission CORRECT" : "commission WRONG");

  await Order.deleteMany({ orderNumber: new RegExp("^" + TAG) });
  await PartnerKyc.deleteMany({ organizationName: TAG });
  console.log("\ncleaned up: orders and the temp shop removed");
  await mongoose.disconnect();
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
