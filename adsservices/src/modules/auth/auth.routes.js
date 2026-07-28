const express = require("express");
const rateLimit = require("express-rate-limit");
const ctrl = require("./auth.controller");
const { authenticate } = require("../../middleware/auth.middleware");
const h = require("../../utils/asyncHandler");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: "Too many attempts. Try again later." },
  skip: () => process.env.NODE_ENV !== "production",
});

router.post("/login", loginLimiter, h(ctrl.login));
router.post("/refresh-token", h(ctrl.refreshToken));
router.get("/me", authenticate, h(ctrl.me));
router.post("/logout", h(ctrl.logout));

module.exports = router;
