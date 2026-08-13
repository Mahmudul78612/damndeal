const User = require("../models/User");
const { sendOtp, verifyOtp } = require("../services/otp.service");
const { verifyIdToken } = require("../services/firebase.service");
const { generateTokens, verifyRefreshToken } = require("../services/token.service");
const {
  phoneSchema,
  verifyOtpSchema,
  completeProfileSchema,
} = require("../validators/auth.validator");

// POST /auth/send-otp
async function handleSendOtp(req, res) {
  const { error } = phoneSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, message: error.details[0].message });
  }

  const { phone } = req.body;

  // Admin login restricted to allowed numbers only
  if (req.clientRole === "admin") {
    const allowedAdmins = (process.env.ADMIN_PHONES || "").split(",").map((p) => p.trim()).filter(Boolean);
    if (allowedAdmins.length > 0 && !allowedAdmins.includes(phone)) {
      return res.status(403).json({ success: false, message: "This phone number is not authorized for admin access" });
    }
  }

  const result = await sendOtp(phone, req);

  return res.status(result.success ? 200 : 429).json(result);
}

// POST /auth/verify-otp
async function handleVerifyOtp(req, res) {
  const { error } = verifyOtpSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, message: error.details[0].message });
  }

  const { phone, otp } = req.body;
  const result = await verifyOtp(phone, otp);

  if (!result.success) {
    return res.status(401).json(result);
  }

  // Find or create user with the role from the client type
  const role = req.clientRole || "user";
  let user = await User.findOne({ phone, role });

  let isNewUser = false;
  if (!user) {
    user = await User.create({ phone, role });
    isNewUser = true;
  }

  user.lastLogin = new Date();
  await user.save();

  const tokens = generateTokens(user._id, user.role);

  return res.json({
    success: true,
    isNewUser,
    isProfileComplete: user.isProfileComplete,
    user: {
      id: user._id,
      phone: user.phone,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    ...tokens,
  });
}

// PUT /auth/complete-profile
async function handleCompleteProfile(req, res) {
  const { error } = completeProfileSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, message: error.details[0].message });
  }

  const { name, email } = req.body;

  const user = await User.findByIdAndUpdate(
    req.user.userId,
    { name, email, isProfileComplete: true },
    { new: true }
  );

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  return res.json({
    success: true,
    user: {
      id: user._id,
      phone: user.phone,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
}

// POST /auth/refresh-token
async function handleRefreshToken(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ success: false, message: "Refresh token required" });
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    const user = await User.findById(payload.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: "User not found or inactive" });
    }

    const tokens = generateTokens(user._id, user.role);
    return res.json({ success: true, ...tokens });
  } catch {
    return res.status(401).json({ success: false, message: "Invalid refresh token" });
  }
}

// GET /auth/me
async function handleGetMe(req, res) {
  const user = await User.findById(req.user.userId).select("-__v");
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  return res.json({
    success: true,
    user: {
      id: user._id,
      phone: user.phone,
      name: user.name,
      email: user.email,
      role: user.role,
      isProfileComplete: user.isProfileComplete,
    },
  });
}

// POST /auth/firebase-verify  (US region — Firebase Phone Auth)
async function handleFirebaseVerify(req, res) {
  const { idToken } = req.body;
  if (!idToken) {
    return res.status(400).json({ success: false, message: "idToken is required" });
  }

  let decoded;
  try {
    decoded = await verifyIdToken(idToken);
  } catch (e) {
    return res.status(401).json({ success: false, message: "Invalid or expired Firebase token" });
  }

  const phone = decoded.phone_number;
  if (!phone) {
    return res.status(400).json({ success: false, message: "No phone number in Firebase token" });
  }

  const role = req.clientRole || "user";
  let user = await User.findOne({ phone, role });
  let isNewUser = false;
  if (!user) {
    user = await User.create({ phone, role });
    isNewUser = true;
  }

  user.lastLogin = new Date();
  await user.save();

  const tokens = generateTokens(user._id, user.role);

  return res.json({
    success: true,
    isNewUser,
    isProfileComplete: user.isProfileComplete,
    user: {
      id: user._id,
      phone: user.phone,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    ...tokens,
  });
}

// POST /auth/logout (placeholder for token blacklisting)
async function handleLogout(req, res) {
  // In production, add refresh token to a blacklist in Redis
  return res.json({ success: true, message: "Logged out" });
}

module.exports = {
  handleSendOtp,
  handleVerifyOtp,
  handleFirebaseVerify,
  handleCompleteProfile,
  handleRefreshToken,
  handleGetMe,
  handleLogout,
};
