// ========== DAMNDEAL ADMIN — CONFIG ==========
const CONFIG = {
  API_BASE: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? "http://localhost:5000/api"
    : window.location.protocol + "//" + window.location.hostname + "/api",
  UPLOADS_BASE: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? "http://localhost:5000"
    : window.location.protocol + "//" + window.location.hostname,
  TOKEN_KEY: "dd_admin_token",
  REFRESH_KEY: "dd_admin_refresh",
  USER_KEY: "dd_admin_user",
};

// Get stored token
function getToken() {
  return localStorage.getItem(CONFIG.TOKEN_KEY);
}

// Get stored user
function getUser() {
  try { return JSON.parse(localStorage.getItem(CONFIG.USER_KEY)); } catch { return null; }
}

// Compute base path for this admin portal
const ADMIN_BASE = (function() {
  const p = window.location.pathname;
  const idx = p.lastIndexOf("/pages/");
  if (idx >= 0) return p.substring(0, idx);
  const last = p.lastIndexOf("/");
  return p.substring(0, last);
})();

// Check auth — redirect to login if not authenticated
function requireAuth() {
  const token = getToken();
  const user = getUser();
  if (!token || !user) {
    window.location.href = ADMIN_BASE + "/index.html";
    return false;
  }
  if (user.role !== "admin" && user.role !== "staff") {
    window.location.href = ADMIN_BASE + "/index.html";
    return false;
  }
  return true;
}

// Logout
function logout() {
  localStorage.removeItem(CONFIG.TOKEN_KEY);
  localStorage.removeItem(CONFIG.REFRESH_KEY);
  localStorage.removeItem(CONFIG.USER_KEY);
  localStorage.removeItem("dd_me");
  window.location.href = ADMIN_BASE + "/index.html";
}
