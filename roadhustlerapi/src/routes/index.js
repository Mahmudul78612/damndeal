const express = require("express");
const router = express.Router();

router.use("/auth", require("../modules/auth/auth.routes"));
router.use("/erp", require("../modules/erp/erp.routes"));
router.use("/website", require("../modules/website/website.routes"));

router.get("/health", (_req, res) => res.json({ status: "ok", service: "roadhustler-api", time: new Date().toISOString() }));

module.exports = router;
