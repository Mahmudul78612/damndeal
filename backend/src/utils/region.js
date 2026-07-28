// Region-scoped Mongo filter helpers.
// Use these on every USER-facing Product query so .com (US) never sees IN-only
// products and vice-versa. Admin endpoints keep their own opt-in filter.

function regionFilter(req) {
  const r = (req && req.region) || "IN";
  return { regions: r };
}

// Returns true if a single product doc is visible in the request's region.
function productVisibleInRegion(product, req) {
  const r = (req && req.region) || "IN";
  const regions = (product && product.regions) || ["IN"];
  return Array.isArray(regions) ? regions.includes(r) : regions === r;
}

// Parses regions from incoming admin form body. Accepts:
//   - JSON string '["IN","US"]'
//   - CSV string "IN,US"
//   - array ["IN","US"]
// Returns sanitized array of valid regions, or null if input was empty/invalid.
function parseRegionsInput(input) {
  if (input == null || input === "") return null;
  let arr = input;
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed.startsWith("[")) {
      try { arr = JSON.parse(trimmed); } catch (_) { arr = trimmed.split(","); }
    } else {
      arr = trimmed.split(",");
    }
  }
  if (!Array.isArray(arr)) return null;
  const valid = arr.map((s) => String(s).trim().toUpperCase()).filter((s) => s === "IN" || s === "US");
  return valid.length ? Array.from(new Set(valid)) : null;
}

// Resolve the region filter for admin LIST endpoints.
// - explicit ?region=US wins
// - falls back to req.region (from x-region header)
// - '?region=all' or 'ALL' bypasses (returns null = no filter)
// - default 'IN' so existing data behaves the same
function adminListRegionFilter(req) {
  const q = req?.query?.region;
  const explicit = q ? String(q).trim().toUpperCase() : null;
  if (explicit === "ALL") return null;
  const r = explicit || (req && req.region) || "IN";
  if (r !== "IN" && r !== "US") return null;
  return { regions: r };
}

module.exports = { regionFilter, productVisibleInRegion, parseRegionsInput, adminListRegionFilter };
