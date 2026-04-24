(async function () {
  document.body.innerHTML = pageShell("Staff");
  buildLayout("staff");

  const content = document.getElementById("page-content");
  let staffList = [], editId = null;

  async function load() {
    content.innerHTML = `<div class="text-center"><div class="spinner"></div></div>`;
    try {
      const data = await API.get("/admin/staff");
      staffList = data.staff || [];
      render();
    } catch (err) { showToast(err.message, "error"); }
  }

  function render() {
    content.innerHTML = `
      <div class="toolbar">
        <div class="toolbar-left"><span class="text-muted text-sm">${staffList.length} staff members</span></div>
        <div class="toolbar-right"><button class="btn btn-primary btn-sm" onclick="openStaffForm()">+ Add Staff</button></div>
      </div>
      <div class="card">
        <div class="card-body table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Phone</th><th>Department</th><th>Permissions</th><th>Actions</th></tr></thead>
            <tbody>
              ${staffList.map(s => `
                <tr>
                  <td>${s.user?.name || '-'}</td>
                  <td>${s.user?.phone || '-'}</td>
                  <td>${s.department || '-'}</td>
                  <td class="text-sm">${(s.permissions || []).join(', ') || 'All'}</td>
                  <td class="d-flex gap-2">
                    <button class="btn btn-outline btn-sm" onclick="editStaff('${s._id}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="delStaff('${s._id}')">Remove</button>
                  </td>
                </tr>
              `).join("") || `<tr><td colspan="5" class="text-center text-muted">No staff members</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <div class="modal-overlay" id="staff-modal">
        <div class="modal">
          <div class="modal-header"><h3 id="staff-title">Add Staff</h3><button class="modal-close" onclick="closeModal('staff-modal')">&times;</button></div>
          <div class="modal-body">
            <div class="form-group"><label>Phone (existing user)</label><input class="form-control" id="s-phone" placeholder="10-digit phone"></div>
            <div class="form-group"><label>Department</label><input class="form-control" id="s-dept" placeholder="E.g. operations"></div>
            <div class="form-group"><label>Permissions (comma-separated)</label><input class="form-control" id="s-perms" placeholder="orders,products,kyc"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="closeModal('staff-modal')">Cancel</button>
            <button class="btn btn-primary" onclick="saveStaff()">Save</button>
          </div>
        </div>
      </div>
    `;
  }

  window.openStaffForm = () => { editId = null; render(); setTimeout(() => openModal("staff-modal"), 0); };

  window.editStaff = (id) => {
    editId = id;
    const s = staffList.find(x => x._id === id);
    if (!s) return;
    render();
    setTimeout(() => {
      document.getElementById("staff-title").textContent = "Edit Staff";
      document.getElementById("s-phone").value = s.user?.phone || "";
      document.getElementById("s-phone").disabled = true;
      document.getElementById("s-dept").value = s.department || "";
      document.getElementById("s-perms").value = (s.permissions || []).join(",");
      openModal("staff-modal");
    }, 0);
  };

  window.saveStaff = async () => {
    const phone = document.getElementById("s-phone").value.trim();
    const department = document.getElementById("s-dept").value.trim();
    const permissions = document.getElementById("s-perms").value.split(",").map(s => s.trim()).filter(Boolean);
    if (!editId && !phone) return showToast("Phone required", "error");
    try {
      if (editId) await API.put(`/admin/staff/${editId}`, { department, permissions });
      else await API.post("/admin/staff", { phone, department, permissions });
      closeModal("staff-modal");
      showToast(editId ? "Updated" : "Added");
      load();
    } catch (err) { showToast(err.message, "error"); }
  };

  window.delStaff = async (id) => {
    if (!confirm("Remove this staff member?")) return;
    try { await API.delete(`/admin/staff/${id}`); showToast("Removed"); load(); }
    catch (err) { showToast(err.message, "error"); }
  };

  load();
})();
