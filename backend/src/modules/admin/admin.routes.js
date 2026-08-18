const express = require("express");
const { authenticate, authorize } = require("../../middleware/auth.middleware");
const { attachStaff, requirePermission } = require("../../middleware/permission.middleware");
const { uploadBanner, uploadCategoryImage, uploadCustomizationImage, uploadProductImages, uploadPromoImages, uploadSettingImage, uploadDesktopBanners, uploadHomeSectionBanners, uploadMagicPoolImages, uploadCsvFile, optimizeImages } = require("../../middleware/upload.middleware");

// Controllers
const category = require("./controllers/category.controller");
const partner = require("./controllers/partner.controller");
const kyc = require("./controllers/kyc.controller");
const product = require("./controllers/product.controller");
const productImport = require("./controllers/productImport.controller");
const payout = require("./controllers/payout.controller");
const staff = require("./controllers/staff.controller");
const dashboard = require("./controllers/dashboard.controller");
const notification = require("./controllers/notification.controller");
const banner = require("./controllers/banner.controller");
const settings = require("./controllers/settings.controller");
const homepage = require("./controllers/homepage.controller");
const deliveryBoy = require("./controllers/deliveryBoy.controller");
const order = require("./controllers/order.controller");
const shippingCtrl = require("./controllers/shipping.controller");
const darkStoreCtrl = require("./controllers/darkstore.controller");
const storeInv = require("./controllers/storeInventory.controller");
const coupon = require("./controllers/coupon.controller");
const offer = require("./controllers/offer.controller");
const returnCtrl = require("./controllers/return.controller");
const ticket = require("./controllers/ticket.controller");
const subscription = require("./controllers/subscription.controller");
const report = require("./controllers/report.controller");
const wallet = require("./controllers/wallet.controller");
const analytics = require("./controllers/analytics.controller");
const cj = require("./controllers/cj.controller");
const userReview = require("./controllers/userReview.controller");

const router = express.Router();
router.use(authenticate, authorize("admin", "staff"));
router.use(attachStaff);

// ── Role-based access (staff only; role "admin" passes everything) ──
// Guards are mounted per path prefix so every current and future method under
// a module is covered automatically.
const P = requirePermission;
router.use("/dashboard", P("view_dashboard"));
router.use("/analytics", P("view_analytics"));
router.use("/categories", P("manage_categories"));
router.use("/subcategories", P("manage_categories"));
router.use("/products", P("manage_products"));
router.use("/user-reviews", P("manage_reviews"));
router.use("/cj", P("manage_cj"));
router.use("/offers", P("manage_offers"));
router.use("/coupons", P("manage_coupons"));
router.use("/banners", P("manage_banners"));
router.use("/partners", P("manage_partners"));
router.use("/kyc", P("manage_kyc"));
router.use("/orders", P("manage_orders"));
router.use("/shipping", P("manage_shipping"));
router.use("/dark-stores", P("manage_ddgo_stores"));
router.use("/returns", P("manage_returns"));
router.use("/payouts", P("manage_payouts"));
router.use("/delivery-boys", P("manage_delivery"));
router.use("/staff", P("manage_staff"));
router.use("/wallets", P("manage_wallets"));
router.use("/tickets", P("manage_tickets"));
router.use("/subscriptions", P("manage_subscriptions"));
router.use("/notifications", P("manage_notifications"));
router.use("/magic-pools", P("manage_magic_pools"));
router.use("/investors", P("manage_investors"));
router.use("/reports", P("view_reports"));
router.use("/security", P("view_security"));
router.use("/settings", P("manage_settings"));
router.use("/home-sections", P("manage_homepage"));
router.use("/desktop-home-sections", P("manage_homepage"));
router.use("/app-customization", P("manage_homepage"));

