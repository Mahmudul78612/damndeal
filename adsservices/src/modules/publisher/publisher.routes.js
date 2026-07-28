const express = require("express");
const h = require("../../utils/asyncHandler");
const { authenticate, publisherOnly } = require("../../middleware/auth.middleware");
const c = require("./publisher.portal.controller");

const router = express.Router();
router.use(authenticate, publisherOnly);

router.get("/me", h(c.me));
router.get("/zones", h(c.myZones));
router.get("/analytics/overview", h(c.overview));

module.exports = router;
