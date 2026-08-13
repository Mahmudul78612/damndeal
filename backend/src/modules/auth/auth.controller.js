const User = require("../../models/User");
const Staff = require("../../models/Staff");
const { sendOtp, verifyOtp } = require("../../services/otp.service");
const { verifyIdToken } = require("../../services/firebase.service");
const { generateTokens, verifyRefreshToken } = require("../../services/token.service");
const {
  phoneSchema,
  verifyOtpSchema,
  completeProfileSchema,
} = require("./auth.validator");

async function handleSendOtp(req, res) {
  const { error } = phoneSchema.validate(req.body);
  if (error) return res.status(400).json({ success: false, message: error.details[0].message });

  const { phone } = req.body;

  // Admin panel login: allowed for ADMIN_PHONES, or for an active staff member
  if (req.clientRole === "admin") {
    const allowedAdmins = (process.env.ADMIN_PHONES || "").split(",").map((p) => p.trim()).filter(Boolean);
    const isAdminPhone = allowedAdmins.length === 0 || allowedAdmins.includes(phone);
    const isStaffPhone = isAdminPhone ? false : !!(await Staff.findOne({ phone, isActive: true }).select("_id").lean());
    if (!isAdminPhone && !isStaffPhone) {
      return res.status(403).json({ success: false, message: "This phone number is not authorized for admin access" });
    }
  }

  const result = await sendOtp(phone, req);
  return res.status(result.success ? 200 : 429).json(result);
}

async function handleVerifyOtp(req, res) {
  const { error } = verifyOtpSchema.validate(req.body);
  if (error) return res.status(400).json({ success: false, message: error.details[0].message });

  const { phone, otp } = req.body;
  const result = await verifyOtp(phone, otp);
  if (!result.success) return res.status(401).json(result);

  let role = req.clientRole || "user";
  let staffDoc = null;

  // Admin panel: a phone that belongs to a staff member logs in as staff,
  // never as admin (ADMIN_PHONES stay full admins).
  if (role === "admin") {
    const allowedAdmins = (process.env.ADMIN_PHONES || "").split(",").map((p) => p.trim()).filter(Boolean);
    const isAdminPhone = allowedAdmins.length === 0 || allowedAdmins.includes(phone);
    if (!isAdminPhone) {
      staffDoc = await Staff.findOne({ phone, isActive: true });
      if (!staffDoc) {
        return res.status(403).json({ success: false, message: "This phone number is not authorized for admin access" });
      }
      role = "staff";
    }
  }

  let user = await User.findOne({ phone, role });

  let isNewUser = false;
  if (!user) {
    user = await User.create({
      phone,
      role,
      name: staffDoc?.name || null,
      email: staffDoc?.email || null,
      isProfileComplete: !!staffDoc,
    });
    isNewUser = true;
  }

  // Keep the staff record pointed at the account that actually logs in
  if (staffDoc && String(staffDoc.user) !== String(user._id)) {
    staffDoc.user = user._id;
    await staffDoc.save();
  }

  user.lastLogin = new Date();
  if (req.body.fcmToken) user.fcmToken = req.body.fcmToken;
  await user.save();

  const tokens = generateTokens(user._id, user.role);

  return res.json({
    success: true,
    isNewUser,
    isProfileComplete: user.isProfileComplete,
    user: {
      id: user._id, phone: user.phone, name: user.name, email: user.email, role: user.role,
      ...(staffDoc
        ? { permissions: staffDoc.permissions || [], regions: staffDoc.regions || [], roleName: staffDoc.roleName }
        : {}),
    },
    ...tokens,
  });
}

// POST /auth/firebase-verify  (Global / damndeal.com — Firebase Phone Auth)
async function handleFirebaseVerify(req, res) {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ success: false, message: "idToken is required" });

  let decoded;
  try {
    decoded = await verifyIdToken(idToken);
  } catch (e) {
    console.error("[firebase-verify] token verify failed:", e.message);
    return res.status(401).json({ success: false, message: "Invalid or expired Firebase token" });
  }

  const phone = decoded.phone_number;
  if (!phone) return res.status(400).json({ success: false, message: "No phone number in Firebase token" });

  const role = req.clientRole || "user";
  let user = await User.findOne({ phone, role });

  let isNewUser = false;
  if (!user) {
    user = await User.create({ phone, role });
    isNewUser = true;
  }

  user.lastLogin = new Date();
  if (req.body.fcmToken) user.fcmToken = req.body.fcmToken;
  await user.save();

  const tokens = generateTokens(user._id, user.role);

  return res.json({
    success: true,
    isNewUser,
    isProfileComplete: user.isProfileComplete,
    user: { id: user._id, phone: user.phone, name: user.name, email: user.email, role: user.role },
    ...tokens,
  });
}

async function handleCompleteProfile(req, res) {
  const { error } = completeProfileSchema.validate(req.body);
  if (error) return res.status(400).json({ success: false, message: error.details[0].message });

  const user = await User.findByIdAndUpdate(
    req.user.userId,
    { name: req.body.name, email: req.body.email, isProfileComplete: true },
    { new: true }
  );
  if (!user) return res.status(404).json({ success: false, message: "User not found" });

  return res.json({
    success: true,
    user: { id: user._id, phone: user.phone, name: user.name, email: user.email, role: user.role },
  });
}

async function handleRefreshToken(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ success: false, message: "Refresh token required" });

  try {
    const payload = verifyRefreshToken(refreshToken);
    const user = await User.findById(payload.userId);
    if (!user || !user.isActive) return res.status(401).json({ success: false, message: "User not found or inactive" });

    const tokens = generateTokens(user._id, user.role);
    return res.json({ success: true, ...tokens });
  } catch {
    return res.status(401).json({ success: false, message: "Invalid refresh token" });
  }
}

async function handleGetMe(req, res) {
  const user = await User.findById(req.user.userId).select("-__v");
  if (!user) return res.status(404).json({ success: false, message: "User not found" });

  return res.json({
    success: true,
    user: {
      id: user._id, phone: user.phone, name: user.name, email: user.email,
      role: user.role, avatar: user.avatar, isProfileComplete: user.isProfileComplete,
    },
  });
}

async function handleUpdateFcmToken(req, res) {
  const { fcmToken } = req.body;
  if (!fcmToken) return res.status(400).json({ success: false, message: "fcmToken required" });

  await User.findByIdAndUpdate(req.user.userId, { fcmToken });
  return res.json({ success: true, message: "FCM token updated" });
}

async function handleLogout(req, res) {
  await User.findByIdAndUpdate(req.user.userId, { fcmToken: null });
  return res.json({ success: true, message: "Logged out" });
}

module.exports = {
  handleSendOtp, handleVerifyOtp, handleFirebaseVerify, handleCompleteProfile,
  handleRefreshToken, handleGetMe, handleUpdateFcmToken, handleLogout,
};
