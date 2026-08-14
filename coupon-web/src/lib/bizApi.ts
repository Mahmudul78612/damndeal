/**
 * API client for the merchant console.
 *
 * Deliberately separate from lib/api.ts: a business session must not share
 * storage with a shopper session. A cashier signing in on a till device
 * should never be able to act as whichever customer last used that browser,
 * and an owner browsing coupons as a shopper should not lose their console
 * session. Different key, different client.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

const SERVER_API = process.env.NEXT_PUBLIC_API_URL || 'https://damndeal.in/api';
const API_BASE = typeof window !== 'undefined' ? '/proxy-api' : SERVER_API;

export const BIZ_TOKEN_KEY = 'dd_biz_token';
export const BIZ_REFRESH_KEY = 'dd_biz_refresh';

function region(): string {
  if (process.env.NEXT_PUBLIC_REGION) {
    return process.env.NEXT_PUBLIC_REGION.toUpperCase() === 'US' ? 'US' : 'IN';
  }
  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    if (h === 'damndeal.com' || h.endsWith('.damndeal.com')) return 'US';
  }
  return 'IN';
}

export function bizToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(BIZ_TOKEN_KEY);
}

export function setBizSession(accessToken?: string, refreshToken?: string) {
  if (typeof window === 'undefined') return;
  if (accessToken) localStorage.setItem(BIZ_TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(BIZ_REFRESH_KEY, refreshToken);
}

export function clearBizSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(BIZ_TOKEN_KEY);
  localStorage.removeItem(BIZ_REFRESH_KEY);
}

/**
 * Trade the stored refresh token for a fresh access token.
 *
 * Access tokens live 15 minutes, so without this a cashier who kept the
 * console open through a quiet hour was thrown back to the login screen on
 * their next tap. Member sessions are issued by the same token service as
 * shopper ones, so /auth/refresh-token accepts them unchanged.
 *
 * Concurrent 401s share one refresh call — a page that fires several requests
 * at once must not burn (and rotate away) the refresh token several times.
 */
let refreshing: Promise<string | null> | null = null;

async function refreshBizToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (refreshing) return refreshing;

  refreshing = (async () => {
    const refreshToken = localStorage.getItem(BIZ_REFRESH_KEY);
    if (!refreshToken) return null;
    try {
      const res = await fetch(`${API_BASE}/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data?.accessToken) return null;
      setBizSession(data.accessToken, data.refreshToken);
      return data.accessToken as string;
    } catch {
      return null;
    } finally {
      // Let the next 401 start a fresh attempt rather than reusing this result
      setTimeout(() => { refreshing = null; }, 0);
    }
  })();

  return refreshing;
}

function bounceToLogin(message?: string): Error {
  clearBizSession();
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/business/login')) {
    window.location.href = '/business/login';
  }
  return new Error(message || 'Please sign in again');
}

async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-client-type': 'web',
    'x-region': region(),
    ...((options.headers as Record<string, string>) || {}),
  };
  const t = bizToken();
  if (t) headers['Authorization'] = `Bearer ${t}`;

  let res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  let body = await res.json().catch(() => null);

  if (res.status === 401) {
    const refreshed = await refreshBizToken();
    if (!refreshed) throw bounceToLogin(body?.message);
    headers['Authorization'] = `Bearer ${refreshed}`;
    res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    body = await res.json().catch(() => null);
    if (res.status === 401) throw bounceToLogin(body?.message);
  }
  if (!res.ok || body?.success === false) {
    const err = new Error(body?.message || `Request failed (${res.status})`);
    (err as any).code = body?.code;
    (err as any).status = res.status;
    throw err;
  }
  return body;
}

export const biz = {
  get: <T = any>(url: string) => request<T>(url),
  post: <T = any>(url: string, data?: any) =>
    request<T>(url, { method: 'POST', body: JSON.stringify(data ?? {}) }),
  put: <T = any>(url: string, data?: any) =>
    request<T>(url, { method: 'PUT', body: JSON.stringify(data ?? {}) }),
  patch: <T = any>(url: string, data?: any) =>
    request<T>(url, { method: 'PATCH', body: JSON.stringify(data ?? {}) }),
  del: <T = any>(url: string) => request<T>(url, { method: 'DELETE' }),
  upload: async <T = any>(url: string, formData: FormData): Promise<T> => {
    const headers: Record<string, string> = { 'x-client-type': 'web', 'x-region': region() };
    const t = bizToken();
    if (t) headers['Authorization'] = `Bearer ${t}`;

    let res = await fetch(`${API_BASE}${url}`, { method: 'POST', headers, body: formData });
    if (res.status === 401) {
      const refreshed = await refreshBizToken();
      if (!refreshed) throw bounceToLogin();
      headers['Authorization'] = `Bearer ${refreshed}`;
      res = await fetch(`${API_BASE}${url}`, { method: 'POST', headers, body: formData });
    }

    const body = await res.json().catch(() => null);
    if (!res.ok || body?.success === false) throw new Error(body?.message || 'Upload failed');
    return body;
  },
};

export const CURRENCY = region() === 'US' ? '$' : '₹';
