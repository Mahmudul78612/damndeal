/**
 * Single sign-on across damndeal.in and coupon.damndeal.in.
 *
 * Both sites talk to the same backend and accept the same JWT, but
 * localStorage is per-origin, so a shopper signed in on damndeal.in was asked
 * to sign in again on the coupon site. The session is therefore mirrored into
 * a cookie scoped to the parent domain (".damndeal.in"), which every subdomain
 * can read.
 *
 * The cookie carries BOTH tokens. Carrying only the access token looked fine
 * for fifteen minutes and then broke: the sibling site had nothing to refresh
 * with, so every call started failing with "Invalid or expired token" while
 * the UI still believed it was signed in. The refresh token is what makes an
 * adopted session survive on its own.
 *
 * Same exposure as the localStorage tokens it mirrors (readable by our own
 * scripts, sent only to our own hosts) — this widens it from one origin to our
 * own subdomains, nothing further.
 */

const COOKIE = 'dd_sso';

export interface SsoSession {
  access: string;
  refresh: string;
}

/** ".damndeal.in" from "coupon.damndeal.in"; null on localhost or an IP. */
function parentDomain(): string | null {
  if (typeof window === 'undefined') return null;
  const h = window.location.hostname;
  if (h === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(h)) return null;
  const parts = h.split('.');
  if (parts.length < 2) return null;
  return '.' + parts.slice(-2).join('.');   // damndeal.in / damndeal.com
}

/** Cookie expiry follows the refresh token (30d), not the access token. */
export function writeSsoCookie(access: string, refresh?: string, days = 30) {
  const domain = parentDomain();
  if (!domain || typeof document === 'undefined' || !access) return;
  const value = encodeURIComponent(JSON.stringify({ a: access, r: refresh || '' }));
  const expires = new Date(Date.now() + days * 86400000).toUTCString();
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie =
    `${COOKIE}=${value}; Domain=${domain}; Path=/; Expires=${expires}; SameSite=Lax${secure}`;
}

export function readSsoCookie(): SsoSession | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]*)`));
  if (!m) return null;
  const raw = decodeURIComponent(m[1]);
  // Cookies written before this carried a bare access token. Still honoured,
  // and upgraded to the pair on the next login or refresh.
  if (!raw.startsWith('{')) return raw ? { access: raw, refresh: '' } : null;
  try {
    const p = JSON.parse(raw);
    return p?.a ? { access: p.a, refresh: p.r || '' } : null;
  } catch {
    return null;
  }
}

export function clearSsoCookie() {
  const domain = parentDomain();
  if (!domain || typeof document === 'undefined') return;
  document.cookie = `${COOKIE}=; Domain=${domain}; Path=/; Max-Age=0; SameSite=Lax`;
}

/**
 * Adopt a session started on a sibling site.
 * Returns the access token that should be used, or null if there is none.
 */
export function adoptSsoSession(): string | null {
  if (typeof window === 'undefined') return null;

  const local = localStorage.getItem('dd_token');
  const localRefresh = localStorage.getItem('dd_refresh') || '';
  if (local) {
    // Keep the cookie in step so the other site sees this session too.
    writeSsoCookie(local, localRefresh);
    return local;
  }

  const shared = readSsoCookie();
  if (!shared) return null;
  localStorage.setItem('dd_token', shared.access);
  if (shared.refresh) localStorage.setItem('dd_refresh', shared.refresh);
  return shared.access;
}

/**
 * Called from the API client after a refresh, so the cookie never holds a
 * token the other site cannot use.
 */
export function syncSsoCookie() {
  if (typeof window === 'undefined') return;
  const access = localStorage.getItem('dd_token');
  if (!access) { clearSsoCookie(); return; }
  writeSsoCookie(access, localStorage.getItem('dd_refresh') || '');
}
