/**
 * Merchant-side roles for the coupon business portal.
 *
 * Deliberately the same shape as config/permissions.js (the platform staff
 * system) so there is one mental model in this codebase, not two.
 *
 * Scope is separate from role: a `manager` may be limited to two brands and a
 * `cashier` to a single outlet. Role says WHAT, scope says WHERE.
 */

const COUPON_PERMISSIONS = [
  { key: "view_dashboard", label: "Dashboard & analytics", group: "Insights" },
  { key: "manage_campaigns", label: "Create & edit coupons", group: "Coupons" },
  { key: "publish_campaigns", label: "Submit coupons for review", group: "Coupons" },
  { key: "redeem_codes", label: "Verify & redeem at the counter", group: "Counter" },
  { key: "manage_outlets", label: "Add & edit outlets", group: "Business" },
  { key: "manage_brands", label: "Edit brand profile", group: "Business" },
  { key: "manage_members", label: "Invite & manage team", group: "Business" },
  { key: "manage_billing", label: "Buy packs, invoices, credits", group: "Billing" },
  { key: "manage_api", label: "API keys & integrations", group: "Business" },
];

const COUPON_PERMISSION_KEYS = COUPON_PERMISSIONS.map((p) => p.key);

const COUPON_ROLES = {
  owner: {
    label: "Owner — full control of the company",
    permissions: COUPON_PERMISSION_KEYS,
  },
  manager: {
    label: "Manager — runs coupons and the counter",
    permissions: [
      "view_dashboard", "manage_campaigns", "publish_campaigns",
      "redeem_codes", "manage_outlets",
    ],
  },
  marketer: {
    label: "Marketer — creates offers, no counter, no billing",
    permissions: ["view_dashboard", "manage_campaigns", "publish_campaigns"],
  },
  cashier: {
    label: "Cashier — redeems codes at their outlet only",
    permissions: ["redeem_codes"],
  },
  accountant: {
    label: "Accountant — billing and reports only",
    permissions: ["view_dashboard", "manage_billing"],
  },
};

/** Roles that MUST be pinned to at least one outlet to make sense. */
const OUTLET_SCOPED_ROLES = new Set(["cashier"]);

function permissionsFor(role) {
  return COUPON_ROLES[role]?.permissions || [];
}

module.exports = {
  COUPON_PERMISSIONS,
  COUPON_PERMISSION_KEYS,
  COUPON_ROLES,
  OUTLET_SCOPED_ROLES,
  permissionsFor,
};
