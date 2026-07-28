const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Internal staff accounts: technicians, service advisors, owner.
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    phone: { type: String, trim: true },
    role: { type: String, enum: ["staff", "manager", "admin"], default: "staff", index: true },
    avatar: { type: String },
    hourlyRate: { type: Number, default: 0 }, // technician pay rate (USD/hr) for payroll/productivity
    specialties: [{ type: String }], // e.g. brakes, engine, electrical
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

userSchema.methods.setPassword = async function (plain) {
  this.passwordHash = await bcrypt.hash(plain, 10);
};
userSchema.methods.checkPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
