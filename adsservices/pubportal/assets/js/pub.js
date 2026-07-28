requireAuth();
const U = getUser();
document.getElementById("who").textContent = (U?.name || "") + (U?.appId ? " · " + U.appId : "");

document.querySelectorAll(".nav-item[data-view]").forEach(el => {
  el.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    el.classList.add("active");
    document.getElementById("title").textContent = el.textContent.trim();
    render(el.dataset.view);
  });
});
const C = () => document.getElementById("content");
function cpy(t){ navigator.clipboard.writeText(t); toast("Copied"); }
function render(v){ v==="zones"?renderZones():renderOverview(); }

async function renderOverview(){
  C().innerHTML = `<div class="muted">Loading…</div>`;
  const d=(await API.get("/publisher/analytics/overview")).data;
  const max=Math.max(1,...d.series.map(s=>s.impressions));
  C().innerHTML=`
    <div class="stats">
      <div class="stat"><div class="label">Impressions</div><div class="val accent">${d.impressions.toLocaleString()}</div></div>
      <div class="stat"><div class="label">Clicks</div><div class="val green">${d.clicks.toLocaleString()}</div></div>
      <div class="stat"><div class="label">CTR</div><div class="val pink">${d.ctr}%</div></div>
      <div class="stat"><div class="label">Ad Slots</div><div class="val">${d.zones}</div></div>
    </div>
    <div class="card"><h3>Daily impressions</h3>
      <div class="bars">${d.series.map(s=>`<div class="bar" style="height:${Math.round(s.impressions/max*100)}%" title="${s.date}: ${s.impressions} impr, ${s.clicks} clk"></div>`).join("")||'<span class="muted">No data yet</span>'}</div>
    </div>
    <div class="card"><h3>By State</h3>
      <table><thead><tr><th>Country</th><th>State</th><th>Impr</th><th>Clicks</th><th>CTR</th></tr></thead><tbody>
      ${d.states.length?d.states.map(s=>`<tr><td>${esc(s.country||"?")}</td><td>${esc(s.state||"?")}</td><td>${s.impressions}</td><td>${s.clicks}</td><td>${s.ctr}%</td></tr>`).join(""):`<tr><td colspan="5" class="empty">No data yet</td></tr>`}
      </tbody></table></div>`;
}

async function renderZones(){
  C().innerHTML=`<div class="muted">Loading…</div>`;
  const [r, meRes]=await Promise.all([API.get("/publisher/zones"), API.get("/publisher/me")]);
  const me=meRes.data;
  C().innerHTML=`
    <div class="card"><h3>🔑 Your Publisher Key</h3>
      <div style="display:flex;gap:.5rem;align-items:center"><code style="flex:1;word-break:break-all">${esc(me.apiKey||"—")}</code><button class="btn btn-sm" onclick="cpy('${esc(me.apiKey||"")}')">Copy</button></div>
    </div>
    <div class="card"><h3>📦 My Ad Slots (${r.items.length})</h3>
      <p class="muted" style="font-size:.8rem;margin-bottom:.6rem">Paste this where you want an ad to appear, then load the SDK once:</p>
      <table><thead><tr><th>Slot</th><th>Type</th><th>Impr</th><th>Clicks</th><th>CTR</th><th>Embed</th></tr></thead><tbody>
      ${r.items.length?r.items.map(z=>{
        const embed='<div class="dd-ad" data-zone="'+z.apiKey+'"></div>';
        return `<tr><td>${esc(z.name)}</td><td><span class="chip">${z.type}</span></td><td>${z.impressions}</td><td>${z.clicks}</td><td>${z.ctr}%</td>
          <td><button class="btn btn-sm" onclick='cpy(${JSON.stringify(embed)})'>Copy code</button></td></tr>`;
      }).join(""):`<tr><td colspan="6" class="empty">No ad slots yet — ask the admin to create zones for your app.</td></tr>`}
      </tbody></table>
      <p class="muted" style="font-size:.78rem;margin-top:.8rem">Then once per page: <code>&lt;script src="https://damndeal.in/ads/embed.js" async&gt;&lt;/script&gt;</code> · Full guide: <a href="https://damndeal.in/ads/docs/" target="_blank" style="color:var(--primary)">damndeal.in/ads/docs</a></p>
    </div>`;
}

renderOverview();
