// Publisher portal — apps/sites where ads run.
window.CONFIG = {
  API_BASE: (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? "http://localhost:7000/api"
    : "/ads/api",
  CLIENT_TYPE: "publisher",
};
