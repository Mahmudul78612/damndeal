const express = require("express");
const { authenticate, authorize } = require("../../middleware/auth.middleware");
const { uploadInvestorDoc, uploadInvestorReceipt } = require("../../middleware/upload.middleware");
const auth = require("./controllers/auth.controller");
const portal = require("./controllers/portal.controller");

const router = express.Router();

// ── Auth (public) ──────────────────────────────────────────────────────────
router.post("/auth/send-otp", auth.sendOtp);
router.post("/auth/verify-otp", auth.verifyOtp);
router.post("/auth/firebase-verify", auth.firebaseVerify);
router.post("/auth/refresh", auth.refresh);

// ── Portal (investor auth required) ───────────────────────────────────────
router.use(authenticate, authorize("investor"));

router.get("/me", portal.getMe);
router.put("/me", portal.updateMe);

// KYC upload
router.post("/kyc", uploadInvestorDoc, portal.submitKyc);

// Purchase: upload receipt + form data
router.post("/purchase", uploadInvestorReceipt, portal.requestPurchase);

// Withdrawal request
router.post("/withdraw", portal.requestWithdrawal);

module.exports = router;
