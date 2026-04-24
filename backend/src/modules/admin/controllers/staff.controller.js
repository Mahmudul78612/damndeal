const User = require("../../../models/User");
const Staff = require("../../../models/Staff");

const VALID_PERMISSIONS = [
  "manage_partners", "manage_products", "manage_orders",
  "manage_payouts", "manage_staff", "manage_delivery",
  "manage_settings", "manage_categories", "manage_notifications",
];

// GET /admin/staff
async function listStaff(req, res) {
  const staff = await Staff.find().populate("user", "phone isActive lastLogin").sort({ createdAt: -1 });
  return res.json({ success: true, staff });
}

// POST /admin/staff — add staff member (phone must already exist as role=staff)
async function addStaff(req, res) {
  const { phone, name, email, department, permissions } = req.body;
  if (!phone || !name) return res.status(400).json({ success: false, message: "phone and name required" });

  // Validate permissions
  const invalid = (permissions || []).filter((p) => !VALID_PERMISSIONS.includes(p));
  if (invalid.length) return res.status(400).json({ success: false, message: `Invalid permissions: ${invalid.join(", ")}` });

  // Find or create staff user
  let user = await User.findOne({ phone, role: "staff" });
  if (!user) {
    user = await User.create({ phone, role: "staff", name, email, isProfileComplete: true });
  }

  const existing = await Staff.findOne({ user: user._id });
  if (existing) return res.status(409).json({ success: false, message: "Staff member already exists" });

  const staff = await Staff.create({
    user: user._id, name, email,
    department: department || "general",
    permissions: permissions || [],
    addedBy: req.user.userId,
  });

  return res.status(201).json({ success: true, staff });
}

// PUT /admin/staff/:id
async function updateStaff(req, res) {
  const { name, email, department, permissions, isActive } = req.body;
  const updates = {};
  if (name) updates.name = name;
  if (email) updates.email = email;
  if (department) updates.department = department;
  if (permissions) {
    const invalid = permissions.filter((p) => !VALID_PERMISSIONS.includes(p));
    if (invalid.length) return res.status(400).json({ success: false, message: `Invalid permissions: ${invalid.join(", ")}` });
    updates.permissions = permissions;
  }
  if (isActive !== undefined) updates.isActive = isActive;

  const staff = await Staff.findByIdAndUpdate(req.params.id, updates, { new: true });
  if (!staff) return res.status(404).json({ success: false, message: "Staff not found" });

  return res.json({ success: true, staff });
}

// DELETE /admin/staff/:id
async function removeStaff(req, res) {
  const staff = await Staff.findByIdAndDelete(req.params.id);
  if (!staff) return res.status(404).json({ success: false, message: "Staff not found" });

  // Deactivate user account
  await User.findByIdAndUpdate(staff.user, { isActive: false });
  return res.json({ success: true, message: "Staff removed" });
}

module.exports = { listStaff, addStaff, updateStaff, removeStaff, VALID_PERMISSIONS };
