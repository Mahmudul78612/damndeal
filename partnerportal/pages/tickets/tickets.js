(function(){
  requireAuth();
  document.body.innerHTML = pageShell('Support');
  buildLayout('tickets');
  const content = document.getElementById('page-content');

  let page = 1, statusFilter = '';

  async function load(p=1){
    page = p;
    content.innerHTML = '<div class="text-center"><div class="spinner"></div></div>';
    try {
      let ep = `/partner/tickets?page=${page}&limit=20`;
      if (statusFilter) ep += '&status='+statusFilter;
      const data = await API.get(ep);
      const tickets = data.tickets || [];
      const pages = data.pages || 1;
      const total = data.total || 0;

      content.innerHTML = `
        <div class="toolbar">
          <div class="toolbar-left">
            <select class="form-control" style="width:140px" onchange="window._ts=this.value;loadT(1)">
              <option value="">All Status</option>
              <option value="open" ${statusFilter==='open'?'selected':''}>Open</option>
              <option value="resolved" ${statusFilter==='resolved'?'selected':''}>Resolved</option>
              <option value="closed" ${statusFilter==='closed'?'selected':''}>Closed</option>
            </select>
            <span class="text-muted text-sm">${total} tickets</span>
          </div>
          <button class="btn btn-sm btn-primary" onclick="openCreate()">+ New Ticket</button>
        </div>

        <div class="card">
          <div class="card-body table-wrap">
            <table>
              <thead><tr><th>Ticket #</th><th>Subject</th><th>Category</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead>
              <tbody>
                ${tickets.map(t=>`
                  <tr>
                    <td><strong>${esc(t.ticketNumber||'-')}</strong></td>
                    <td>${esc(t.subject)}</td>
                    <td>${esc(t.category||'other')}</td>
                    <td>${statusBadge(t.status)}</td>
                    <td>${fmtDateTime(t.updatedAt)}</td>
                    <td><button class="btn btn-xs" onclick="viewTicket('${t._id}')">View</button></td>
                  </tr>`).join('')||'<tr><td colspan="6" class="text-center text-muted">No tickets</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
        <div class="pagination" id="pag"></div>

        <!-- View ticket modal -->
        <div class="modal-overlay" id="view-modal">
          <div class="modal" style="max-width:560px">
            <div class="modal-header"><h3 id="viewTitle">Ticket</h3><button class="modal-close" onclick="closeModal('view-modal')">&times;</button></div>
            <div class="modal-body" id="ticketDetail"></div>
          </div>
        </div>

        <!-- Create ticket modal -->
        <div class="modal-overlay" id="create-modal">
          <div class="modal" style="max-width:480px">
            <div class="modal-header"><h3>New Support Ticket</h3><button class="modal-close" onclick="closeModal('create-modal')">&times;</button></div>
            <div class="modal-body">
              <div class="form-group"><label>Subject *</label><input class="form-control" id="fSubject" required></div>
              <div class="form-row">
                <div class="form-group"><label>Category</label><select class="form-control" id="fCat"><option value="other">Other</option><option value="order">Order Issue</option><option value="payment">Payment</option><option value="technical">Technical</option><option value="account">Account</option></select></div>
                <div class="form-group"><label>Order ID <small class="text-muted">(optional)</small></label><input class="form-control" id="fOrder"></div>
              </div>
              <div class="form-group"><label>Message *</label><textarea class="form-control" id="fMessage" rows="4" required></textarea></div>
              <div class="modal-footer" style="padding:0;border:none;margin-top:14px">
                <button class="btn" onclick="closeModal('create-modal')">Cancel</button>
                <button class="btn btn-primary" onclick="createTicket()">Submit</button>
              </div>
            </div>
          </div>
        </div>`;
      renderPagination('pag', page, pages, loadT);
    } catch(e){ content.innerHTML = '<div class="empty-state"><p>'+esc(e.message)+'</p></div>'; }
  }

  window.loadT = function(p){ statusFilter = window._ts||statusFilter; load(p); };

  /* ── Create ── */
  window.openCreate = function(){
    load(page).then(()=>{
      document.getElementById('fSubject').value='';
      document.getElementById('fCat').value='other';
      document.getElementById('fOrder').value='';
      document.getElementById('fMessage').value='';
      openModal('create-modal');
    });
  };

  window.createTicket = async function(){
    const subject = document.getElementById('fSubject').value.trim();
    const message = document.getElementById('fMessage').value.trim();
    if (!subject || !message) { showToast('Subject and message required','error'); return; }
    const payload = {
      subject,
      category: document.getElementById('fCat').value,
      message
    };
    const orderId = document.getElementById('fOrder').value.trim();
    if (orderId) payload.orderId = orderId;

    try {
      await API.post('/partner/tickets', payload);
      showToast('Ticket created','success');
      closeModal('create-modal');
      load(page);
    } catch(e){ showToast(e.message,'error'); }
  };

  /* ── View ── */
  window.viewTicket = async function(id){
    openModal('view-modal');
    const d = document.getElementById('ticketDetail');
    d.innerHTML = '<div class="spinner"></div>';
    try {
      const data = await API.get('/partner/tickets/'+id);
      const t = data.ticket;
      const user = getUser();

      d.innerHTML = `
        <div style="font-size:13px;margin-bottom:12px">
          <div><strong>${esc(t.ticketNumber)}</strong> — ${statusBadge(t.status)}</div>
          <div class="text-muted text-sm mt-1">${esc(t.subject)} | ${esc(t.category||'other')}</div>
          ${t.order ? '<div class="text-muted text-sm">Order: '+esc(t.order.orderNumber||t.order)+'</div>' : ''}
        </div>

        <div style="max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius);padding:10px;margin-bottom:12px">
          ${(t.messages||[]).map(m=>{
            const isMe = m.senderRole === 'partner';
            return `<div style="margin-bottom:10px;padding:8px 12px;border-radius:8px;${isMe?'background:var(--primary-bg);margin-left:30px':'background:#f3f4f6;margin-right:30px'}">
              <div style="font-size:11px;color:var(--text-light);margin-bottom:2px">${isMe?'You':'Support'} · ${fmtDateTime(m.createdAt||m.timestamp)}</div>
              <div style="font-size:13px">${esc(m.text)}</div>
            </div>`;
          }).join('')}
        </div>

        ${t.status !== 'closed' ? `
        <div class="d-flex gap-1">
          <input class="form-control" id="replyMsg" placeholder="Type reply..." style="flex:1">
          <button class="btn btn-sm btn-primary" onclick="replyTicket('${t._id}')">Reply</button>
        </div>` : '<p class="text-sm text-muted text-center">Ticket closed</p>'}`;
    } catch(e){ d.innerHTML = '<p class="text-muted">'+esc(e.message)+'</p>'; }
  };

  window.replyTicket = async function(id){
    const text = document.getElementById('replyMsg').value.trim();
    if (!text) { showToast('Enter a message','error'); return; }
    try {
      await API.post('/partner/tickets/'+id+'/reply', { text });
      showToast('Reply sent','success');
      viewTicket(id);
    } catch(e){ showToast(e.message,'error'); }
  };

  load();
})();
