const express = require("express");
const { authenticate, authorize } = require("../../middleware/auth.middleware");

const shop = require("./controllers/shop.controller");
const address = require("./controllers/address.controller");
const order = require("./controllers/order.controller");
const review = require("./controllers/review.controller");
const productReview = require("./controllers/productReview.controller");
const home = require("./controllers/home.controller");
const coupon = require("./controllers/coupon.controller");
const walletCtrl = require("./controllers/wallet.controller");
const wishlist = require("./controllers/wishlist.controller");
const returnCtrl = require("./controllers/return.controller");
const search = require("./controllers/search.controller");
const ticket = require("./controllers/ticket.controller");
const payment = require("./controllers/payment.controller");
const referral = require("./controllers/referral.controller");
const offer = require("./controllers/offer.controller");
const magicClubCtrl = require("./controllers/magicClub.controller");
const magicPoolCtrl = require("./controllers/magicPool.controller");
const invoiceService = require("../../services/invoice.service");
const cjService = require("../../services/cj.service");
const Product = require("../../models/Product");
const AppSettings = require("../../models/AppSettings");

const router = express.Router();

// Public (no auth needed)
router.get("/home", home.getHomePage);
router.get("/app-feed", home.getAppFeed);
router.get("/app-categories-page", home.getAppCategoriesPage);
const desktopHome = require("./controllers/desktopHome.controller");
router.get("/desktop-home", desktopHome.getDesktopHome);
router.get("/serviceability", shop.getServiceability);
router.post("/serviceability/notify", shop.requestArea);
router.get("/shops", shop.getShops);
router.get("/shops/:id", shop.getShop);
router.get("/shops/:id/products", shop.getShopProducts);
router.get("/shops/:id/reviews", review.getShopReviews);
router.get("/products/:id/reviews", productReview.listProductReviews);
router.get("/search", search.searchProducts);
router.get("/products", search.browseProducts);
router.get("/offers", offer.listOffers);
router.get("/offers/:id", offer.getOffer);
router.get("/banners/:id/products", home.getBannerProducts);

// Pincode serviceability check (public)
const shippingService = require("../../services/shipping.service");
router.get("/check-pincode", async (req, res) => {
  try {
    const { pincode, productId } = req.query;
    if (!pincode || !/^\d{6}$/.test(pincode)) {
      return res.status(400).json({ success: false, message: "Valid 6-digit pincode required" });
    }

    // CJ products use international logistics ETA + fee estimate.
    if (productId) {
      const product = await Product.findById(productId).lean();
      if (product && product.source === "cj") {
        const vid = product.cjVariantId || (Array.isArray(product.cjVariants) ? product.cjVariants[0]?.cjVid : null);
        if (vid) {
          const estimate = await cjService.estimateFreightSummary({
            startCountryCode: "CN",
            endCountryCode: "IN",
            quantity: 1,
            weight: parseFloat(product.weight) || 500,
            vid,
          });
          const usdRate = parseFloat((await AppSettings.findOne({ key: "cj_usd_inr_rate" }))?.value || "84") || 84;
          const feeInr = Math.round((estimate.feeUsd || 0) * usdRate * 100) / 100;
          const minDays = estimate.minDays != null ? estimate.minDays : 7;
          const maxDays = estimate.maxDays != null ? estimate.maxDays : Math.max(minDays, 12);

          return res.json({
            success: true,
            serviceable: true,
            city: "",
            state: "",
            cod: false,
            prepaid: true,
            estimatedDays: maxDays,
            estimatedMinDays: minDays,
            estimatedMaxDays: maxDays,
            deliveryFee: feeInr,
            deliveryType: "international",
          });
        }
      }
    }

    const result = await shippingService.checkPincode(pincode);

    // Get estimated delivery days — try real TAT API first, fallback to zone heuristic
    let estimatedDays = 5;
    if (result.serviceable) {
      const setting = await AppSettings.findOne({ key: "shipping_pickup_pincode" });
      const originPin = setting?.value || "";

      try {
        const tat = await shippingService.getExpectedTAT(originPin, pincode);
        if (tat.expectedDays) {
          estimatedDays = tat.expectedDays;
        } else {
          throw new Error("No TAT data");
        }
      } catch {
        // Fallback: zone-based heuristic
        const originZone = originPin.substring(0, 3);
        const destZone = pincode.substring(0, 3);
        if (originZone === destZone) {
          estimatedDays = 2;
        } else if (originPin.charAt(0) === pincode.charAt(0)) {
          estimatedDays = 4;
        } else {
          estimatedDays = 6;
        }
      }
    }

    return res.json({
      success: true,
      ...result,
      estimatedDays: result.serviceable ? estimatedDays : null,
      deliveryType: "domestic",
    });
  } catch (err) {
    return res.json({ success: true, serviceable: true, estimatedDays: 5, cod: true, prepaid: true, city: "", state: "", deliveryType: "domestic" });
  }
});

