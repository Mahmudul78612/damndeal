/* Road Hustlers ERP — same-origin API client (served from the API itself at /erp). */
const API = (() => {
  const BASE = location.origin.includes('road-hustlers.com') || location.port === '6000'
    ? '/api'
    : 'https://api.road-hustlers.com/api';

  const tok = () => localStorage.getItem('rh_token') || '';

  async function req(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (tok()) headers['Authorization'] = 'Bearer ' + tok();
    const res = await fetch(BASE + path, { ...opts, headers });
    let body = null;
    try { body = await res.json(); } catch {}
    if (res.status === 401 && !path.includes('/auth/')) {
      // try refresh once
      const rt = localStorage.getItem('rh_refresh');
      if (rt) {
        const rr = await fetch(BASE + '/auth/refresh-token', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rt }),
        });
        const rb = await rr.json().catch(() => null);
        const nt = rb?.token || rb?.accessToken || rb?.data?.token;
        if (rr.ok && nt) {
          localStorage.setItem('rh_token', nt);
          if (rb.refreshToken) localStorage.setItem('rh_refresh', rb.refreshToken);
          return req(path, opts);
        }
      }
      localStorage.removeItem('rh_token');
      App.showLogin();
      throw new Error('Session expired — sign in again');
    }
    if (!res.ok || body?.success === false) {
      throw new Error(body?.error || body?.message || `HTTP ${res.status}`);
    }
    return body;
  }

  return {
    get: (p) => req(p),
    post: (p, b) => req(p, { method: 'POST', body: JSON.stringify(b || {}) }),
    put: (p, b) => req(p, { method: 'PUT', body: JSON.stringify(b || {}) }),
    patch: (p, b) => req(p, { method: 'PATCH', body: JSON.stringify(b || {}) }),
    del: (p) => req(p, { method: 'DELETE' }),
    setTokens: (t, r) => { if (t) localStorage.setItem('rh_token', t); if (r) localStorage.setItem('rh_refresh', r); },
    clear: () => { localStorage.removeItem('rh_token'); localStorage.removeItem('rh_refresh'); localStorage.removeItem('rh_user'); },
    hasToken: () => !!tok(),
  };
})();
