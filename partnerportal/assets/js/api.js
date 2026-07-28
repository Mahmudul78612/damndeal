// ========== DAMNDEAL PARTNER PORTAL — API HELPER ==========
async function api(endpoint, options = {}) {
  const url = CONFIG.API_BASE + endpoint;
  const headers = { 'x-client-type': CONFIG.CLIENT_TYPE };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  options.headers = { ...headers, ...options.headers };

  let res;
  try { res = await fetch(url, options); } catch { throw new Error('Network error. Check connection.'); }

  if (res.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      options.headers['Authorization'] = 'Bearer ' + getToken();
      res = await fetch(url, options);
    } else { logout(); throw new Error('Session expired'); }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed (' + res.status + ')');
  return data;
}

async function tryRefreshToken() {
  const refresh = getRefresh();
  if (!refresh) return false;
  try {
    const res = await fetch(CONFIG.API_BASE + '/auth/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh })
    });
    if (!res.ok) return false;
    const data = await res.json();
    setAuth(data);
    return true;
  } catch { return false; }
}

const API = {
  get:    (ep) => api(ep),
  post:   (ep, body) => api(ep, { method: 'POST', body }),
  put:    (ep, body) => api(ep, { method: 'PUT', body }),
  delete: (ep) => api(ep, { method: 'DELETE' }),
  upload: (ep, formData, method = 'POST') => api(ep, { method, body: formData })
};
