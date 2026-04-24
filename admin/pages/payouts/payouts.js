(async function () {
  document.body.innerHTML += pageShell("Payouts");
  buildLayout("payouts");

  const content = document.getElementById("page-content");
  let _processPayoutId = null;

  // Load partners for dropdown
  async function loadPartners() {
    try {
      const data = await API.get("/admin/partners");
      const sel = document.getElementById("cp-partner");
      (data.partners || []).forEach(p => {
        const opt = document.createElement("option");
        opt.value = p._id;
        opt.textContent = p.name ? `${p.name} (${p.phone})` : p.phone;
        sel.appendChild(opt);
      });
    } catch (_) {}
  }
  loadPartners();

  async function load() {
    content.innerHTML = `<div class="text-center"><div class="spinner"></div></div>`;
    try {
      const data = await API.get("/admin/payouts");
      const payouts = data.payouts || [];

      content.innerHTML = `
        <div class="toolbar">
          <div class="toolbar-left"><span class="text-muted text-sm">${payouts.length} payouts</span></div>
          <div class="toolbar-right"><button class="btn btn-primary btn-sm" onclick="createPayout()">+ Create Payout</button></div>
        </div>
        <div class="card">
          <div class="card-body table-wrap">
            <table>
              <thead><tr><th>Partner</th><th>Amount</th><th>Commission</th><th>Net Payout</th><th>Status</th><th>Period</th><th>Actions</th></tr></thead>
              <tbody>
                ${payouts.map(p => `
                  <tr>
                    <td>${p.partner?.name || p.partner?.phone || '-'}</td>
                    <td>${fmtCurrency(p.amount)}</td>
                    <td>${fmtCurrency(p.commission)}</td>
                    <td><strong>${fmtCurrency(p.netPayout)}</strong></td>
                    <td>${statusBadge(p.status)}</td>
                    <td class="text-sm">${p.period?.from ? new Date(p.period.from).toLocaleDateString() + ' – ' + new Date(p.period.to).toLocaleDateString() : '-'}</td>
                    <td>
                      ${p.status === 'pending' ? `<button class="btn btn-success btn-sm" onclick="processPay('${p._id}')">Process</button>` : '—'}
                    </td>
                  </tr>
                `).join("") || `<tr><td colspan="7" class="text-center text-muted">No payouts</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) { content.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`; }
  }

  window.createPayout = () => {
    document.getElementById("cp-partner").value = "";
    document.getElementById("cp-from").value = "";
    document.getElementById("cp-to").value = "";
    document.getElementById("cp-commission").value = "0";
    document.getElementById("cp-tds").value = "0";
    document.getElementById("cp-paymentMode").value = "bank_transfer";
    document.getElementById("cp-note").value = "";
    openModal("create-payout-modal");
  };

  window.saveCreatePayout = async () => {
    const partner = document.getElementById("cp-partner").value;
    const from = document.getElementById("cp-from").value;
    const to = document.getElementById("cp-to").value;
    const commission = parseFloat(document.getElementById("cp-commission").value) || 0;
    const tds = parseFloat(document.getElementById("cp-tds").value) || 0;
    const paymentMode = document.getElementById("cp-paymentMode").value;
    const note = document.getElementById("cp-note").value.trim();

    if (!partner) return showToast("Please select a partner", "error");
    if (!from || !to) return showToast("Please select date range", "error");

    const btn = document.getElementById("cp-save-btn");
    btn.disabled = true; btn.textContent = "Creating…";
    try {
      await API.post("/admin/payouts", { partner, from, to, commission, tds, paymentMode, note });
      closeModal("create-payout-modal");
      showToast("Payout created");
      load();
    } catch (err) { showToast(err.message, "error"); }
    btn.disabled = false; btn.textContent = "Create Payout";
  };

  window.processPay = (id) => {
    _processPayoutId = id;
    document.getElementById("pp-status").value = "completed";
    document.getElementById("pp-txnId").value = "";
    openModal("process-payout-modal");
  };

  window.saveProcessPayout = async () => {
    const status = document.getElementById("pp-status").value;
    const transactionId = document.getElementById("pp-txnId").value.trim();

    const btn = document.getElementById("pp-save-btn");
    btn.disabled = true; btn.textContent = "Saving…";
    try {
      await API.put(`/admin/payouts/${_processPayoutId}/process`, { status, transactionId });
      closeModal("process-payout-modal");
      showToast("Payout processed");
      load();
    } catch (err) { showToast(err.message, "error"); }
    btn.disabled = false; btn.textContent = "Save";
  };

  load();
})();
