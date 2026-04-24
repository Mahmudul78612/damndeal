(async function () {
  document.body.innerHTML = pageShell("Support Tickets");
  buildLayout("tickets");

  const content = document.getElementById("page-content");
  let statusFilter = "";

  async function load() {
    content.innerHTML = `<div class="text-center"><div class="spinner"></div></div>`;
    try {
      let ep = "/admin/tickets";
      if (statusFilter) ep += `?status=${statusFilter}`;
      const data = await API.get(ep);
      const tickets = data.tickets || [];

      content.innerHTML = `
        <div class="toolbar">
          <div class="toolbar-left">
            <select class="form-control" style="width:150px" onchange="filterTkt(this.value)">
              <option value="">All</option>
              <option value="open" ${statusFilter==="open"?"selected":""}>Open</option>
              <option value="assigned" ${statusFilter==="assigned"?"selected":""}>Assigned</option>
              <option value="resolved" ${statusFilter==="resolved"?"selected":""}>Resolved</option>
              <option value="closed" ${statusFilter==="closed"?"selected":""}>Closed</option>
            </select>
          </div>
        </div>
        <div class="card">
          <div class="card-body table-wrap">
            <table>
              <thead><tr><th>Ticket #</th><th>Subject</th><th>From</th><th>Category</th><th>Priority</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead>
              <tbody>
                ${tickets.map(t => `
                  <tr>
                    <td><strong>${t.ticketNumber}</strong></td>
                    <td>${(t.subject || '').substring(0, 30)}</td>
                    <td>${t.user?.name || t.user?.phone || '-'} <span class="text-muted text-sm">(${t.userRole})</span></td>
                    <td><span class="badge badge-purple">${t.category}</span></td>
                    <td>${t.priority === 'high' ? '<span class="badge badge-danger">High</span>' : t.priority === 'medium' ? '<span class="badge badge-warning">Medium</span>' : '<span class="badge badge-gray">Low</span>'}</td>
                    <td>${statusBadge(t.status)}</td>
                    <td>${fmtDate(t.updatedAt)}</td>
                    <td>
                      <button class="btn btn-outline btn-sm" onclick="viewTicket('${t._id}')">View</button>
                    </td>
                  </tr>
                `).join("") || `<tr><td colspan="8" class="text-center text-muted">No tickets</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>

        <div class="modal-overlay" id="tkt-modal">
          <div class="modal" style="max-width:640px">
            <div class="modal-header"><h3>Ticket Detail</h3><button class="modal-close" onclick="closeModal('tkt-modal')">&times;</button></div>
            <div class="modal-body" id="tkt-body">Loading...</div>
            <div class="modal-footer">
              <input class="form-control" id="tkt-reply" placeholder="Type reply..." style="flex:1">
              <button class="btn btn-primary btn-sm" onclick="replyTicket()">Reply</button>
              <button class="btn btn-success btn-sm" onclick="resolveTicket()">Resolve</button>
              <button class="btn btn-outline btn-sm" onclick="closeTicket()">Close</button>
            </div>
          </div>
        </div>
      `;
    } catch (err) { content.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`; }
  }

  let currentTicketId = null;
  window.filterTkt = (v) => { statusFilter = v; load(); };

  window.viewTicket = async (id) => {
    currentTicketId = id;
    openModal("tkt-modal");
    const body = document.getElementById("tkt-body");
    body.innerHTML = `<div class="text-center"><div class="spinner"></div></div>`;
    try {
      const data = await API.get(`/admin/tickets/${id}`);
      const t = data.ticket;
      body.innerHTML = `
        <p><strong>${t.ticketNumber}</strong> — ${t.subject}</p>
        <p class="text-muted text-sm">Category: ${t.category} | Priority: ${t.priority} | Status: ${t.status}</p>
        <hr style="margin:12px 0;border:none;border-top:1px solid var(--border)">
        <div style="max-height:300px;overflow-y:auto">
          ${(t.messages || []).map(m => `
            <div style="margin-bottom:10px;padding:8px 12px;border-radius:8px;background:${m.senderRole === 'admin' || m.senderRole === 'staff' ? 'var(--primary-bg)' : '#f3f4f6'};font-size:13px">
              <strong>${m.senderRole}:</strong> ${m.text}
              <div class="text-muted text-sm">${fmtDateTime(m.createdAt)}</div>
            </div>
          `).join("")}
        </div>
      `;
    } catch (err) { body.innerHTML = `<p class="text-muted">${err.message}</p>`; }
  };

  window.replyTicket = async () => {
    if (!currentTicketId) return;
    const text = document.getElementById("tkt-reply").value.trim();
    if (!text) return showToast("Enter reply", "error");
    try {
      await API.post(`/admin/tickets/${currentTicketId}/reply`, { text });
      document.getElementById("tkt-reply").value = "";
      showToast("Reply sent");
      viewTicket(currentTicketId);
    } catch (err) { showToast(err.message, "error"); }
  };

  window.resolveTicket = async () => {
    if (!currentTicketId) return;
    try { await API.put(`/admin/tickets/${currentTicketId}/resolve`); showToast("Resolved"); closeModal("tkt-modal"); load(); }
    catch (err) { showToast(err.message, "error"); }
  };

  window.closeTicket = async () => {
    if (!currentTicketId) return;
    try { await API.put(`/admin/tickets/${currentTicketId}/close`); showToast("Closed"); closeModal("tkt-modal"); load(); }
    catch (err) { showToast(err.message, "error"); }
  };

  load();
})();
