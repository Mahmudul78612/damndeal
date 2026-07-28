// ========== DAMNDEAL PARTNER PORTAL — CONFIG ==========
const CONFIG = {
  API_BASE: 'http://localhost:5000/api',
  TOKEN_KEY: 'pp_token',
  REFRESH_KEY: 'pp_refresh',
  USER_KEY: 'pp_user',
  CLIENT_TYPE: 'partner'
};

function getToken() { return localStorage.getItem(CONFIG.TOKEN_KEY); }
function getRefresh() { return localStorage.getItem(CONFIG.REFRESH_KEY); }
function getUser() { try { return JSON.parse(localStorage.getItem(CONFIG.USER_KEY)); } catch { return null; } }
function setAuth(data) {
  if (data.accessToken) localStorage.setItem(CONFIG.TOKEN_KEY, data.accessToken);
  if (data.refreshToken) localStorage.setItem(CONFIG.REFRESH_KEY, data.refreshToken);
  if (data.user) localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(data.user));
}

const PP_BASE = (function() {
  const p = window.location.pathname;
  const idx = p.lastIndexOf("/pages/");
  if (idx >= 0) return p.substring(0, idx);
  const last = p.lastIndexOf("/");
  return p.substring(0, last);
})();

function requireAuth() {
  const token = getToken();
  const user = getUser();
  if (!token || !user) { window.location.href = PP_BASE + '/index.html'; return false; }
  if (user.role !== 'partner') { logout(); return false; }
  return true;
}

function logout() {
  localStorage.removeItem(CONFIG.TOKEN_KEY);
  localStorage.removeItem(CONFIG.REFRESH_KEY);
  localStorage.removeItem(CONFIG.USER_KEY);
  window.location.href = PP_BASE + '/index.html';
}
