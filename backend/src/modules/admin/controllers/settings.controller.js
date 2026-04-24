const AppSettings = require("../../../models/AppSettings");
const notificationService = require("../../../services/notification.service");
const secrets = require("../../../utils/secrets");

// GET /admin/settings — sensitive values are masked (never sent in plaintext)
async function getSettings(_req, res) {
  const docs = await AppSettings.find().sort({ key: 1 }).lean();
  for (const s of docs) {
    if (secrets.isSecretKey(s.key)) {
      const plain = secrets.decrypt(s.value);
      s.value = plain ? secrets.mask(plain) : "";
      s.isSecret = true;
      s.isSet = !!plain;
    }
  }
  return res.json({ success: true, settings: docs });
}

// PUT /admin/settings/:key — encrypts secret values; ignores masked placeholder
async function upsertSetting(req, res) {
  let { value, description } = req.body;
  if (value === undefined) return res.status(400).json({ success: false, message: "value required" });

  const key = req.params.key;
  const isSecret = secrets.isSecretKey(key);

  // If admin sent back the mask placeholder unchanged, treat as no-op
  if (isSecret && secrets.isMasked(value)) {
    const existing = await AppSettings.findOne({ key });
    return res.json({ success: true, setting: existing || { key, value: "" }, unchanged: true });
  }

  // Encrypt at rest if this is a secret
  const storedValue = isSecret ? secrets.encryptSetting(key, value) : value;

  const setting = await AppSettings.findOneAndUpdate(
    { key },
    { value: storedValue, description: description || "", updatedBy: req.user.userId },
    { new: true, upsert: true }
  ).lean();

  // Invalidate caches that depend on settings
  if (String(key).startsWith("fast2sms_") && notificationService._invalidateFast2SmsCache) {
    notificationService._invalidateFast2SmsCache();
  }

  // Mask before returning to client
  if (isSecret && setting) {
    const plain = secrets.decrypt(setting.value);
    setting.value = plain ? secrets.mask(plain) : "";
    setting.isSecret = true;
    setting.isSet = !!plain;
  }

  return res.json({ success: true, setting });
}

// DELETE /admin/settings/:key
async function deleteSetting(req, res) {
  await AppSettings.findOneAndDelete({ key: req.params.key });
  return res.json({ success: true, message: "Setting deleted" });
}

