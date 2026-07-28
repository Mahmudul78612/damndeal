// ========== DAMNDEAL DELIVERY APP — API ==========
async function api(endpoint, options={}){
  const url = CONFIG.API_BASE + endpoint;
  const headers = { 'x-client-type': CONFIG.CLIENT_TYPE };
  const token = getToken();
  if(token) headers['Authorization'] = 'Bearer ' + token;
  if(options.body && !(options.body instanceof FormData)){
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  options.headers = { ...headers, ...options.headers };

  let res;
  try{ res = await fetch(url, options); }catch{ throw new Error('Network error'); }

  if(res.status === 401){
    const ok = await tryRefresh();
    if(ok){ options.headers['Authorization']='Bearer '+getToken(); res=await fetch(url,options); }
    else{ logout(); throw new Error('Session expired'); }
  }
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}
async function tryRefresh(){
  const r=getRefresh(); if(!r) return false;
  try{
    const res=await fetch(CONFIG.API_BASE+'/auth/refresh-token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refreshToken:r})});
    if(!res.ok) return false;
    const d=await res.json(); setAuth(d); return true;
  }catch{ return false; }
}
const API={
  get:   (ep)=>api(ep),
  post:  (ep,body)=>api(ep,{method:'POST',body}),
  put:   (ep,body)=>api(ep,{method:'PUT',body}),
  delete:(ep)=>api(ep,{method:'DELETE'}),
  upload:(ep,fd,method='POST')=>api(ep,{method,body:fd})
};
