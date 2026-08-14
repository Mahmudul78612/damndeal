const express = require("express");
const { authenticate, authorize } = require("../../middleware/auth.middleware");
const { attachStaff, requirePermission } = require("../../middleware/permission.middleware");
const { uploadCouponImages, optimizeImages } = require("../../middleware/upload.middleware");
const pub = require("./public.controller");
const vendor = require("./vendor.controller");
const extApi = require("./verifyApi.controller");
const admin = require("./admin.controller");
const member = require("./member.controller");
const { attachCouponMember, requireCouponPermission } = require("../../middleware/couponAuth.middleware");

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
router.get("/vendor/me", authenticate, attachCouponMember, h(vendor.me));
router.put("/vendor/me", authenticate, attachCouponMember, requireCouponPermission("manage_brands"), h(vendor.updateMe));
router.post("/vendor/campaigns", authenticate, attachCouponMember, requireCouponPermission("manage_campaigns"), h(vendor.createCampaign));
router.get("/vendor/campaigns", authenticate, attachCouponMember, h(vendor.myCampaigns));
router.get("/vendor/analytics", authenticate, attachCouponMember, requireCouponPermission("view_dashboard"), h(vendor.analytics));

/* Outlets — the brand's physical locations */
router.get("/vendor/outlets", authenticate, attachCouponMember, h(vendor.listOutlets));
router.post("/vendor/outlets", authenticate, attachCouponMember, requireCouponPermission("manage_outlets"), h(vendor.createOutlet));
router.post("/vendor/outlets/bulk", authenticate, attachCouponMember, requireCouponPermission("manage_outlets"), h(vendor.bulkOutlets));
router.put("/vendor/outlets/:id", authenticate, attachCouponMember, requireCouponPermission("manage_outlets"), h(vendor.updateOutlet));
router.delete("/vendor/outlets/:id", authenticate, attachCouponMember, requireCouponPermission("manage_outlets"), h(vendor.deleteOutlet));
router.patch("/vendor/campaigns/:id", authenticate, attachCouponMember, requireCouponPermission("manage_campaigns"), h(vendor.updateCampaign));
router.get("/vendor/stats", authenticate, attachCouponMember, h(vendor.stats));
router.post("/vendor/verify", authenticate, attachCouponMember, requireCouponPermission("redeem_codes"), h(vendor.verifyCode));
router.post("/vendor/redeem", authenticate, attachCouponMember, requireCouponPermission("redeem_codes"), h(vendor.redeemCode));
router.post("/vendor/api-key", authenticate, attachCouponMember, requireCouponPermission("manage_api"), h(vendor.rotateApiKey));
router.get("/vendor/packs", authenticate, h(vendor.packs));
router.post("/vendor/packs", authenticate, attachCouponMember, requireCouponPermission("manage_billing"), h(vendor.buyPack));
router.post("/vendor/packs/:id/confirm", authenticate, attachCouponMember, requireCouponPermission("manage_billing"), h(vendor.confirmPack));
router.get("/vendor/packs/:id/invoice", authenticate, attachCouponMember, requireCouponPermission("manage_billing"), h(vendor.packInvoice));
router.get("/vendor/pack-orders", authenticate, h(vendor.myPackOrders));

/* ── Business portal: team accounts, invites, credentials ── */
// Public — the invitee has no session yet
router.get("/business/invite/:token", h(member.inviteInfo));
router.post("/business/invite/:token/accept", h(member.acceptInvite));
router.post("/business/login", h(member.login));

// Signed in as a member of a business
const biz = [authenticate, attachCouponMember];
router.get("/business/me", ...biz, h(member.me));
router.post("/business/set-password", ...biz, h(member.setPassword));
router.get("/business/members", ...biz, requireCouponPermission("manage_members"), h(member.listMembers));
router.post("/business/members", ...biz, requireCouponPermission("manage_members"), h(member.inviteMember));
router.put("/business/members/:id", ...biz, requireCouponPermission("manage_members"), h(member.updateMember));
router.delete("/business/members/:id", ...biz, requireCouponPermission("manage_members"), h(member.removeMember));

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
// keep above any GET /admin/campaigns/:id route — "search" must not be read as an id
router.get("/admin/campaigns/search", ...adm, h(admin.searchCampaigns));
router.post("/admin/campaigns/:id/moderate", ...adm, h(admin.moderateCampaign));
router.put("/admin/campaigns/:id", ...adm, h(admin.updateCampaign));
router.get("/admin/credit-packs", ...adm, h(admin.getCreditPacks));
router.put("/admin/credit-packs", ...adm, h(admin.updateCreditPacks));
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
