// Shared API client + auth helpers (used by both admin & advertiser portals).
const TOKEN_KEY = CONFIG.CLIENT_TYPE + "_token";
const REFRESH_KEY = CONFIG.CLIENT_TYPE + "_refresh";
const USER_KEY = CONFIG.CLIENT_TYPE + "_user";

function setSession(res) {
  localStorage.setItem(TOKEN_KEY, res.accessToken);
  localStorage.setItem(REFRESH_KEY, res.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(res.user));
}
function getToken() { return localStorage.getItem(TOKEN_KEY); }
function getUser() { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } }
function logout() { [TOKEN_KEY, REFRESH_KEY, USER_KEY].forEach(k => localStorage.removeItem(k)); location.href = "index.html"; }
function requireAuth() { if (!getToken()) location.href = "index.html"; }
function requireGuest() { if (getToken()) location.href = "dashboard.html"; }

async function apiRaw(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (!(opts.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const t = getToken();
  if (t) headers["Authorization"] = "Bearer " + t;
  if (opts.clientType) headers["x-client-type"] = opts.clientType;

  const res = await fetch(CONFIG.API_BASE + path, { ...opts, headers });
  let data = {};
  try { data = await res.json(); } catch {}
  if (res.status === 401 && getToken()) {
    const ok = await tryRefresh();
    if (ok) return apiRaw(path, opts);
    logout();
  }
  if (!res.ok) throw new Error(data.message || "Error " + res.status);
  return data;
}

async function tryRefresh() {
  const r = localStorage.getItem(REFRESH_KEY);
  if (!r) return false;
  try {
    const res = await fetch(CONFIG.API_BASE + "/auth/refresh-token", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: r }),
    });
    const d = await res.json();
    if (d.success) { localStorage.setItem(TOKEN_KEY, d.accessToken); localStorage.setItem(REFRESH_KEY, d.refreshToken); return true; }
  } catch {}
  return false;
}

const API = {
  get: (p) => apiRaw(p),
  post: (p, body) => apiRaw(p, { method: "POST", body: JSON.stringify(body) }),
  put: (p, body) => apiRaw(p, { method: "PUT", body: JSON.stringify(body) }),
  patch: (p, body) => apiRaw(p, { method: "PATCH", body: JSON.stringify(body) }),
  del: (p) => apiRaw(p, { method: "DELETE" }),
  upload: (p, formData, method = "POST") => apiRaw(p, { method, body: formData }),
};

async function login(email, password) {
  const res = await apiRaw("/auth/login", {
    method: "POST", body: JSON.stringify({ email, password }), clientType: CONFIG.CLIENT_TYPE,
  });
  setSession(res);
  return res;
}

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}
function esc(s) { const d = document.createElement("div"); d.textContent = String(s ?? ""); return d.innerHTML; }