// OTP / bot-protection status (any admin or staff may view)
router.get("/security/otp", async (req, res) => {
  const botGuard = require("../../services/botGuard.service");
  try {
    return res.json({ success: true, ...(await botGuard.stats()) });
  } catch (e) {
    return res.status(503).json({ success: false, message: "Protection stats unavailable: " + e.message });
  }
});

// Who am I + permission catalog (no permission needed — every signed-in
// admin/staff must be able to load their own menu)
router.get("/me", staff.getMe);
router.get("/permissions", staff.getPermissionCatalog);

// Dashboard
router.get("/dashboard", dashboard.getDashboard);

// Categories
router.post("/categories", uploadCategoryImage, category.createCategory);
router.get("/categories", category.getCategories);
router.put("/categories/:id", uploadCategoryImage, category.updateCategory);
router.delete("/categories/:id", category.deleteCategory);
router.post("/subcategories", uploadCategoryImage, category.createSubCategory);
router.get("/subcategories", category.getSubCategories);
router.put("/subcategories/:id", uploadCategoryImage, category.updateSubCategory);
router.delete("/subcategories/:id", category.deleteSubCategory);

// Partners
router.get("/partners", partner.listPartners);
router.get("/partners/:id", partner.getPartner);
router.put("/partners/:id/toggle", partner.togglePartner);
router.put("/partners/:id/commission", partner.setCommission);
router.get("/partners/:id/settlement", partner.settlement);

// KYC
router.get("/kyc", kyc.listKyc);
router.put("/kyc/:id/review", kyc.reviewKyc);

// Products — full CRUD + review
router.post("/products/import-csv", uploadCsvFile, productImport.importCsv);
router.post("/products", uploadProductImages, product.createProduct);
router.get("/products", product.listProducts);
router.get("/products/:id", product.getProduct);
router.put("/products/:id", uploadProductImages, product.updateProduct);
router.delete("/products/:id", product.deleteProduct);
router.put("/products/:id/review", product.reviewProduct);

// User product reviews/ratings moderation
router.get("/user-reviews", userReview.listReviews);
router.put("/user-reviews/:id/moderate", userReview.moderateReview);
router.delete("/user-reviews/:id", userReview.deleteReview);
router.post("/user-reviews/seed", userReview.seedReview);

// Orders
router.get("/orders", order.listOrders);
router.get("/orders/:id", order.getOrder);
router.put("/orders/:id/assign-delivery", order.assignDeliveryBoy);
router.put("/orders/:id/status", order.updateOrderStatus);
router.put("/orders/:id/reject", order.rejectOrder);
router.put("/orders/:id/self-ship", order.selfShip);
router.put("/orders/:id/self-ship-update", order.selfShipUpdate);

// Shipping (courier)
router.post("/orders/:id/ship", shippingCtrl.shipOrder);
router.get("/orders/:id/track", shippingCtrl.trackOrder);
router.post("/orders/:id/cancel-shipment", shippingCtrl.cancelShipment);
router.put("/orders/:id/update-shipment", shippingCtrl.updateShipment);
router.put("/orders/:id/ewaybill", shippingCtrl.updateEwaybill);
router.get("/shipping/check-pincode", shippingCtrl.checkPincode);
router.get("/shipping/expected-tat", shippingCtrl.getExpectedTAT);
router.get("/shipping/fetch-waybill", shippingCtrl.fetchWaybill);
router.post("/shipping/calculate-cost", shippingCtrl.calculateShippingCost);
router.post("/shipping/pickup-request", shippingCtrl.createPickupRequest);
router.post("/shipping/warehouse", shippingCtrl.createWarehouse);
router.put("/shipping/warehouse", shippingCtrl.updateWarehouse);

// Payouts
router.get("/payouts", payout.listPayouts);
router.post("/payouts", payout.createPayout);
router.put("/payouts/:id/process", payout.processPayout);

// Staff
router.get("/staff", staff.listStaff);
router.post("/staff", staff.addStaff);
router.put("/staff/:id", staff.updateStaff);
router.delete("/staff/:id", staff.removeStaff);

