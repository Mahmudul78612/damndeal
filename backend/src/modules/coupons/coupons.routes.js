const express = require("express");
const { authenticate, authorize } = require("../../middleware/auth.middleware");
const { attachStaff, requirePermission } = require("../../middleware/permission.middleware");
const { uploadCouponImages, optimizeImages } = require("../../middleware/upload.middleware");
const pub = require("./public.controller");
const vendor = require("./vendor.controller");
const extApi = require("./verifyApi.controller");
const admin = require("./admin.controller");

const router = express.Router();
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ── Public marketplace ── */
router.get("/home", h(pub.home));
router.get("/geo", h(pub.geo));
router.get("/list", h(pub.list));
router.get("/categories", h(pub.categories));
router.get("/c/:slug", h(pub.detail));
router.get("/vendors/:slug", h(pub.vendorPage));

/* ── Customer claims (auth) ── */
router.post("/claim", authenticate, h(pub.claim));
router.get("/my-claims", authenticate, h(pub.myClaims));

/* ── Spin & Win ── */
router.get("/spin", h(pub.spinWheel));
router.post("/spin/play", authenticate, h(pub.spinPlay));

/* ── External verify API (x-api-key) ── */
router.post("/api/verify", h(extApi.verify));
router.post("/api/redeem", h(extApi.redeem));

/* ── Vendor portal (auth) ── */
router.post("/vendor/register", authenticate, h(vendor.register));
router.get("/vendor/me", authenticate, h(vendor.me));
router.put("/vendor/me", authenticate, h(vendor.updateMe));
router.post("/vendor/campaigns", authenticate, h(vendor.createCampaign));
router.get("/vendor/campaigns", authenticate, h(vendor.myCampaigns));
router.patch("/vendor/campaigns/:id", authenticate, h(vendor.updateCampaign));
router.get("/vendor/stats", authenticate, h(vendor.stats));
router.post("/vendor/verify", authenticate, h(vendor.verifyCode));
router.post("/vendor/redeem", authenticate, h(vendor.redeemCode));
router.post("/vendor/api-key", authenticate, h(vendor.rotateApiKey));
router.get("/vendor/packs", authenticate, h(vendor.packs));
router.post("/vendor/packs", authenticate, h(vendor.buyPack));
router.get("/vendor/pack-orders", authenticate, h(vendor.myPackOrders));

/* ── Image upload (vendor banners / admin section banners) ── */
router.post("/upload", authenticate, uploadCouponImages, optimizeImages(1600), (req, res) => {
  const files = (req.files || []).map((f) => `/uploads/coupons/${f.filename}`);
  return res.json({ success: true, files });
});

/* ── Admin ── */
// Full admins, plus staff holding the Coupon Marketplace permission
const adm = [
  authenticate,
  authorize("admin", "staff"),
  attachStaff,
  requirePermission("manage_coupon_market"),
];
router.get("/admin/dashboard", ...adm, h(admin.dashboard));
router.get("/admin/categories", ...adm, h(admin.listCategories));
router.post("/admin/categories", ...adm, h(admin.createCategory));
router.put("/admin/categories/:id", ...adm, h(admin.updateCategory));
router.delete("/admin/categories/:id", ...adm, h(admin.deleteCategory));
router.get("/admin/campaigns", ...adm, h(admin.listCampaigns));
router.post("/admin/campaigns/:id/moderate", ...adm, h(admin.moderateCampaign));
router.put("/admin/campaigns/:id", ...adm, h(admin.updateCampaign));
router.get("/admin/spin-settings", ...adm, h(admin.getSpinSettings));
router.put("/admin/spin-settings", ...adm, h(admin.updateSpinSettings));
router.get("/admin/vendors", ...adm, h(admin.listVendors));
router.put("/admin/vendors/:id", ...adm, h(admin.updateVendor));
router.get("/admin/sections", ...adm, h(admin.listSections));
router.post("/admin/sections", ...adm, h(admin.createSection));
router.put("/admin/sections/:id", ...adm, h(admin.updateSection));
router.delete("/admin/sections/:id", ...adm, h(admin.deleteSection));
router.get("/admin/pack-orders", ...adm, h(admin.listPackOrders));
router.post("/admin/pack-orders/:id/decide", ...adm, h(admin.decidePackOrder));

module.exports = router;
