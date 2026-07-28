const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Garage clients. Can be created two ways:
//   1. WALK-IN  — staff creates them in the ERP. Only name + phone required.
//                 No email/password needed; they have no website login.
//   2. WEBSITE  — they self-register with email + password (portal access).
// A walk-in can later be "invited" to the portal (set email + password).
const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true, default: null }, // optional (walk-in)
    passwordHash: { type: String, default: null }, // only if portal access
    phone: { type: String, trim: true },
    address: {
      street: String,
      city: String,
      state: String,
      zip: String,
    },
    company: { type: String, trim: true }, // fleet / business accounts
    notes: { type: String }, // internal advisor notes
    tags: [{ type: String }], // fleet, VIP, warranty
    totalSpent: { type: Number, default: 0 }, // lifetime USD (computed on payments)
    source: { type: String, enum: ["website", "walk-in", "referral", "google", "phone", "other"], default: "walk-in" },
    portalEnabled: { type: Boolean, default: false }, // true once email+password set
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // staff who added (walk-in)
  },
  { timestamps: true }
);

// Unique email ONLY when it is a real string — so unlimited walk-ins can have
// no email (null). A plain sparse index treats null as a value and would clash;
// partialFilterExpression on $type:"string" enforces uniqueness only for real emails.
customerSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } }
);

customerSchema.methods.setPassword = async function (plain) {
  this.passwordHash = await bcrypt.hash(plain, 10);
  this.portalEnabled = true;
};
customerSchema.methods.checkPassword = function (plain) {
  if (!this.passwordHash) return Promise.resolve(false);
  return bcrypt.compare(plain, this.passwordHash);
};
customerSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

module.exports = mongoose.model("Customer", customerSchema);