// Protected (user auth)
router.use(authenticate, authorize("user"));

// Addresses
router.get("/addresses", address.getAddresses);
router.post("/addresses", address.addAddress);
router.put("/addresses/:id", address.updateAddress);
router.delete("/addresses/:id", address.deleteAddress);

// Orders
router.get("/orders/delivery-estimate", order.getDeliveryEstimate);
router.post("/orders", order.placeOrder);
router.get("/orders", order.getMyOrders);
router.get("/orders/:id", order.getOrderDetail);
router.put("/orders/:id/cancel", order.cancelOrder);

// Invoice download
router.get("/orders/:id/invoice", async (req, res) => {
  try {
    const pdfDoc = await invoiceService.generateInvoice(req.params.id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=invoice-${req.params.id}.pdf`);
    pdfDoc.pipe(res);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Reviews
router.post("/reviews", review.addReview);
router.post("/products/:id/reviews", productReview.addProductReview);
router.get("/products/:id/my-review", productReview.getMyProductReview);

// Coupons
router.post("/coupons/validate", coupon.validateCouponCode);
router.get("/coupons", coupon.listAvailableCoupons);

// Wallet
router.get("/wallet", walletCtrl.getWallet);
router.get("/wallet/transactions", walletCtrl.getTransactions);

// Wishlist
router.post("/wishlist/products", wishlist.addProduct);
router.delete("/wishlist/products/:productId", wishlist.removeProduct);
router.get("/wishlist/products", wishlist.getWishlistProducts);
router.post("/wishlist/shops", wishlist.saveShop);
router.delete("/wishlist/shops/:partnerId", wishlist.unsaveShop);
router.get("/wishlist/shops", wishlist.getSavedShops);

// Returns
router.post("/returns", returnCtrl.createReturn);
router.get("/returns", returnCtrl.getMyReturns);
router.get("/returns/order/:orderId", returnCtrl.getReturnByOrder);

// Support Tickets
router.post("/tickets", ticket.createTicket);
router.get("/tickets", ticket.getMyTickets);
router.get("/tickets/:id", ticket.getTicket);
router.post("/tickets/:id/reply", ticket.replyTicket);

// Payments (Razorpay — India)
router.post("/payments/create", payment.createPayment);
router.post("/payments/verify", payment.verifyPayment);

// Payments (Stripe — US / damndeal.com)
router.post("/payments/stripe/checkout", payment.createStripeCheckout);
router.post("/payments/stripe/verify-checkout", payment.verifyStripeCheckout);
router.post("/payments/stripe/create-intent", payment.createStripeIntent);
router.post("/payments/stripe/confirm", payment.confirmStripePayment);

// Referral
router.get("/referral", referral.getMyReferral);
router.post("/referral/apply", referral.applyReferralCode);

// Magic Club (rewards + redeemable wallet)
router.get("/magic-club", magicClubCtrl.getClubs);
router.get("/magic-club/wallet", magicClubCtrl.getWallet);
router.post("/magic-club/redeem/initiate", magicClubCtrl.initiateRedeem);

// Magic Pool (raffle / wheel of fortune)
router.get("/magic-pools", magicPoolCtrl.listOpen);
router.get("/magic-pools/mine", magicPoolCtrl.listMine);
router.get("/magic-pools/:id", magicPoolCtrl.getOne);
router.post("/magic-pools/:id/join", magicPoolCtrl.join);

// FCM token (save device push token)
const User = require("../../models/User");
router.post("/fcm-token", async (req, res) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) return res.status(400).json({ success: false, message: "fcmToken required" });
    await User.findByIdAndUpdate(req.user.userId, { fcmToken });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
