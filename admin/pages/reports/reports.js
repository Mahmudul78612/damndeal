(async function () {
  document.body.innerHTML = pageShell("Reports");
  buildLayout("reports");

  const content = document.getElementById("page-content");
  let activeTab = "orders";

  function render() {
    content.innerHTML = `
      <div class="toolbar">
        <div class="toolbar-left" style="gap:4px">
          ${["orders", "revenue", "users", "payments"].map(t =>
            `<button class="btn ${activeTab === t ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="setTab('${t}')">${t.charAt(0).toUpperCase() + t.slice(1)}</button>`
          ).join("")}
        </div>
        <div class="toolbar-right">
          <input type="date" class="form-control" id="r-from" style="width:140px">
          <input type="date" class="form-control" id="r-to" style="width:140px">
          <button class="btn btn-primary btn-sm" onclick="loadReport()">Generate</button>
          <button class="btn btn-outline btn-sm" onclick="exportCSV()">CSV</button>
        </div>
      </div>
      <div class="card">
        <div class="card-body" id="report-content">
          <div class="empty-state"><p>Select a report and click Generate</p></div>
        </div>
      </div>
    `;
  }

  window.setTab = (t) => { activeTab = t; render(); };

  window.loadReport = async () => {
    const from = document.getElementById("r-from").value;
    const to = document.getElementById("r-to").value;
    const rc = document.getElementById("report-content");
    rc.innerHTML = `<div class="text-center"><div class="spinner"></div></div>`;

    let ep = `/admin/reports/${activeTab}?`;
    if (from) ep += `from=${from}&`;
    if (to) ep += `to=${to}&`;

    try {
      const data = await API.get(ep);
      if (activeTab === "orders") {
        const r = data.report || data;
        rc.innerHTML = `
          <div class="stats-grid">
            <div class="stat-card"><div class="label">Total Orders</div><div class="value">${r.totalOrders ?? 0}</div></div>
            <div class="stat-card"><div class="label">Total Revenue</div><div class="value">${fmtCurrency(r.totalRevenue)}</div></div>
            <div class="stat-card"><div class="label">Avg Order Value</div><div class="value">${fmtCurrency(r.avgOrderValue)}</div></div>
            <div class="stat-card"><div class="label">Cancelled</div><div class="value">${r.cancelledOrders ?? 0}</div></div>
          </div>
          ${r.statusBreakdown ? `<h4 class="text-sm mb-2">By Status</h4><div class="stats-grid">${r.statusBreakdown.map(s => `<div class="stat-card"><div class="label">${s._id || s.status}</div><div class="value">${s.count}</div></div>`).join("")}</div>` : ''}
        `;
      } else if (activeTab === "revenue") {
        const r = data.report || data;
        rc.innerHTML = `
          <div class="stats-grid">
            <div class="stat-card"><div class="label">Gross Revenue</div><div class="value">${fmtCurrency(r.grossRevenue)}</div></div>
            <div class="stat-card"><div class="label">Platform Fees</div><div class="value">${fmtCurrency(r.platformFees)}</div></div>
            <div class="stat-card"><div class="label">Delivery Fees</div><div class="value">${fmtCurrency(r.deliveryFees)}</div></div>
            <div class="stat-card"><div class="label">Discounts Given</div><div class="value">${fmtCurrency(r.totalDiscounts)}</div></div>
          </div>
        `;
      } else if (activeTab === "users") {
        const r = data.report || data;
        rc.innerHTML = `
          <div class="stats-grid">
            <div class="stat-card"><div class="label">Total Users</div><div class="value">${r.totalUsers ?? 0}</div></div>
            <div class="stat-card"><div class="label">New (period)</div><div class="value">${r.newUsers ?? 0}</div></div>
            <div class="stat-card"><div class="label">Active Users</div><div class="value">${r.activeUsers ?? 0}</div></div>
          </div>
        `;
      } else {
        const payments = data.payments || data.report || [];
        rc.innerHTML = `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Order</th><th>User</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                ${(Array.isArray(payments) ? payments : []).map(p => `
                  <tr>
                    <td>${p.order?.orderNumber || '-'}</td>
                    <td>${p.user?.phone || '-'}</td>
                    <td>${fmtCurrency(p.amount)}</td>
                    <td>${p.method || '-'}</td>
                    <td>${statusBadge(p.status)}</td>
                    <td>${fmtDate(p.createdAt)}</td>
                  </tr>
                `).join("") || `<tr><td colspan="6" class="text-center text-muted">No data</td></tr>`}
              </tbody>
            </table>
          </div>
        `;
      }
    } catch (err) { rc.innerHTML = `<p class="text-muted">${err.message}</p>`; }
  };

  window.exportCSV = async () => {
    const from = document.getElementById("r-from")?.value || "";
    const to = document.getElementById("r-to")?.value || "";
    try {
      const token = getToken();
      const url = `${CONFIG.API_BASE}/admin/reports/${activeTab}?format=csv&from=${from}&to=${to}`;
      const res = await fetch(url, { headers: { Authorization: "Bearer " + token } });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${activeTab}-report.csv`;
      a.click();
      showToast("Downloaded");
    } catch (err) { showToast(err.message, "error"); }
  };

  render();
})();
