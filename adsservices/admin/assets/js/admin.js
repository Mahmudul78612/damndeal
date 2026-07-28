requireAuth();
const U = getUser();
document.getElementById("who").textContent = (U?.name || "Admin") + " · " + (U?.role || "admin");

let zonesCache = [], advertisersCache = [];

/* ---- nav ---- */
document.querySelectorAll(".nav-item[data-view]").forEach(el => {
  el.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    el.classList.add("active");
    const v = el.dataset.view;
    document.getElementById("title").textContent = el.textContent.trim();
    render(v);
  });
});

function openModal(id){ document.getElementById(id).classList.add("show"); }
function closeModal(id){ document.getElementById(id).classList.remove("show"); }

const C = () => document.getElementById("content");
const badge = s => `<span class="badge b-${s}">${s}</span>`;
const img = u => u ? `<img src="${esc(u)}" style="width:46px;height:30px;object-fit:cover;border-radius:5px;background:#000">` : "";
const UP = (CONFIG.API_BASE.replace(/\/api$/,""));

function render(view){
  if(view==="overview") return renderOverview();
  if(view==="ads") return renderAds();
  if(view==="advertisers") return renderAdvertisers();
  if(view==="apps") return renderPublishers();
  if(view==="zones") return renderZones();
  if(view==="enquiries") return renderEnquiries();
}

/* ---- ENQUIRIES (Contact Sales leads) ---- */
async function renderEnquiries(){
  C().innerHTML=`<div class="muted">Loading…</div>`;
  const r=await API.get("/admin/sales-leads?limit=100");
  C().innerHTML=`<div class="card">
    <h3>Sales Enquiries (${r.total}) ${r.newCount?`<span class="badge b-pending">${r.newCount} new</span>`:""}</h3>
    <p class="muted" style="font-size:.8rem;margin-bottom:.8rem">From the “Contact Sales” form on <a href="https://damndeal.in/ads/advertise/" target="_blank" style="color:var(--primary)">the advertise landing page</a>.</p>
    <table><thead><tr><th>When</th><th>Name</th><th>Company</th><th>Contact</th><th>Message</th><th>Status</th></tr></thead><tbody>
    ${r.items.length?r.items.map(l=>`<tr>
      <td class="muted" style="white-space:nowrap">${new Date(l.createdAt).toLocaleDateString()}</td>
      <td><b>${esc(l.name)}</b></td><td>${esc(l.company||"")}</td>
      <td class="muted">${esc(l.email||"")}${l.email&&l.phone?"<br>":""}${esc(l.phone||"")}</td>
      <td style="max-width:220px;font-size:.82rem">${esc(l.message||"—")}</td>
      <td><select class="btn-sm" style="padding:.3rem;border-radius:7px" onchange="setLeadStatus('${l._id}',this.value)">
        ${["new","contacted","closed"].map(s=>`<option value="${s}" ${l.status===s?"selected":""}>${s}</option>`).join("")}
      </select></td>
    </tr>`).join(""):`<tr><td colspan="6" class="empty">No enquiries yet.</td></tr>`}
    </tbody></table></div>`;
}
async function setLeadStatus(id,status){ await API.patch("/admin/sales-leads/"+id,{status}); toast("Updated"); }

