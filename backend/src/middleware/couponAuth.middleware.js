/**
 * Merchant-portal authorisation.
 *
 * Resolves WHO is acting (a CouponMember), WHAT they may do (role → permissions)
 * and WHERE (scope of brands / outlets). Membership is read on every request so
 * revoking a role or disabling a member takes effect immediately rather than
 * when the access token happens to expire.
 *
 * Backwards compatibility: merchants who signed up before the org model exists
 * as CouponVendor.user. If no CouponMember is found, that legacy owner is
 * treated as the owner of their own brand, so nothing breaks mid-migration.
 */
const { CouponMember, CouponOrg, CouponOutlet } = require("../models/couponOrg.models");
const { CouponVendor } = require("../models/coupon.models");
const { permissionsFor } = require("../config/couponPermissions");

/** Loads req.couponMember + req.couponPerms. Never rejects on its own. */
async function attachCouponMember(req, res, next) {
  try {
    if (req._couponMemberLoaded) return next();
    req._couponMemberLoaded = true;

    let member = null;
    if (req.user?.memberId) {
      member = await CouponMember.findById(req.user.memberId).lean();
    }
    if (!member && req.user?.userId) {
      member = await CouponMember.findOne({ user: req.user.userId, status: "active" }).lean();
    }

    if (member) {
      if (member.status !== "active") {
        return res.status(403).json({
          success: false,
          message: "Your access to this business has been disabled. Contact the owner.",
        });
      }
      const org = await CouponOrg.findById(member.org).lean();
      if (!org || org.status === "suspended") {
        return res.status(403).json({ success: false, message: "This business account is suspended." });
      }
      req.couponMember = member;
      req.couponOrg = org;
      req.couponPerms = permissionsFor(member.role);
      return next();
    }

    // Legacy owner: no membership row, but they own a brand directly.
    const brand = await CouponVendor.findOne({ user: req.user?.userId }).select("_id org").lean();
    if (brand) {
      req.couponMember = {
        _id: null, org: brand.org || null, user: req.user.userId,
        role: "owner", scope: { brands: [], outlets: [] }, status: "active", legacy: true,
      };
      req.couponPerms = permissionsFor("owner");
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

/** Route guard: requireCouponPermission("manage_campaigns") */
function requireCouponPermission(...required) {
  return async (req, res, next) => {
    try {
      if (!req._couponMemberLoaded) {
        await new Promise((resolve, reject) =>
          attachCouponMember(req, res, (e) => (e ? reject(e) : resolve()))
        );
        if (res.headersSent) return;
      }
      if (!req.couponMember) {
        return res.status(404).json({
          success: false, needsRegistration: true,
          message: "No business account found — register your business first.",
        });
      }
      const held = req.couponPerms || [];
      if (!required.some((p) => held.includes(p))) {
        return res.status(403).json({
          success: false,
          message: "Your role does not allow this action.",
        });
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

/**
 * Which brands may this member act on?
 * Empty scope.brands = every brand in the org.
 * Returns an array of brand ids (may be empty for a brand-less org).
 */
async function brandsInScope(req) {
  const m = req.couponMember;
  if (!m) return [];
  if (m.scope?.brands?.length) return m.scope.brands.map(String);
  const filter = m.org ? { org: m.org } : { user: m.user };
  const rows = await CouponVendor.find(filter).select("_id").lean();
  return rows.map((r) => String(r._id));
}

/**
 * Resolve the brand a request is acting on.
 * `?brandId=` (or body.brandId) picks one explicitly; otherwise the member's
 * single in-scope brand is used. Returns null and sends the response on error.
 */
async function resolveBrand(req, res) {
  const ids = await brandsInScope(req);
  if (!ids.length) {
    res.status(404).json({
      success: false, needsRegistration: true,
      message: "No brand found for your business — create one first.",
    });
    return null;
  }
  const wanted = String(req.query.brandId || req.body?.brandId || "");
  if (wanted) {
    if (!ids.includes(wanted)) {
      res.status(403).json({ success: false, message: "You do not have access to that brand." });
      return null;
    }
    return CouponVendor.findById(wanted);
  }
  if (ids.length > 1) {
    // Ambiguous on purpose: the portal always sends brandId once a company
    // has more than one brand, so silently picking one would hide mistakes.
    res.status(400).json({
      success: false, code: "BRAND_REQUIRED", brands: ids,
      message: "Choose which brand you are working on.",
    });
    return null;
  }
  return CouponVendor.findById(ids[0]);
}

/**
 * Enforce outlet scope. A cashier pinned to one shop must not redeem for
 * another, even if the code belongs to the same brand.
 * Returns true when allowed.
 */
function outletInScope(req, outletId) {
  const scoped = req.couponMember?.scope?.outlets || [];
  if (!scoped.length) return true;              // org/brand-wide member
  if (!outletId) return false;                  // scoped member must name an outlet
  return scoped.map(String).includes(String(outletId));
}

/** The outlet a scoped member is acting at (first pinned outlet). */
async function defaultOutlet(req) {
  const scoped = req.couponMember?.scope?.outlets || [];
  if (!scoped.length) return null;
  return CouponOutlet.findById(scoped[0]).lean();
}

module.exports = {
  attachCouponMember,
  requireCouponPermission,
  brandsInScope,
  resolveBrand,
  outletInScope,
  defaultOutlet,
};
