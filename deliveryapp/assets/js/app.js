// ========== DAMNDEAL DELIVERY APP — APP HELPERS ==========

/* ---- Toast ---- */
function showToast(msg, type='success'){
  let c = document.querySelector('.toast-container');
  if(!c){ c=document.createElement('div'); c.className='toast-container'; document.body.appendChild(c); }
  const t = document.createElement('div');
  t.className = 'toast toast-'+type;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transition='opacity .3s'; setTimeout(()=>t.remove(),300); }, 2800);
}

/* ---- Helpers ---- */
function esc(s){ const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }
function fmtDate(d){ if(!d) return '—'; const dt=new Date(d); return dt.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); }
function fmtTime(d){ if(!d) return ''; const dt=new Date(d); return dt.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}); }
function fmtDateTime(d){ return fmtDate(d)+' '+fmtTime(d); }
function fmtCurrency(n){ return '₹'+(parseFloat(n)||0).toLocaleString('en-IN',{minimumFractionDigits:0,maximumFractionDigits:0}); }
function statusBadge(s){
  const map={assigned:'badge-info',picked_up:'badge-warning',on_the_way:'badge-purple',delivered:'badge-success',failed:'badge-danger',pending:'badge-gray'};
  const label=(s||'').replace(/_/g,' ');
  return `<span class="badge ${map[s]||'badge-gray'}">${esc(label)}</span>`;
}

/* ---- Slot a page into app shell ---- */
function appShell(activePage){
  return `
  <div class="app-header">
    <div class="brand">Damn<span>Deal</span> <span style="font-size:12px;opacity:.7">Delivery</span></div>
    <div class="header-right">
      <button class="header-btn" id="onlineToggle" onclick="toggleOnline()">
        <span class="status-dot offline" id="statusDot"></span><span id="statusLabel">Offline</span>
      </button>
    </div>
  </div>
  <div class="app-body" id="pageContent"></div>
  <nav class="bottom-nav">
    <button class="nav-btn ${activePage==='home'?'active':''}" onclick="goto('home')"><span class="icon">🏠</span>Home</button>
    <button class="nav-btn ${activePage==='earnings'?'active':''}" onclick="goto('earnings')"><span class="icon">💰</span>Earnings</button>
    <button class="nav-btn ${activePage==='profile'?'active':''}" onclick="goto('profile')"><span class="icon">👤</span>Profile</button>
  </nav>`;
}

function goto(page){
  const base = window.location.pathname.includes('/pages/') ? '../../pages/' : 'pages/';
  window.location.href = base + page + '/' + page + '.html';
}

/* ---- Online toggle ---- */
async function toggleOnline(){
  try{
    const d = await API.put('/delivery/toggle-online');
    updateOnlineUI(d.isOnline);
    showToast(d.isOnline ? 'You are Online!' : 'You are Offline', d.isOnline?'success':'warning');
  }catch(e){ showToast(e.message,'error'); }
}
function updateOnlineUI(on){
  const dot = document.getElementById('statusDot');
  const lbl = document.getElementById('statusLabel');
  if(dot){ dot.className='status-dot '+(on?'online':'offline'); }
  if(lbl){ lbl.textContent = on?'Online':'Offline'; }
}

/* ---- Load profile & online status ---- */
async function loadOnlineStatus(){
  try{
    const p = await API.get('/delivery/profile');
    setProfile(p);
    updateOnlineUI(p.isOnline);
  }catch(e){}
}

/* ---- Geolocation ---- */
let _locWatcher = null;
function startLocationTracking(){
  if(!navigator.geolocation) return;
  _locWatcher = navigator.geolocation.watchPosition(
    pos => { API.put('/delivery/location',{lat:pos.coords.latitude, lng:pos.coords.longitude}).catch(()=>{}); },
    ()=>{}, {enableHighAccuracy:true, maximumAge:30000, timeout:10000}
  );
}
function stopLocationTracking(){ if(_locWatcher!==null){ navigator.geolocation.clearWatch(_locWatcher); _locWatcher=null; } }

/* ---- Swipe handler ---- */
function initSwipe(el, onComplete){
  if(!el) return;
  const thumb = el.querySelector('.swipe-thumb');
  const fill = el.querySelector('.swipe-fill');
  if(!thumb) return;
  const maxX = el.offsetWidth - thumb.offsetWidth - 8;
  let startX=0, currentX=0, dragging=false;

  function onStart(e){
    if(el.classList.contains('done')) return;
    dragging=true; startX=(e.touches?e.touches[0]:e).clientX - currentX;
    thumb.style.transition='none'; if(fill) fill.style.transition='none';
  }
  function onMove(e){
    if(!dragging) return; e.preventDefault();
    const x = Math.max(0, Math.min(maxX, (e.touches?e.touches[0]:e).clientX - startX));
    currentX=x; thumb.style.left=(x+4)+'px';
    if(fill) fill.style.width=(x+thumb.offsetWidth/2)+'px';
  }
  function onEnd(){
    if(!dragging) return; dragging=false;
    thumb.style.transition='left .2s'; if(fill) fill.style.transition='width .2s';
    if(currentX >= maxX * 0.85){
      currentX=maxX; thumb.style.left=(maxX+4)+'px';
      if(fill) fill.style.width='100%';
      el.classList.add('done');
      if(onComplete) onComplete();
    } else {
      currentX=0; thumb.style.left='4px';
      if(fill) fill.style.width='0';
    }
  }

  thumb.addEventListener('mousedown',onStart);
  thumb.addEventListener('touchstart',onStart,{passive:true});
  document.addEventListener('mousemove',onMove);
  document.addEventListener('touchmove',onMove,{passive:false});
  document.addEventListener('mouseup',onEnd);
  document.addEventListener('touchend',onEnd);
}

/* ---- Open directions ---- */
function openDirections(lat,lng,label){
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  window.open(url,'_blank');
}
