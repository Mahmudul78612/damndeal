const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const adminUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["staff", "admin"], default: "admin", index: true },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

adminUserSchema.methods.setPassword = async function (p) { this.passwordHash = await bcrypt.hash(p, 10); };
adminUserSchema.methods.checkPassword = function (p) { return bcrypt.compare(p, this.passwordHash); };
adminUserSchema.methods.toJSON = function () { const o = this.toObject(); delete o.passwordHash; return o; };

module.exports = mongoose.model("AdminUser", adminUserSchema);
