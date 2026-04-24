(async function () {
  document.body.innerHTML = pageShell("Dashboard");
  buildLayout("dashboard");

  const content = document.getElementById("page-content");
  content.innerHTML = `<div class="text-center"><div class="spinner"></div></div>`;

  try {
    const data = await API.get("/admin/dashboard");
    if (!data.success) throw new Error(data.message);

    const d = data.dashboard || data;
    const o = d.orders || {};
    const c = d.counts || {};
    const p = d.pending || {};
    content.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="label">Total Orders</div>
          <div class="value">${(o.totalOrders||0).toLocaleString('en-IN')}</div>
          <div class="sub">Delivered: ${(o.deliveredOrders||0).toLocaleString('en-IN')} • Pending: ${(o.pendingOrders||0).toLocaleString('en-IN')}</div>
        </div>
        <div class="stat-card">
          <div class="label">Total Revenue</div>
          <div class="value">${fmtCurrency(o.totalRevenue)}</div>
          <div class="sub">All orders received</div>
        </div>
        <div class="stat-card">
          <div class="label">Realized Revenue</div>
          <div class="value">${fmtCurrency(o.deliveredRevenue)}</div>
          <div class="sub">After delivery</div>
        </div>
        <div class="stat-card">
          <div class="label">Pending Revenue</div>
          <div class="value">${fmtCurrency(o.pendingRevenue)}</div>
          <div class="sub">Not yet delivered</div>
        </div>
        <div class="stat-card">
          <div class="label">Profit</div>
          <div class="value">${fmtCurrency(o.totalProfit)}</div>
          <div class="sub">From delivered orders only</div>
        </div>
        <div class="stat-card">
          <div class="label">Avg Order Value</div>
          <div class="value">${fmtCurrency(o.avgOrderValue)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Users</div>
          <div class="value">${(c.users||0).toLocaleString('en-IN')}</div>
        </div>
        <div class="stat-card">
          <div class="label">Partners</div>
          <div class="value">${(c.partners||0).toLocaleString('en-IN')}</div>
        </div>
        <div class="stat-card">
          <div class="label">Products</div>
          <div class="value">${(c.products||0).toLocaleString('en-IN')}</div>
          <div class="sub">Pending: ${(p.products||0).toLocaleString('en-IN')}</div>
        </div>
        <div class="stat-card">
          <div class="label">Delivery Boys</div>
          <div class="value">${(c.deliveryBoys||0).toLocaleString('en-IN')}</div>
        </div>
        <div class="stat-card">
          <div class="label">Pending KYC</div>
          <div class="value">${(p.kyc||0).toLocaleString('en-IN')}</div>
        </div>
        <div class="stat-card">
          <div class="label">Pending Payouts</div>
          <div class="value">${(p.payouts?.count||0).toLocaleString('en-IN')}</div>
          <div class="sub">${fmtCurrency(p.payouts?.total)}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>Recent Orders</h3></div>
        <div class="card-body table-wrap">
          <table>
            <thead><tr><th>Order #</th><th>Customer</th><th>Partner</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
            <tbody id="recent-orders">
              ${(d.recentOrders || []).map(o => `
                <tr>
                  <td>${o.orderNumber || o._id?.slice(-6)}</td>
                  <td>${o.user?.name || o.user?.phone || '-'}</td>
                  <td>${o.partner?.name || o.partner?.phone || '-'}</td>
                  <td>${fmtCurrency(o.grandTotal)}</td>
                  <td>${statusBadge(o.status)}</td>
                  <td>${fmtDate(o.createdAt)}</td>
                </tr>
              `).join("") || `<tr><td colspan="6" class="text-center text-muted">No recent orders</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>${err.message}</p></div>`;
    showToast(err.message, "error");
  }
})();
