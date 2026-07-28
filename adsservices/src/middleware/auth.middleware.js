const { verifyAccess } = require("../utils/jwt");

function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, message: "Authentication required" });
  try {
    req.auth = verifyAccess(token);
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ success: false, message: "Forbidden — insufficient permissions" });
    }
    next();
  };
}

const staffOnly = authorize("staff", "admin");
const adminOnly = authorize("admin");
const advertiserOnly = authorize("advertiser");
const publisherOnly = authorize("publisher");

module.exports = { authenticate, authorize, staffOnly, adminOnly, advertiserOnly, publisherOnly };
