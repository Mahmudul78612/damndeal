(function(){
  requireAuth();
  document.body.innerHTML = pageShell('Payouts');
  buildLayout('payouts');
  const content = document.getElementById('page-content');

  let page = 1, statusFilter = '';

  async function load(p=1){
    page = p;
    content.innerHTML = '<div class="text-center"><div class="spinner"></div></div>';
    try {
      let ep = `/partner/payouts?page=${page}&limit=20`;
      if (statusFilter) ep += '&status='+statusFilter;
      const data = await API.get(ep);
      const payouts = data.payouts || [];
      const pag = data.pagination || {};

      let totalPaid = 0, totalPending = 0;
      payouts.forEach(p => {
        if (p.status === 'paid') totalPaid += p.amount;
        else totalPending += p.amount;
      });

      content.innerHTML = `
        <div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
          <div class="stat-card"><div class="label">Total Payouts</div><div class="value">${payouts.length}</div></div>
          <div class="stat-card"><div class="label">Total Paid</div><div class="value" style="color:var(--success)">${fmtCurrency(totalPaid)}</div></div>
          <div class="stat-card"><div class="label">Pending</div><div class="value" style="color:var(--warning)">${fmtCurrency(totalPending)}</div></div>
        </div>

        <div class="toolbar">
          <select class="form-control" style="width:140px" onchange="window._ps=this.value;loadPay(1)">
            <option value="">All Status</option>
            <option value="pending" ${statusFilter==='pending'?'selected':''}>Pending</option>
            <option value="paid" ${statusFilter==='paid'?'selected':''}>Paid</option>
            <option value="failed" ${statusFilter==='failed'?'selected':''}>Failed</option>
          </select>
        </div>

        <div class="card">
          <div class="card-body table-wrap">
            <table>
              <thead><tr><th>Amount</th><th>Period</th><th>Status</th><th>Transaction ID</th><th>Date</th></tr></thead>
              <tbody>
                ${payouts.map(p=>`
                  <tr>
                    <td><strong>${fmtCurrency(p.amount)}</strong></td>
                    <td>${esc(p.period||'-')}</td>
                    <td>${statusBadge(p.status)}</td>
                    <td class="text-muted text-sm">${esc(p.transactionId||'-')}</td>
                    <td>${fmtDate(p.createdAt)}</td>
                  </tr>`).join('')||'<tr><td colspan="5" class="text-center text-muted">No payouts yet</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
        <div class="pagination" id="pag"></div>`;
      renderPagination('pag', page, pag.pages||1, loadPay);
    } catch(e){ content.innerHTML = '<div class="empty-state"><p>'+esc(e.message)+'</p></div>'; }
  }

  window.loadPay = function(p){ statusFilter = window._ps||statusFilter; load(p); };
  load();
})();
