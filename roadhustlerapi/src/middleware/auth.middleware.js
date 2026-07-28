const { verifyAccess } = require("../utils/jwt");

// Authenticates any logged-in principal (staff/admin OR customer).
// Sets req.auth = { id, role }.
function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }
  try {
    req.auth = verifyAccess(token);
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

// Like authenticate but never blocks — sets req.auth if a valid token is present.
function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) {
    try { req.auth = verifyAccess(token); } catch { /* ignore — treat as guest */ }
  }
  next();
}

// Restrict to specific roles. Usage: authorize("admin","manager")
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ success: false, message: "Forbidden — insufficient permissions" });
    }
    next();
  };
}

// Convenience: any internal staff (not customer)
const staffOnly = authorize("staff", "manager", "admin");
// Manager-level and up (advisors + owner)
const managerOnly = authorize("manager", "admin");
// Owner only
const adminOnly = authorize("admin");
// Customer portal
const customerOnly = authorize("customer");

module.exports = { authenticate, optionalAuth, authorize, staffOnly, managerOnly, adminOnly, customerOnly };
