const express = require("express");
const h = require("../../utils/asyncHandler");
const c = require("./serve.controller");
const event = require("./event.controller");

const router = express.Router();

// All public — called by our apps / advertiser sites. No auth (pixel/serve).
router.get("/serve", h(c.serve));
router.get("/serve/multi", h(c.serveMulti));
router.get("/click/:adId", h(c.click));

// Conversion / event tracking (Meta Pixel / Google conversion style)
router.post("/event", h(event.track));
router.get("/event", h(event.track)); // allow GET for simple image-pixel beacons

module.exports = router;
