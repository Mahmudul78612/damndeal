(function () {
  document.body.innerHTML = pageShell("Product Reviews");
  buildLayout("reviews");
  const content = document.getElementById("page-content");

  function esc(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }
  function imgUrl(path) { return path ? CONFIG.API_BASE.replace('/api', '') + '/' + path : ''; }
  function stars(n) {
    let h = '';
    for (let i = 1; i <= 5; i++) h += `<span style="color:${i <= n ? '#facc15' : '#e5e7eb'}">★</span>`;
    return h;
  }

  let page = 1, statusFilter = "pending", searchQ = "";

  async function load(p = 1) {
    page = p;
    content.innerHTML = '<div class="text-center" style="padding:40px"><div class="spinner"></div></div>';
    try {
      let ep = `/admin/user-reviews?page=${page}&limit=30&status=${statusFilter}`;
      if (searchQ) ep += "&q=" + encodeURIComponent(searchQ);
      const data = await API.get(ep);
      const reviews = data.reviews || [];
      const pag = data.pagination || {};
      const sc = data.statusCounts || {};

      content.innerHTML = `
        <div class="platform-tabs">
          <button class="ptab ${statusFilter === 'pending' ? 'active' : ''}" onclick="window._setStatus('pending')">Pending (${sc.pending || 0})</button>
          <button class="ptab ${statusFilter === 'approved' ? 'active' : ''}" onclick="window._setStatus('approved')">Approved (${sc.approved || 0})</button>
          <button class="ptab ${statusFilter === 'rejected' ? 'active' : ''}" onclick="window._setStatus('rejected')">Rejected (${sc.rejected || 0})</button>
          <button class="ptab ${statusFilter === 'all' ? 'active' : ''}" onclick="window._setStatus('all')">All</button>
        </div>
        <div class="toolbar">
          <div class="toolbar-left">
            <input class="search-input" placeholder="Search by user or comment..." value="${esc(searchQ)}" onkeyup="if(event.key==='Enter'){window._sq=this.value;window._loadP(1)}">
            <span class="text-muted text-sm">${pag.total || 0} reviews</span>
          </div>
          <div class="toolbar-right">
            <button class="btn btn-sm btn-primary" onclick="window._openSeed()">+ Add Fake Review</button>
          </div>
        </div>
        ${renderList(reviews)}
        <div class="pagination" id="pag"></div>
        <div id="seed-modal-wrap"></div>
      `;
      renderPagination("pag", page, pag.pages || 1, window._loadP);
    } catch (e) {
      content.innerHTML = '<div class="empty-state"><p>' + esc(e.message) + '</p></div>';
    }
  }

  function renderList(reviews) {
    if (!reviews.length) return '<div class="empty-state"><p>No reviews</p></div>';
    return `<div style="display:flex;flex-direction:column;gap:12px">
      ${reviews.map(r => {
        const prodImg = r.product?.images?.[0] ? imgUrl(r.product.images[0]) : '';
        return `<div style="background:#fff;border:1px solid #eee;border-radius:12px;padding:14px">
          <div style="display:flex;gap:12px;align-items:flex-start">
            <div style="width:60px;height:60px;border-radius:8px;background:#f3f4f6;overflow:hidden;flex-shrink:0">
              ${prodImg ? `<img src="${prodImg}" style="width:100%;height:100%;object-fit:cover">` : ''}
            </div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
                <p style="font-weight:600;font-size:14px;margin:0">${esc(r.product?.name || 'Product deleted')}</p>
                <span style="font-size:11px;padding:2px 8px;border-radius:4px;font-weight:600;background:${
                  r.status === 'pending' ? '#fef3c7' : r.status === 'approved' ? '#d1fae5' : '#fee2e2'
                };color:${
                  r.status === 'pending' ? '#92400e' : r.status === 'approved' ? '#065f46' : '#991b1b'
                }">${r.status.toUpperCase()}</span>
              </div>
              <div style="display:flex;align-items:center;gap:8px;margin-top:4px;font-size:12px;color:#6b7280">
                <span style="font-size:14px">${stars(r.rating)}</span>
                <span>•</span>
                <span>${esc(r.userName || 'Anonymous')}</span>
                ${r.user?.phone ? `<span>• ${esc(r.user.phone)}</span>` : ''}
                <span>• ${new Date(r.createdAt).toLocaleString('en-IN')}</span>
              </div>
              ${r.title ? `<p style="font-weight:600;margin:6px 0 2px 0;font-size:13px">${esc(r.title)}</p>` : ''}
              ${r.comment ? `<p style="margin:4px 0;font-size:13px;color:#374151;white-space:pre-line">${esc(r.comment)}</p>` : ''}
              ${r.rejectionReason ? `<p style="margin:4px 0;font-size:11px;color:#991b1b">Rejected: ${esc(r.rejectionReason)}</p>` : ''}
            </div>
          </div>
          <div style="display:flex;gap:6px;margin-top:10px;justify-content:flex-end">
            ${r.status !== 'approved' ? `<button class="btn btn-sm" style="background:#10b981;color:#fff" onclick="window._mod('${r._id}','approve')">Approve</button>` : ''}
            ${r.status !== 'rejected' ? `<button class="btn btn-sm" style="background:#ef4444;color:#fff" onclick="window._mod('${r._id}','reject')">Reject</button>` : ''}
            <button class="btn btn-sm btn-secondary" onclick="window._del('${r._id}')">Delete</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  window._setStatus = (s) => { statusFilter = s; load(1); };
  window._loadP = (p) => load(p);
  window._sq = "";

  window._mod = async (id, action) => {
    let reason = "";
    if (action === 'reject') {
      reason = prompt("Reason for rejection (optional):") || "";
    }
    try {
      await API.put(`/admin/user-reviews/${id}/moderate`, { action, reason });
      load(page);
    } catch (e) { alert("Failed: " + e.message); }
  };

  window._del = async (id) => {
    if (!confirm("Delete this review permanently?")) return;
    try {
      await API.delete(`/admin/user-reviews/${id}`);
      load(page);
    } catch (e) { alert("Failed: " + e.message); }
  };

  window._openSeed = () => {
    document.getElementById('seed-modal-wrap').innerHTML = `
      <div class="modal-overlay" onclick="if(event.target===this)window._closeSeed()">
        <div class="modal" style="max-width:500px">
          <div class="modal-header"><h3>Add Fake Review</h3><button onclick="window._closeSeed()">&times;</button></div>
          <div class="modal-body" style="display:flex;flex-direction:column;gap:10px">
            <input id="seed-pid" class="form-control" placeholder="Product ID *">
            <select id="seed-rating" class="form-control">
              <option value="5">★★★★★ (5)</option>
              <option value="4">★★★★ (4)</option>
              <option value="3">★★★ (3)</option>
              <option value="2">★★ (2)</option>
              <option value="1">★ (1)</option>
            </select>
            <input id="seed-name" class="form-control" placeholder="Reviewer name (e.g. Rahul S.)" value="Verified Buyer">
            <input id="seed-title" class="form-control" placeholder="Review title (optional)">
            <textarea id="seed-comment" class="form-control" rows="4" placeholder="Review comment"></textarea>
            <button class="btn btn-primary" onclick="window._submitSeed()">Submit</button>
          </div>
        </div>
      </div>
    `;
  };
  window._closeSeed = () => { document.getElementById('seed-modal-wrap').innerHTML = ''; };
  window._submitSeed = async () => {
    const productId = document.getElementById('seed-pid').value.trim();
    const rating = document.getElementById('seed-rating').value;
    const userName = document.getElementById('seed-name').value.trim();
    const title = document.getElementById('seed-title').value.trim();
    const comment = document.getElementById('seed-comment').value.trim();
    if (!productId) return alert('Product ID required');
    try {
      await API.post('/admin/user-reviews/seed', { productId, rating, userName, title, comment });
      window._closeSeed();
      load(1);
    } catch (e) { alert("Failed: " + e.message); }
  };

  load(1);
})();
