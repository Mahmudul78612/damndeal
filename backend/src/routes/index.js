const express = require("express");

// Module routes
const authRoutes = require("../modules/auth/auth.routes");
const adminRoutes = require("../modules/admin/admin.routes");
const partnerRoutes = require("../modules/partner/partner.routes");
const userRoutes = require("../modules/user/user.routes");
const deliveryRoutes = require("../modules/delivery/delivery.routes");
const { getCategories, getSubCategories } = require("../modules/admin/controllers/category.controller");
const AppSettings = require("../models/AppSettings");
const SubCategory = require("../models/SubCategory");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/partner", partnerRoutes);
router.use("/user", userRoutes);
router.use("/delivery", deliveryRoutes);
router.use("/investor", require("../modules/investor/investor.routes"));
router.use("/coupons", require("../modules/coupons/coupons.routes"));

// Public — categories (for app/web/partner signup)
router.get("/categories", getCategories);
router.get("/subcategories", getSubCategories);

// Public — app customization (featured card widget)
router.get("/app-customization", async (req, res) => {
  try {
    const setting = await AppSettings.findOne({ key: "featured_card" });
    if (!setting || !setting.value) {
      return res.json({ success: true, featuredCard: null });
    }
    const { subcategoryId, image } = setting.value;
    const sub = await SubCategory.findById(subcategoryId).populate("category", "name slug");
    return res.json({ success: true, featuredCard: { image, subcategory: sub } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Public — HSN code search
const hsnCodes = require("../data/hsnCodes");
router.get("/hsn-codes", (req, res) => {
  const q = (req.query.q || "").toLowerCase().trim();
  if (!q) return res.json({ success: true, codes: hsnCodes.slice(0, 50) });
  const filtered = hsnCodes.filter(
    (h) => h.code.includes(q) || h.description.toLowerCase().includes(q)
  );
  return res.json({ success: true, codes: filtered.slice(0, 30) });
});

// Health check
router.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Public — app config (force update, maintenance, branding)
router.get("/app-config", async (req, res) => {
  try {
    const keys = [
      "app_maintenance", "maintenance_message",
      "force_update_enabled", "app_min_version_android", "app_min_version_ios",
      "app_store_url", "play_store_url",
      "brand_primary_color", "brand_accent_color", "ddgo_brand_color",
      "app_bar_color_light", "app_bar_color_dark", "app_bar_bg_image", "dark_mode_enabled",
      "category_heading_color", "category_text_color", "category_bg_color",
      "support_phone", "support_email", "support_whatsapp",
      "about_us_url", "privacy_policy_url", "terms_url", "instagram_url",
      "cod_enabled", "wallet_enabled", "referral_enabled",
      "new_user_signup_enabled",
      // Branding logos
      "brand_logo_url", "brand_logo_dark_url", "brand_favicon_url", "brand_name",
      // Legal page overrides (HTML / Markdown supported as raw HTML)
      "legal_privacy_html", "legal_terms_html", "legal_refund_html", "legal_vendor_html",
      // Company / footer
      "company_name", "company_address", "support_phone_alt"
    ];
    const docs = await AppSettings.find({ key: { $in: keys } });
    const config = {};
    docs.forEach(d => { config[d.key] = d.value; });
    return res.json({ success: true, config });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── Shipping Webhooks (public, no auth — called by Delhivery / FShip servers) ──
const shippingService = require("../services/shipping.service");

router.post("/webhooks/delhivery", async (req, res) => {
  try {
    const result = await shippingService.processWebhook("delhivery", req.body);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error("Delhivery webhook error:", err.message);
    return res.status(200).json({ success: false, message: err.message });
  }
});

router.post("/webhooks/fship", async (req, res) => {
  try {
    const result = await shippingService.processWebhook("fship", req.body);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error("FShip webhook error:", err.message);
    return res.status(200).json({ success: false, message: err.message });
  }
});

module.exports = router;
