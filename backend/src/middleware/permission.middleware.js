// Staff permission + region enforcement for admin routes.
//
// role "admin"  → full access, every region.
// role "staff"  → must have the route's permission AND the request's region
//                 (x-region header) in their allowed regions.
//
// The Staff doc is read fresh on each request (cached on req) so revoking a
// permission or deactivating an account takes effect immediately, without
// waiting for the access token to expire.
const Staff = require("../models/Staff");

async function loadStaff(req) {
  if (req._staffLoaded) return req.staff;
  req._staffLoaded = true;
  req.staff = await Staff.findOne({ user: req.user.userId }).lean();
  return req.staff;
}

// Attaches req.staff for staff users and blocks deactivated accounts.
async function attachStaff(req, res, next) {
  try {
    if (req.user?.role !== "staff") return next();
    const staff = await loadStaff(req);
    if (!staff || staff.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Your staff account is inactive. Please contact the administrator.",
      });
    }
    // Region scope — admin panel sends x-region with every request
    const region = (req.region || "IN").toUpperCase();
    const allowed = Array.isArray(staff.regions) && staff.regions.length ? staff.regions : ["IN", "US"];
    if (!allowed.includes(region)) {
      return res.status(403).json({
        success: false,
        message: `You do not have access to the ${region} store. Switch the region selector to ${allowed.join(" / ")}.`,
      });
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

// Route guard: requirePermission("manage_orders")
function requirePermission(...required) {
  return async (req, res, next) => {
    try {
      if (req.user?.role === "admin") return next();
      if (req.user?.role !== "staff") {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
      const staff = await loadStaff(req);
      if (!staff || staff.isActive === false) {
        return res.status(403).json({ success: false, message: "Your staff account is inactive." });
      }
      const held = staff.permissions || [];
      const ok = required.some((p) => held.includes(p));
      if (!ok) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to access this section.",
        });
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { attachStaff, requirePermission };
