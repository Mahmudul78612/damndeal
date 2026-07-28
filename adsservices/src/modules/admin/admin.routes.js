const express = require("express");
const h = require("../../utils/asyncHandler");
const { authenticate, staffOnly, adminOnly } = require("../../middleware/auth.middleware");
const { uploadAd } = require("../../middleware/upload.middleware");

const advertiser = require("./advertiser.controller");
const publisher = require("./publisher.controller");
const salesLead = require("./salesLead.controller");
const zone = require("./zone.controller");
const ad = require("./ad.controller");
const analytics = require("./analytics.controller");

const router = express.Router();
router.use(authenticate, staffOnly);

// Analytics
router.get("/analytics/overview", h(analytics.overview));
router.get("/analytics/by-state", h(analytics.byState));
router.get("/analytics/ads/:id", h(analytics.adAnalytics));

// Advertisers
router.get("/advertisers", h(advertiser.list));
router.post("/advertisers", h(advertiser.create));
router.get("/advertisers/:id", h(advertiser.getOne));
router.put("/advertisers/:id", h(advertiser.update));
router.post("/advertisers/:id/regenerate-key", h(advertiser.regenerateKey));
router.delete("/advertisers/:id", adminOnly, h(advertiser.remove));

// Sales enquiries (from landing "Contact Sales")
router.get("/sales-leads", h(salesLead.list));
router.patch("/sales-leads/:id", h(salesLead.update));

// Publishers (apps/sites where ads run)
router.get("/publishers", h(publisher.list));
router.post("/publishers", h(publisher.create));
router.get("/publishers/:id", h(publisher.getOne));
router.put("/publishers/:id", h(publisher.update));
router.post("/publishers/:id/regenerate-key", h(publisher.regenerateKey));
router.delete("/publishers/:id", adminOnly, h(publisher.remove));

// Zones (placements)
router.get("/zones", h(zone.list));
router.post("/zones", h(zone.create));
router.put("/zones/:id", h(zone.update));
router.delete("/zones/:id", adminOnly, h(zone.remove));

// Ads (creative upload)
router.get("/ads", h(ad.list));
router.post("/ads", uploadAd, h(ad.create));
router.get("/ads/:id", h(ad.getOne));
router.put("/ads/:id", uploadAd, h(ad.update));
router.patch("/ads/:id/status", h(ad.setStatus));
router.delete("/ads/:id", h(ad.remove));

module.exports = router;
