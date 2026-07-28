(async function () {
  document.body.innerHTML = pageShell("Magic Pools");
  buildLayout("magic-pools");

  const content = document.getElementById("page-content");
  const API_ORIGIN = (window.API_URL || "").replace(/\/api\/?$/, "");
  const imgSrc = (u) => !u ? "" : (u.startsWith("http") ? u : API_ORIGIN + u);

  const THEMES = [
    { id: "fuchsia", name: "Fuchsia",  grad: "linear-gradient(135deg,#a21caf,#c026d3,#ec4899)" },
    { id: "amber",   name: "Amber",    grad: "linear-gradient(135deg,#f59e0b,#f97316,#ef4444)" },
    { id: "emerald", name: "Emerald",  grad: "linear-gradient(135deg,#059669,#0d9488,#06b6d4)" },
    { id: "sky",     name: "Ocean",    grad: "linear-gradient(135deg,#0284c7,#3b82f6,#6366f1)" },
    { id: "violet",  name: "Violet",   grad: "linear-gradient(135deg,#7c3aed,#a855f7,#d946ef)" },
    { id: "rose",    name: "Rose",     grad: "linear-gradient(135deg,#e11d48,#f43f5e,#fb7185)" },
    { id: "cosmic",  name: "Cosmic",   grad: "linear-gradient(135deg,#1e3a8a,#7c3aed,#ec4899)" },
    { id: "gold",    name: "Gold",     grad: "linear-gradient(135deg,#d97706,#fbbf24,#fde047)" },
  ];
  const themeGrad = (id) => (THEMES.find((t) => t.id === id) || THEMES[0]).grad;

  let pools = [], editId = null;
  let formImages = [];
  let formImageUrl = "";
  let formTheme = "fuchsia";

  function statusBadge(s) {
    const map = {
      open: '<span class="badge badge-success">Open</span>',
      drawing: '<span class="badge badge-warning">Drawing…</span>',
      drawn: '<span class="badge badge-purple">Drawn</span>',
      cancelled: '<span class="badge badge-gray">Cancelled</span>',
    };
    return map[s] || s;
  }

  async function load() {
    content.innerHTML = `<div class="text-center"><div class="spinner"></div></div>`;
    try {
      const data = await API.get("/admin/magic-pools");
      pools = data.pools || [];
      render();
    } catch (err) { showToast(err.message, "error"); }
  }

  function poolCardPreview(p) {
    const grad = themeGrad(p.theme || "fuchsia");
    const bg = p.imageUrl
      ? `background-image:url('${imgSrc(p.imageUrl)}');background-size:cover;background-position:center;`
      : `background:${grad};`;
    return `
      <div class="mp-card" onclick="viewPool('${p._id}')">
        <div class="mp-card-hero" style="${bg}">
          <div class="mp-card-overlay">
            ${p.tagline ? `<span class="mp-tag">${p.tagline}</span>` : ''}
            <h4 class="mp-name">${p.name}</h4>
            ${p.prizeDescription ? `<p class="mp-prize">🎁 ${p.prizeDescription}</p>` : ''}
          </div>
        </div>
        <div class="mp-card-body">
          <div class="mp-stat-row">
            <span class="mp-stat">${p.participantsCount}/${p.capacity}</span>
            ${statusBadge(p.status)}
            <span class="badge badge-purple">${p.platform}</span>
          </div>
          <div class="mp-bar"><div class="mp-bar-fill" style="width:${Math.min(100, (p.participantsCount/p.capacity)*100)}%;background:${grad};"></div></div>
          <div class="mp-actions" onclick="event.stopPropagation()">
            <button class="btn btn-outline btn-sm" onclick="editPool('${p._id}')">Edit</button>
            ${p.status === 'open' && p.participantsCount > 0 ? `<button class="btn btn-warning btn-sm" onclick="drawPool('${p._id}')">Draw</button>` : ''}
            <button class="btn btn-danger btn-sm" onclick="delPool('${p._id}')">Del</button>
          </div>
        </div>
      </div>
    `;
  }

  function render() {
    content.innerHTML = `
      <style>
        .mp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;margin-top:8px;}
        .mp-card{background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);cursor:pointer;transition:transform 0.15s,box-shadow 0.15s;}
        .mp-card:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,0.12);}
        .mp-card-hero{height:130px;position:relative;color:#fff;}
        .mp-card-overlay{position:absolute;inset:0;padding:12px;display:flex;flex-direction:column;justify-content:flex-end;background:linear-gradient(to top,rgba(0,0,0,0.55),rgba(0,0,0,0));}
        .mp-tag{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;background:rgba(255,255,255,0.25);padding:2px 8px;border-radius:99px;backdrop-filter:blur(4px);align-self:flex-start;margin-bottom:4px;}
        .mp-name{font-size:16px;font-weight:800;margin:0;text-shadow:0 1px 2px rgba(0,0,0,0.3);}
        .mp-prize{font-size:11px;margin:2px 0 0;opacity:0.95;}
        .mp-card-body{padding:10px 12px;}
        .mp-stat-row{display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap;}
        .mp-stat{font-size:12px;font-weight:700;color:#374151;}
        .mp-bar{height:6px;background:#f3f4f6;border-radius:99px;overflow:hidden;margin-bottom:8px;}
        .mp-bar-fill{height:100%;border-radius:99px;transition:width 0.5s;}
        .mp-actions{display:flex;gap:6px;flex-wrap:wrap;}

        .theme-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}
        .theme-tile{cursor:pointer;border-radius:10px;height:50px;border:3px solid transparent;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.5px;text-shadow:0 1px 2px rgba(0,0,0,0.3);transition:all 0.15s;}
        .theme-tile.active{border-color:#1f2937;box-shadow:0 0 0 2px #fff inset;transform:scale(1.05);}

        .img-thumbs{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;}
        .img-thumb{position:relative;width:80px;height:80px;border-radius:8px;overflow:hidden;border:2px solid transparent;background:#f3f4f6;}
        .img-thumb.hero{border-color:#10b981;box-shadow:0 0 0 1px #10b981;}
        .img-thumb img{width:100%;height:100%;object-fit:cover;display:block;}
        .img-thumb-x{position:absolute;top:2px;right:2px;width:18px;height:18px;border:none;background:rgba(0,0,0,0.7);color:#fff;border-radius:99px;cursor:pointer;font-size:11px;line-height:1;display:flex;align-items:center;justify-content:center;padding:0;}
        .img-thumb-set{position:absolute;bottom:0;left:0;right:0;padding:3px;background:rgba(0,0,0,0.65);color:#fff;font-size:9px;font-weight:700;text-align:center;cursor:pointer;border:none;width:100%;}
        .upload-box{border:2px dashed #d1d5db;border-radius:8px;padding:14px;text-align:center;color:#6b7280;cursor:pointer;font-size:12px;transition:border-color 0.15s;}
        .upload-box:hover{border-color:#9ca3af;}
      </style>

      <div class="toolbar">
        <div class="toolbar-left"><span class="text-muted text-sm">${pools.length} pools</span></div>
        <div class="toolbar-right"><button class="btn btn-primary btn-sm" onclick="openForm()">+ New Pool</button></div>
      </div>

      ${pools.length === 0
        ? `<div class="card"><div class="card-body text-center text-muted" style="padding:40px;">No pools yet. Click <strong>+ New Pool</strong> to create one.</div></div>`
        : `<div class="mp-grid">${pools.map(poolCardPreview).join('')}</div>`}

      <div class="modal-overlay" id="pool-modal">
        <div class="modal modal-lg">
          <div class="modal-header">
            <h3 id="pool-title">New Magic Pool</h3>
            <button class="modal-close" onclick="closeModal('pool-modal')">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Theme (visual style on storefront) *</label>
              <div class="theme-grid" id="theme-grid">
                ${THEMES.map(t => `
                  <div class="theme-tile" data-theme="${t.id}" style="background:${t.grad}" onclick="setTheme('${t.id}')">
                    ${t.name}
                  </div>`).join('')}
              </div>
            </div>

            <div class="form-row">
              <div class="form-group"><label>Tagline (badge above title)</label><input class="form-control" id="f-tagline" placeholder="e.g. Mega Festival Draw"></div>
              <div class="form-group"><label>Name *</label><input class="form-control" id="f-name" placeholder="e.g. Diwali Pool #1"></div>
            </div>
            <div class="form-group"><label>Description</label><textarea class="form-control" id="f-desc" rows="2"></textarea></div>

            <div class="form-row">
              <div class="form-group"><label>Capacity *</label><input class="form-control" type="number" id="f-cap" min="2" placeholder="10"></div>
              <div class="form-group"><label>Platform</label>
                <select class="form-control" id="f-platform">
                  <option value="any">Any</option>
                  <option value="damndeal">Online Store</option>
                  <option value="ddgo">Quick Commerce</option>
                </select>
              </div>
            </div>

            <div class="form-group"><label>Prize Description *</label><input class="form-control" id="f-prize" placeholder="e.g. iPhone 15 / ₹5000 cashback"></div>
            <div class="form-group"><label>Prize Points (optional, credited to winner's wallet)</label><input class="form-control" type="number" id="f-points" value="0"></div>

            <div class="form-group">
              <label>Pool Images <span class="text-muted text-sm">(up to 8 — first becomes hero, click "Set Hero" to change)</span></label>
              <input type="file" id="f-files" accept="image/*" multiple style="display:none" onchange="handleFiles(event)">
              <div class="upload-box" onclick="document.getElementById('f-files').click()">
                📷 Click to upload images (JPG, PNG, max 5MB each)
              </div>
              <div class="img-thumbs" id="img-thumbs"></div>
            </div>

            <div class="form-group"><label><input type="checkbox" id="f-active" checked> Active (visible to users)</label></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="closeModal('pool-modal')">Cancel</button>
            <button class="btn btn-primary" onclick="savePool()">Save Pool</button>
          </div>
        </div>
      </div>

      <div class="modal-overlay" id="view-modal">
        <div class="modal modal-lg">
          <div class="modal-header"><h3 id="view-title">Pool Detail</h3><button class="modal-close" onclick="closeModal('view-modal')">&times;</button></div>
          <div class="modal-body" id="view-body"></div>
        </div>
      </div>
    `;
  }

  window.setTheme = function (id) {
    formTheme = id;
    document.querySelectorAll('#theme-grid .theme-tile').forEach((t) => {
      t.classList.toggle('active', t.dataset.theme === id);
    });
  };

  function renderThumbs() {
    const wrap = document.getElementById('img-thumbs');
    if (!wrap) return;
    wrap.innerHTML = formImages.map((url) => {
      const isHero = url === formImageUrl;
      const safe = url.replace(/'/g, "\\'");
      return `
        <div class="img-thumb ${isHero ? 'hero' : ''}">
          <img src="${imgSrc(url)}" alt="">
          <button class="img-thumb-x" onclick="removeImg('${safe}')">×</button>
          ${isHero ? '<div class="img-thumb-set">★ HERO</div>' : `<button class="img-thumb-set" onclick="setHero('${safe}')">Set Hero</button>`}
        </div>`;
    }).join('');
  }

  window.handleFiles = async function (e) {
    const files = e.target.files;
    if (!files || !files.length) return;
    const fd = new FormData();
    [...files].forEach((f) => fd.append('images', f));
    try {
      const res = await API.upload('/admin/magic-pools/upload-images', fd);
      const urls = res.urls || [];
      formImages = [...formImages, ...urls];
      if (!formImageUrl && urls.length) formImageUrl = urls[0];
      renderThumbs();
      showToast(`${urls.length} image(s) uploaded`, 'success');
    } catch (err) {
      showToast(err.message || 'Upload failed', 'error');
    }
    e.target.value = '';
  };

  window.removeImg = function (url) {
    formImages = formImages.filter((u) => u !== url);
    if (formImageUrl === url) formImageUrl = formImages[0] || '';
    renderThumbs();
  };
  window.setHero = function (url) {
    formImageUrl = url;
    renderThumbs();
  };

  window.openForm = function () {
    editId = null;
    formImages = []; formImageUrl = ''; formTheme = 'fuchsia';
    document.getElementById('pool-title').textContent = 'New Magic Pool';
    ['f-name','f-desc','f-prize','f-tagline'].forEach((id) => document.getElementById(id).value = '');
    document.getElementById('f-cap').value = '10';
    document.getElementById('f-points').value = '0';
    document.getElementById('f-platform').value = 'any';
    document.getElementById('f-active').checked = true;
    setTheme('fuchsia');
    renderThumbs();
    openModal('pool-modal');
  };

  window.editPool = async function (id) {
    try {
      const { pool } = await API.get(`/admin/magic-pools/${id}`);
      editId = id;
      formImages = [...(pool.images || [])];
      if (pool.imageUrl && !formImages.includes(pool.imageUrl)) formImages.unshift(pool.imageUrl);
      formImageUrl = pool.imageUrl || formImages[0] || '';
      formTheme = pool.theme || 'fuchsia';
      document.getElementById('pool-title').textContent = 'Edit Pool';
      document.getElementById('f-name').value = pool.name || '';
      document.getElementById('f-desc').value = pool.description || '';
      document.getElementById('f-tagline').value = pool.tagline || '';
      document.getElementById('f-cap').value = pool.capacity;
      document.getElementById('f-prize').value = pool.prizeDescription || '';
      document.getElementById('f-points').value = pool.prizePoints || 0;
      document.getElementById('f-platform').value = pool.platform || 'any';
      document.getElementById('f-active').checked = pool.isActive !== false;
      setTheme(formTheme);
      renderThumbs();
      openModal('pool-modal');
    } catch (e) { showToast(e.message, 'error'); }
  };

  window.savePool = async function () {
    const body = {
      name: document.getElementById('f-name').value.trim(),
      tagline: document.getElementById('f-tagline').value.trim(),
      description: document.getElementById('f-desc').value.trim(),
      capacity: Number(document.getElementById('f-cap').value),
      prizeDescription: document.getElementById('f-prize').value.trim(),
      prizePoints: Number(document.getElementById('f-points').value) || 0,
      imageUrl: formImageUrl,
      images: formImages,
      theme: formTheme,
      platform: document.getElementById('f-platform').value,
      isActive: document.getElementById('f-active').checked,
    };
    if (!body.name || !body.capacity) return showToast('Name and capacity are required', 'error');
    try {
      if (editId) await API.put(`/admin/magic-pools/${editId}`, body);
      else await API.post('/admin/magic-pools', body);
      closeModal('pool-modal');
      showToast('Saved', 'success');
      load();
    } catch (e) { showToast(e.message, 'error'); }
  };

  window.delPool = async function (id) {
    if (!confirm('Delete / cancel this pool?')) return;
    try { await API.delete(`/admin/magic-pools/${id}`); showToast('Deleted', 'success'); load(); }
    catch (e) { showToast(e.message, 'error'); }
  };

  window.drawPool = async function (id) {
    if (!confirm('Force-draw the winner now? This cannot be undone.')) return;
    try { await API.post(`/admin/magic-pools/${id}/draw`, {}); showToast('Winner drawn!', 'success'); load(); }
    catch (e) { showToast(e.message, 'error'); }
  };

  window.viewPool = async function (id) {
    document.getElementById('view-body').innerHTML = `<div class="text-center"><div class="spinner"></div></div>`;
    openModal('view-modal');
    try {
      const { pool } = await API.get(`/admin/magic-pools/${id}`);
      const winnerHTML = pool.winner && pool.winner.user ? `
        <div class="card" style="background:#fff7ed;border:1px solid #fdba74;margin-bottom:12px;"><div class="card-body">
          <strong>🏆 Winner:</strong> ${pool.winner.user.name || ''} (${pool.winner.user.phone || ''})
          <br><span class="text-muted text-sm">Drawn at ${fmtDate(pool.winner.drawnAt)}</span>
        </div></div>` : '';
      const partsHTML = (pool.participants || []).map((p, i) => `
        <tr>
          <td>${i+1}</td>
          <td>${p.user?.name || '-'} <span class="text-muted text-sm">${p.user?.phone || ''}</span></td>
          <td>${p.order?.orderNumber || p.order?._id || '-'}</td>
          <td>${fmtDate(p.joinedAt)}</td>
        </tr>`).join('');
      document.getElementById('view-title').textContent = pool.name;
      document.getElementById('view-body').innerHTML = `
        ${winnerHTML}
        <div class="form-row">
          <div><strong>Status:</strong> ${statusBadge(pool.status)}</div>
          <div><strong>Capacity:</strong> ${(pool.participants||[]).length}/${pool.capacity}</div>
          <div><strong>Prize:</strong> ${pool.prizeDescription || '-'}</div>
          <div><strong>Theme:</strong> ${pool.theme || 'fuchsia'}</div>
        </div>
        <h4 style="margin-top:16px;">Participants</h4>
        <div class="table-wrap"><table>
          <thead><tr><th>#</th><th>User</th><th>Order</th><th>Joined</th></tr></thead>
          <tbody>${partsHTML || '<tr><td colspan="4" class="text-center text-muted">No participants</td></tr>'}</tbody>
        </table></div>
      `;
    } catch (e) { showToast(e.message, 'error'); closeModal('view-modal'); }
  };

  load();
})();
