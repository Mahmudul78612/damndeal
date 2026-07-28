(function(){
  if(!requireAuth()) return;

  document.body.innerHTML = appShell('profile');
  const $page = document.getElementById('pageContent');

  loadOnlineStatus();

  let profile = null, editMode = false;

  async function load(){
    $page.innerHTML = '<div class="text-center mt-2"><span class="spinner"></span></div>';
    try{
      profile = await API.get('/delivery/profile');
      setProfile(profile);
      render();
    }catch(e){
      $page.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>${esc(e.message)}</p></div>`;
    }
  }

  function render(){
    if(!profile) return;
    const p = profile;
    const photoUrl = p.photo ? CONFIG.API_BASE.replace('/api','')+'/'+p.photo : '';
    const user = getUser() || {};
    const vehicleIcons = {bike:'🏍️',scooter:'🛵',bicycle:'🚲',car:'🚗',walk:'🚶'};

    if(!editMode){
      $page.innerHTML = `
        <!-- Avatar & Name -->
        <div class="text-center mb-2">
          ${photoUrl ? `<img src="${photoUrl}" class="profile-avatar" alt="Photo">` : '<div class="onboard-avatar" style="margin:0 auto 12px">👤</div>'}
          <h2 style="font-size:18px;margin-bottom:2px">${esc(p.name||user.name||'Delivery Partner')}</h2>
          <div class="text-sm text-muted">${esc(user.phone||p.phone||'')}</div>
          ${p.isVerified?'<div class="mt-1"><span class="badge badge-success">✅ Verified</span></div>':'<div class="mt-1"><span class="badge badge-warning">⏳ Verification Pending</span></div>'}
        </div>

        <!-- Stats -->
        <div class="stat-row-3">
          <div class="stat-card">
            <div class="label">Deliveries</div>
            <div class="value">${p.totalDeliveries||0}</div>
          </div>
          <div class="stat-card">
            <div class="label">Earnings</div>
            <div class="value" style="font-size:16px">${fmtCurrency(p.totalEarnings||0)}</div>
          </div>
          <div class="stat-card">
            <div class="label">Rating</div>
            <div class="value" style="font-size:16px">${p.rating?p.rating.toFixed(1):'—'}</div>
            <div class="sub">${p.ratingCount||0} reviews</div>
          </div>
        </div>

        <!-- Info Card -->
        <div class="card">
          <div class="card-header"><h3>Details</h3><button class="btn btn-sm btn-outline" onclick="toggleEdit()">✏️ Edit</button></div>
          <div class="card-body">
            <div class="info-row"><span class="text-muted text-sm">Email</span><br><span>${esc(p.email||'—')}</span></div>
            <div class="divider"></div>
            <div class="info-row"><span class="text-muted text-sm">Vehicle</span><br><span>${vehicleIcons[p.vehicleType]||''} ${esc(p.vehicleType||'—')} ${p.vehicleNumber?'· '+esc(p.vehicleNumber):''}</span></div>
            <div class="divider"></div>
            <div class="info-row"><span class="text-muted text-sm">Aadhaar</span><br><span>${esc(p.aadhaarNumber||'—')}</span></div>
          </div>
        </div>

        <!-- Logout -->
        <button class="btn btn-outline mt-2" style="color:var(--danger);border-color:var(--danger)" onclick="doLogout()">🚪 Logout</button>
      `;
    } else {
      $page.innerHTML = `
        <div class="card">
          <div class="card-header"><h3>Edit Profile</h3><button class="btn btn-sm btn-outline" onclick="toggleEdit()">✕ Cancel</button></div>
          <div class="card-body">
            <div class="text-center mb-2">
              <label for="editPhoto" style="cursor:pointer">
                ${photoUrl ? `<img src="${photoUrl}" class="profile-avatar" id="editAvatarPreview" alt="">` : '<div class="onboard-avatar" id="editAvatarPreview" style="margin:0 auto 12px">📷</div>'}
                <div class="text-xs text-muted">Tap to change photo</div>
              </label>
              <input type="file" id="editPhoto" accept="image/*" style="display:none" onchange="previewEditPhoto(this)">
            </div>
            <div class="form-group">
              <label>Full Name *</label>
              <input type="text" class="form-control" id="eName" value="${esc(p.name||'')}">
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" class="form-control" id="eEmail" value="${esc(p.email||'')}">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Vehicle Type</label>
                <select class="form-control" id="eVehicle">
                  ${['bike','scooter','bicycle','car','walk'].map(v=>`<option value="${v}" ${p.vehicleType===v?'selected':''}>${v}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Vehicle Number</label>
                <input type="text" class="form-control" id="eVehicleNo" value="${esc(p.vehicleNumber||'')}">
              </div>
            </div>
            <div class="form-group">
              <label>Aadhaar Number</label>
              <input type="text" class="form-control" id="eAadhaar" value="${esc(p.aadhaarNumber||'')}" maxlength="14" inputmode="numeric">
            </div>
            <button class="btn btn-primary mt-1" onclick="saveProfile()">💾 Save Changes</button>
          </div>
        </div>
      `;
    }
  }

  window.toggleEdit = function(){ editMode=!editMode; render(); };

  window.previewEditPhoto = function(inp){
    if(inp.files && inp.files[0]){
      const r = new FileReader();
      r.onload = e => {
        const av = document.getElementById('editAvatarPreview');
        if(av.tagName==='IMG'){ av.src = e.target.result; }
        else { av.innerHTML = `<img src="${e.target.result}" style="width:80px;height:80px;border-radius:50%;object-fit:cover">`; }
      };
      r.readAsDataURL(inp.files[0]);
    }
  };

  window.saveProfile = async function(){
    const name = document.getElementById('eName').value.trim();
    if(!name){ showToast('Name is required','error'); return; }

    const fd = new FormData();
    fd.append('name', name);
    fd.append('phone', getUser()?.phone || profile.phone || '');
    const email = document.getElementById('eEmail').value.trim();
    if(email) fd.append('email', email);
    fd.append('vehicleType', document.getElementById('eVehicle').value);
    const vn = document.getElementById('eVehicleNo').value.trim();
    if(vn) fd.append('vehicleNumber', vn);
    const aadhaar = document.getElementById('eAadhaar').value.replace(/\s/g,'');
    if(aadhaar) fd.append('aadhaarNumber', aadhaar);
    const photoFile = document.getElementById('editPhoto')?.files?.[0];
    if(photoFile) fd.append('photo', photoFile);

    try{
      await API.upload('/delivery/profile', fd);
      showToast('Profile updated!');
      editMode = false;
      await load();
    }catch(e){ showToast(e.message,'error'); }
  };

  window.doLogout = function(){
    API.post('/auth/logout').catch(()=>{});
    stopLocationTracking();
    logout();
  };

  load();
})();
