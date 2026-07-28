/**
 * Server-side (SSR) API helper — resolves region from the request host so
 * coupon.damndeal.com renders US ($) and coupon.damndeal.in renders IN (₹).
 */
import { headers, cookies } from "next/headers";

const INTERNAL_API =
  process.env.API_INTERNAL_URL ||
  (process.env.NODE_ENV === "production" ? "http://127.0.0.1:5000/api" : "https://damndeal.in/api");

export async function serverRegion(): Promise<"IN" | "US"> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") || h.get("host") || "").toLowerCase();
  return host.includes("damndeal.com") ? "US" : "IN";
}

/** Location cookies (set by the client picker) → query string for filtered endpoints. */
async function locQS(): Promise<string> {
  try {
    const c = await cookies();
    const p = new URLSearchParams();
    const state = c.get("dd_state")?.value;
    const lat = c.get("dd_lat")?.value;
    const lng = c.get("dd_lng")?.value;
    const rad = c.get("dd_rad")?.value;
    if (state) p.set("state", state);
    if (lat && lng) { p.set("lat", lat); p.set("lng", lng); p.set("radius", rad || "25"); }
    const s = p.toString();
    return s ? `&${s}` : "";
  } catch { return ""; }
}

const LOC_FILTERED = ["/coupons/home", "/coupons/list", "/coupons/spin"];

export async function apiServer<T = Record<string, unknown>>(path: string): Promise<T | null> {
  const region = await serverRegion();
  let url = `${INTERNAL_API}${path}`;
  if (LOC_FILTERED.some((p) => path.startsWith(p))) {
    const qs = await locQS();
    if (qs) url += (path.includes("?") ? "" : "?x=1") + qs;
  }
  try {
    const res = await fetch(url, {
      headers: { "x-region": region },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const currencyFor = (region: "IN" | "US") => (region === "US" ? "$" : "₹");
