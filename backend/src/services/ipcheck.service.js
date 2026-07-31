// IP trust checks for OTP protection.
//
// Blocks OTP sends from datacenter/VPS/proxy IPs (rented bot infrastructure)
// and from outside allowed countries. Real users come from mobile/broadband
// ISPs; SMS-pump attackers rent cloud servers.
//
// Datacenter ranges come from a local CIDR list file (one CIDR per line),
// refreshed weekly on the server via cron from the community-maintained
// X4BNet lists_vpn project. Everything FAILS OPEN: missing file, unknown IP,
// or unknown country never blocks a real user.
const fs = require("fs");
const path = require("path");

const LIST_PATH =
  process.env.DATACENTER_IP_LIST ||
  path.join(__dirname, "../../data/datacenter-ipv4.txt");
const RELOAD_MS = 24 * 60 * 60 * 1000;

let ranges = []; // sorted [startInt, endInt] pairs

function ipToInt(ip) {
  const m = String(ip || "").match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const a = +m[1], b = +m[2], c = +m[3], d = +m[4];
  if (a > 255 || b > 255 || c > 255 || d > 255) return null;
  return a * 16777216 + b * 65536 + c * 256 + d;
}

function loadList() {
  try {
    const txt = fs.readFileSync(LIST_PATH, "utf8");
    const out = [];
    for (const line of txt.split(/\r?\n/)) {
      const s = line.trim();
      if (!s || s.startsWith("#")) continue;
      const [ip, prefixStr] = s.split("/");
      const base = ipToInt(ip);
      if (base === null) continue;
      const prefix = prefixStr === undefined ? 32 : parseInt(prefixStr, 10);
      if (!(prefix >= 0 && prefix <= 32)) continue;
      const size = Math.pow(2, 32 - prefix);
      const start = Math.floor(base / size) * size;
      out.push([start, start + size - 1]);
    }
    out.sort((x, y) => x[0] - y[0]);
    ranges = out;
    console.log(`[IPCHECK] Loaded ${ranges.length} datacenter IP ranges`);
  } catch {
    ranges = []; // list absent → datacenter check disabled (fail-open)
  }
}

loadList();
setInterval(loadList, RELOAD_MS).unref();

function isPrivateIp(ip) {
  return /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|::ffff:127\.|fc|fe80)/i.test(
    String(ip || "")
  );
}

function isDatacenterIp(ip) {
  const n = ipToInt(String(ip || "").replace(/^::ffff:/i, ""));
  if (n === null || !ranges.length) return false;
  let lo = 0, hi = ranges.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (ranges[mid][0] <= n) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans >= 0 && n <= ranges[ans][1];
}

// Returns ISO country code ("IN", "US", …) or null when unknown.
function countryOf(ip) {
  try {
    const geoip = require("geoip-lite");
    const hit = geoip.lookup(String(ip || "").replace(/^::ffff:/i, ""));
    return (hit && hit.country) || null;
  } catch {
    return null;
  }
}

module.exports = { isDatacenterIp, isPrivateIp, countryOf };
