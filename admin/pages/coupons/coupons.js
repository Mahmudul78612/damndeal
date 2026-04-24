(async function () {
  document.body.innerHTML = pageShell("Coupons");
  buildLayout("coupons");

  const content = document.getElementById("page-content");
  let coupons = [], editId = null;

  async function load() {
    content.innerHTML = `<div class="text-center"><div class="spinner"></div></div>`;
    try {
      const data = await API.get("/admin/coupons");
      coupons = data.coupons || [];
      render();
    } catch (err) { showToast(err.message, "error"); }
  }

  function render() {
    content.innerHTML = `
      <div class="toolbar">
        <div class="toolbar-left"><span class="text-muted text-sm">${coupons.length} coupons</span></div>
        <div class="toolbar-right"><button class="btn btn-primary btn-sm" onclick="openForm()">+ Add Coupon</button></div>
      </div>
      <div class="card">
        <div class="card-body table-wrap">
          <table>
            <thead><tr><th>Code</th><th>Discount</th><th>Min Order</th><th>Usage</th><th>Scope</th><th>Active</th><th>Expires</th><th>Actions</th></tr></thead>
            <tbody>
              ${coupons.map(c => `
                <tr>
                  <td><strong>${c.code}</strong></td>
                  <td>${c.discountType === 'percent' ? c.discountValue + '%' : fmtCurrency(c.discountValue)}${c.maxDiscount ? ' (max ' + fmtCurrency(c.maxDiscount) + ')' : ''}</td>
                  <td>${fmtCurrency(c.minOrderAmount)}</td>
                  <td>${c.usedCount || 0}/${c.usageLimit || '∞'}</td>
                  <td><span class="badge badge-purple">${c.scope}</span></td>
                  <td>${c.isActive ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-gray">No</span>'}</td>
                  <td>${fmtDate(c.endDate)}</td>
                  <td class="d-flex gap-2">
                    <button class="btn btn-outline btn-sm" onclick="editCoupon('${c._id}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="delCoupon('${c._id}')">Del</button>
                  </td>
                </tr>
              `).join("") || `<tr><td colspan="8" class="text-center text-muted">No coupons</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <div class="modal-overlay" id="coupon-modal">
        <div class="modal">
          <div class="modal-header"><h3 id="coupon-title">Add Coupon</h3><button class="modal-close" onclick="closeModal('coupon-modal')">&times;</button></div>
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group"><label>Code</label><input class="form-control" id="f-code" placeholder="E.g. FIRST50"></div>
              <div class="form-group"><label>Scope</label>
                <select class="form-control" id="f-scope">
                  <option value="global">Global</option>
                  <option value="partner">Partner</option>
                  <option value="first_order">First Order</option>
                  <option value="category">Category</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>Discount Type</label>
                <select class="form-control" id="f-type"><option value="flat">Flat</option><option value="percent">Percent</option></select>
              </div>
              <div class="form-group"><label>Discount Value</label><input class="form-control" type="number" id="f-value"></div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>Max Discount</label><input class="form-control" type="number" id="f-max" placeholder="0 = no cap"></div>
              <div class="form-group"><label>Min Order Amount</label><input class="form-control" type="number" id="f-min" value="0"></div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>Usage Limit</label><input class="form-control" type="number" id="f-limit" placeholder="0 = unlimited"></div>
              <div class="form-group"><label>Per User Limit</label><input class="form-control" type="number" id="f-userLimit" value="1"></div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>Start Date</label><input class="form-control" type="date" id="f-start"></div>
              <div class="form-group"><label>End Date</label><input class="form-control" type="date" id="f-end"></div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="closeModal('coupon-modal')">Cancel</button>
            <button class="btn btn-primary" onclick="saveCoupon()">Save</button>
          </div>
        </div>
      </div>
    `;
  }

  window.openForm = () => { editId = null; render(); setTimeout(() => { document.getElementById("coupon-title").textContent = "Add Coupon"; openModal("coupon-modal"); }, 0); };

  window.editCoupon = (id) => {
    editId = id;
    const c = coupons.find(x => x._id === id);
    if (!c) return;
    render();
    setTimeout(() => {
      document.getElementById("coupon-title").textContent = "Edit Coupon";
      document.getElementById("f-code").value = c.code;
      document.getElementById("f-scope").value = c.scope;
      document.getElementById("f-type").value = c.discountType;
      document.getElementById("f-value").value = c.discountValue;
      document.getElementById("f-max").value = c.maxDiscount || "";
      document.getElementById("f-min").value = c.minOrderAmount || 0;
      document.getElementById("f-limit").value = c.usageLimit || "";
      document.getElementById("f-userLimit").value = c.perUserLimit || 1;
      if (c.startDate) document.getElementById("f-start").value = c.startDate.slice(0, 10);
      if (c.endDate) document.getElementById("f-end").value = c.endDate.slice(0, 10);
      openModal("coupon-modal");
    }, 0);
  };

  window.saveCoupon = async () => {
    const body = {
      code: document.getElementById("f-code").value.trim().toUpperCase(),
      scope: document.getElementById("f-scope").value,
      discountType: document.getElementById("f-type").value,
      discountValue: Number(document.getElementById("f-value").value),
      maxDiscount: Number(document.getElementById("f-max").value) || 0,
      minOrderAmount: Number(document.getElementById("f-min").value) || 0,
      usageLimit: Number(document.getElementById("f-limit").value) || 0,
      perUserLimit: Number(document.getElementById("f-userLimit").value) || 1,
      startDate: document.getElementById("f-start").value || undefined,
      endDate: document.getElementById("f-end").value || undefined,
    };
    if (!body.code || !body.discountValue) return showToast("Code & value required", "error");
    try {
      if (editId) await API.put(`/admin/coupons/${editId}`, body);
      else await API.post("/admin/coupons", body);
      closeModal("coupon-modal");
      showToast(editId ? "Updated" : "Created");
      load();
    } catch (err) { showToast(err.message, "error"); }
  };

  window.delCoupon = async (id) => {
    if (!confirm("Delete this coupon?")) return;
    try { await API.delete(`/admin/coupons/${id}`); showToast("Deleted"); load(); }
    catch (err) { showToast(err.message, "error"); }
  };

  load();
})();
