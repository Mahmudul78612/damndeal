const SERVER_API = process.env.NEXT_PUBLIC_API_URL || 'https://damndeal.in/api';
const API_BASE = typeof window !== 'undefined' ? '/proxy-api' : SERVER_API;

interface FetchOptions extends RequestInit {
  token?: string;
}

async function request<T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-client-type': 'web',
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
