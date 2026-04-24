(async function () {
  document.body.innerHTML = pageShell("Wallets");
  buildLayout("wallets");

  const content = document.getElementById("page-content");

  async function load() {
    content.innerHTML = `<div class="text-center"><div class="spinner"></div></div>`;
    try {
      const data = await API.get("/admin/wallets");
      const wallets = data.wallets || [];

      content.innerHTML = `
        <div class="card">
          <div class="card-header">
            <h3>User Wallets (${wallets.length})</h3>
          </div>
          <div class="card-body table-wrap">
            <table>
              <thead><tr><th>User</th><th>Phone</th><th>Balance</th><th>Actions</th></tr></thead>
              <tbody>
                ${wallets.map(w => `
                  <tr>
                    <td>${w.user?.name || '-'}</td>
                    <td>${w.user?.phone || '-'}</td>
                    <td><strong>${fmtCurrency(w.balance)}</strong></td>
                    <td class="d-flex gap-2">
                      <button class="btn btn-outline btn-sm" onclick="viewTxns('${w.user?._id || w.user}')">Transactions</button>
                      <button class="btn btn-primary btn-sm" onclick="creditWallet('${w.user?._id || w.user}')">Credit</button>
                    </td>
                  </tr>
                `).join("") || `<tr><td colspan="4" class="text-center text-muted">No wallets</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>

        <div class="modal-overlay" id="txn-modal">
          <div class="modal" style="max-width:600px">
            <div class="modal-header"><h3>Transactions</h3><button class="modal-close" onclick="closeModal('txn-modal')">&times;</button></div>
            <div class="modal-body" id="txn-body">Loading...</div>
          </div>
        </div>
      `;
    } catch (err) { content.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`; }
  }

  window.viewTxns = async (userId) => {
    openModal("txn-modal");
    const body = document.getElementById("txn-body");
    body.innerHTML = `<div class="text-center"><div class="spinner"></div></div>`;
    try {
      const data = await API.get(`/admin/wallets/${userId}/transactions`);
      const txns = data.transactions || [];
      body.innerHTML = `
        <table>
          <thead><tr><th>Type</th><th>Amount</th><th>Source</th><th>Description</th><th>Date</th></tr></thead>
          <tbody>
            ${txns.map(t => `
              <tr>
                <td>${t.type === 'credit' ? '<span class="badge badge-success">Credit</span>' : '<span class="badge badge-danger">Debit</span>'}</td>
                <td>${fmtCurrency(t.amount)}</td>
                <td class="text-sm">${t.source || '-'}</td>
                <td class="text-sm">${(t.description || '').substring(0, 30)}</td>
                <td>${fmtDateTime(t.createdAt)}</td>
              </tr>
            `).join("") || `<tr><td colspan="5" class="text-center text-muted">No transactions</td></tr>`}
          </tbody>
        </table>
      `;
    } catch (err) { body.innerHTML = `<p class="text-muted">${err.message}</p>`; }
  };

  window.creditWallet = async (userId) => {
    const amount = prompt("Amount to credit:");
    if (!amount || isNaN(amount) || Number(amount) <= 0) return showToast("Invalid amount", "error");
    const description = prompt("Reason:") || "Admin credit";
    try {
      await API.post(`/admin/wallets/${userId}/credit`, { amount: Number(amount), description });
      showToast(`₹${amount} credited`);
      load();
    } catch (err) { showToast(err.message, "error"); }
  };

  load();
})();
