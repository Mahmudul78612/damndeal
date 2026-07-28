const express = require("express");
const h = require("../utils/asyncHandler");
const salesLead = require("../modules/admin/salesLead.controller");
const router = express.Router();

// Public — "Contact Sales" form from the advertise landing page
router.post("/sales-lead", h(salesLead.submit));

router.use("/auth", require("../modules/auth/auth.routes"));
router.use("/admin", require("../modules/admin/admin.routes"));
router.use("/advertiser", require("../modules/advertiser/advertiser.routes"));
router.use("/publisher", require("../modules/publisher/publisher.routes"));
router.use("/", require("../modules/serve/serve.routes")); // /serve, /click

router.get("/health", (_req, res) => res.json({ status: "ok", service: "adsservices-api", time: new Date().toISOString() }));

module.exports = router;
