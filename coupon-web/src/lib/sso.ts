/**
 * Single sign-on across damndeal.in and coupon.damndeal.in.
 *
 * Both sites talk to the same backend and accept the same JWT, but
 * localStorage is per-origin, so a shopper signed in on damndeal.in was asked
 * to sign in again on the coupon site. The session is therefore mirrored into
 * a cookie scoped to the parent domain (".damndeal.in"), which every subdomain
 * can read.
 *
 * Same exposure as the localStorage token it mirrors (readable by our own
 * scripts, sent only to our own hosts) — this widens it from one origin to our
 * own subdomains, nothing further.
 */

const COOKIE = 'dd_sso';

/** ".damndeal.in" from "coupon.damndeal.in"; null on localhost or an IP. */
function parentDomain(): string | null {
  if (typeof window === 'undefined') return null;
  const h = window.location.hostname;
  if (h === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(h)) return null;
  const parts = h.split('.');
  if (parts.length < 2) return null;
  return '.' + parts.slice(-2).join('.');   // damndeal.in / damndeal.com
}

export function writeSsoCookie(token: string, days = 30) {
  const domain = parentDomain();
  if (!domain || typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 86400000).toUTCString();
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie =
    `${COOKIE}=${encodeURIComponent(token)}; Domain=${domain}; Path=/; Expires=${expires}; SameSite=Lax${secure}`;
}

export function readSsoCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function clearSsoCookie() {
  const domain = parentDomain();
  if (!domain || typeof document === 'undefined') return;
  document.cookie = `${COOKIE}=; Domain=${domain}; Path=/; Max-Age=0; SameSite=Lax`;
}

/**
 * Adopt a session started on a sibling site.
 * Returns the token that should be used, or null if there is none.
 */
export function adoptSsoSession(): string | null {
  if (typeof window === 'undefined') return null;
  const local = localStorage.getItem('dd_token');
  if (local) {
    // Keep the cookie in step so the other site sees this session too.
    writeSsoCookie(local);
    return local;
  }
  const shared = readSsoCookie();
  if (shared) {
    localStorage.setItem('dd_token', shared);
    return shared;
  }
  return null;
}
