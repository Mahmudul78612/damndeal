const Investor = require("../../../models/Investor");
const otpService = require("../../../services/otp.service");
const tokenService = require("../../../services/token.service");
const { verifyIdToken } = require("../../../services/firebase.service");

// POST /investor/auth/send-otp
async function sendOtp(req, res) {
  const { phone, name, email } = req.body;
  if (!phone) return res.status(400).json({ success: false, message: "Phone required" });

  // Auto-register investor if first time — region from request (damndeal.com => US)
  let investor = await Investor.findOne({ phone });
  if (!investor) {
    if (!name) return res.status(400).json({ success: false, message: "Name required for new registration" });
    const region = req.region === "US" ? "US" : "IN";
    investor = await Investor.create({ phone, name, email, region });
  }

  const clientIp =
    req.headers["x-real-ip"] ||
    (req.headers["x-forwarded-for"] || "").split(",").pop().trim() ||
    req.ip;
  const result = await otpService.sendOtp(phone, clientIp);
  if (!result.success) return res.status(429).json(result);
  return res.json({ success: true, message: "OTP sent", isNew: !investor.createdAt });
}

// POST /investor/auth/verify-otp
async function verifyOtp(req, res) {
  const { phone, otp } = req.body;
  if (!phone || !otp) return res.status(400).json({ success: false, message: "Phone and OTP required" });

  const valid = await otpService.verifyOtp(phone, otp);
  if (!valid) return res.status(400).json({ success: false, message: "Invalid or expired OTP" });

  const investor = await Investor.findOne({ phone });
  if (!investor) return res.status(404).json({ success: false, message: "Investor not found" });

  const { accessToken, refreshToken } = tokenService.generateTokens(investor._id, "investor");
  return res.json({ success: true, accessToken, refreshToken, investor: {
    _id: investor._id, name: investor.name, phone: investor.phone,
    status: investor.status, kycStatus: investor.kycStatus,
  }});
}

// POST /investor/auth/firebase-verify  (Global / damndeal.com — Firebase Phone Auth)
async function firebaseVerify(req, res) {
  const { idToken, name, email } = req.body;
  if (!idToken) return res.status(400).json({ success: false, message: "idToken required" });

  let decoded;
  try {
    decoded = await verifyIdToken(idToken);
  } catch (e) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }

  const phone = decoded.phone_number;
  if (!phone) return res.status(400).json({ success: false, message: "No phone number in token" });

  let investor = await Investor.findOne({ phone });
  if (!investor) {
    if (!name) return res.status(400).json({ success: false, message: "Name required for new registration" });
    const region = req.region === "US" ? "US" : "IN";
    investor = await Investor.create({ phone, name, email, region });
  }

  const { accessToken, refreshToken } = tokenService.generateTokens(investor._id, "investor");
  return res.json({
    success: true, accessToken, refreshToken,
    investor: {
      _id: investor._id, name: investor.name, phone: investor.phone,
      status: investor.status, kycStatus: investor.kycStatus,
    },
  });
}

// POST /investor/auth/refresh
async function refresh(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ success: false, message: "Refresh token required" });
  try {
    const decoded = tokenService.verifyRefreshToken(refreshToken);
    if (decoded.role !== "investor") return res.status(403).json({ success: false, message: "Forbidden" });
    const investor = await Investor.findById(decoded.userId);
    if (!investor) return res.status(404).json({ success: false, message: "Not found" });
    const tokens = tokenService.generateTokens(investor._id, "investor");
    return res.json({ success: true, ...tokens });
  } catch {
    return res.status(401).json({ success: false, message: "Invalid refresh token" });
  }
}

module.exports = { sendOtp, verifyOtp, firebaseVerify, refresh };
