(function(){
  requireAuth();
  document.body.innerHTML = pageShell('Returns');
  buildLayout('returns');
  const content = document.getElementById('page-content');

  let page = 1, statusFilter = '';

  async function load(p=1){
    page = p;
    content.innerHTML = '<div class="text-center"><div class="spinner"></div></div>';
    try {
      let ep = `/partner/returns?page=${page}&limit=20`;
      if (statusFilter) ep += '&status='+statusFilter;
      const data = await API.get(ep);
      const returns = data.returns || [];
      const pages = data.pages || 1;
      const total = data.total || 0;

      content.innerHTML = `
        <div class="toolbar">
          <div class="toolbar-left">
            <select class="form-control" style="width:140px" onchange="window._rs=this.value;loadR(1)">
              <option value="">All Status</option>
              <option value="requested" ${statusFilter==='requested'?'selected':''}>Requested</option>
              <option value="approved" ${statusFilter==='approved'?'selected':''}>Approved</option>
              <option value="rejected" ${statusFilter==='rejected'?'selected':''}>Rejected</option>
            </select>
            <span class="text-muted text-sm">${total} returns</span>
          </div>
        </div>

        <div class="card">
          <div class="card-body table-wrap">
            <table>
              <thead><tr><th>Order #</th><th>Customer</th><th>Reason</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                ${returns.map(r=>`
                  <tr>
                    <td><strong>${r.order?.orderNumber||r.order?._id?.slice(-6)||'-'}</strong></td>
                    <td>${esc(r.user?.name||r.user?.phone||'-')}</td>
                    <td style="max-width:200px">${esc(r.reason||'-')}</td>
                    <td>${statusBadge(r.status)}</td>
                    <td>${fmtDate(r.createdAt)}</td>
                    <td>
                      <button class="btn btn-xs" onclick="viewReturn('${r._id}')">View</button>
                    </td>
                  </tr>`).join('')||'<tr><td colspan="6" class="text-center text-muted">No return requests</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
        <div class="pagination" id="pag"></div>

        <!-- Detail Modal -->
        <div class="modal-overlay" id="ret-modal">
          <div class="modal" style="max-width:500px">
            <div class="modal-header"><h3>Return Details</h3><button class="modal-close" onclick="closeModal('ret-modal')">&times;</button></div>
            <div class="modal-body" id="retDetail"></div>
          </div>
        </div>`;
      renderPagination('pag', page, pages, loadR);
    } catch(e){ content.innerHTML = '<div class="empty-state"><p>'+esc(e.message)+'</p></div>'; }
  }

  window.loadR = function(p){ statusFilter = window._rs||statusFilter; load(p); };

  window.viewReturn = async function(id){
    openModal('ret-modal');
    const d = document.getElementById('retDetail');
    d.innerHTML = '<div class="spinner"></div>';
    try {
      const data = await API.get('/partner/returns/'+id);
      const r = data.return || data;
      d.innerHTML = `
        <div style="font-size:13px;display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div><strong>Order:</strong> ${r.order?.orderNumber||r.order||'-'}</div>
          <div><strong>Status:</strong> ${statusBadge(r.status)}</div>
          <div><strong>Customer:</strong> ${esc(r.user?.name||r.user?.phone||'-')}</div>
          <div><strong>Requested:</strong> ${fmtDateTime(r.createdAt)}</div>
        </div>
        <div class="mt-2" style="font-size:13px"><strong>Reason:</strong><br>${esc(r.reason||'Not specified')}</div>
        ${r.images?.length ? '<div class="mt-2 img-grid">'+r.images.map(i=>`<img src="${CONFIG.API_BASE.replace('/api','')}/${i}">`).join('')+'</div>' : ''}
        ${r.rejectionReason ? '<div class="mt-2" style="color:var(--danger);font-size:13px"><strong>Rejection Reason:</strong> '+esc(r.rejectionReason)+'</div>' : ''}`;
    } catch(e){ d.innerHTML = '<p class="text-muted">'+esc(e.message)+'</p>'; }
  };

  load();
})();
