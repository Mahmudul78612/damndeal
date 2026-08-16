import { clearSsoCookie, syncSsoCookie } from './sso';

const SERVER_API = process.env.NEXT_PUBLIC_API_URL || 'https://damndeal.in/api';
const API_BASE = typeof window !== 'undefined' ? '/proxy-api' : SERVER_API;

// Detect region: env var wins, then browser hostname, then default IN
function detectRegion(): string {
  const env = process.env.NEXT_PUBLIC_REGION;
  if (env) return env.toUpperCase() === 'US' ? 'US' : 'IN';
  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    if (h === 'damndeal.com' || h.endsWith('.damndeal.com')) return 'US';
  }
  return 'IN';
}

const REGION = detectRegion();

// Exposed for UI (currency symbol, payment gateway choice).
export function getRegion(): string {
  return REGION;
}
export const IS_US = REGION === 'US';
export const CURRENCY_SYMBOL = REGION === 'US' ? '$' : '₹';

interface FetchOptions extends RequestInit {
  token?: string;
}


/**
 * Stable per-browser id + the moment this tab was opened.
 *
 * These are anti-abuse signals for OTP requests, not tracking: the server uses
 * them to notice one browser asking for many different phone numbers, or a
 * form submitted faster than a human can type. Both degrade gracefully — the
 * server has its own network-level checks when a client sends neither.
 */
const TAB_OPENED_AT = Date.now();
function deviceId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = localStorage.getItem('dd_did');
    if (!id) {
      id = (crypto?.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, '').slice(0, 32);
      localStorage.setItem('dd_did', id);
    }
    return id;
  } catch {
    return '';
  }
}

async function request<T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-client-type': 'web',
    ...(typeof window !== 'undefined' ? { 'x-device-id': deviceId(), 'x-form-opened': String(TAB_OPENED_AT) } : {}),
    'x-region': REGION,
    ...(customHeaders as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('dd_token');
    if (stored) headers['Authorization'] = `Bearer ${stored}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, { headers, ...rest });

  if (res.status === 401 && typeof window !== 'undefined') {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${refreshed}`;
      const retry = await fetch(`${API_BASE}${endpoint}`, { headers, ...rest });
      if (!retry.ok) throw new Error((await retry.json()).message || 'Request failed');
      return retry.json();
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }

  return res.json();
}

/**
 * Swap the refresh token for a fresh access token.
 *
 * Three things beyond the obvious:
 *  - concurrent 401s share one call, so a page that fires several requests at
 *    once cannot rotate the refresh token out from under itself;
 *  - the SSO cookie is rewritten on success, so the sibling site never adopts
 *    a token that has already been replaced;
 *  - a session that cannot be refreshed is cleared and announced, so the UI
 *    can ask for a sign-in instead of showing "Invalid or expired token"
 *    against a page that still looks signed in.
 */
let refreshing: Promise<string | null> | null = null;

function endSession() {
  localStorage.removeItem('dd_token');
  localStorage.removeItem('dd_refresh');
  clearSsoCookie();
  window.dispatchEvent(new Event('dd:session-expired'));
}

async function tryRefresh(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (refreshing) return refreshing;

  refreshing = (async () => {
    const refreshToken = localStorage.getItem('dd_refresh');
    // No refresh token means this session was adopted from an older SSO cookie
    // that only carried an access token. Nothing to renew — end it cleanly.
    if (!refreshToken) {
      if (localStorage.getItem('dd_token')) endSession();
      return null;
    }
    try {
      const res = await fetch(`${API_BASE}/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) { endSession(); return null; }
      const data = await res.json();
      if (!data?.accessToken) { endSession(); return null; }
      localStorage.setItem('dd_token', data.accessToken);
      if (data.refreshToken) localStorage.setItem('dd_refresh', data.refreshToken);
      syncSsoCookie();
      return data.accessToken as string;
    } catch {
      // A network blip must not sign anyone out — keep the session and let the
      // caller surface the failure.
      return null;
    } finally {
      setTimeout(() => { refreshing = null; }, 0);
    }
  })();

  return refreshing;
}

// Simple in-flight deduplication for GET requests (prevents duplicate simultaneous calls)
const inflight = new Map<string, Promise<any>>();

function cachedGet<T = any>(url: string, opts?: FetchOptions): Promise<T> {
  const key = url;
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = request<T>(url, { method: 'GET', ...opts }).finally(() => {
    // Remove from cache after a short delay to batch near-simultaneous calls
    setTimeout(() => inflight.delete(key), 2000);
  });
  inflight.set(key, p);
  return p;
}

export const api = {
  get: <T = any>(url: string, opts?: FetchOptions) => cachedGet<T>(url, opts),
  post: <T = any>(url: string, body?: unknown, opts?: FetchOptions) =>
    request<T>(url, { method: 'POST', body: JSON.stringify(body), ...opts }),
  put: <T = any>(url: string, body?: unknown, opts?: FetchOptions) =>
    request<T>(url, { method: 'PUT', body: JSON.stringify(body), ...opts }),
  delete: <T = any>(url: string, opts?: FetchOptions) => request<T>(url, { method: 'DELETE', ...opts }),
};

export const imgUrl = (path?: string) => {
  if (!path) return '/placeholder.png';
  if (path.startsWith('http')) return path;
  // In browser, use relative path (proxied via rewrites); on server use full URL
  if (typeof window !== 'undefined') return path;
  return `${SERVER_API.replace('/api', '')}${path}`;
};
