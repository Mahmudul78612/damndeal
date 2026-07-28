const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

// A PUBLISHER = an app/site WHERE ads are shown (e.g. DamnPay, DamnDeal).
// Onboarded by an admin; gets a publisher API key + a portal login to see
// its placements' performance. Zones (ad slots) belong to a publisher.
const publisherSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // "DamnPay"
    appId: { type: String, trim: true }, // short id e.g. "damnpay"
    contactEmail: { type: String, lowercase: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true }, // portal login
    passwordHash: { type: String, required: true },
    // Publisher key the app sends when requesting ads (identifies the app).
    apiKey: { type: String, unique: true, index: true },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
  },
  { timestamps: true }
);

publisherSchema.pre("validate", function (next) {
  if (!this.apiKey) this.apiKey = "ddp_" + crypto.randomBytes(16).toString("hex");
  next();
});

publisherSchema.methods.setPassword = async function (p) { this.passwordHash = await bcrypt.hash(p, 10); };
publisherSchema.methods.checkPassword = function (p) { return bcrypt.compare(p, this.passwordHash); };
publisherSchema.methods.toJSON = function () { const o = this.toObject(); delete o.passwordHash; return o; };

module.exports = mongoose.model("Publisher", publisherSchema);
