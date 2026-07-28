(function(){
  requireAuth();
  document.body.innerHTML = pageShell('Dashboard');
  buildLayout('dashboard');
  const content = document.getElementById('page-content');

  async function load(){
    content.innerHTML = '<div class="text-center"><div class="spinner"></div></div>';
    try {
      const d = await API.get('/partner/dashboard');
      const db = d.dashboard || d;
      const o = db.orders || {};
      const p = db.products || {};

      content.innerHTML = `
        <div class="stats-grid">
          <div class="stat-card"><div class="label">Total Orders</div><div class="value">${o.totalOrders||0}</div></div>
          <div class="stat-card"><div class="label">Revenue</div><div class="value">${fmtCurrency(o.totalRevenue)}</div></div>
          <div class="stat-card"><div class="label">Profit</div><div class="value">${fmtCurrency(o.totalProfit)}</div></div>
          <div class="stat-card"><div class="label">Avg Order</div><div class="value">${fmtCurrency(o.avgOrderValue)}</div></div>
          <div class="stat-card"><div class="label">Total Products</div><div class="value">${p.totalProducts||0}</div></div>
          <div class="stat-card"><div class="label">Low Stock</div><div class="value" style="color:var(--warning)">${p.lowStockProducts||0}</div></div>
          <div class="stat-card"><div class="label">Out of Stock</div><div class="value" style="color:var(--danger)">${p.outOfStock||0}</div></div>
          <div class="stat-card"><div class="label">Pending Approval</div><div class="value">${p.pendingApproval||0}</div></div>
          <div class="stat-card"><div class="label">Total Customers</div><div class="value">${db.totalCustomers||0}</div></div>
        </div>

        <div class="card mb-2">
          <div class="card-header"><h3>Recent Orders</h3></div>
          <div class="card-body table-wrap">
            <table>
              <thead><tr><th>Order #</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                ${(db.recentOrders||[]).map(r=>`
                  <tr>
                    <td><strong>${r.orderNumber||r._id?.slice(-6)||'-'}</strong></td>
                    <td>${esc(r.user?.name||r.customer?.name||r.user?.phone||'-')}</td>
                    <td>${fmtCurrency(r.grandTotal)}</td>
                    <td>${statusBadge(r.status)}</td>
                    <td>${fmtDate(r.createdAt)}</td>
                  </tr>`).join('')||'<tr><td colspan="5" class="text-center text-muted">No orders yet</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Top Products</h3></div>
          <div class="card-body table-wrap">
            <table>
              <thead><tr><th>Product</th><th>Sold</th><th>Revenue</th></tr></thead>
              <tbody>
                ${(db.topProducts||[]).map(t=>`
                  <tr>
                    <td>${esc(t.name||t._id||'-')}</td>
                    <td>${t.totalSold||t.sold||0}</td>
                    <td>${fmtCurrency(t.totalRevenue||t.revenue)}</td>
                  </tr>`).join('')||'<tr><td colspan="3" class="text-center text-muted">No data</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>`;
    } catch(e) { content.innerHTML = '<div class="empty-state"><p>'+esc(e.message)+'</p></div>'; }
  }
  checkKycStatus();
  load();
})();
