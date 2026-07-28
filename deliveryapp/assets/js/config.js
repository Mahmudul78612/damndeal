// ========== DAMNDEAL DELIVERY APP — CONFIG ==========
const CONFIG = {
  API_BASE: 'http://localhost:5000/api',
  TOKEN_KEY: 'da_token',
  REFRESH_KEY: 'da_refresh',
  USER_KEY: 'da_user',
  PROFILE_KEY: 'da_profile',
  CLIENT_TYPE: 'delivery'
};
function getToken(){ return localStorage.getItem(CONFIG.TOKEN_KEY); }
function getRefresh(){ return localStorage.getItem(CONFIG.REFRESH_KEY); }
function getUser(){ try{ return JSON.parse(localStorage.getItem(CONFIG.USER_KEY)); }catch{ return null; } }
function getProfile(){ try{ return JSON.parse(localStorage.getItem(CONFIG.PROFILE_KEY)); }catch{ return null; } }
function setAuth(d){
  if(d.accessToken) localStorage.setItem(CONFIG.TOKEN_KEY, d.accessToken);
  if(d.refreshToken) localStorage.setItem(CONFIG.REFRESH_KEY, d.refreshToken);
  if(d.user) localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(d.user));
}
function setProfile(p){ localStorage.setItem(CONFIG.PROFILE_KEY, JSON.stringify(p)); }
function requireAuth(){
  const t=getToken(), u=getUser();
  if(!t||!u){ window.location.href='/index.html'; return false; }
  if(u.role!=='delivery'){ logout(); return false; }
  return true;
}
function logout(){
  localStorage.removeItem(CONFIG.TOKEN_KEY);
  localStorage.removeItem(CONFIG.REFRESH_KEY);
  localStorage.removeItem(CONFIG.USER_KEY);
  localStorage.removeItem(CONFIG.PROFILE_KEY);
  window.location.href='/index.html';
}
