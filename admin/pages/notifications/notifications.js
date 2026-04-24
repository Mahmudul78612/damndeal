(function(){
  requireAuth();
  document.body.innerHTML = pageShell('Notifications');
  buildLayout('notifications');

  const main = document.getElementById('page-content');

  /* ── state ── */
  let items = [], page = 1;

  /* ── render ── */
  function render(){
    main.innerHTML = `
      <div class="toolbar">
        <h2 style="margin:0;font-size:1.1rem">Push Notifications</h2>
        <button class="btn btn-sm btn-primary" onclick="openCreate()">+ Create Notification</button>
      </div>

      <div class="card" style="margin-top:1rem">
        <table class="table">
          <thead><tr><th>Title</th><th>Body</th><th>Type</th><th>Target</th><th>Sent</th><th>Created</th><th style="width:140px">Actions</th></tr></thead>
          <tbody>${items.length ? items.map(n=>`
            <tr>
              <td>${esc(n.title)}</td>
              <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(n.body)}</td>
              <td>${statusBadge(n.type||'general')}</td>
              <td>${esc(n.target||'all')}</td>
              <td>${n.sentAt ? fmtDateTime(n.sentAt) : '<span class="badge badge-gray">Not sent</span>'}</td>
              <td>${fmtDateTime(n.createdAt)}</td>
              <td>
                ${!n.sentAt ? `<button class="btn btn-sm btn-primary" onclick="sendNotif('${n._id}')">Send</button>` : ''}
                <button class="btn btn-sm btn-danger" onclick="deleteNotif('${n._id}')">Del</button>
              </td>
            </tr>`).join('') : '<tr><td colspan="7" class="empty-state">No notifications</td></tr>'}
          </tbody>
        </table>
      </div>
      <div id="pag"></div>

      <!-- modal -->
      <div class="modal-overlay" id="modal">
        <div class="modal" style="width:500px">
          <h3>Create Notification</h3>
          <div class="form-group">
            <label>Title</label>
            <input class="form-control" id="fTitle" placeholder="Notification title">
          </div>
          <div class="form-group">
            <label>Body</label>
            <textarea class="form-control" id="fBody" rows="3" placeholder="Notification body text"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Type</label>
              <select class="form-control" id="fType">
                <option value="general">General</option>
                <option value="promotional">Promotional</option>
                <option value="order">Order</option>
                <option value="alert">Alert</option>
              </select>
            </div>
            <div class="form-group">
              <label>Target</label>
              <select class="form-control" id="fTarget">
                <option value="all">All Users</option>
                <option value="users">Customers Only</option>
                <option value="partners">Partners Only</option>
                <option value="delivery">Delivery Boys Only</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Image URL <small style="color:var(--text-light)">(optional)</small></label>
            <input class="form-control" id="fImage" placeholder="https://...">
          </div>
          <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:1rem">
            <button class="btn" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="create()">Create</button>
          </div>
        </div>
      </div>`;
  }

  function esc(s){ const d=document.createElement('div'); d.textContent=String(s||''); return d.innerHTML; }

  /* ── load ── */
  async function load(){
    try{
      const r = await API.get('/admin/notifications?page='+page+'&limit=20');
      items = r.data || r.notifications || [];
      if(!Array.isArray(items)) items = [];
    }catch(e){ items=[]; showToast(e.message,'error'); }
    render();
  }

  /* ── create ── */
  window.openCreate = function(){
    render();
    document.getElementById('fTitle').value='';
    document.getElementById('fBody').value='';
    document.getElementById('fType').value='general';
    document.getElementById('fTarget').value='all';
    document.getElementById('fImage').value='';
    openModal();
  };

  window.create = async function(){
    const title = document.getElementById('fTitle').value.trim();
    const body  = document.getElementById('fBody').value.trim();
    if(!title||!body){ showToast('Title and body required','error'); return; }
    const payload = {
      title, body,
      type: document.getElementById('fType').value,
      target: document.getElementById('fTarget').value
    };
    const img = document.getElementById('fImage').value.trim();
    if(img) payload.image = img;

    try{
      await API.post('/admin/notifications', payload);
      showToast('Notification created','success');
      closeModal();
      load();
    }catch(e){ showToast(e.message,'error'); }
  };

  /* ── send ── */
  window.sendNotif = async function(id){
    if(!confirm('Send this notification to all targeted users?')) return;
    try{
      await API.post('/admin/notifications/'+id+'/send');
      showToast('Notification sent','success');
      load();
    }catch(e){ showToast(e.message,'error'); }
  };

  /* ── delete ── */
  window.deleteNotif = async function(id){
    if(!confirm('Delete this notification?')) return;
    try{
      await API.delete('/admin/notifications/'+id);
      showToast('Deleted','success');
      load();
    }catch(e){ showToast(e.message,'error'); }
  };

  load();
})();
