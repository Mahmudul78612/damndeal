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

async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-client-type': 'web',
    'x-region': region(),
    ...((options.headers as Record<string, string>) || {}),
  };
  const t = bizToken();
  if (t) headers['Authorization'] = `Bearer ${t}`;

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const body = await res.json().catch(() => null);

  if (res.status === 401) {
    clearBizSession();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/business/login')) {
      window.location.href = '/business/login';
    }
    throw new Error(body?.message || 'Please sign in again');
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
    const res = await fetch(`${API_BASE}${url}`, { method: 'POST', headers, body: formData });
    const body = await res.json().catch(() => null);
    if (!res.ok || body?.success === false) throw new Error(body?.message || 'Upload failed');
    return body;
  },
};

export const CURRENCY = region() === 'US' ? '$' : '₹';
