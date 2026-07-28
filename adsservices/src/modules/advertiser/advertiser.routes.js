const express = require("express");
const h = require("../../utils/asyncHandler");
const { authenticate, advertiserOnly } = require("../../middleware/auth.middleware");
const c = require("./advertiser.portal.controller");

const router = express.Router();
router.use(authenticate, advertiserOnly);

router.get("/me", h(c.me));
router.get("/ads", h(c.myAds));
router.get("/ads/:id", h(c.myAd));
router.get("/analytics/overview", h(c.overview));
router.get("/analytics/ads/:id", h(c.adAnalytics));

module.exports = router;
