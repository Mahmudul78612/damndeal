// Staff permission catalog + role presets.
//
// One permission per admin module. The admin panel renders its checkboxes and
// hides sidebar items from this same list, so adding a module here is the only
// place a new capability needs to be declared.

const PERMISSIONS = [
  // Main
  { key: "view_dashboard", label: "Dashboard", group: "Main" },
  { key: "view_analytics", label: "Analytics", group: "Main" },
  // Catalog
  { key: "manage_categories", label: "Categories", group: "Catalog" },
  { key: "manage_products", label: "Products", group: "Catalog" },
  { key: "manage_reviews", label: "Product Reviews", group: "Catalog" },
  { key: "manage_cj", label: "CJ Dropshipping", group: "Catalog" },
  { key: "manage_offers", label: "Offers", group: "Catalog" },
  { key: "manage_coupons", label: "Coupons", group: "Catalog" },
  { key: "manage_coupon_market", label: "Coupon Marketplace", group: "Catalog" },
  { key: "manage_banners", label: "Banners", group: "Catalog" },
  // Business
  { key: "manage_partners", label: "Partners", group: "Business" },
  { key: "manage_kyc", label: "KYC Requests", group: "Business" },
  { key: "manage_orders", label: "Orders", group: "Business" },
  { key: "manage_shipping", label: "Shipping", group: "Business" },
  { key: "manage_ddgo_stores", label: "DDGo Stores", group: "Business" },
  { key: "manage_returns", label: "Returns", group: "Business" },
  { key: "manage_payouts", label: "Payouts", group: "Business" },
  // Users
  { key: "manage_delivery", label: "Delivery Boys", group: "Users" },
  { key: "manage_staff", label: "Staff & Roles", group: "Users" },
  { key: "manage_wallets", label: "Wallets", group: "Users" },
  // Engagement
  { key: "manage_tickets", label: "Support Tickets", group: "Engagement" },
  { key: "manage_subscriptions", label: "Subscriptions", group: "Engagement" },
  { key: "manage_notifications", label: "Notifications", group: "Engagement" },
  { key: "manage_magic_pools", label: "Magic Pools", group: "Engagement" },
  { key: "manage_investors", label: "Investors", group: "Engagement" },
  // System
  { key: "view_reports", label: "Reports", group: "System" },
  { key: "view_security", label: "Security & OTP protection", group: "System" },
  { key: "manage_settings", label: "Settings", group: "System" },
  { key: "manage_homepage", label: "Home Layouts & App Customization", group: "System" },
];

const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

// Ready-made roles. "custom" lets the admin tick individual permissions.
const ROLE_PRESETS = {
  manager: {
    label: "Manager (almost everything, no staff/settings)",
    permissions: PERMISSION_KEYS.filter(
      (k) => !["manage_staff", "manage_settings"].includes(k)
    ),
  },
  operations: {
    label: "Operations (orders, shipping, returns)",
    permissions: [
      "view_dashboard", "manage_orders", "manage_shipping", "manage_returns",
      "manage_delivery", "manage_tickets",
    ],
  },
  catalog: {
    label: "Catalog Manager (products & content)",
    permissions: [
      "view_dashboard", "manage_categories", "manage_products", "manage_reviews",
      "manage_cj", "manage_offers", "manage_banners", "manage_homepage",
    ],
  },
  support: {
    label: "Customer Support (tickets, orders, returns)",
    permissions: ["view_dashboard", "manage_tickets", "manage_orders", "manage_returns"],
  },
  finance: {
    label: "Finance (payouts, wallets, reports)",
    permissions: ["view_dashboard", "view_analytics", "manage_payouts", "manage_wallets", "view_reports"],
  },
  marketing: {
    label: "Marketing (coupons, offers, notifications, layouts)",
    permissions: [
      "view_dashboard", "view_analytics", "manage_offers", "manage_coupons",
      "manage_coupon_market", "manage_banners", "manage_notifications",
      "manage_magic_pools", "manage_homepage",
    ],
  },
  custom: { label: "Custom (pick permissions manually)", permissions: [] },
};

module.exports = { PERMISSIONS, PERMISSION_KEYS, ROLE_PRESETS };
