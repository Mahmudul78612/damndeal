(async function () {
  document.body.innerHTML = pageShell("Subscriptions");
  buildLayout("subscriptions");

  const content = document.getElementById("page-content");
  let plans = [], editId = null;

  async function load() {
    content.innerHTML = `<div class="text-center"><div class="spinner"></div></div>`;
    try {
      const [planRes, subRes] = await Promise.all([
        API.get("/admin/subscriptions/plans"),
        API.get("/admin/subscriptions"),
      ]);
      plans = planRes.plans || [];
      const subs = subRes.subscriptions || [];

      content.innerHTML = `
        <div class="card mb-2">
          <div class="card-header">
            <h3>Subscription Plans</h3>
            <button class="btn btn-primary btn-sm" onclick="openPlanForm()">+ Add Plan</button>
          </div>
          <div class="card-body table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Price</th><th>Duration</th><th>Commission</th><th>Max Products</th><th>Active</th><th>Actions</th></tr></thead>
              <tbody>
                ${plans.map(p => `
                  <tr>
                    <td><strong>${p.name}</strong></td>
                    <td>${fmtCurrency(p.price)}</td>
                    <td>${p.durationDays} days</td>
                    <td>${p.features?.commissionPercent ?? '-'}%</td>
                    <td>${p.features?.maxProducts ?? '∞'}</td>
                    <td>${p.isActive !== false ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-gray">No</span>'}</td>
                    <td class="d-flex gap-2">
                      <button class="btn btn-outline btn-sm" onclick="editPlan('${p._id}')">Edit</button>
                      <button class="btn btn-danger btn-sm" onclick="delPlan('${p._id}')">Del</button>
                    </td>
                  </tr>
                `).join("") || `<tr><td colspan="7" class="text-center text-muted">No plans</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Partner Subscriptions (${subs.length})</h3></div>
          <div class="card-body table-wrap">
            <table>
              <thead><tr><th>Partner</th><th>Plan</th><th>Amount</th><th>Status</th><th>Start</th><th>End</th></tr></thead>
              <tbody>
                ${subs.map(s => `
                  <tr>
                    <td>${s.partner?.name || s.partner?.phone || '-'}</td>
                    <td>${s.plan?.name || '-'}</td>
                    <td>${fmtCurrency(s.amount)}</td>
                    <td>${statusBadge(s.status)}</td>
                    <td>${fmtDate(s.startDate)}</td>
                    <td>${fmtDate(s.endDate)}</td>
                  </tr>
                `).join("") || `<tr><td colspan="6" class="text-center text-muted">No subscriptions</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>

        <div class="modal-overlay" id="plan-modal">
          <div class="modal">
            <div class="modal-header"><h3 id="plan-title">Add Plan</h3><button class="modal-close" onclick="closeModal('plan-modal')">&times;</button></div>
            <div class="modal-body">
              <div class="form-group"><label>Name</label><input class="form-control" id="p-name"></div>
              <div class="form-row">
                <div class="form-group"><label>Price (₹)</label><input class="form-control" type="number" id="p-price"></div>
                <div class="form-group"><label>Duration (days)</label><input class="form-control" type="number" id="p-duration" value="30"></div>
              </div>
              <div class="form-row">
                <div class="form-group"><label>Commission %</label><input class="form-control" type="number" id="p-commission" step="0.1"></div>
                <div class="form-group"><label>Max Products</label><input class="form-control" type="number" id="p-maxprod" value="100"></div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" onclick="closeModal('plan-modal')">Cancel</button>
              <button class="btn btn-primary" onclick="savePlan()">Save</button>
            </div>
          </div>
        </div>
      `;
    } catch (err) { content.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`; }
  }

  window.openPlanForm = () => { editId = null; load().then(() => setTimeout(() => openModal("plan-modal"), 100)); };

  window.editPlan = (id) => {
    editId = id;
    const p = plans.find(x => x._id === id);
    if (!p) return;
    load().then(() => setTimeout(() => {
      document.getElementById("plan-title").textContent = "Edit Plan";
      document.getElementById("p-name").value = p.name;
      document.getElementById("p-price").value = p.price;
      document.getElementById("p-duration").value = p.durationDays;
      document.getElementById("p-commission").value = p.features?.commissionPercent || "";
      document.getElementById("p-maxprod").value = p.features?.maxProducts || 100;
      openModal("plan-modal");
    }, 100));
  };

  window.savePlan = async () => {
    const body = {
      name: document.getElementById("p-name").value.trim(),
      price: Number(document.getElementById("p-price").value),
      durationDays: Number(document.getElementById("p-duration").value),
      features: {
        commissionPercent: Number(document.getElementById("p-commission").value) || 0,
        maxProducts: Number(document.getElementById("p-maxprod").value) || 100,
      },
    };
    if (!body.name || !body.price) return showToast("Name & price required", "error");
    try {
      if (editId) await API.put(`/admin/subscriptions/plans/${editId}`, body);
      else await API.post("/admin/subscriptions/plans", body);
      closeModal("plan-modal");
      showToast(editId ? "Updated" : "Created");
      load();
    } catch (err) { showToast(err.message, "error"); }
  };

  window.delPlan = async (id) => {
    if (!confirm("Delete this plan?")) return;
    try { await API.delete(`/admin/subscriptions/plans/${id}`); showToast("Deleted"); load(); }
    catch (err) { showToast(err.message, "error"); }
  };

  load();
})();
