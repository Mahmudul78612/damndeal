// ── Token helpers ──────────────────────────────────────────────────────────
function getToken() { return localStorage.getItem("inv_token"); }
function setTokens(access, refresh) {
  localStorage.setItem("inv_token", access);
  localStorage.setItem("inv_refresh", refresh);
}
function clearTokens() {
  localStorage.removeItem("inv_token");
  localStorage.removeItem("inv_refresh");
  localStorage.removeItem("inv_investor");
}
function getInvestor() {
  try { return JSON.parse(localStorage.getItem("inv_investor") || "null"); } catch { return null; }
}
function setInvestor(inv) { localStorage.setItem("inv_investor", JSON.stringify(inv)); }
function requireAuth() {
  if (!getToken()) { window.location.href = "/investor/login.html"; return false; }
  return true;
}
function requireGuest() {
  if (getToken()) { window.location.href = "/investor/dashboard.html"; }
}

// ── API helper ─────────────────────────────────────────────────────────────
async function invApi(method, endpoint, body) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = "Bearer " + token;
  const res = await fetch(CONFIG.API_BASE + endpoint, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (res.status === 401) { clearTokens(); window.location.href = "/investor/login.html"; return; }
  return data;
}

async function invApiForm(endpoint, formData) {
  const token = getToken();
  const headers = {};
  if (token) headers["Authorization"] = "Bearer " + token;
  const res = await fetch(CONFIG.API_BASE + endpoint, { method: "POST", headers, body: formData });
  return res.json();
}

function logout() { clearTokens(); window.location.href = "/investor/login.html"; }
