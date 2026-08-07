const User = require("../../../models/User");
const Staff = require("../../../models/Staff");
const { PERMISSIONS, PERMISSION_KEYS, ROLE_PRESETS } = require("../../../config/permissions");

const VALID_REGIONS = ["IN", "US"];

function normalizePhone(raw) {
  return String(raw || "").trim().replace(/\s+/g, "");
}

function resolvePermissions(roleName, permissions) {
  const preset = ROLE_PRESETS[roleName];
  if (preset && roleName !== "custom") return preset.permissions;
  return (permissions || []).filter((p) => PERMISSION_KEYS.includes(p));
}

// GET /admin/permissions — catalog for the admin UI (checkboxes + presets)
async function getPermissionCatalog(req, res) {
  return res.json({
    success: true,
    permissions: PERMISSIONS,
    roles: Object.entries(ROLE_PRESETS).map(([key, v]) => ({
      key, label: v.label, permissions: v.permissions,
    })),
    regions: VALID_REGIONS,
  });
}

// GET /admin/me — who am I + what can I do (drives sidebar filtering)
async function getMe(req, res) {
  const user = await User.findById(req.user.userId).select("name phone email role").lean();
  if (!user) return res.status(404).json({ success: false, message: "User not found" });

  if (user.role === "admin") {
    return res.json({
      success: true,
      me: { ...user, isAdmin: true, permissions: PERMISSION_KEYS, regions: VALID_REGIONS, roleName: "admin" },
    });
  }

  const staff = await Staff.findOne({ user: user._id }).lean();
  return res.json({
    success: true,
    me: {
      ...user,
      isAdmin: false,
      permissions: staff?.permissions || [],
      regions: staff?.regions?.length ? staff.regions : VALID_REGIONS,
      roleName: staff?.roleName || "custom",
      department: staff?.department || null,
      isActive: staff?.isActive !== false,
    },
  });
}

// GET /admin/staff
async function listStaff(req, res) {
  const staff = await Staff.find()
    .populate("user", "phone isActive lastLogin")
    .sort({ createdAt: -1 })
    .lean();
  return res.json({ success: true, staff });
}

// POST /admin/staff — add a staff member by phone (no prior account needed;
// the User doc is created on their first admin-panel login)
async function addStaff(req, res) {
  const { name, email, department, roleName = "custom", permissions, regions } = req.body;
  const phone = normalizePhone(req.body.phone);
  if (!phone || !name) {
    return res.status(400).json({ success: false, message: "phone and name are required" });
  }
  if (!/^\+?\d{10,15}$/.test(phone)) {
    return res.status(400).json({ success: false, message: "Enter a valid phone number" });
  }
  if (roleName !== "custom" && !ROLE_PRESETS[roleName]) {
    return res.status(400).json({ success: false, message: "Invalid role" });
  }

  const regionList = (regions || []).filter((r) => VALID_REGIONS.includes(r));
  if (!regionList.length) {
    return res.status(400).json({ success: false, message: "Select at least one region (India / USA)" });
  }
  const permissionList = resolvePermissions(roleName, permissions);
  if (!permissionList.length) {
    return res.status(400).json({ success: false, message: "Select at least one permission" });
  }

  if (await Staff.findOne({ phone })) {
    return res.status(409).json({ success: false, message: "A staff member with this phone already exists" });
  }
  const adminPhones = (process.env.ADMIN_PHONES || "").split(",").map((p) => p.trim()).filter(Boolean);
  if (adminPhones.includes(phone)) {
    return res.status(409).json({ success: false, message: "This phone is a full admin already" });
  }

  // Link an existing staff-role account if one exists; otherwise it is created
  // on first login (verify-otp keeps the link in sync).
  const user = await User.findOne({ phone, role: "staff" });

  const staff = await Staff.create({
    user: user?._id || null,
    phone,
    name,
    email: email || null,
    department: department || "general",
    roleName,
    permissions: permissionList,
    regions: regionList,
    addedBy: req.user.userId,
  });

  return res.status(201).json({ success: true, staff });
}

// PUT /admin/staff/:id
async function updateStaff(req, res) {
  const { name, email, department, roleName, permissions, regions, isActive } = req.body;
  const staff = await Staff.findById(req.params.id);
  if (!staff) return res.status(404).json({ success: false, message: "Staff not found" });

  if (name) staff.name = name;
  if (email !== undefined) staff.email = email || null;
  if (department) staff.department = department;
  if (isActive !== undefined) staff.isActive = !!isActive;

  if (regions) {
    const regionList = regions.filter((r) => VALID_REGIONS.includes(r));
    if (!regionList.length) {
      return res.status(400).json({ success: false, message: "Select at least one region (India / USA)" });
    }
    staff.regions = regionList;
  }

  if (roleName || permissions) {
    const nextRole = roleName || staff.roleName;
    if (nextRole !== "custom" && !ROLE_PRESETS[nextRole]) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }
    const permissionList = resolvePermissions(nextRole, permissions || staff.permissions);
    if (!permissionList.length) {
      return res.status(400).json({ success: false, message: "Select at least one permission" });
    }
    staff.roleName = nextRole;
    staff.permissions = permissionList;
  }

  await staff.save();

  // Mirror the active flag onto the login account
  if (staff.user) await User.findByIdAndUpdate(staff.user, { isActive: staff.isActive });

  return res.json({ success: true, staff });
}

// DELETE /admin/staff/:id
async function removeStaff(req, res) {
  const staff = await Staff.findByIdAndDelete(req.params.id);
  if (!staff) return res.status(404).json({ success: false, message: "Staff not found" });

  // Deactivate the login account so any live session stops working
  if (staff.user) await User.findByIdAndUpdate(staff.user, { isActive: false });
  return res.json({ success: true, message: "Staff removed" });
}

module.exports = {
  listStaff, addStaff, updateStaff, removeStaff,
  getPermissionCatalog, getMe,
  VALID_PERMISSIONS: PERMISSION_KEYS,
};
