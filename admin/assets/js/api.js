// ========== DAMNDEAL ADMIN — API HELPER ==========

async function api(endpoint, options = {}) {
  const url = CONFIG.API_BASE + endpoint;
  const headers = { "x-client-type": "admin", ...options.headers };
  const token = getToken();
  if (token) headers["Authorization"] = "Bearer " + token;

  // Don't set content-type for FormData
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    if (options.body && typeof options.body === "object") {
      options.body = JSON.stringify(options.body);
    }
  }

  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
      // Try refresh
      const refreshed = await tryRefreshToken();
      if (refreshed) return api(endpoint, options); // retry
      logout();
      return { success: false, message: "Session expired" };
    }

    if (!res.ok) {
      throw new Error(data.message || `Error ${res.status}`);
    }

    return data;
  } catch (err) {
    if (err.name === "TypeError" && err.message.includes("fetch")) {
      throw new Error("Server not reachable. Check your connection.");
    }
    throw err;
  }
}

async function tryRefreshToken() {
  const refreshToken = localStorage.getItem(CONFIG.REFRESH_KEY);
  if (!refreshToken) return false;

  try {
    const res = await fetch(CONFIG.API_BASE + "/auth/refresh-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await res.json();
    if (data.success && data.accessToken) {
      localStorage.setItem(CONFIG.TOKEN_KEY, data.accessToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Shorthand methods
const API = {
  get: (ep) => api(ep),
  post: (ep, body) => api(ep, { method: "POST", body }),
  put: (ep, body) => api(ep, { method: "PUT", body }),
  delete: (ep) => api(ep, { method: "DELETE" }),
  upload: (ep, formData, method = "POST") => api(ep, { method, body: formData }),
};
