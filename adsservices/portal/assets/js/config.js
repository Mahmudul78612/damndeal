// Mounted under damndeal.in/ads/  → API at /ads/api
window.CONFIG = {
  API_BASE: (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? "http://localhost:7000/api"
    : "/ads/api",
  CLIENT_TYPE: "advertiser",
};
