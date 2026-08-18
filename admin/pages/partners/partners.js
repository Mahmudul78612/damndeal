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
                    <td style="white-space:nowrap">
                      <button class="btn btn-outline btn-sm" onclick="openMoney('${p._id}', '${esc(p.name || p.phone)}')">💰 Commission</button>
                      <button class="btn btn-outline btn-sm" onclick="togglePartner('${p._id}', ${p.isActive !== false})">${p.isActive !== false ? 'Disable' : 'Enable'}</button>
                    </td>
                  </tr>
                `).join("") || `<tr><td colspan="6" class="text-center text-muted">No partners</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
        <div class="pagination" id="pagination"></div>

        <!-- Commission & settlement -->
        <div class="modal-overlay" id="money-modal">
          <div class="modal" style="max-width:560px">
            <div class="modal-header"><h3 id="money-title">Commission</h3>
              <button class="modal-close" onclick="closeModal('money-modal')">&times;</button></div>
            <div class="modal-body">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:6px">
                <div>
                  <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">Commission %</label>
                  <input class="form-control" id="m_pct" type="number" min="0" max="50" step="0.5">
                  <div style="font-size:11px;color:var(--text-light);margin-top:3px">Item subtotal ka % har order pe</div>
                </div>
                <div>
                  <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">Flat per order</label>
                  <input class="form-control" id="m_flat" type="number" min="0" step="0.5">
                  <div style="font-size:11px;color:var(--text-light);margin-top:3px">Fixed charge har order pe</div>
                </div>
              </div>
              <div style="font-size:11.5px;color:var(--text-light);margin-bottom:14px">
                Dono 0 = platform default (Quick Commerce Settings). Naye orders pe lagega — purane orders pe jo rate order ke waqt tha wahi frozen hai.
              </div>
              <button class="btn btn-primary" id="m_save" style="width:100%">Save commission</button>

              <hr style="border:none;border-top:1px solid var(--border);margin:18px 0 14px">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
                <b style="font-size:13.5px">Settlement (last 30 days)</b>
                <button class="btn btn-sm btn-outline" id="m_refresh">Refresh</button>
              </div>
              <div id="m_stmt"><div class="spinner"></div></div>
            </div>
          </div>
        </div>
      `;
      renderPagination("pagination", page, pages, load);
    } catch (err) { content.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`; }
  }

  let moneyPartner = null;

  window.openMoney = async (id, name) => {
    moneyPartner = id;
    document.getElementById("money-title").textContent = "Commission — " + name;
    document.getElementById("m_stmt").innerHTML = '<div class="spinner"></div>';
    openModal("money-modal");

    // Current rate comes from the partner detail (kyc rides along on it)
    try {
      const d = await API.get(`/admin/partners/${id}`);
      document.getElementById("m_pct").value = d.kyc?.commissionPercent ?? 0;
      document.getElementById("m_flat").value = d.kyc?.commissionFlat ?? 0;
    } catch (e) {
      document.getElementById("m_pct").value = "";
      document.getElementById("m_flat").value = "";
    }
    loadStatement();

    document.getElementById("m_save").onclick = async () => {
      try {
        const r = await API.put(`/admin/partners/${moneyPartner}/commission`, {
          percent: parseFloat(document.getElementById("m_pct").value) || 0,
          flat: parseFloat(document.getElementById("m_flat").value) || 0,
        });
        showToast(r.message || "Saved");
      } catch (e) { showToast(e.message, "error"); }
    };
    document.getElementById("m_refresh").onclick = loadStatement;
  };

  async function loadStatement() {
    const box = document.getElementById("m_stmt");
    box.innerHTML = '<div class="spinner"></div>';
    try {
      const s = await API.get(`/admin/partners/${moneyPartner}/settlement`);
      const row = (l, v, b) => `<div style="display:flex;justify-content:space-between;padding:3px 0">
        <span style="font-size:13px;color:var(--text-light)">${l}</span>
        <span style="font-size:13px;font-weight:${b ? 800 : 600}">${v}</span></div>`;
      box.innerHTML =
        row("Delivered orders", s.orders)
        + row("Gross (items)", s.gross.toLocaleString())
        + row("Commission (platform)", "− " + s.commission.toLocaleString())
        + '<hr style="border:none;border-top:1px dashed var(--border);margin:6px 0">'
        + row("Net payable", s.net.toLocaleString(), true)
        + (s.codCollectedByShop > 0
            ? row("COD already with the shop", s.codCollectedByShop.toLocaleString())
            : "")
        + row("Paid out till date (all time)", s.alreadyPaidAllTime.toLocaleString())
        + `<div style="font-size:11px;color:var(--text-light);margin-top:8px">
             Payout banane ke liye Payouts page pe "Net payable" amount use karo.
             COD wale orders ka paisa shop ke paas pehle se hai — us hisaab se adjust karna.
           </div>`;
    } catch (e) {
      box.innerHTML = `<div style="color:#B91C1C;font-size:13px">${esc(e.message)}</div>`;
    }
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
