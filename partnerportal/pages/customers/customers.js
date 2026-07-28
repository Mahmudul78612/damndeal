(function(){
  requireAuth();
  document.body.innerHTML = pageShell('Customers');
  buildLayout('customers');
  const content = document.getElementById('page-content');

  let page = 1, search = '';

  async function load(p=1){
    page = p;
    content.innerHTML = '<div class="text-center"><div class="spinner"></div></div>';
    try {
      let ep = `/partner/customers?page=${page}&limit=20`;
      if (search) ep += '&search='+encodeURIComponent(search);
      const data = await API.get(ep);
      const customers = data.customers || [];
      const pag = data.pagination || {};

      content.innerHTML = `
        <div class="toolbar">
          <div class="toolbar-left">
            <input class="search-input" placeholder="Search by name or phone..." value="${esc(search)}" onkeyup="if(event.key==='Enter'){window._cs=this.value;loadC(1)}">
            <span class="text-muted text-sm">${pag.total||customers.length} customers</span>
          </div>
        </div>

        <div class="card">
          <div class="card-body table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Phone</th><th>Total Orders</th><th>Total Spent</th><th>Last Order</th></tr></thead>
              <tbody>
                ${customers.map(c=>`
                  <tr>
                    <td><strong>${esc(c.name||'-')}</strong></td>
                    <td>${esc(c.phone||'-')}</td>
                    <td>${c.totalOrders||0}</td>
                    <td>${fmtCurrency(c.totalSpent)}</td>
                    <td>${fmtDate(c.lastOrderAt)}</td>
                  </tr>`).join('')||'<tr><td colspan="5" class="text-center text-muted">No customers yet</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
        <div class="pagination" id="pag"></div>`;
      renderPagination('pag', page, pag.pages||1, loadC);
    } catch(e){ content.innerHTML = '<div class="empty-state"><p>'+esc(e.message)+'</p></div>'; }
  }

  window.loadC = function(p){ search = window._cs||search; load(p); };
  load();
})();
