(async function () {
  document.body.innerHTML = pageShell("Partners");
  buildLayout("partners");

  const content = document.getElementById("page-content");
  let page = 1;

  async function load(p = 1) {
    page = p;
    content.innerHTML = `<div class="text-center"><div class="spinner"></div></div>`;
    try {
      const data = await API.get(`/admin/partners?page=${page}&limit=20`);
      const partners = data.partners || [];
      const total = data.total || 0;
      const pages = data.pages || 1;

      content.innerHTML = `
        <div class="toolbar">
          <div class="toolbar-left"><h3 style="font-size:15px">All Partners (${total})</h3></div>
        </div>
        <div class="card">
          <div class="card-body table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Phone</th><th>Status</th><th>Active</th><th>Created</th><th>Actions</th></tr></thead>
              <tbody>
                ${partners.map(p => `
                  <tr>
                    <td>${p.name || '-'}</td>
                    <td>${p.phone}</td>
                    <td>${statusBadge(p.kycStatus || 'pending')}</td>
                    <td>${p.isActive !== false ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-gray">No</span>'}</td>
                    <td>${fmtDate(p.createdAt)}</td>
                    <td>
                      <button class="btn btn-outline btn-sm" onclick="togglePartner('${p._id}', ${p.isActive !== false})">${p.isActive !== false ? 'Disable' : 'Enable'}</button>
                    </td>
                  </tr>
                `).join("") || `<tr><td colspan="6" class="text-center text-muted">No partners</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
        <div class="pagination" id="pagination"></div>
      `;
      renderPagination("pagination", page, pages, load);
    } catch (err) { content.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`; }
  }

  window.load = load;
  window.togglePartner = async (id, current) => {
    try {
      await API.put(`/admin/partners/${id}/toggle`);
      showToast(current ? "Partner disabled" : "Partner enabled");
      load(page);
    } catch (err) { showToast(err.message, "error"); }
  };

  load();
})();
