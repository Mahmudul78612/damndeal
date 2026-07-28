(function(){
  requireAuth();
  document.body.innerHTML = pageShell('Delivery Boys');
  buildLayout('delivery-boys');
  const content = document.getElementById('page-content');

  let page = 1, search = '';

  async function load(p=1){
    page = p;
    content.innerHTML = '<div class="text-center"><div class="spinner"></div></div>';
    try {
      let ep = `/partner/delivery-boys?page=${page}&limit=20`;
      if (search) ep += '&search='+encodeURIComponent(search);
      const data = await API.get(ep);
      const boys = data.deliveryBoys || [];
      const pag = data.pagination || {};

      content.innerHTML = `
        <div class="toolbar">
          <div class="toolbar-left">
            <input class="search-input" placeholder="Search..." value="${esc(search)}" onkeyup="if(event.key==='Enter'){window._s=this.value;loadDB(1)}">
            <span class="text-muted text-sm">${pag.total||boys.length} delivery boys</span>
          </div>
          <button class="btn btn-sm btn-primary" onclick="openAdd()">+ Add Delivery Boy</button>
        </div>

        <div class="card">
          <div class="card-body table-wrap">
            <table>
              <thead><tr><th></th><th>Name</th><th>Phone</th><th>Vehicle</th><th>Online</th><th>Deliveries</th><th>Earnings</th><th>Actions</th></tr></thead>
              <tbody>
                ${boys.map(b=>`
                  <tr>
                    <td>${b.photo ? `<img src="${CONFIG.API_BASE.replace('/api','')}/${b.photo}" class="img-thumb">` : '🚴'}</td>
                    <td><strong>${esc(b.name)}</strong></td>
                    <td>${esc(b.phone)}</td>
                    <td>${esc(b.vehicleType||'-')} ${esc(b.vehicleNumber||'')}</td>
                    <td>${b.isOnline ? '<span class="badge badge-success">Online</span>' : '<span class="badge badge-gray">Offline</span>'}</td>
                    <td>${b.totalDeliveries||0}</td>
                    <td>${fmtCurrency(b.totalEarnings)}</td>
                    <td>
                      <div class="d-flex gap-1">
                        <button class="btn btn-xs ${b.isOnline?'btn-warning':'btn-success'}" onclick="toggleDB('${b._id}')">${b.isOnline?'Set Offline':'Set Online'}</button>
                        <button class="btn btn-xs" onclick="openEdit('${b._id}')">Edit</button>
                        <button class="btn btn-xs btn-danger" onclick="delDB('${b._id}')">Del</button>
                      </div>
                    </td>
                  </tr>`).join('')||'<tr><td colspan="8" class="text-center text-muted">No delivery boys added</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
        <div class="pagination" id="pag"></div>

        <!-- Modal -->
        <div class="modal-overlay" id="db-modal">
          <div class="modal" style="max-width:480px">
            <div class="modal-header"><h3 id="dbTitle">Add Delivery Boy</h3><button class="modal-close" onclick="closeModal('db-modal')">&times;</button></div>
            <div class="modal-body">
              <form id="dbForm" enctype="multipart/form-data">
                <div class="form-row">
                  <div class="form-group"><label>Name *</label><input class="form-control" id="fName" required></div>
                  <div class="form-group"><label>Phone *</label><input class="form-control" id="fPhone" required></div>
                </div>
                <div class="form-group"><label>Email</label><input class="form-control" id="fEmail" type="email"></div>
                <div class="form-group"><label>Aadhaar Number</label><input class="form-control" id="fAadhaar"></div>
                <div class="form-row">
                  <div class="form-group"><label>Vehicle Type</label><select class="form-control" id="fVehicle"><option value="bike">Bike</option><option value="car">Car</option><option value="bicycle">Bicycle</option></select></div>
                  <div class="form-group"><label>Vehicle Number</label><input class="form-control" id="fVNum"></div>
                </div>
                <div class="form-group"><label>Photo</label><input class="form-control" id="fPhoto" type="file" accept="image/*"></div>
                <div class="modal-footer" style="padding:0;border:none;margin-top:14px">
                  <button type="button" class="btn" onclick="closeModal('db-modal')">Cancel</button>
                  <button type="submit" class="btn btn-primary">Save</button>
                </div>
              </form>
            </div>
          </div>
        </div>`;
      renderPagination('pag', page, pag.pages||1, loadDB);
    } catch(e){ content.innerHTML = '<div class="empty-state"><p>'+esc(e.message)+'</p></div>'; }
  }

  window.loadDB = function(p){ search = window._s||search; load(p); };

  let editId = null;

  window.openAdd = function(){
    editId = null;
    load(page).then(()=>{
      document.getElementById('dbTitle').textContent = 'Add Delivery Boy';
      document.getElementById('dbForm').reset();
      openModal('db-modal');
    });
  };

  window.openEdit = async function(id){
    try {
      const r = await API.get('/partner/delivery-boys/'+id);
      const b = r.deliveryBoy;
      editId = id;
      await load(page);
      document.getElementById('dbTitle').textContent = 'Edit Delivery Boy';
      document.getElementById('fName').value = b.name||'';
      document.getElementById('fPhone').value = b.phone||'';
      document.getElementById('fEmail').value = b.email||'';
      document.getElementById('fAadhaar').value = b.aadhaarNumber||'';
      document.getElementById('fVehicle').value = b.vehicleType||'bike';
      document.getElementById('fVNum').value = b.vehicleNumber||'';
      openModal('db-modal');
    } catch(e){ showToast(e.message,'error'); }
  };

  document.body.addEventListener('submit', async function(e){
    if (e.target.id !== 'dbForm') return;
    e.preventDefault();
    const fd = new FormData();
    fd.append('name', document.getElementById('fName').value.trim());
    fd.append('phone', document.getElementById('fPhone').value.trim());
    const email = document.getElementById('fEmail').value.trim();
    if (email) fd.append('email', email);
    const aadhaar = document.getElementById('fAadhaar').value.trim();
    if (aadhaar) fd.append('aadhaarNumber', aadhaar);
    fd.append('vehicleType', document.getElementById('fVehicle').value);
    const vnum = document.getElementById('fVNum').value.trim();
    if (vnum) fd.append('vehicleNumber', vnum);
    const photo = document.getElementById('fPhoto').files[0];
    if (photo) fd.append('photo', photo);

    try {
      if (editId) {
        await API.upload('/partner/delivery-boys/'+editId, fd, 'PUT');
        showToast('Updated','success');
      } else {
        await API.upload('/partner/delivery-boys', fd);
        showToast('Delivery boy added','success');
      }
      closeModal('db-modal');
      load(page);
    } catch(e){ showToast(e.message,'error'); }
  });

  window.toggleDB = async function(id){
    try { await API.put('/partner/delivery-boys/'+id+'/toggle'); showToast('Status toggled','success'); load(page); }
    catch(e){ showToast(e.message,'error'); }
  };

  window.delDB = async function(id){
    if (!confirm('Remove this delivery boy?')) return;
    try { await API.delete('/partner/delivery-boys/'+id); showToast('Removed','success'); load(page); }
    catch(e){ showToast(e.message,'error'); }
  };

  load();
})();