// POST /admin/settings/seed — seed defaults
async function seedDefaults(req, res) {
  const defaults = [
    // App Control
    { key: "app_maintenance", value: false, description: "Maintenance mode — show maintenance screen in app" },
    { key: "maintenance_message", value: "We're upgrading! Back shortly.", description: "Message shown during maintenance" },
    { key: "force_update_enabled", value: false, description: "Force users to update app" },
    { key: "app_min_version_android", value: "1.0.0", description: "Minimum Android app version" },
    { key: "app_min_version_ios", value: "1.0.0", description: "Minimum iOS app version" },
    { key: "app_store_url", value: "", description: "Apple App Store URL" },
    { key: "play_store_url", value: "", description: "Google Play Store URL" },

    // Branding
    { key: "brand_primary_color", value: "#4F46E5", description: "Primary brand color" },
    { key: "brand_accent_color", value: "#F59E0B", description: "Accent / highlight color" },
    { key: "ddgo_brand_color", value: "#0D7A30", description: "DD Go section color" },
    { key: "app_bar_color_light", value: "#FFFFFF", description: "AppBar background (light mode)" },
    { key: "app_bar_color_dark", value: "#1F2937", description: "AppBar background (dark mode)" },
    { key: "dark_mode_enabled", value: false, description: "Allow dark mode in app" },

    // Delivery & Fees
    { key: "delivery_fee", value: 49, description: "Flat delivery fee (₹) when below free-delivery threshold" },
    { key: "delivery_fee_per_km", value: 0, description: "Additional fee per km (₹). 0 for flat-rate." },
    { key: "free_delivery_above", value: 250, description: "Free delivery if order above this amount (₹). 0 = disabled" },
    { key: "max_delivery_radius_km", value: 20, description: "Max allowed delivery distance in km" },
    { key: "delivery_radius_km", value: 20, description: "Shop discovery radius in km" },
    { key: "platform_fee", value: 0, description: "Platform fee per order (₹)" },
    { key: "min_order_amount", value: 0, description: "Minimum order amount (₹). 0 = disabled" },
    { key: "same_day_delivery_cutoff_hour", value: 20, description: "Same-day delivery cutoff (24h)" },

    // Business & Commission
    { key: "commission_percent", value: 5, description: "Commission % on partner orders" },
    { key: "payout_schedule", value: "weekly", description: "Payout frequency: daily/weekly/biweekly/monthly" },
    { key: "payout_min_amount", value: 500, description: "Minimum payout amount (₹)" },
    { key: "gst_enabled", value: false, description: "Show GST breakdown" },
    { key: "default_gst_percent", value: 18, description: "Default GST rate %" },

    // Users & Auth
    { key: "new_user_signup_enabled", value: true, description: "Allow new registrations" },
    { key: "referral_enabled", value: false, description: "Enable referral system" },
    { key: "referral_bonus", value: 50, description: "Referrer reward (₹)" },
    { key: "referral_signup_bonus", value: 25, description: "New user signup reward (₹)" },
    { key: "wallet_enabled", value: true, description: "Enable wallet payments" },
    { key: "max_wallet_usage_percent", value: 100, description: "Max wallet % per order" },
    { key: "otp_expiry_minutes", value: 5, description: "OTP validity in minutes" },

    // Orders & Cart
    { key: "max_cart_items", value: 50, description: "Max items in cart" },
    { key: "max_item_quantity", value: 10, description: "Max qty per item" },
    { key: "cod_enabled", value: true, description: "Allow Cash on Delivery" },
    { key: "cod_max_amount", value: 0, description: "Max COD order value (₹). 0=no limit" },
    { key: "cod_fee", value: 30, description: "Extra fee added when customer chooses Cash on Delivery (₹)" },
    { key: "cancel_window_minutes", value: 5, description: "Order cancel window (minutes)" },
    { key: "auto_confirm_orders", value: false, description: "Auto-confirm orders" },
    { key: "order_rating_enabled", value: true, description: "Allow order ratings" },

    // Razorpay Payment Gateway
    { key: "razorpay_enabled", value: true, description: "Enable Razorpay online payments at checkout" },
    { key: "razorpay_key_id", value: "", description: "Razorpay Key ID (from Razorpay dashboard → Settings → API Keys)" },
    { key: "razorpay_key_secret", value: "", description: "Razorpay Key Secret (keep this private)" },

    // Support & Notifications
    { key: "support_phone", value: "+911234567890", description: "Support phone" },
    { key: "support_email", value: "help@damndeal.com", description: "Support email" },
    { key: "support_whatsapp", value: "", description: "WhatsApp support number" },
    { key: "about_us_url", value: "", description: "About us page URL" },
    { key: "privacy_policy_url", value: "", description: "Privacy policy URL" },
    { key: "terms_url", value: "", description: "Terms & conditions URL" },
    { key: "instagram_url", value: "", description: "Instagram page URL" },
    { key: "fcm_enabled", value: true, description: "Push notifications enabled" },

    // Fast2SMS WhatsApp Notifications
    { key: "fast2sms_enabled", value: true, description: "Enable Fast2SMS WhatsApp transactional notifications" },
    { key: "fast2sms_api_key", value: "", description: "Fast2SMS API authorization key (Dashboard → Dev API → API Key)" },
    { key: "fast2sms_phone_number_id", value: "", description: "Fast2SMS Phone Number ID (Dashboard → WhatsApp → Numbers)" },
    { key: "fast2sms_tpl_order_confirm", value: "", description: "Template ID for Order Placed (vars: name | orderNo | item | amount | address)" },
    { key: "fast2sms_tpl_on_the_way", value: "", description: "Template ID for Order Shipped / On the way (vars: name | orderNo | trackingId | courier | eta)" },
    { key: "fast2sms_tpl_order_cancel", value: "", description: "Template ID for Order Cancelled (vars: name | orderNo | refundDays)" },

    // Branding — Logos & Identity
    { key: "brand_name", value: "DamnDeal", description: "Display name shown across the site (alt text, footer)" },
    { key: "brand_logo_url", value: "", description: "Light-mode header / mobile / desktop logo. Upload via the image picker. Leave empty to use bundled default." },
    { key: "brand_logo_dark_url", value: "", description: "Optional dark-background variant (used in footer). Leave empty to reuse light logo." },
    { key: "brand_favicon_url", value: "", description: "Favicon URL (browser tab icon)" },
    { key: "admin_brand_name", value: "Admin Panel", description: "Text shown in admin sidebar (top-left) when no admin logo is uploaded" },
    { key: "admin_logo_url", value: "", description: "Logo shown in admin sidebar (top-left). Recommended white/light PNG with transparent bg, ~200x60px (sidebar has dark background)." },

    // Company info / footer
    { key: "company_name", value: "DamnDeal India Private Limited", description: "Legal company name shown in footer & legal pages" },
    { key: "company_address", value: "", description: "Registered company address (footer + legal contact)" },
    { key: "support_phone_alt", value: "", description: "Secondary support phone (optional)" },

    // Legal pages (override the built-in static content with custom HTML)
    { key: "legal_privacy_html", value: "", description: "Custom HTML for Privacy Policy. Leave empty to use built-in default." },
    { key: "legal_terms_html", value: "", description: "Custom HTML for Terms & Conditions. Leave empty to use built-in default." },
    { key: "legal_refund_html", value: "", description: "Custom HTML for Refund Policy. Leave empty to use built-in default." },
    { key: "legal_vendor_html", value: "", description: "Custom HTML for Vendor / Partner Terms. Leave empty to use built-in default." },
  ];

  let seeded = 0;
  for (const d of defaults) {
    const exists = await AppSettings.findOne({ key: d.key });
    if (!exists) {
      await AppSettings.create(d);
      seeded++;
    }
  }

  return res.json({ success: true, message: `Seeded ${seeded} new settings (${defaults.length - seeded} already existed)` });
}

