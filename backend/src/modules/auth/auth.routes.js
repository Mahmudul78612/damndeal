const express = require("express");
const { authenticate } = require("../../middleware/auth.middleware");
const { clientType } = require("../../middleware/clientType.middleware");
const {
  handleSendOtp, handleVerifyOtp, handleFirebaseVerify, handleCompleteProfile,
  handleRefreshToken, handleGetMe, handleUpdateFcmToken, handleLogout,
} = require("./auth.controller");

const router = express.Router();

router.post("/send-otp", clientType, handleSendOtp);
router.post("/verify-otp", clientType, handleVerifyOtp);
router.post("/firebase-verify", clientType, handleFirebaseVerify);
router.post("/refresh-token", handleRefreshToken);
router.put("/complete-profile", authenticate, handleCompleteProfile);
router.put("/fcm-token", authenticate, handleUpdateFcmToken);
router.get("/me", authenticate, handleGetMe);
router.post("/logout", authenticate, handleLogout);

module.exports = router;
