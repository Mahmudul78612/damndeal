requireAuth();
const U = getUser();
document.getElementById("who").textContent = (U?.name || "") + (U?.company ? " · " + U.company : "");

document.querySelectorAll(".nav-item[data-view]").forEach(el => {
  el.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    el.classList.add("active");
    document.getElementById("title").textContent = el.textContent.trim();
    render(el.dataset.view);
  });
});
function openModal(id){ document.getElementById(id).classList.add("show"); }
function closeModal(id){ document.getElementById(id).classList.remove("show"); }
const C = () => document.getElementById("content");
const badge = s => `<span class="badge b-${s}">${s}</span>`;

function render(v){ v==="ads"?renderAds():renderOverview(); }

async function renderOverview(){
  C().innerHTML = `<div class="muted">Loading…</div>`;
  const [r, meRes] = await Promise.all([API.get("/advertiser/analytics/overview"), API.get("/advertiser/me")]);
  const d = r.data; const me = meRes.data;
  C().innerHTML=`
    <div class="stats">
      <div class="stat"><div class="label">Impressions</div><div class="val accent">${d.impressions.toLocaleString()}</div></div>
      <div class="stat"><div class="label">Clicks</div><div class="val green">${d.clicks.toLocaleString()}</div></div>
      <div class="stat"><div class="label">CTR</div><div class="val pink">${d.ctr}%</div></div>
      <div class="stat"><div class="label">Conversions</div><div class="val accent">${(d.conversions||0).toLocaleString()}</div></div>
      <div class="stat"><div class="label">Sale Value</div><div class="val green">$${(d.conversionValue||0).toLocaleString()}</div></div>
      <div class="stat"><div class="label">Conv. Rate</div><div class="val pink">${d.convRate||0}%</div></div>
    </div>
    <div class="card"><h3>Your Ads</h3>
      <table><thead><tr><th>Ad</th><th>Type</th><th>Impr</th><th>Clicks</th><th>CTR</th></tr></thead><tbody>
      ${d.topAds.length?d.topAds.map(a=>`<tr style="cursor:pointer" onclick="adAnalytics('${a.id}')"><td>${esc(a.title)}</td><td><span class="chip">${a.type}</span></td><td>${a.impressions}</td><td>${a.clicks}</td><td>${a.ctr}%</td></tr>`).join(""):`<tr><td colspan="5" class="empty">No ads running yet</td></tr>`}
      </tbody></table>
      <p class="muted" style="font-size:.78rem;margin-top:.6rem">Click an ad for state-wise breakdown & trends.</p>
    </div>

    <div class="card">
      <h3>📈 Event Manager — track your sales</h3>
      <p class="muted" style="font-size:.82rem;margin-bottom:.8rem">Add this to your website to see how many sales/signups came from your ads (like Meta Pixel / Google conversion tracking).</p>
      <label>Your Conversion API Key</label>
      <div style="display:flex;gap:.5rem;align-items:center">
        <code style="flex:1;word-break:break-all">${esc(me.apiKey||"—")}</code>
        <button class="btn btn-sm" onclick="navigator.clipboard.writeText('${esc(me.apiKey||"")}');toast('Copied')">Copy</button>
      </div>
      <label style="margin-top:1rem">1) On every page (captures the ad click):</label>
      <pre style="background:var(--panel2);border:1px solid var(--border);border-radius:10px;padding:.8rem;font-size:.78rem;overflow:auto">&lt;script src="https://damndeal.in/ads/event.js"&gt;&lt;/script&gt;</pre>
      <label>2) On your order-success / thank-you page:</label>
      <pre style="background:var(--panel2);border:1px solid var(--border);border-radius:10px;padding:.8rem;font-size:.78rem;overflow:auto">ddq('purchase', { value: 1299, currency: 'USD', orderId: 'ORD-123' });</pre>
      <p class="muted" style="font-size:.78rem;margin-top:.6rem">Server-side (optional): POST to <code>https://damndeal.in/ads/api/event</code> with header <code>x-api-key: ${esc((me.apiKey||"").slice(0,12))}…</code></p>
    </div>`;
}

async function renderAds(){
  C().innerHTML=`<div class="muted">Loading…</div>`;
  const r=await API.get("/advertiser/ads");
  C().innerHTML=`<div class="wrap">${
    r.items.length?r.items.map(a=>`
      <div class="card" style="width:260px;cursor:pointer" onclick="adAnalytics('${a._id}')">
        <div style="height:110px;border-radius:8px;overflow:hidden;background:#000;display:flex;align-items:center;justify-content:center">
          ${a.type==='video'?`<video src="${esc(a.creativeUrl)}" style="width:100%;height:100%;object-fit:cover" muted></video>`:`<img src="${esc(a.creativeUrl)}" style="width:100%;height:100%;object-fit:cover">`}
        </div>
        <h3 style="margin:.7rem 0 .3rem">${esc(a.title)}</h3>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span>${badge(a.status)}</span><span class="chip">${a.type}</span>
        </div>
        <div class="row" style="margin-top:.7rem;font-size:.8rem">
          <div><div class="muted">Impr</div><b>${a.impressions}</b></div>
          <div><div class="muted">Clicks</div><b>${a.clicks}</b></div>
          <div><div class="muted">CTR</div><b>${a.ctr}%</b></div>
        </div>
      </div>`).join(""):`<div class="empty">No ads yet</div>`
  }</div>`;
}

async function adAnalytics(id){
  const d=(await API.get(`/advertiser/analytics/ads/${id}`)).data;
  const max=Math.max(1,...d.series.map(s=>s.impressions));
  document.getElementById("an-body").innerHTML=`
    <h3>${esc(d.title)}</h3>
    <div class="stats" style="margin:1rem 0">
      <div class="stat"><div class="label">Impressions</div><div class="val accent">${d.impressions}</div></div>
      <div class="stat"><div class="label">Clicks</div><div class="val green">${d.clicks}</div></div>
      <div class="stat"><div class="label">CTR</div><div class="val pink">${d.ctr}%</div></div>
      <div class="stat"><div class="label">Conversions</div><div class="val accent">${d.conversions||0}</div></div>
      <div class="stat"><div class="label">Sale Value</div><div class="val green">$${(d.conversionValue||0).toLocaleString()}</div></div>
    </div>
    <div class="card" style="background:var(--panel2)"><h3 style="font-size:.85rem">Daily trend</h3>
      <div class="bars">${d.series.map(s=>`<div class="bar" style="height:${Math.round(s.impressions/max*100)}%" title="${s.date}: ${s.impressions} impr"></div>`).join("")||'<span class="muted">No data</span>'}</div></div>
    <div class="card" style="background:var(--panel2)"><h3 style="font-size:.85rem">Performance by State</h3>
      <table><thead><tr><th>Country</th><th>State</th><th>Impr</th><th>Clicks</th><th>CTR</th></tr></thead><tbody>
      ${d.states.length?d.states.map(s=>`<tr><td>${esc(s.country||"?")}</td><td>${esc(s.state||"?")}</td><td>${s.impressions}</td><td>${s.clicks}</td><td>${s.ctr}%</td></tr>`).join(""):`<tr><td colspan="5" class="empty">No data yet</td></tr>`}
      </tbody></table></div>`;
  openModal("m-analytics");
}

renderOverview();
