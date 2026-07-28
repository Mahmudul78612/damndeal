(function () {
  requireAuth();
  document.body.innerHTML = pageShell('Investors');
  buildLayout('investors');

  const main = document.getElementById('page-content');
  let activeTab = 'analytics';
  let investors = [], purchases = [], withdrawals = [], analytics = {};

  // ── Tabs ──────────────────────────────────────────────────────────────────
  function tabBar() {
    return `
      <div style="display:flex;gap:.5rem;margin-bottom:1.5rem;flex-wrap:wrap">
        ${[['analytics','📊 Analytics'],['list','👥 Investors'],['purchases','🛒 Purchases'],['withdrawals','💸 Withdrawals']].map(([id,label]) =>
          `<button class="btn btn-sm ${activeTab===id?'btn-primary':'btn-outline'}" onclick="switchTab('${id}')">${label}</button>`
        ).join('')}
      </div>`;
  }

  window.switchTab = function(tab) { activeTab = tab; render(); };

  // ── Render ────────────────────────────────────────────────────────────────
  function render() {
    main.innerHTML = tabBar() + (
      activeTab === 'analytics' ? renderAnalytics() :
      activeTab === 'list'      ? renderList() :
      activeTab === 'purchases' ? renderPurchases() :
                                   renderWithdrawals()
    );
  }

  function badge(s) {
    const m = { pending:'badge-gray', approved:'badge-success', rejected:'badge-danger', submitted:'badge-warning', processed:'badge-success', not_submitted:'badge-gray' };
    return `<span class="badge ${m[s]||'badge-gray'}">${s}</span>`;
  }
  function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—'; }
  function esc(s) { const d=document.createElement('div'); d.textContent=String(s||''); return d.innerHTML; }

  function renderAnalytics() {
    const a = analytics;
    return `
      <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-bottom:2rem">
        <div class="stat-card"><div class="label">Total Investors</div><div class="value">${a.totalInvestors||0}</div></div>
        <div class="stat-card"><div class="label">Approved</div><div class="value">${a.approvedInvestors||0}</div></div>
        <div class="stat-card"><div class="label">KYC Pending</div><div class="value">${a.pendingKyc||0}</div>
          ${a.pendingKyc > 0 ? `<div class="sub" style="color:var(--warning)">⚠️ Action needed</div>` : ''}</div>
        <div class="stat-card"><div class="label">Total Slots Sold</div><div class="value">${(a.totalSlotsSold||0).toLocaleString('en-IN')}</div></div>
        <div class="stat-card"><div class="label">Total Revenue</div><div class="value">₹${(a.totalRevenue||0).toLocaleString('en-IN')}</div></div>
        <div class="stat-card"><div class="label">Pending Purchases</div><div class="value">${a.pendingPurchases||0}</div>
          ${a.pendingPurchases > 0 ? `<div class="sub" style="color:var(--warning)">⚠️ Approve</div>` : ''}</div>
        <div class="stat-card"><div class="label">Pending Withdrawals</div><div class="value">${a.pendingWithdrawals||0}</div>
          ${a.pendingWithdrawals > 0 ? `<div class="sub" style="color:var(--warning)">⚠️ Process</div>` : ''}</div>
        <div class="stat-card"><div class="label">Total Paid Out</div><div class="value">₹${(a.totalPayoutsDone||0).toLocaleString('en-IN')}</div></div>
      </div>
      <div class="card">
        <h3 style="font-size:1rem;margin-bottom:1rem">⚙️ Slot Price Setting</h3>
        <div style="display:flex;gap:1rem;align-items:flex-end;flex-wrap:wrap">
          <div class="form-group" style="margin:0">
            <label>Price per Slot (₹)</label>
            <input class="form-control" id="slot-price-inp" type="number" value="${a.slotPrice||1000}" style="width:160px">
          </div>
          <button class="btn btn-primary" onclick="saveSlotPrice()">Save Price</button>
        </div>
      </div>`;
  }

  function renderList() {
    return `
      <div class="toolbar" style="margin-bottom:1rem">
        <div style="display:flex;gap:.5rem;flex-wrap:wrap">
          <select class="form-control" id="filter-status" onchange="filterInvestors()" style="width:160px">
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select class="form-control" id="filter-kyc" onchange="filterInvestors()" style="width:180px">
            <option value="">All KYC</option>
            <option value="not_submitted">Not Submitted</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Phone</th><th>KYC</th><th>Status</th><th>Slots</th><th>Points</th><th>Joined</th><th>Actions</th></tr></thead>
            <tbody id="inv-list-body">
              ${investors.length ? investors.map(inv => `
                <tr>
                  <td>${esc(inv.name)}</td>
                  <td>${esc(inv.phone)}</td>
                  <td>${badge(inv.kycStatus)}</td>
                  <td>${badge(inv.status)}</td>
                  <td>${inv.totalSlotsOwned||0}</td>
                  <td>${(inv.pointsBalance||0).toLocaleString('en-IN')}</td>
                  <td>${fmtDate(inv.createdAt)}</td>
                  <td style="display:flex;gap:.4rem;flex-wrap:wrap">
                    <button class="btn btn-sm btn-primary" onclick="viewInvestor('${inv._id}')">View</button>
                    ${inv.kycStatus==='submitted' ? `<button class="btn btn-sm btn-accent" onclick="kycAction('${inv._id}','approved')">✅ KYC</button>
                      <button class="btn btn-sm btn-danger" onclick="kycAction('${inv._id}','rejected')">❌ KYC</button>` : ''}
                    <button class="btn btn-sm" style="background:#EDE9FE;color:#5B21B6" onclick="creditModal('${inv._id}','${esc(inv.name)}')">+ Points</button>
                  </td>
                </tr>`).join('') : '<tr><td colspan="8" class="empty-state">No investors</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function renderPurchases() {
    return `
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Investor</th><th>Slots</th><th>Amount</th><th>UTR</th><th>Receipt</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              ${purchases.length ? purchases.map(p => `
                <tr>
                  <td>${fmtDate(p.createdAt)}</td>
                  <td>${p.investorName||p.investor}</td>
                  <td>${p.slotsRequested}</td>
                  <td>₹${(p.totalAmount||0).toLocaleString('en-IN')}</td>
                  <td>${esc(p.transactionRef||'—')}</td>
                  <td>${p.receiptUrl ? `<a href="${p.receiptUrl}" target="_blank" class="btn btn-sm btn-outline">View</a>` : '—'}</td>
                  <td>${badge(p.status)}</td>
                  <td>
                    ${p.status==='pending' ? `
                      <button class="btn btn-sm btn-primary" onclick="approvePurchaseModal('${p._id}',${p.slotsRequested})">Approve</button>
                      <button class="btn btn-sm btn-danger" onclick="rejectPurchase('${p._id}')">Reject</button>` : ''}
                    ${p.status==='approved' ? `<span style="font-size:.8rem;color:var(--muted)">${p.slotsApproved} slots assigned</span>` : ''}
                  </td>
                </tr>`).join('') : '<tr><td colspan="8" class="empty-state">No purchase requests</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function renderWithdrawals() {
    return `
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Investor</th><th>Points</th><th>₹</th><th>Bank/UPI</th><th>Status</th><th>UTR</th><th>Actions</th></tr></thead>
            <tbody>
              ${withdrawals.length ? withdrawals.map(w => `
                <tr>
                  <td>${fmtDate(w.createdAt)}</td>
                  <td>${w.investorName||w.investor}</td>
                  <td>${(w.pointsRequested||0).toLocaleString('en-IN')}</td>
                  <td>₹${w.amountInRupees||0}</td>
                  <td style="font-size:.8rem">${w.bankDetails?.upiId || w.bankDetails?.accountNumber || '—'}</td>
                  <td>${badge(w.status)}</td>
                  <td>${w.utrNumber||'—'}</td>
                  <td>
                    ${w.status==='pending' ? `
                      <button class="btn btn-sm btn-primary" onclick="processWithdrawal('${w._id}')">Process</button>
                      <button class="btn btn-sm btn-danger" onclick="rejectWithdrawal('${w._id}')">Reject</button>` : ''}
                  </td>
                </tr>`).join('') : '<tr><td colspan="8" class="empty-state">No withdrawal requests</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  // ── Load data ─────────────────────────────────────────────────────────────
  async function load() {
    main.innerHTML = `<div class="text-center"><div class="spinner"></div></div>`;
    try {
      const [analyticsRes, invRes, allPurchases, allWithdrawals] = await Promise.all([
        API.get('/admin/investors/analytics'),
        API.get('/admin/investors?limit=100'),
        API.get('/admin/investors?limit=100'),
        API.get('/admin/investors?limit=100'),
      ]);
      analytics = analyticsRes.analytics || {};
      investors = invRes.investors || [];

      // Flatten purchases + withdrawals across all investors
      const allInvRes = await API.get('/admin/investors?limit=200');
      investors = allInvRes.investors || [];

      // Load all purchases and withdrawals
      const purchasePromises = investors.slice(0,50).map(inv => API.get(`/admin/investors/${inv._id}`));
      const details = await Promise.all(purchasePromises);
      purchases = [];
      withdrawals = [];
      details.forEach((d, i) => {
        const invName = investors[i]?.name || '';
        (d.purchases||[]).forEach(p => purchases.push({...p, investorName: invName}));
        (d.withdrawals||[]).forEach(w => withdrawals.push({...w, investorName: invName}));
      });
      purchases.sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
      withdrawals.sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
    } catch(e) { showToast(e.message,'error'); }
    render();
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  window.filterInvestors = function() { render(); };

  window.viewInvestor = async function(id) {
    const res = await API.get(`/admin/investors/${id}`);
    const inv = res.investor;
    showModal(`
      <h3>${esc(inv.name)}</h3>
      <p style="color:var(--muted);margin-bottom:1rem">${inv.phone} · ${inv.email||'no email'}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;font-size:.88rem;margin-bottom:1rem">
        <div><strong>Status:</strong> ${badge(inv.status)}</div>
        <div><strong>KYC:</strong> ${badge(inv.kycStatus)}</div>
        <div><strong>Slots:</strong> ${inv.totalSlotsOwned||0}</div>
        <div><strong>Points:</strong> ${(inv.pointsBalance||0).toLocaleString()}</div>
        <div><strong>Earned:</strong> ${(inv.totalEarned||0).toLocaleString()}</div>
        <div><strong>Withdrawn:</strong> ₹${(inv.totalWithdrawn||0).toLocaleString()}</div>
      </div>
      ${inv.bankDetails?.accountNumber ? `
        <div style="background:#F9FAFB;padding:.75rem;border-radius:8px;font-size:.85rem;margin-bottom:1rem">
          <strong>Bank:</strong> ${esc(inv.bankDetails.accountHolder||'')} · ${esc(inv.bankDetails.accountNumber)} · ${esc(inv.bankDetails.ifsc||'')}
          ${inv.bankDetails.upiId ? `· UPI: ${esc(inv.bankDetails.upiId)}` : ''}
        </div>` : ''}
      ${(inv.kycDocuments||[]).length ? `
        <div style="margin-bottom:1rem">
          <strong>KYC Documents:</strong><br>
          ${inv.kycDocuments.map(d => `<a href="${d.url}" target="_blank" class="btn btn-sm btn-outline" style="margin-top:.4rem">${d.docType}</a> `).join('')}
        </div>` : ''}
      ${inv.adminNote ? `<div class="alert" style="background:#FFF7ED;border:1px solid #FED7AA;color:#9A3412;font-size:.85rem">Note: ${esc(inv.adminNote)}</div>` : ''}
    `);
  };

  window.kycAction = async function(id, status) {
    const note = status === 'rejected' ? prompt('Rejection reason (optional):') : null;
    const res = await API.put(`/admin/investors/${id}/kyc`, { kycStatus: status, adminNote: note });
    if (res.success) { showToast(`KYC ${status}`,'success'); load(); }
    else showToast(res.message,'error');
  };

  window.creditModal = function(id, name) {
    showModal(`
      <h3>Credit Points — ${esc(name)}</h3>
      <div class="form-group"><label>Points to Credit</label><input class="form-control" id="credit-pts" type="number" min="1" placeholder="e.g. 500"></div>
      <div class="form-group"><label>Reason (optional)</label><input class="form-control" id="credit-reason" placeholder="Monthly reward"></div>
      <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:1rem">
        <button class="btn" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="doCredit('${id}')">Credit Points</button>
      </div>`);
  };

  window.doCredit = async function(id) {
    const pts = parseInt(document.getElementById('credit-pts').value);
    const reason = document.getElementById('credit-reason').value.trim();
    if (!pts || pts < 1) { showToast('Enter valid points','error'); return; }
    const res = await API.post(`/admin/investors/${id}/credit-points`, { points: pts, reason });
    if (res.success) { showToast(`${pts} points credited`,'success'); closeModal(); load(); }
    else showToast(res.message,'error');
  };

  window.approvePurchaseModal = function(purchaseId, slots) {
    showModal(`
      <h3>Approve Purchase</h3>
      <p style="color:var(--muted);font-size:.9rem;margin-bottom:1rem">${slots} slots requested. Enter Magic Club IDs to assign (one per line or comma-separated). Leave blank to auto-assign count.</p>
      <div class="form-group"><label>Magic Club Slot IDs (${slots} needed)</label>
        <textarea class="form-control" id="slot-ids-inp" rows="4" placeholder="MC_001, MC_002, MC_003…"></textarea></div>
      <div class="form-group"><label>Admin Note (optional)</label><input class="form-control" id="approve-note" placeholder=""></div>
      <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:1rem">
        <button class="btn" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="doApprovePurchase('${purchaseId}')">Approve & Assign</button>
      </div>`);
  };

  window.doApprovePurchase = async function(purchaseId) {
    const raw = document.getElementById('slot-ids-inp').value.trim();
    const slotIds = raw ? raw.split(/[\n,]+/).map(s=>s.trim()).filter(Boolean) : [];
    const adminNote = document.getElementById('approve-note').value.trim();
    const res = await API.put(`/admin/investors/purchases/${purchaseId}`, { status:'approved', slotIds, adminNote });
    if (res.success) { showToast('Purchase approved','success'); closeModal(); load(); }
    else showToast(res.message,'error');
  };

  window.rejectPurchase = async function(purchaseId) {
    const note = prompt('Rejection reason:') || '';
    if (!confirm('Reject this purchase?')) return;
    const res = await API.put(`/admin/investors/purchases/${purchaseId}`, { status:'rejected', adminNote: note });
    if (res.success) { showToast('Purchase rejected','success'); load(); }
    else showToast(res.message,'error');
  };

  window.processWithdrawal = async function(wId) {
    const utr = prompt('Enter UTR / payment reference number:');
    if (!utr) return;
    const res = await API.put(`/admin/investors/withdrawals/${wId}`, { status:'processed', utrNumber: utr });
    if (res.success) { showToast('Withdrawal processed','success'); load(); }
    else showToast(res.message,'error');
  };

  window.rejectWithdrawal = async function(wId) {
    const note = prompt('Rejection reason:') || '';
    if (!confirm('Reject this withdrawal? Points will be refunded.')) return;
    const res = await API.put(`/admin/investors/withdrawals/${wId}`, { status:'rejected', adminNote: note });
    if (res.success) { showToast('Withdrawal rejected, points refunded','success'); load(); }
    else showToast(res.message,'error');
  };

  window.saveSlotPrice = async function() {
    const price = parseInt(document.getElementById('slot-price-inp').value);
    if (!price || price < 1) { showToast('Enter valid price','error'); return; }
    const res = await API.put('/admin/settings', { key: 'investor_slot_price', value: String(price) });
    if (res.success) { showToast('Slot price updated','success'); analytics.slotPrice = price; }
    else showToast(res.message,'error');
  };

  load();
})();
