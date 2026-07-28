(function(){
  requireAuth();
  document.body.innerHTML = pageShell('Offers');
  buildLayout('offers');
  const content = document.getElementById('page-content');

  let page = 1, items = [];

  async function load(p=1){
    page = p;
    content.innerHTML = '<div class="text-center"><div class="spinner"></div></div>';
    try {
      const data = await API.get(`/partner/offers?page=${page}&limit=20`);
      items = data.offers || [];
      const total = data.total || 0;
      const pages = data.pages || 1;

      content.innerHTML = `
        <div class="toolbar">
          <span class="text-muted text-sm">${total} offers</span>
          <button class="btn btn-sm btn-primary" onclick="openAdd()">+ Create Offer</button>
        </div>

        <div class="card">
          <div class="card-body table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Discount</th><th>Products</th><th>Valid From</th><th>Valid To</th><th>Actions</th></tr></thead>
              <tbody>
                ${items.map(o=>`
                  <tr>
                    <td><strong>${esc(o.name)}</strong>${o.description?'<br><small class="text-muted">'+esc(o.description)+'</small>':''}</td>
                    <td>${o.discountType==='percentage' ? o.discountValue+'%' : fmtCurrency(o.discountValue)} <span class="badge badge-gray">${o.discountType}</span></td>
                    <td>${(o.products||[]).length} items</td>
                    <td>${fmtDate(o.validFrom)}</td>
                    <td>${o.validTo ? fmtDate(o.validTo) : 'No expiry'}</td>
                    <td>
                      <div class="d-flex gap-1">
                        <button class="btn btn-xs" onclick="openEdit('${o._id}')">Edit</button>
                        <button class="btn btn-xs btn-danger" onclick="delOffer('${o._id}')">Del</button>
                      </div>
                    </td>
                  </tr>`).join('')||'<tr><td colspan="6" class="text-center text-muted">No offers</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
        <div class="pagination" id="pag"></div>

        <!-- Modal -->
        <div class="modal-overlay" id="offer-modal">
          <div class="modal" style="max-width:500px">
            <div class="modal-header"><h3 id="ofTitle">Create Offer</h3><button class="modal-close" onclick="closeModal('offer-modal')">&times;</button></div>
            <div class="modal-body">
              <div class="form-group"><label>Name *</label><input class="form-control" id="fName" required></div>
              <div class="form-group"><label>Description</label><textarea class="form-control" id="fDesc" rows="2"></textarea></div>
              <div class="form-row">
                <div class="form-group"><label>Type</label><select class="form-control" id="fType"><option value="percentage">Percentage</option><option value="fixed">Fixed</option></select></div>
                <div class="form-group"><label>Value *</label><input class="form-control" id="fVal" type="number" min="0" required></div>
              </div>
              <div class="form-group"><label>Product IDs <small class="text-muted">(comma separated)</small></label><input class="form-control" id="fProds" placeholder="id1, id2, ..."></div>
              <div class="form-row">
                <div class="form-group"><label>Valid From *</label><input class="form-control" id="fFrom" type="date" required></div>
                <div class="form-group"><label>Valid To</label><input class="form-control" id="fTo" type="date"></div>
              </div>
              <div class="modal-footer" style="padding:0;border:none;margin-top:14px">
                <button class="btn" onclick="closeModal('offer-modal')">Cancel</button>
                <button class="btn btn-primary" onclick="saveOffer()">Save</button>
              </div>
            </div>
          </div>
        </div>`;
      renderPagination('pag', page, pages, loadOf);
    } catch(e){ content.innerHTML = '<div class="empty-state"><p>'+esc(e.message)+'</p></div>'; }
  }

  window.loadOf = function(p){ load(p); };

  let editId = null;

  window.openAdd = function(){
    editId = null;
    load(page).then(()=>{
      document.getElementById('ofTitle').textContent = 'Create Offer';
      document.getElementById('fName').value = '';
      document.getElementById('fDesc').value = '';
      document.getElementById('fType').value = 'percentage';
      document.getElementById('fVal').value = '';
      document.getElementById('fProds').value = '';
      document.getElementById('fFrom').value = new Date().toISOString().slice(0,10);
      document.getElementById('fTo').value = '';
      openModal('offer-modal');
    });
  };

  window.openEdit = function(id){
    const o = items.find(x=>x._id===id);
    if(!o) return;
    editId = id;
    load(page).then(()=>{
      document.getElementById('ofTitle').textContent = 'Edit Offer';
      document.getElementById('fName').value = o.name||'';
      document.getElementById('fDesc').value = o.description||'';
      document.getElementById('fType').value = o.discountType||'percentage';
      document.getElementById('fVal').value = o.discountValue||'';
      document.getElementById('fProds').value = (o.products||[]).map(p=>p._id||p).join(', ');
      document.getElementById('fFrom').value = o.validFrom ? o.validFrom.slice(0,10) : '';
      document.getElementById('fTo').value = o.validTo ? o.validTo.slice(0,10) : '';
      openModal('offer-modal');
    });
  };

  window.saveOffer = async function(){
    const name = document.getElementById('fName').value.trim();
    const discountValue = parseFloat(document.getElementById('fVal').value);
    if (!name || isNaN(discountValue)) { showToast('Name and value required','error'); return; }
    const payload = {
      name,
      description: document.getElementById('fDesc').value.trim(),
      discountType: document.getElementById('fType').value,
      discountValue,
      products: document.getElementById('fProds').value.split(',').map(s=>s.trim()).filter(Boolean),
      validFrom: document.getElementById('fFrom').value
    };
    const to = document.getElementById('fTo').value;
    if (to) payload.validTo = to;

    try {
      if (editId) { await API.put('/partner/offers/'+editId, payload); showToast('Offer updated','success'); }
      else { await API.post('/partner/offers', payload); showToast('Offer created','success'); }
      closeModal('offer-modal');
      load(page);
    } catch(e){ showToast(e.message,'error'); }
  };

  window.delOffer = async function(id){
    if (!confirm('Delete this offer?')) return;
    try { await API.delete('/partner/offers/'+id); showToast('Deleted','success'); load(page); }
    catch(e){ showToast(e.message,'error'); }
  };

  load();
})();
