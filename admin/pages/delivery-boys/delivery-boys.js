(async function () {
  document.body.innerHTML = pageShell("Delivery Boys");
  buildLayout("delivery-boys");

  const content = document.getElementById("page-content");

  async function load() {
    content.innerHTML = `<div class="text-center"><div class="spinner"></div></div>`;
    try {
      const data = await API.get("/admin/delivery-boys");
      const boys = data.deliveryBoys || [];

      content.innerHTML = `
        <div class="card">
          <div class="card-header"><h3>Delivery Boys (${boys.length})</h3></div>
          <div class="card-body table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Phone</th><th>Vehicle</th><th>Verified</th><th>Online</th><th>Partner</th><th>Actions</th></tr></thead>
              <tbody>
                ${boys.map(b => `
                  <tr>
                    <td>${b.name || '-'}</td>
                    <td>${b.phone || '-'}</td>
                    <td>${b.vehicleType || '-'}</td>
                    <td>${b.isVerified ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-warning">No</span>'}</td>
                    <td>${b.isOnline ? '<span class="badge badge-success">Online</span>' : '<span class="badge badge-gray">Offline</span>'}</td>
                    <td>${b.partner ? '<span class="badge badge-info">Partner</span>' : '<span class="badge badge-purple">Platform</span>'}</td>
                    <td class="d-flex gap-2">
                      ${!b.isVerified ? `<button class="btn btn-success btn-sm" onclick="verify('${b._id}')">Verify</button>` : ''}
                      <button class="btn btn-outline btn-sm" onclick="toggle('${b._id}')">${b.isActive !== false ? 'Disable' : 'Enable'}</button>
                    </td>
                  </tr>
                `).join("") || `<tr><td colspan="7" class="text-center text-muted">No delivery boys</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) { content.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`; }
  }

  window.verify = async (id) => {
    try { await API.put(`/admin/delivery-boys/${id}/verify`); showToast("Verified"); load(); }
    catch (err) { showToast(err.message, "error"); }
  };
  window.toggle = async (id) => {
    try { await API.put(`/admin/delivery-boys/${id}/toggle`); showToast("Updated"); load(); }
    catch (err) { showToast(err.message, "error"); }
  };

  load();
})();
