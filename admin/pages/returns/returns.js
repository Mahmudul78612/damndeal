(async function () {
  document.body.innerHTML = pageShell("Returns");
  buildLayout("returns");

  const content = document.getElementById("page-content");

  async function load() {
    content.innerHTML = `<div class="text-center"><div class="spinner"></div></div>`;
    try {
      const data = await API.get("/admin/returns");
      const returns = data.returns || [];

      content.innerHTML = `
        <div class="card">
          <div class="card-header"><h3>Return Requests (${returns.length})</h3></div>
          <div class="card-body table-wrap">
            <table>
              <thead><tr><th>Order</th><th>User</th><th>Reason</th><th>Refund Amt</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                ${returns.map(r => `
                  <tr>
                    <td>${r.order?.orderNumber || r.order?._id?.slice(-6) || '-'}</td>
                    <td>${r.user?.name || r.user?.phone || '-'}</td>
                    <td class="text-sm">${(r.reason || '').substring(0, 40)}</td>
                    <td>${fmtCurrency(r.totalRefundAmount)}</td>
                    <td>${statusBadge(r.status)}</td>
                    <td>${fmtDate(r.createdAt)}</td>
                    <td class="d-flex gap-2">
                      ${r.status === 'requested' ? `
                        <button class="btn btn-success btn-sm" onclick="reviewReturn('${r._id}','approved')">Approve</button>
                        <button class="btn btn-danger btn-sm" onclick="reviewReturn('${r._id}','rejected')">Reject</button>
                      ` : '—'}
                    </td>
                  </tr>
                `).join("") || `<tr><td colspan="7" class="text-center text-muted">No returns</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) { content.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`; }
  }

  window.reviewReturn = async (id, status) => {
    let adminNote = "";
    if (status === "rejected") {
      adminNote = prompt("Rejection note:");
      if (adminNote === null) return;
    }
    try {
      await API.put(`/admin/returns/${id}/review`, { status, adminNote });
      showToast(`Return ${status}`);
      load();
    } catch (err) { showToast(err.message, "error"); }
  };

  load();
})();
