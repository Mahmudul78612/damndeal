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

async function tryRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem('dd_refresh');
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      localStorage.removeItem('dd_token');
      localStorage.removeItem('dd_refresh');
      return null;
    }
    const data = await res.json();
    localStorage.setItem('dd_token', data.accessToken);
    localStorage.setItem('dd_refresh', data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
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

// Multipart upload — browser sets the Content-Type boundary itself.
//
// This refreshes on 401 exactly like request() does. Without it an upload was
// the only call that could not survive an expired access token, so a merchant
// who left the portal open long enough got "Invalid or expired token" the
// moment they attached an image, while every other action kept working.
async function uploadRequest<T = any>(endpoint: string, formData: FormData): Promise<T> {
  const headers: Record<string, string> = { 'x-client-type': 'web', 'x-region': REGION };
  const stored = typeof window !== 'undefined' ? localStorage.getItem('dd_token') : null;
  if (stored) headers['Authorization'] = `Bearer ${stored}`;

  let res = await fetch(`${API_BASE}${endpoint}`, { method: 'POST', headers, body: formData });

  if (res.status === 401 && typeof window !== 'undefined') {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${refreshed}`;
      res = await fetch(`${API_BASE}${endpoint}`, { method: 'POST', headers, body: formData });
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Upload failed' }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  get: <T = any>(url: string, opts?: FetchOptions) => cachedGet<T>(url, opts),
  post: <T = any>(url: string, body?: unknown, opts?: FetchOptions) =>
    request<T>(url, { method: 'POST', body: JSON.stringify(body), ...opts }),
  put: <T = any>(url: string, body?: unknown, opts?: FetchOptions) =>
    request<T>(url, { method: 'PUT', body: JSON.stringify(body), ...opts }),
  patch: <T = any>(url: string, body?: unknown, opts?: FetchOptions) =>
    request<T>(url, { method: 'PATCH', body: JSON.stringify(body), ...opts }),
  delete: <T = any>(url: string, opts?: FetchOptions) => request<T>(url, { method: 'DELETE', ...opts }),
  upload: <T = any>(url: string, formData: FormData) => uploadRequest<T>(url, formData),
};

export const imgUrl = (path?: string) => {
  if (!path) return '/placeholder.png';
  if (path.startsWith('http')) return path;
  // In browser, use relative path (proxied via rewrites); on server use full URL
  if (typeof window !== 'undefined') return path;
  return `${SERVER_API.replace('/api', '')}${path}`;
};

/** Location chosen in the picker → query params for client fetches. */
export function locQSClient(): string {
  if (typeof window === 'undefined') return '';
  try {
    const l = JSON.parse(localStorage.getItem('dd_loc') || '{}');
    const p = new URLSearchParams();
    if (l.state) p.set('state', l.state);
    if (l.lat != null && l.lng != null) { p.set('lat', String(l.lat)); p.set('lng', String(l.lng)); p.set('radius', String(l.radius || 25)); }
    const s = p.toString();
    return s ? '?' + s : '';
  } catch { return ''; }
}
