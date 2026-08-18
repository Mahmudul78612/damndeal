// ========== DAMNDEAL PARTNER PORTAL — CONFIG ==========
//
// Same-origin API, resolved from the page's own protocol and host.
// The old build pointed at http://168.144.20.237/api, which meant an HTTPS
// page calling plain HTTP: browsers block that as mixed content, so the portal
// loaded but every request failed — and had it gone through, the partner's
// token would have travelled unencrypted.
const CONFIG = {
  API_BASE: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000/api'
    : window.location.protocol + '//' + window.location.hostname + '/api',
  UPLOADS_BASE: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000'
    : window.location.protocol + '//' + window.location.hostname,
  TOKEN_KEY: 'pp_token',
  REFRESH_KEY: 'pp_refresh',
  USER_KEY: 'pp_user',
  CLIENT_TYPE: 'partner'
};