// Delivery boys
router.get("/delivery-boys", deliveryBoy.listDeliveryBoys);
router.put("/delivery-boys/:id/verify", deliveryBoy.verifyDeliveryBoy);
router.put("/delivery-boys/:id/toggle", deliveryBoy.toggleDeliveryBoy);

// Notifications
router.post("/notifications", notification.createNotification);
router.get("/notifications", notification.listNotifications);
router.post("/notifications/:id/send", notification.sendNotification);
router.delete("/notifications/:id", notification.deleteNotification);

// Banners
router.post("/banners", uploadBanner, banner.createBanner);
router.get("/banners", banner.listBanners);
router.put("/banners/:id", uploadBanner, banner.updateBanner);
router.delete("/banners/:id", banner.deleteBanner);

// App settings
router.get("/settings", settings.getSettings);
router.put("/settings/:key", settings.upsertSetting);
router.delete("/settings/:key", settings.deleteSetting);
router.post("/settings/seed", settings.seedDefaults);
router.post("/settings/upload/:key", uploadSettingImage, settings.uploadSettingImage);
router.post("/settings/test-fast2sms", settings.testFast2Sms);

// App customization — featured card
router.put("/app-customization/featured-card", uploadCustomizationImage, settings.upsertFeaturedCard);
router.delete("/app-customization/featured-card", settings.deleteFeaturedCard);

// Home page arrangement
router.get("/home-sections", homepage.listSections);
router.post("/home-sections", homepage.createSection);
router.post("/home-sections/promo", uploadPromoImages, optimizeImages(1600), homepage.savePromoSection);
router.post("/home-sections/banner", uploadHomeSectionBanners, optimizeImages(1600), homepage.saveBannerSection);
router.put("/home-sections/reorder", homepage.reorderSections);
router.put("/home-sections/:id", homepage.updateSection);
router.delete("/home-sections/:id", homepage.deleteSection);

// Desktop Home Layout
const desktopHome = require("./controllers/desktopHome.controller");
router.get("/desktop-home-sections", desktopHome.listSections);
router.post("/desktop-home-sections", desktopHome.createSection);
router.post("/desktop-home-sections/with-images", uploadDesktopBanners, optimizeImages(1600), desktopHome.createSectionWithImages);
router.put("/desktop-home-sections/reorder", desktopHome.reorderSections);
router.put("/desktop-home-sections/:id", desktopHome.updateSection);
router.put("/desktop-home-sections/:id/with-images", uploadDesktopBanners, optimizeImages(1600), desktopHome.updateSectionWithImages);
router.delete("/desktop-home-sections/:id", desktopHome.deleteSection);

// Coupons
router.post("/coupons", coupon.createCoupon);
router.get("/coupons", coupon.listCoupons);
router.put("/coupons/:id", coupon.updateCoupon);
router.delete("/coupons/:id", coupon.deleteCoupon);

// Offers
router.post("/offers", offer.createOffer);
router.get("/offers", offer.listOffers);
router.put("/offers/:id", offer.updateOffer);
router.delete("/offers/:id", offer.deleteOffer);

// Returns
router.get("/returns", returnCtrl.listReturns);
router.put("/returns/:id/review", returnCtrl.reviewReturn);

// Support Tickets
router.get("/tickets", ticket.listTickets);
router.get("/tickets/:id", ticket.getTicket);
router.put("/tickets/:id/assign", ticket.assignTicket);
router.post("/tickets/:id/reply", ticket.replyTicket);
router.put("/tickets/:id/resolve", ticket.resolveTicket);
router.put("/tickets/:id/close", ticket.closeTicket);

// Subscription Plans
router.post("/subscriptions/plans", subscription.createPlan);
router.get("/subscriptions/plans", subscription.listPlans);
router.put("/subscriptions/plans/:id", subscription.updatePlan);
router.delete("/subscriptions/plans/:id", subscription.deletePlan);
router.get("/subscriptions", subscription.listSubscriptions);