// POST /admin/settings/upload/:key — upload image for a setting
async function uploadSettingImage(req, res) {
  if (!req.file) return res.status(400).json({ success: false, message: "Image required" });
  const imagePath = `/uploads/settings/${req.file.filename}`;
  const setting = await AppSettings.findOneAndUpdate(
    { key: req.params.key },
    { value: imagePath, updatedBy: req.user.userId },
    { new: true, upsert: true }
  );
  return res.json({ success: true, setting });
}

// PUT /admin/app-customization/featured-card
async function upsertFeaturedCard(req, res) {
  const { subcategoryId } = req.body;
  if (!subcategoryId) return res.status(400).json({ success: false, message: "subcategoryId required" });

  // Build value object
  const existing = await AppSettings.findOne({ key: "featured_card" });
  const value = existing ? { ...existing.value } : {};
  value.subcategoryId = subcategoryId;
  if (req.file) {
    value.image = `/uploads/customization/${req.file.filename}`;
  }

  const setting = await AppSettings.findOneAndUpdate(
    { key: "featured_card" },
    { value, description: "Featured subcategory card on category page", updatedBy: req.user.userId },
    { new: true, upsert: true }
  );
  return res.json({ success: true, setting });
}

// DELETE /admin/app-customization/featured-card
async function deleteFeaturedCard(_req, res) {
  await AppSettings.findOneAndDelete({ key: "featured_card" });
  return res.json({ success: true, message: "Featured card removed" });
}

// POST /admin/settings/test-fast2sms { phone }
async function testFast2Sms(req, res) {
  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({ success: false, message: "phone required" });
  if (notificationService._invalidateFast2SmsCache) notificationService._invalidateFast2SmsCache();
  const out = await notificationService.sendTestWhatsApp(phone);
  return res.json(out);
}

module.exports = { getSettings, upsertSetting, deleteSetting, seedDefaults, uploadSettingImage, upsertFeaturedCard, deleteFeaturedCard, testFast2Sms };
