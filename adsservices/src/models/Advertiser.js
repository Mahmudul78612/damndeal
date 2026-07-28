const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

// The client whose ads run. Login is created by an admin when uploading an ad.
const advertiserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    company: { type: String, trim: true },
    phone: { type: String, trim: true },
    // Server-side Conversions API key (like Meta's access token). Used to post
    // conversion events from the advertiser's backend.
    apiKey: { type: String, unique: true, index: true },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
  },
  { timestamps: true }
);

advertiserSchema.pre("validate", function (next) {
  if (!this.apiKey) this.apiKey = "ddc_" + crypto.randomBytes(16).toString("hex");
  next();
});

advertiserSchema.methods.setPassword = async function (p) { this.passwordHash = await bcrypt.hash(p, 10); };
advertiserSchema.methods.checkPassword = function (p) { return bcrypt.compare(p, this.passwordHash); };
advertiserSchema.methods.toJSON = function () { const o = this.toObject(); delete o.passwordHash; return o; };

module.exports = mongoose.model("Advertiser", advertiserSchema);