// Reports
router.get("/reports/orders", report.orderReport);
router.get("/reports/revenue", report.revenueReport);
router.get("/reports/users", report.userReport);
router.get("/reports/payments", report.paymentReport);

// Wallets
router.get("/wallets", wallet.listWallets);
router.get("/wallets/:userId/transactions", wallet.getTransactions);
router.post("/wallets/:userId/credit", wallet.adminCredit);

// Analytics
router.get("/analytics", analytics.getAnalytics);

// ── CJ Dropshipping ────────────────────────────────────────────────────────
router.get("/cj/settings", cj.getCJSettings);
router.post("/cj/settings", cj.saveCJSettings);
router.get("/cj/categories", cj.getCJCategories);
router.get("/cj/products/search", cj.searchCJProducts);
router.get("/cj/products/:pid", cj.getCJProductDetails);
router.post("/cj/products/import", cj.importCJProduct);
router.get("/cj/imported", cj.listImportedProducts);
router.put("/cj/imported/:id", cj.updateImportedProduct);
router.delete("/cj/imported/:id", cj.deleteImportedProduct);
router.post("/cj/sync/:id", cj.syncCJProduct);
router.get("/cj/order/:cjOrderId", cj.getCJOrder);
router.get("/cj/freight", cj.getCJFreight);

// ── Magic Pool (raffle / wheel of fortune) ────────────────────────────────
const magicPool = require("./controllers/magicPool.controller");
router.get("/magic-pools", magicPool.listPools);
router.post("/magic-pools", magicPool.createPool);
router.post("/magic-pools/upload-images", uploadMagicPoolImages, magicPool.uploadImages);
router.get("/magic-pools/:id", magicPool.getPool);
router.put("/magic-pools/:id", magicPool.updatePool);
router.delete("/magic-pools/:id", magicPool.deletePool);
router.post("/magic-pools/:id/draw", magicPool.drawPool);

// ── Investor Portal ───────────────────────────────────────────────────────
const investor = require("./controllers/investor.controller");
router.get("/investors/analytics", investor.analytics);
router.get("/investors", investor.listInvestors);
router.get("/investors/:id", investor.getInvestor);
router.put("/investors/:id/kyc", investor.updateKyc);
router.post("/investors/:id/credit-points", investor.creditPoints);
router.put("/investors/purchases/:purchaseId", investor.updatePurchase);
router.put("/investors/withdrawals/:withdrawalId", investor.updateWithdrawal);

// ── DDGo dark stores (quick commerce fulfilment points) ───────────────────
// "coverage" sits above "/:id" so the word is never read as an id.
router.put("/delivery-boys/:id/store", deliveryBoy.assignStore);

router.get("/dark-stores/coverage", darkStoreCtrl.coverage);
router.get("/dark-stores/demand", darkStoreCtrl.demand);
router.get("/dark-stores/performance", darkStoreCtrl.performance);
router.get("/dark-stores", darkStoreCtrl.list);
router.post("/dark-stores", darkStoreCtrl.create);
router.get("/dark-stores/:id", darkStoreCtrl.getOne);
router.put("/dark-stores/:id", darkStoreCtrl.update);
router.delete("/dark-stores/:id", darkStoreCtrl.remove);

// Per-store shelf. Declared after the store routes so ":id/inventory" is never
// swallowed by the plain ":id" handlers above.
router.get("/dark-stores/:id/inventory", storeInv.list);
router.put("/dark-stores/:id/inventory", storeInv.upsert);
router.post("/dark-stores/:id/inventory/bulk", storeInv.bulk);
router.delete("/dark-stores/:id/inventory/:productId", storeInv.remove);
router.get("/dark-stores/:id/stockable", storeInv.stockable);

module.exports = router;