/* ---- OVERVIEW ---- */
async function renderOverview(){
  C().innerHTML = `<div class="muted">Loading…</div>`;
  const r = (await API.get("/admin/analytics/overview")).data;
  const states = (await API.get("/admin/analytics/by-state")).data;
  C().innerHTML = `
    <div class="stats">
      <div class="stat"><div class="label">Impressions</div><div class="val accent">${r.impressions.toLocaleString()}</div></div>
      <div class="stat"><div class="label">Clicks</div><div class="val green">${r.clicks.toLocaleString()}</div></div>
      <div class="stat"><div class="label">CTR</div><div class="val pink">${r.ctr}%</div></div>
      <div class="stat"><div class="label">Conversions</div><div class="val accent">${(r.conversions||0).toLocaleString()}</div></div>
      <div class="stat"><div class="label">Sale Value</div><div class="val green">$${(r.conversionValue||0).toLocaleString()}</div></div>
      <div class="stat"><div class="label">Conv. Rate</div><div class="val pink">${r.convRate||0}%</div></div>
      <div class="stat"><div class="label">Active Ads</div><div class="val">${r.activeAds}</div></div>
      <div class="stat"><div class="label">Advertisers</div><div class="val">${r.advertisers}</div></div>
      <div class="stat"><div class="label">Zones</div><div class="val">${r.zones}</div></div>
    </div>
    <div class="row" style="flex-wrap:wrap">
      <div class="card" style="flex:1;min-width:320px">
        <h3>Top Ads</h3>
        <table><thead><tr><th>Ad</th><th>Advertiser</th><th>Impr</th><th>Clicks</th><th>CTR</th></tr></thead><tbody>
        ${r.topAds.length ? r.topAds.map(a=>`<tr><td>${esc(a.title)}</td><td class="muted">${esc(a.advertiser||"")}</td><td>${a.impressions}</td><td>${a.clicks}</td><td>${a.ctr}%</td></tr>`).join("") : `<tr><td colspan="5" class="empty">No data yet</td></tr>`}
        </tbody></table>
      </div>
      <div class="card" style="flex:1;min-width:320px">
        <h3>Top States <span class="muted" style="font-size:.75rem">(recommendation)</span></h3>
        <table><thead><tr><th>Country</th><th>State</th><th>Impr</th><th>Clicks</th><th>CTR</th></tr></thead><tbody>
        ${states.length ? states.slice(0,10).map(s=>`<tr><td>${esc(s.country||"?")}</td><td>${esc(s.state||"?")}</td><td>${s.impressions}</td><td>${s.clicks}</td><td>${s.ctr}%</td></tr>`).join("") : `<tr><td colspan="5" class="empty">No data yet</td></tr>`}
        </tbody></table>
      </div>
    </div>`;
}

