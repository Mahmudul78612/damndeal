(async function () {
  document.body.innerHTML = pageShell("Offers");
  buildLayout("offers");

  const content = document.getElementById("page-content");
  let offers = [], editId = null;

  async function load() {
    content.innerHTML = `<div class="text-center"><div class="spinner"></div></div>`;
    try {
      const data = await API.get("/admin/offers");
      offers = data.offers || [];
      render();
    } catch (err) { showToast(err.message, "error"); }
  }

  function render() {
    content.innerHTML = `
      <div class="toolbar">
        <div class="toolbar-left"><span class="text-muted text-sm">${offers.length} offers</span></div>
        <div class="toolbar-right"><button class="btn btn-primary btn-sm" onclick="openOfferForm()">+ Add Offer</button></div>
      </div>
      <div class="card">
        <div class="card-body table-wrap">
          <table>
            <thead><tr><th>Title</th><th>Type</th><th>Discount</th><th>Active</th><th>Period</th><th>Actions</th></tr></thead>
            <tbody>
              ${offers.map(o => `
                <tr>
                  <td>${o.title}</td>
                  <td><span class="badge badge-purple">${o.type}</span></td>
                  <td>${o.discountType === 'percent' ? (o.discountValue || 0) + '%' : fmtCurrency(o.discountValue)}</td>
                  <td>${o.isActive ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-gray">No</span>'}</td>
                  <td>${fmtDate(o.startDate)} — ${fmtDate(o.endDate)}</td>
                  <td class="d-flex gap-2">
                    <button class="btn btn-outline btn-sm" onclick="editOffer('${o._id}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="delOffer('${o._id}')">Del</button>
                  </td>
                </tr>
              `).join("") || `<tr><td colspan="6" class="text-center text-muted">No offers</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <div class="modal-overlay" id="offer-modal">
        <div class="modal">
          <div class="modal-header"><h3 id="offer-title">Add Offer</h3><button class="modal-close" onclick="closeModal('offer-modal')">&times;</button></div>
          <div class="modal-body">
            <div class="form-group"><label>Title</label><input class="form-control" id="o-title"></div>
            <div class="form-row">
              <div class="form-group"><label>Type</label>
                <select class="form-control" id="o-type">
                  <option value="flash_deal">Flash Deal</option>
                  <option value="deal_of_day">Deal of Day</option>
                  <option value="combo">Combo</option>
                  <option value="buy_x_get_y">Buy X Get Y</option>
                  <option value="flat_discount">Flat Discount</option>
                </select>
              </div>
              <div class="form-group"><label>Discount Type</label>
                <select class="form-control" id="o-dtype"><option value="flat">Flat</option><option value="percent">Percent</option></select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>Discount Value</label><input class="form-control" type="number" id="o-dval"></div>
              <div class="form-group"><label>Max Discount</label><input class="form-control" type="number" id="o-maxd" placeholder="0 = none"></div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>Start Date</label><input class="form-control" type="date" id="o-start"></div>
              <div class="form-group"><label>End Date</label><input class="form-control" type="date" id="o-end"></div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="closeModal('offer-modal')">Cancel</button>
            <button class="btn btn-primary" onclick="saveOffer()">Save</button>
          </div>
        </div>
      </div>
    `;
  }

  window.openOfferForm = () => { editId = null; render(); setTimeout(() => openModal("offer-modal"), 0); };

  window.editOffer = (id) => {
    editId = id;
    const o = offers.find(x => x._id === id);
    if (!o) return;
    render();
    setTimeout(() => {
      document.getElementById("offer-title").textContent = "Edit Offer";
      document.getElementById("o-title").value = o.title;
      document.getElementById("o-type").value = o.type;
      document.getElementById("o-dtype").value = o.discountType || "flat";
      document.getElementById("o-dval").value = o.discountValue || "";
      document.getElementById("o-maxd").value = o.maxDiscount || "";
      if (o.startDate) document.getElementById("o-start").value = o.startDate.slice(0, 10);
      if (o.endDate) document.getElementById("o-end").value = o.endDate.slice(0, 10);
      openModal("offer-modal");
    }, 0);
  };

  window.saveOffer = async () => {
    const body = {
      title: document.getElementById("o-title").value.trim(),
      type: document.getElementById("o-type").value,
      discountType: document.getElementById("o-dtype").value,
      discountValue: Number(document.getElementById("o-dval").value) || 0,
      maxDiscount: Number(document.getElementById("o-maxd").value) || 0,
      startDate: document.getElementById("o-start").value || undefined,
      endDate: document.getElementById("o-end").value || undefined,
    };
    if (!body.title) return showToast("Title required", "error");
    try {
      if (editId) await API.put(`/admin/offers/${editId}`, body);
      else await API.post("/admin/offers", body);
      closeModal("offer-modal");
      showToast(editId ? "Updated" : "Created");
      load();
    } catch (err) { showToast(err.message, "error"); }
  };

  window.delOffer = async (id) => {
    if (!confirm("Delete this offer?")) return;
    try { await API.delete(`/admin/offers/${id}`); showToast("Deleted"); load(); }
    catch (err) { showToast(err.message, "error"); }
  };

  load();
})();
