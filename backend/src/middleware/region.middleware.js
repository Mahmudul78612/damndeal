// Resolves req.region from (in priority order):
//   1. X-Region header (set by apps / admin region switcher)
//   2. Hostname (damndeal.com / *.com → US, else IN)
//   3. Authenticated user's preferredRegion (if loaded later)
//   4. Fallback: 'IN'
//
// Region is then available as req.region throughout downstream handlers.
// Keep the surface tiny — never throw, never block. Default 'IN' is always safe.

const VALID_REGIONS = ["IN", "US"];

function detectRegion(req) {
  const hdr = (req.headers["x-region"] || "").toString().toUpperCase().trim();
  if (VALID_REGIONS.includes(hdr)) return hdr;

  const host = (req.hostname || "").toLowerCase();
  if (host.endsWith(".com") || host === "damndeal.com") return "US";

  return "IN";
}

function regionMiddleware(req, _res, next) {
  req.region = detectRegion(req);
  next();
}

module.exports = { regionMiddleware, VALID_REGIONS };
