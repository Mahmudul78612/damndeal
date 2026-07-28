const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  handleSendOtp,
  handleVerifyOtp,
  handleFirebaseVerify,
  handleCompleteProfile,
  handleRefreshToken,
  handleGetMe,
  handleLogout,
} = require("../controllers/auth.controller");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const { clientType } = require("../middleware/clientType.middleware");

const router = express.Router();

// Rate-limiters — protect OTP endpoints from SMS-bomb / brute-force.
// Skipped automatically in non-production for tests.
const isProd = process.env.NODE_ENV === "production";
const sendOtpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many OTP requests. Try again later." },
  skip: () => !isProd,
});
const verifyOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many verification attempts. Try again later." },
  skip: () => !isProd,
});

// Public routes — clientType middleware sets the role based on x-client-type header
router.post("/send-otp", sendOtpLimiter, clientType, handleSendOtp);
router.post("/verify-otp", verifyOtpLimiter, clientType, handleVerifyOtp);
router.post("/firebase-verify", clientType, handleFirebaseVerify);
router.post("/refresh-token", handleRefreshToken);

// Protected routes
router.put("/complete-profile", authenticate, handleCompleteProfile);
router.get("/me", authenticate, handleGetMe);
router.post("/logout", authenticate, handleLogout);

module.exports = router;
