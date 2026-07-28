const geoip = require("geoip-lite");

// Extract the real client IP (behind nginx use X-Forwarded-For).
function clientIp(req) {
  const xff = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  let ip = xff || req.socket?.remoteAddress || req.ip || "";
  // normalize IPv6-mapped IPv4 (::ffff:1.2.3.4) and localhost
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  if (ip === "::1") ip = "127.0.0.1";
  return ip;
}

// Resolve { ip, country, region(state), city } from a request.
// Callers may override with explicit ip/country/state query params (server-side calls).
function resolveLocation(req) {
  const q = req.query || {};
  const ip = q.ip || clientIp(req);

  // explicit override wins (useful when the calling app already knows the geo)
  if (q.country || q.state) {
    return { ip, country: (q.country || "").toUpperCase() || null, region: q.state || null, city: q.city || null };
  }

  const look = geoip.lookup(ip);
  if (!look) return { ip, country: null, region: null, city: null };
  return { ip, country: look.country || null, region: look.region || null, city: look.city || null };
}

module.exports = { clientIp, resolveLocation };