/* ---- ADS ---- */
async function renderAds(){
  C().innerHTML = `<div class="muted">Loading…</div>`;
  const r = await API.get("/admin/ads?limit=100");
  C().innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;margin-bottom:.6rem">
        <h3 style="margin:0">All Ads (${r.total})</h3>
        <button class="btn btn-sm" onclick="openUpload()">＋ Upload Ad</button>
      </div>
      <table><thead><tr><th></th><th>Title</th><th>Advertiser</th><th>Type</th><th>Targeting</th><th>Impr</th><th>Clicks</th><th>CTR</th><th>Status</th><th></th></tr></thead><tbody>
      ${r.items.length ? r.items.map(a=>{
        const t=a.targeting||{}; const tg=[...(t.countries||[]),...(t.states||[])].join(", ")||"All";
        const ctr=a.impressions>0?Math.round(a.clicks/a.impressions*10000)/100:0;
        return `<tr>
          <td>${img(a.type==='video'?(a.thumbnailUrl?UP+a.thumbnailUrl:''):UP+a.creativeUrl)}</td>
          <td>${esc(a.title)}</td><td class="muted">${esc(a.advertiser?.name||"")}</td>
          <td><span class="chip">${a.type}</span></td><td class="muted">${esc(tg)}</td>
          <td>${a.impressions}</td><td>${a.clicks}</td><td>${ctr}%</td>
          <td>${badge(a.status)}</td>
          <td style="white-space:nowrap">
            <button class="btn btn-sm btn-ghost" onclick="adAnalytics('${a._id}')">📈</button>
            <button class="btn btn-sm btn-ghost" onclick="toggleAd('${a._id}','${a.status}')">${a.status==='active'?'⏸':'▶'}</button>
            <button class="btn btn-sm btn-danger" onclick="delAd('${a._id}')">🗑</button>
          </td></tr>`;
      }).join("") : `<tr><td colspan="10" class="empty">No ads yet — click “Upload Ad”.</td></tr>`}
      </tbody></table>
    </div>`;
}
async function toggleAd(id,status){ await API.patch(`/admin/ads/${id}/status`,{status:status==='active'?'paused':'active'}); toast("Updated"); renderAds(); }
async function delAd(id){ if(!confirm("Delete this ad?"))return; await API.del(`/admin/ads/${id}`); toast("Deleted"); renderAds(); }

async function adAnalytics(id){
  const d=(await API.get(`/admin/analytics/ads/${id}`)).data;
  const max=Math.max(1,...d.series.map(s=>s.impressions));
  document.getElementById("an-body").innerHTML=`
    <h3>${esc(d.ad.title)} <span class="muted" style="font-size:.8rem">· ${esc(d.ad.advertiser?.name||"")}</span></h3>
    <div class="stats" style="margin:1rem 0">
      <div class="stat"><div class="label">Impressions</div><div class="val accent">${d.impressions}</div></div>
      <div class="stat"><div class="label">Clicks</div><div class="val green">${d.clicks}</div></div>
      <div class="stat"><div class="label">CTR</div><div class="val pink">${d.ctr}%</div></div>
      <div class="stat"><div class="label">Conversions</div><div class="val accent">${d.conversions||0}</div></div>
      <div class="stat"><div class="label">Sale Value</div><div class="val green">$${(d.conversionValue||0).toLocaleString()}</div></div>
    </div>
    <div class="card" style="background:var(--panel2)"><h3 style="font-size:.85rem">Daily trend</h3>
      <div class="bars">${d.series.map(s=>`<div class="bar" style="height:${Math.round(s.impressions/max*100)}%" title="${s.date}: ${s.impressions} impr, ${s.clicks} clk"></div>`).join("")||'<span class="muted">No data</span>'}</div>
    </div>
    <div class="card" style="background:var(--panel2)"><h3 style="font-size:.85rem">State-wise</h3>
      <table><thead><tr><th>Country</th><th>State</th><th>Impr</th><th>Clicks</th><th>CTR</th></tr></thead><tbody>
      ${d.states.length?d.states.map(s=>`<tr><td>${esc(s.country||"?")}</td><td>${esc(s.state||"?")}</td><td>${s.impressions}</td><td>${s.clicks}</td><td>${s.ctr}%</td></tr>`).join(""):`<tr><td colspan="5" class="empty">No data</td></tr>`}
      </tbody></table></div>`;
  openModal("m-analytics");
}

/* ---- ADVERTISERS ---- */
async function renderAdvertisers(){
  C().innerHTML=`<div class="muted">Loading…</div>`;
  const r=await API.get("/admin/advertisers?limit=100");
  advertisersCache=r.items;
  C().innerHTML=`<div class="card">
    <div style="display:flex;justify-content:space-between;margin-bottom:.6rem">
      <h3 style="margin:0">Advertisers / Companies (${r.total})</h3>
      <button class="btn btn-sm" onclick="openOnboard()">＋ Onboard Advertiser</button>
    </div>
    <p class="muted" style="font-size:.8rem;margin-bottom:.8rem">Click a company to view its login, API key & integration code.</p>
    <table><thead><tr><th>Name</th><th>Email (login)</th><th>Company</th><th>API Key</th><th>Status</th><th></th></tr></thead><tbody>
    ${r.items.length?r.items.map(a=>`<tr style="cursor:pointer" onclick="showAdvertiser('${a._id}')">
      <td>${esc(a.name)}</td><td class="muted">${esc(a.email)}</td><td>${esc(a.company||"")}</td>
      <td><code style="font-size:.72rem">${esc((a.apiKey||"").slice(0,14))}…</code></td>
      <td>${a.isActive?badge("active"):badge("paused")}</td>
      <td><button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();showAdvertiser('${a._id}')">View</button></td>
    </tr>`).join(""):`<tr><td colspan="6" class="empty">No advertisers yet — click “Onboard Advertiser”.</td></tr>`}
    </tbody></table></div>`;
}

function openOnboard(){
  ["adv-name","adv-company","adv-email","adv-phone","adv-pass"].forEach(i=>document.getElementById(i).value="");
  document.getElementById("adv-alert").innerHTML="";
  openModal("m-advertiser");
}

async function submitAdvertiser(){
  const name=document.getElementById("adv-name").value.trim();
  const email=document.getElementById("adv-email").value.trim();
  const password=document.getElementById("adv-pass").value;
  if(!name||!email||!password){ document.getElementById("adv-alert").innerHTML='<div class="alert alert-err">Name, email & password required</div>'; return; }
  const btn=document.getElementById("adv-btn"); btn.disabled=true; btn.textContent="Creating…";
  try{
    const r=await API.post("/admin/advertisers",{name,email,password,company:document.getElementById("adv-company").value.trim(),phone:document.getElementById("adv-phone").value.trim()});
    closeModal("m-advertiser"); toast("Advertiser onboarded ✓");
    // immediately show onboarding pack (creds + API key + snippet)
    document.getElementById("advd-body").innerHTML=onboardingPanel(r.data,{password});
    openModal("m-advdetail");
    renderAdvertisers();
  }catch(e){ document.getElementById("adv-alert").innerHTML='<div class="alert alert-err">'+esc(e.message)+'</div>'; }
  btn.disabled=false; btn.textContent="Create & Get Key";
}

async function showAdvertiser(id){
  const d=(await API.get("/admin/advertisers/"+id)).data;
  document.getElementById("advd-body").innerHTML=onboardingPanel(d.advertiser,{totals:d.totals,ads:d.ads});
  openModal("m-advdetail");
}

// the copy-paste onboarding pack for a company
function onboardingPanel(adv,extra={}){
  const key=adv.apiKey||"";
  const pixel='<script src="https://damndeal.in/ads/event.js"><\/script>';
  const fire="ddq('purchase', { value: 1299, currency: 'USD', orderId: 'ORDER_ID' });";
  const totals=extra.totals?`<div class="row" style="margin:.6rem 0 1rem"><div><div class="muted" style="font-size:.75rem">Impressions</div><b>${extra.totals.impressions}</b></div><div><div class="muted" style="font-size:.75rem">Clicks</div><b>${extra.totals.clicks}</b></div><div><div class="muted" style="font-size:.75rem">Ads</div><b>${(extra.ads||[]).length}</b></div></div>`:"";
  const pwLine=extra.password?`<div><label>Password</label><div style="display:flex;gap:.4rem"><code style="flex:1">${esc(extra.password)}</code><button class="btn btn-sm" onclick="cpy('${esc(extra.password)}')">Copy</button></div></div>`:"";
  return `
    <h3>${esc(adv.name)} ${adv.company?`<span class="muted" style="font-size:.8rem">· ${esc(adv.company)}</span>`:""}</h3>
    ${totals}
    <div class="up-sec" style="margin-top:0">
      <h4>🔐 Portal Login <span class="muted" style="font-weight:400">(give to the company)</span></h4>
      <div class="formgrid">
        <div><label>Portal URL</label><div style="display:flex;gap:.4rem"><code style="flex:1">damndeal.in/ads/portal/</code><button class="btn btn-sm" onclick="cpy('https://damndeal.in/ads/portal/')">Copy</button></div></div>
        <div><label>Email</label><div style="display:flex;gap:.4rem"><code style="flex:1">${esc(adv.email)}</code><button class="btn btn-sm" onclick="cpy('${esc(adv.email)}')">Copy</button></div></div>
      </div>
      ${pwLine}
    </div>
    <div class="up-sec">
      <h4>🔑 Conversion API Key</h4>
      <div style="display:flex;gap:.4rem;align-items:center"><code style="flex:1;word-break:break-all">${esc(key)}</code>
        <button class="btn btn-sm" onclick="cpy('${esc(key)}')">Copy</button>
        <button class="btn btn-sm btn-ghost" onclick="regenKey('${adv._id}')">↻ Regenerate</button></div>
    </div>
    <div class="up-sec">
      <h4>📋 Integration code <span class="muted" style="font-weight:400">(send to the company)</span></h4>
      <label>1) On every page:</label>
      <div style="display:flex;gap:.4rem"><code style="flex:1;word-break:break-all">${esc(pixel)}</code><button class="btn btn-sm" onclick="cpy(${JSON.stringify(pixel)})">Copy</button></div>
      <label>2) On order-success page:</label>
      <div style="display:flex;gap:.4rem"><code style="flex:1;word-break:break-all">${esc(fire)}</code><button class="btn btn-sm" onclick="cpy(${JSON.stringify(fire)})">Copy</button></div>
      <label>Server-side (optional) — POST damndeal.in/ads/api/event with header:</label>
      <div style="display:flex;gap:.4rem"><code style="flex:1;word-break:break-all">x-api-key: ${esc(key)}</code><button class="btn btn-sm" onclick="cpy('x-api-key: ${esc(key)}')">Copy</button></div>
      <p class="muted" style="font-size:.75rem;margin-top:.6rem">Full guide: <a href="https://damndeal.in/ads/docs/" target="_blank" style="color:var(--primary)">damndeal.in/ads/docs</a></p>
    </div>`;
}
function cpy(t){ navigator.clipboard.writeText(t); toast("Copied"); }
async function regenKey(id){ if(!confirm("Regenerate API key? Old key will stop working."))return; const r=await API.post("/admin/advertisers/"+id+"/regenerate-key",{}); toast("Key regenerated"); document.getElementById("advd-body").innerHTML=onboardingPanel(r.data); }

/* ---- APPS / PUBLISHERS ---- */
async function renderPublishers(){
  C().innerHTML=`<div class="muted">Loading…</div>`;
  const r=await API.get("/admin/publishers?limit=100");
  C().innerHTML=`<div class="card">
    <div style="display:flex;justify-content:space-between;margin-bottom:.6rem">
      <h3 style="margin:0">Apps / Publishers (${r.total})</h3>
      <button class="btn btn-sm" onclick="openPubOnboard()">＋ Onboard App</button>
    </div>
    <p class="muted" style="font-size:.8rem;margin-bottom:.8rem">Apps where ads are shown (e.g. DamnPay). Click an app to view its key, zones & integration code.</p>
    <table><thead><tr><th>App</th><th>App ID</th><th>Login Email</th><th>Publisher Key</th><th>Status</th><th></th></tr></thead><tbody>
    ${r.items.length?r.items.map(p=>`<tr style="cursor:pointer" onclick="showPublisher('${p._id}')">
      <td>${esc(p.name)}</td><td class="muted">${esc(p.appId||"")}</td><td class="muted">${esc(p.email)}</td>
      <td><code style="font-size:.72rem">${esc((p.apiKey||"").slice(0,14))}…</code></td>
      <td>${p.isActive?badge("active"):badge("paused")}</td>
      <td><button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();showPublisher('${p._id}')">View</button></td>
    </tr>`).join(""):`<tr><td colspan="6" class="empty">No apps yet — click “Onboard App”.</td></tr>`}
    </tbody></table></div>`;
}
function openPubOnboard(){
  ["pub-name","pub-appid","pub-email","pub-pass"].forEach(i=>document.getElementById(i).value="");
  document.getElementById("pub-alert").innerHTML=""; openModal("m-pub");
}
async function submitPublisher(){
  const name=document.getElementById("pub-name").value.trim();
  const email=document.getElementById("pub-email").value.trim();
  const password=document.getElementById("pub-pass").value;
  if(!name||!email||!password){ document.getElementById("pub-alert").innerHTML='<div class="alert alert-err">Name, email & password required</div>'; return; }
  const btn=document.getElementById("pub-btn"); btn.disabled=true; btn.textContent="Creating…";
  try{
    const r=await API.post("/admin/publishers",{name,appId:document.getElementById("pub-appid").value.trim(),email,password});
    closeModal("m-pub"); toast("App onboarded ✓");
    document.getElementById("pubd-body").innerHTML=publisherPanel(r.data,{password,zones:[]});
    openModal("m-pubdetail"); renderPublishers();
  }catch(e){ document.getElementById("pub-alert").innerHTML='<div class="alert alert-err">'+esc(e.message)+'</div>'; }
  btn.disabled=false; btn.textContent="Create & Get Key";
}
async function showPublisher(id){
  const d=(await API.get("/admin/publishers/"+id)).data;
  document.getElementById("pubd-body").innerHTML=publisherPanel(d.publisher,{totals:d.totals,zones:d.zones});
  openModal("m-pubdetail");
}
function publisherPanel(p,extra={}){
  const key=p.apiKey||"";
  const zones=extra.zones||[];
  const firstZone=zones[0]?.apiKey||"YOUR_ZONE_KEY";
  const embed='<div class="dd-ad" data-zone="'+firstZone+'" data-app="'+(p.appId||"")+'"></div>\n<script src="https://damndeal.in/ads/embed.js" async><\/script>';
  const totals=extra.totals?`<div class="row" style="margin:.6rem 0 1rem"><div><div class="muted" style="font-size:.75rem">Impressions</div><b>${extra.totals.impressions}</b></div><div><div class="muted" style="font-size:.75rem">Clicks</div><b>${extra.totals.clicks}</b></div><div><div class="muted" style="font-size:.75rem">Zones</div><b>${extra.totals.zones}</b></div></div>`:"";
  const pwLine=extra.password?`<div><label>Password</label><div style="display:flex;gap:.4rem"><code style="flex:1">${esc(extra.password)}</code><button class="btn btn-sm" onclick="cpy('${esc(extra.password)}')">Copy</button></div></div>`:"";
  const zoneRows=zones.length?`<table style="margin-top:.4rem"><thead><tr><th>Zone</th><th>Type</th><th>Key</th></tr></thead><tbody>${zones.map(z=>`<tr><td>${esc(z.name)}</td><td><span class="chip">${z.type}</span></td><td><code style="font-size:.72rem">${esc(z.apiKey)}</code> <button class="btn btn-sm btn-ghost" onclick="cpy('${z.apiKey}')">copy</button></td></tr>`).join("")}</tbody></table>`:`<p class="muted" style="font-size:.8rem">No zones yet. Create zones in the Zones tab and assign this app.</p>`;
  return `
    <h3>${esc(p.name)} ${p.appId?`<span class="muted" style="font-size:.8rem">· ${esc(p.appId)}</span>`:""}</h3>
    ${totals}
    <div class="up-sec" style="margin-top:0">
      <h4>🔐 Publisher Portal Login <span class="muted" style="font-weight:400">(give to the app team)</span></h4>
      <div class="formgrid">
        <div><label>Portal URL</label><div style="display:flex;gap:.4rem"><code style="flex:1">damndeal.in/ads/publisher/</code><button class="btn btn-sm" onclick="cpy('https://damndeal.in/ads/publisher/')">Copy</button></div></div>
        <div><label>Email</label><div style="display:flex;gap:.4rem"><code style="flex:1">${esc(p.email)}</code><button class="btn btn-sm" onclick="cpy('${esc(p.email)}')">Copy</button></div></div>
      </div>
      ${pwLine}
    </div>
    <div class="up-sec">
      <h4>🔑 Publisher Key</h4>
      <div style="display:flex;gap:.4rem;align-items:center"><code style="flex:1;word-break:break-all">${esc(key)}</code>
        <button class="btn btn-sm" onclick="cpy('${esc(key)}')">Copy</button>
        <button class="btn btn-sm btn-ghost" onclick="regenPubKey('${p._id}')">↻ Regenerate</button></div>
    </div>
    <div class="up-sec">
      <h4>📦 Zones (ad slots)</h4>
      ${zoneRows}
    </div>
    <div class="up-sec">
      <h4>📋 Integration code <span class="muted" style="font-weight:400">(paste in the app)</span></h4>
      <div style="display:flex;gap:.4rem;align-items:flex-start"><pre style="flex:1;background:var(--panel2);border:1px solid var(--border);border-radius:8px;padding:.6rem;font-size:.74rem;overflow:auto;margin:0">${esc(embed)}</pre><button class="btn btn-sm" onclick="cpy(${JSON.stringify(embed)})">Copy</button></div>
      <p class="muted" style="font-size:.75rem;margin-top:.6rem">Full guide: <a href="https://damndeal.in/ads/docs/" target="_blank" style="color:var(--primary)">damndeal.in/ads/docs</a></p>
    </div>`;
}
async function regenPubKey(id){ if(!confirm("Regenerate publisher key?"))return; const r=await API.post("/admin/publishers/"+id+"/regenerate-key",{}); toast("Key regenerated"); const d=(await API.get("/admin/publishers/"+id)).data; document.getElementById("pubd-body").innerHTML=publisherPanel(d.publisher,{totals:d.totals,zones:d.zones}); }

/* ---- ZONES ---- */
async function renderZones(){
  C().innerHTML=`<div class="muted">Loading…</div>`;
  const r=await API.get("/admin/zones?limit=100");
  zonesCache=r.items;
  C().innerHTML=`<div class="card">
    <div style="display:flex;justify-content:space-between;margin-bottom:.6rem">
      <h3 style="margin:0">Zones / Placements (${r.total})</h3>
      <button class="btn btn-sm" onclick="openZone()">＋ New Zone</button>
    </div>
    <p class="muted" style="font-size:.8rem;margin-bottom:.8rem">Apps request ads using a zone's API key: <code>GET /api/serve?zone=&lt;apiKey&gt;</code></p>
    <table><thead><tr><th>Name</th><th>App / Publisher</th><th>Type</th><th>Size</th><th>API Key</th><th></th></tr></thead><tbody>
    ${r.items.length?r.items.map(z=>`<tr><td>${esc(z.name)}</td><td>${esc(z.publisher?.name||z.app||"—")}</td><td><span class="chip">${z.type}</span></td><td class="muted">${esc(z.size||"")}</td>
      <td><code style="font-size:.75rem">${esc(z.apiKey)}</code> <button class="btn btn-sm btn-ghost" onclick="cpy('${z.apiKey}')">copy</button></td>
      <td><button class="btn btn-sm btn-danger" onclick="delZone('${z._id}')">🗑</button></td></tr>`).join(""):`<tr><td colspan="6" class="empty">No zones yet.</td></tr>`}
    </tbody></table></div>`;
}
async function openZone(){
  const p=await API.get("/admin/publishers?limit=100");
  document.getElementById("z-publisher").innerHTML=`<option value="">— None —</option>`+p.items.map(x=>`<option value="${x._id}">${esc(x.name)}${x.appId?" ("+esc(x.appId)+")":""}</option>`).join("");
  ["z-name","z-app","z-size"].forEach(i=>document.getElementById(i).value=""); document.getElementById("z-alert").innerHTML="";
  openModal("m-zone");
}
async function delZone(id){ if(!confirm("Delete zone?"))return; await API.del(`/admin/zones/${id}`); toast("Deleted"); renderZones(); }
async function submitZone(){
  const name=document.getElementById("z-name").value.trim();
  if(!name){document.getElementById("z-alert").innerHTML='<div class="alert alert-err">Name required</div>';return;}
  try{
    await API.post("/admin/zones",{name,publisher:document.getElementById("z-publisher").value||null,app:document.getElementById("z-app").value.trim(),type:document.getElementById("z-type").value,size:document.getElementById("z-size").value.trim()});
    closeModal("m-zone"); toast("Zone created"); renderZones();
  }catch(e){document.getElementById("z-alert").innerHTML='<div class="alert alert-err">'+esc(e.message)+'</div>';}
}

/* ---- UPLOAD AD ---- */
async function openUpload(){
  // load zones + advertisers for dropdowns
  const [z,a]=await Promise.all([API.get("/admin/zones?limit=100"),API.get("/admin/advertisers?limit=100")]);
  document.getElementById("up-zone").innerHTML=`<option value="">Any matching zone</option>`+z.items.map(x=>`<option value="${x._id}">${esc(x.name)} (${x.type})</option>`).join("");
  document.getElementById("up-adv").innerHTML=`<option value="">— Create new below —</option>`+a.items.map(x=>`<option value="${x._id}">${esc(x.name)} (${esc(x.email)})</option>`).join("");
  onAdvPick(); onType();
  document.getElementById("up-preview").innerHTML='<span class="muted" style="font-size:.78rem">Preview appears here</span>';
  openModal("m-upload");
}
function onAdvPick(){ document.getElementById("up-newadv").style.display=document.getElementById("up-adv").value?"none":"block"; }
function onType(){ /* could toggle width/height for video */ }
function previewCreative(input){
  const box=document.getElementById("up-preview"); const f=input.files[0];
  if(!f){ box.innerHTML='<span class="muted" style="font-size:.78rem">Preview appears here</span>'; return; }
  const url=URL.createObjectURL(f);
  box.innerHTML = f.type.startsWith("video") ? `<video src="${url}" controls muted></video>` : `<img src="${url}">`;
}
function csv(id){ const v=document.getElementById(id).value.trim(); return v?v.split(",").map(s=>s.trim()).filter(Boolean):[]; }

async function submitAd(){
  const file=document.getElementById("up-file").files[0];
  const title=document.getElementById("up-title").value.trim();
  if(!title){return alertUp("Title required");}
  if(!file){return alertUp("Choose a creative file");}
  const advId=document.getElementById("up-adv").value;
  if(!advId){
    if(!document.getElementById("up-aname").value.trim()||!document.getElementById("up-aemail").value.trim()||!document.getElementById("up-apass").value)
      return alertUp("Fill advertiser name, email & password (or pick existing)");
  }
  const fd=new FormData();
  fd.append("creative",file);
  fd.append("title",title);
  fd.append("type",document.getElementById("up-type").value);
  fd.append("targetUrl",document.getElementById("up-target").value.trim());
  fd.append("ctaText",document.getElementById("up-cta").value);
  fd.append("width",document.getElementById("up-w").value||0);
  fd.append("height",document.getElementById("up-h").value||0);
  fd.append("weight",document.getElementById("up-weight").value||5);
  fd.append("impressionCap",document.getElementById("up-cap").value||0);
  if(document.getElementById("up-start").value) fd.append("startDate",document.getElementById("up-start").value);
  if(document.getElementById("up-end").value) fd.append("endDate",document.getElementById("up-end").value);
  fd.append("countries",JSON.stringify(csv("up-countries").map(c=>c.toUpperCase())));
  fd.append("states",JSON.stringify(csv("up-states")));
  fd.append("cities",JSON.stringify(csv("up-cities")));
  const zone=document.getElementById("up-zone").value;
  fd.append("zones",JSON.stringify(zone?[zone]:[]));
  if(advId){ fd.append("advertiserId",advId); }
  else {
    fd.append("advertiserName",document.getElementById("up-aname").value.trim());
    fd.append("advertiserEmail",document.getElementById("up-aemail").value.trim());
    fd.append("advertiserPassword",document.getElementById("up-apass").value);
    fd.append("company",document.getElementById("up-acompany").value.trim());
  }
  const btn=document.getElementById("up-btn"); btn.disabled=true; btn.textContent="Uploading…";
  try{
    await API.upload("/admin/ads",fd);
    closeModal("m-upload"); toast("Ad uploaded ✓");
    document.querySelectorAll("#m-upload input").forEach(i=>i.value=""); document.getElementById("up-weight").value=5;
    render("ads"); document.querySelectorAll(".nav-item").forEach(n=>n.classList.remove("active"));
    document.querySelector('.nav-item[data-view="ads"]').classList.add("active");
    document.getElementById("title").textContent="Ads";
  }catch(e){ alertUp(e.message); }
  btn.disabled=false; btn.textContent="Upload Ad";
}
function alertUp(m){ document.getElementById("up-alert").innerHTML='<div class="alert alert-err">'+esc(m)+'</div>'; }

/* ---- boot ---- */
renderOverview();
