(async function () {
  document.body.innerHTML = pageShell("Staff & Roles");
  buildLayout("staff");

  const content = document.getElementById("page-content");
  let staffList = [];
  let catalog = { permissions: [], roles: [], regions: ["IN", "US"] };
  let editId = null;

  const REGION_LABEL = { IN: "🇮🇳 India (damndeal.in)", US: "🇺🇸 USA (damndeal.com)" };

  function permLabel(key) {
    const p = catalog.permissions.find((x) => x.key === key);
    return p ? p.label : key;
  }

  function roleLabel(key) {
    const r = catalog.roles.find((x) => x.key === key);
    return r ? r.label.split(" (")[0] : key;
  }

  async function load() {
    content.innerHTML = `<div class="text-center"><div class="spinner"></div></div>`;
    try {
      const [cat, data] = await Promise.all([
        API.get("/admin/permissions"),
        API.get("/admin/staff"),
      ]);
      catalog = { permissions: cat.permissions || [], roles: cat.roles || [], regions: cat.regions || ["IN", "US"] };
      staffList = data.staff || [];
      render();
    } catch (err) {
      showToast(err.message, "error");
      content.innerHTML = `<div class="card"><div class="card-body text-center text-muted">${err.message}</div></div>`;
    }
  }

  function permGroupsHTML(selected) {
    const groups = {};
    for (const p of catalog.permissions) (groups[p.group] = groups[p.group] || []).push(p);
    return Object.entries(groups).map(([group, items]) => `
      <div style="margin-bottom:12px">
        <div style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:6px">${group}</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:6px">
          ${items.map((p) => `
            <label style="display:flex;align-items:center;gap:7px;font-size:13px;cursor:pointer">
              <input type="checkbox" class="perm-box" value="${p.key}" ${selected.includes(p.key) ? "checked" : ""}>
              <span>${p.label}</span>
            </label>
          `).join("")}
        </div>
      </div>
    `).join("");
  }

  function render() {
    const rows = staffList.map((s) => {
      const perms = s.permissions || [];
      const regions = (s.regions || []).map((r) => (r === "IN" ? "🇮🇳 IN" : "🇺🇸 US")).join(" ") || "—";
      const shown = perms.slice(0, 3).map(permLabel).join(", ");
      const more = perms.length > 3 ? ` <span class="text-muted">+${perms.length - 3} more</span>` : "";
      return `
        <tr>
          <td><strong>${s.name || "-"}</strong>${s.email ? `<div class="text-muted text-sm">${s.email}</div>` : ""}</td>
          <td>${s.phone || s.user?.phone || "-"}</td>
          <td><span class="badge">${roleLabel(s.roleName || "custom")}</span><div class="text-muted text-sm">${s.department || ""}</div></td>
          <td class="text-sm">${regions}</td>
          <td class="text-sm">${shown || "—"}${more}</td>
          <td>${s.isActive === false
            ? '<span class="badge badge-danger">Inactive</span>'
            : '<span class="badge badge-success">Active</span>'}</td>
          <td class="d-flex gap-2">
            <button class="btn btn-outline btn-sm" onclick="editStaff('${s._id}')">Edit</button>
            <button class="btn btn-outline btn-sm" onclick="toggleStaff('${s._id}', ${s.isActive === false})">${s.isActive === false ? "Activate" : "Disable"}</button>
            <button class="btn btn-danger btn-sm" onclick="delStaff('${s._id}')">Remove</button>
          </td>
        </tr>`;
    }).join("");

    content.innerHTML = `
      <div class="toolbar">
        <div class="toolbar-left"><span class="text-muted text-sm">${staffList.length} staff member(s)</span></div>
        <div class="toolbar-right"><button class="btn btn-primary btn-sm" onclick="openStaffForm()">+ Add Staff</button></div>
      </div>

      <div class="card" style="margin-bottom:14px">
        <div class="card-body text-sm text-muted">
          Staff sign in on this same admin panel with their <strong>phone number + OTP</strong>.
          They only see the sections you tick below, and only the store region(s) you allow.
        </div>
      </div>

      <div class="card">
        <div class="card-body table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Phone</th><th>Role</th><th>Regions</th><th>Access</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="7" class="text-center text-muted">No staff members yet</td></tr>`}</tbody>
          </table>
        </div>
      </div>

      <div class="modal-overlay" id="staff-modal">
        <div class="modal" style="max-width:720px">
          <div class="modal-header">
            <h3 id="staff-title">Add Staff</h3>
            <button class="modal-close" onclick="closeModal('staff-modal')">&times;</button>
          </div>
          <div class="modal-body">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div class="form-group"><label>Phone (login) *</label><input class="form-control" id="s-phone" placeholder="9876543210"></div>
              <div class="form-group"><label>Full name *</label><input class="form-control" id="s-name" placeholder="Staff member name"></div>
              <div class="form-group"><label>Email</label><input class="form-control" id="s-email" placeholder="optional"></div>
              <div class="form-group"><label>Department</label><input class="form-control" id="s-dept" placeholder="e.g. operations"></div>
            </div>

            <div class="form-group">
              <label>Store access *</label>
              <div style="display:flex;gap:18px;padding:4px 0">
                ${catalog.regions.map((r) => `
                  <label style="display:flex;align-items:center;gap:7px;font-size:13px;cursor:pointer">
                    <input type="checkbox" class="region-box" value="${r}"> <span>${REGION_LABEL[r] || r}</span>
                  </label>`).join("")}
              </div>
            </div>

            <div class="form-group">
              <label>Role preset</label>
              <select class="form-control" id="s-role" onchange="applyPreset()">
                ${catalog.roles.map((r) => `<option value="${r.key}">${r.label}</option>`).join("")}
              </select>
            </div>

            <div class="form-group">
              <label>Permissions (what they can open)</label>
              <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;max-height:290px;overflow:auto" id="perm-wrap">
                ${permGroupsHTML([])}
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="closeModal('staff-modal')">Cancel</button>
            <button class="btn btn-primary" onclick="saveStaff()">Save</button>
          </div>
        </div>
      </div>
    `;
  }

  window.applyPreset = () => {
    const role = document.getElementById("s-role").value;
    const preset = catalog.roles.find((r) => r.key === role);
    if (!preset || role === "custom") return;
    document.querySelectorAll(".perm-box").forEach((box) => {
      box.checked = preset.permissions.includes(box.value);
    });
  };

  window.openStaffForm = () => {
    editId = null;
    render();
    setTimeout(() => {
      document.getElementById("staff-title").textContent = "Add Staff";
      document.querySelector('.region-box[value="IN"]').checked = true;
      document.getElementById("s-role").value = "support";
      applyPreset();
      openModal("staff-modal");
    }, 0);
  };

  window.editStaff = (id) => {
    editId = id;
    const s = staffList.find((x) => x._id === id);
    if (!s) return;
    render();
    setTimeout(() => {
      document.getElementById("staff-title").textContent = "Edit Staff";
      document.getElementById("s-phone").value = s.phone || s.user?.phone || "";
      document.getElementById("s-phone").disabled = true;
      document.getElementById("s-name").value = s.name || "";
      document.getElementById("s-email").value = s.email || "";
      document.getElementById("s-dept").value = s.department || "";
      document.getElementById("s-role").value = s.roleName || "custom";
      (s.regions || []).forEach((r) => {
        const box = document.querySelector(`.region-box[value="${r}"]`);
        if (box) box.checked = true;
      });
      const perms = s.permissions || [];
      document.querySelectorAll(".perm-box").forEach((box) => { box.checked = perms.includes(box.value); });
      openModal("staff-modal");
    }, 0);
  };

  window.saveStaff = async () => {
    const phone = document.getElementById("s-phone").value.trim();
    const name = document.getElementById("s-name").value.trim();
    const email = document.getElementById("s-email").value.trim();
    const department = document.getElementById("s-dept").value.trim();
    const roleName = document.getElementById("s-role").value;
    const regions = [...document.querySelectorAll(".region-box:checked")].map((b) => b.value);
    const permissions = [...document.querySelectorAll(".perm-box:checked")].map((b) => b.value);

    if (!editId && !phone) return showToast("Phone is required", "error");
    if (!name) return showToast("Name is required", "error");
    if (!regions.length) return showToast("Select at least one region", "error");
    if (!permissions.length) return showToast("Select at least one permission", "error");

    // Always send the exact ticked boxes — the preset is only a shortcut
    const body = { name, email, department, roleName: "custom", permissions, regions };
    if (roleName !== "custom") body.roleName = roleName;

    try {
      if (editId) {
        await API.put(`/admin/staff/${editId}`, { ...body, roleName: "custom" });
      } else {
        await API.post("/admin/staff", { ...body, phone, roleName: "custom" });
      }
      closeModal("staff-modal");
      showToast(editId ? "Staff updated" : "Staff added — they can now sign in with their phone");
      load();
    } catch (err) { showToast(err.message, "error"); }
  };

  window.toggleStaff = async (id, activate) => {
    try {
      await API.put(`/admin/staff/${id}`, { isActive: activate });
      showToast(activate ? "Activated" : "Disabled");
      load();
    } catch (err) { showToast(err.message, "error"); }
  };

  window.delStaff = async (id) => {
    if (!confirm("Remove this staff member? They will lose admin access immediately.")) return;
    try { await API.delete(`/admin/staff/${id}`); showToast("Removed"); load(); }
    catch (err) { showToast(err.message, "error"); }
  };

  load();
})();
