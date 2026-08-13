/* Security — OTP delivery + bot protection.
   Shows what the SMS balance is being spent on and what was refused, so an
   attack is visible the same day instead of at the end of the month. */
(async function () {
  document.body.innerHTML = pageShell("Security");
  buildLayout("security");

  const content = document.getElementById("page-content");
  let timer = null;

  function reasonTone(reasons) {
    const r = (reasons || []).join(" ");
    if (/honeypot|scripted|datacenter/.test(r)) return "danger";
    if (/sequential|many numbers|burst|spike/.test(r)) return "warning";
    return "muted";
  }

  function render(d) {
    const usedPct = d.dailyCap ? Math.min(100, Math.round((d.sentToday / d.dailyCap) * 100)) : 0;
    const blocked = d.blockedToday || 0;
    const total = (d.sentToday || 0) + blocked;
    const blockPct = total ? Math.round((blocked / total) * 100) : 0;

    content.innerHTML = `
      <div class="toolbar">
        <div class="toolbar-left">
          <span class="text-muted text-sm">Live OTP protection · ${d.date}</span>
        </div>
        <div class="toolbar-right">
          <label class="text-sm text-muted" style="margin-right:10px">
            <input type="checkbox" id="sec-auto" checked> Auto-refresh
          </label>
          <button class="btn btn-outline btn-sm" onclick="secLoad()">Refresh</button>
        </div>
      </div>

      <div class="stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px">
        ${statCard("OTP sent today", d.sentToday, `of ${d.dailyCap} daily cap`, usedPct > 80 ? "danger" : "")}
        ${statCard("Blocked today", blocked, blocked ? `${blockPct}% of all attempts` : "no abuse detected", blocked > 20 ? "danger" : blocked ? "warning" : "")}
        ${statCard("Daily spend cap", d.dailyCap, "hard limit — protects the balance")}
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="card-body">
          <div style="display:flex;justify-content:space-between;font-size:12px;color:#6b7280;margin-bottom:6px">
            <span>Daily SMS budget used</span><span>${usedPct}%</span>
          </div>
          <div style="height:10px;background:#eef0f4;border-radius:6px;overflow:hidden">
            <div style="height:100%;width:${usedPct}%;background:${usedPct > 80 ? "#dc2626" : usedPct > 50 ? "#f59e0b" : "#16a34a"}"></div>
          </div>
          <p class="text-muted text-sm" style="margin-top:8px">
            Once the cap is reached, OTP sending stops for the rest of the day — no rotation of IPs or
            numbers can spend past it. Raise it with <code>OTP_GLOBAL_DAILY_CAP</code> if real traffic grows.
          </p>
        </div>
      </div>

      <div class="card">
        <div class="card-body">
          <h3 style="font-size:15px;margin:0 0 4px">Recent refused attempts</h3>
          <p class="text-muted text-sm" style="margin:0 0 12px">
            Phone numbers are masked. These requests never cost an SMS.
          </p>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>When</th><th>Number</th><th>IP / network</th><th>Risk</th><th>Why it was refused</th></tr>
              </thead>
              <tbody>
                ${(d.recentBlocks || []).map((b) => `
                  <tr>
                    <td class="text-sm">${new Date(b.at).toLocaleString()}</td>
                    <td class="text-sm"><code>${b.phone || "-"}</code></td>
                    <td class="text-sm">${b.ip || "-"}<div class="text-muted" style="font-size:11px">${b.subnet || ""}</div></td>
                    <td><span class="badge ${b.risk >= 70 ? "badge-danger" : "badge-warning"}">${b.risk}</span></td>
                    <td class="text-sm">
                      ${(b.reasons || []).map((r) => `<span class="badge badge-${reasonTone([r])}" style="margin-right:4px">${r}</span>`).join("")}
                      <div class="text-muted" style="font-size:11px;margin-top:3px">${(b.ua || "").slice(0, 70)}</div>
                    </td>
                  </tr>`).join("") ||
                  `<tr><td colspan="5" class="text-center text-muted" style="padding:28px">
                     No refusals recorded — nothing suspicious today.
                   </td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <div class="card-body">
          <h3 style="font-size:15px;margin:0 0 10px">What is protecting OTP right now</h3>
          <ul class="text-sm" style="margin:0;padding-left:18px;line-height:1.9;color:#4b5563">
            <li><b>Per number:</b> 30s → 60s → 120s between resends, 4 per day, then blocked for 24 hours.</li>
            <li><b>Per network:</b> 10 per IP per day, plus /24 subnet velocity so rotating IPs in one range are caught.</li>
            <li><b>Per device:</b> one browser asking for several different numbers is flagged.</li>
            <li><b>Number patterns:</b> sequential or generated-looking lists are refused.</li>
            <li><b>Client checks:</b> scripted clients (curl/python), missing user-agent, honeypot, and forms submitted faster than a human can type.</li>
            <li><b>Networks:</b> datacenter/VPN/proxy ranges and non-Indian IPs cannot request an OTP.</li>
            <li><b>Backstop:</b> the daily spend cap above, which no rotation can get past.</li>
          </ul>
          <p class="text-muted text-sm" style="margin-top:10px">
            All checks fail open — if Redis is unavailable, real customers can still sign in.
          </p>
        </div>
      </div>
    `;

    const auto = document.getElementById("sec-auto");
    if (auto) {
      auto.checked = localStorage.getItem("dd_sec_auto") !== "0";
      auto.addEventListener("change", function () {
        localStorage.setItem("dd_sec_auto", this.checked ? "1" : "0");
        schedule();
      });
    }
    schedule();
  }

  function statCard(label, value, hint, tone) {
    const color = tone === "danger" ? "#dc2626" : tone === "warning" ? "#d97706" : "#111827";
    return `
      <div class="card"><div class="card-body">
        <div class="text-muted" style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px">${label}</div>
        <div style="font-size:26px;font-weight:800;color:${color};margin-top:2px">${Number(value || 0).toLocaleString()}</div>
        <div class="text-muted" style="font-size:11.5px">${hint}</div>
      </div></div>`;
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    const on = localStorage.getItem("dd_sec_auto") !== "0";
    if (on) timer = setTimeout(secLoad, 30000);
  }

  window.secLoad = async function () {
    try {
      const d = await API.get("/admin/security/otp");
      render(d);
    } catch (err) {
      content.innerHTML = `<div class="card"><div class="card-body text-center text-muted" style="padding:32px">
        ${err.message}
      </div></div>`;
      schedule();
    }
  };

  content.innerHTML = `<div class="text-center"><div class="spinner"></div></div>`;
  secLoad();
})();
