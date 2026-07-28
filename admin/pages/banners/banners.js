(async function () {
  document.body.innerHTML = pageShell("Banners");
  buildLayout("banners");

  const content = document.getElementById("page-content");
  let editId = null;
  let allSubCategories = [];
  let allProducts = [];
  let allCategories = [];
  let selectedProductIds = [];

  async function loadCategories() {
    try {
      const res = await API.get('/admin/categories');
      allCategories = res.categories || [];
    } catch (_) { allCategories = []; }
  }

  function imgSrc(path) {
    if (!path) return '';
    return path.startsWith('http') ? path : CONFIG.API_BASE.replace('/api', '') + path;
  }

  async function loadSubCategories() {
    try {
      const res = await API.get('/admin/subcategories');
      allSubCategories = res.subCategories || [];
    } catch (_) {}
  }

  async function loadProducts() {
    try {
      const res = await API.get('/admin/products?limit=500');
      allProducts = res.products || [];
    } catch (_) { allProducts = []; }
  }

  function getProductName(id) {
    const p = allProducts.find(x => x._id === id);
    return p ? p.name : id;
  }

  function getProductImage(id) {
    const p = allProducts.find(x => x._id === id);
    if (p && p.images && p.images.length) return imgSrc(p.images[0]);
    return '';
  }

  function subCatOptions(selectedId) {
    return `<option value="">— None —</option>` +
      allSubCategories.map(s => {
        const catName = s.category?.name || '';
        const sel = s._id === selectedId ? ' selected' : '';
        return `<option value="${s._id}"${sel}>${s.name}${catName ? ' (' + catName + ')' : ''}</option>`;
      }).join('');
  }

  async function load() {
    content.innerHTML = `<div class="text-center"><div class="spinner"></div></div>`;
    try {
      if (!allSubCategories.length) await loadSubCategories();
      if (!allProducts.length) await loadProducts();
      if (!allCategories.length) await loadCategories();
      const data = await API.get("/admin/banners?region=all");
      const banners = data.banners || [];

      content.innerHTML = `
        <div class="toolbar">
          <div class="toolbar-left"><span class="text-muted text-sm">${banners.length} banners</span></div>
          <div class="toolbar-right"><button class="btn btn-primary btn-sm" onclick="openBannerForm()">+ Add Banner</button></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">
          ${banners.map(b => {
            const subNames = (b.subCategories || []).map(s => typeof s === 'object' ? s.name : allSubCategories.find(x => x._id === s)?.name || s).filter(Boolean);
            const regs = Array.isArray(b.regions) && b.regions.length ? b.regions : ['IN'];
            const regBadges = regs.map(r => `<span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;margin-right:4px;color:#fff;background:${r==='US'?'#0EA5E9':'#10B981'}">${r}</span>`).join('');
            return `
            <div class="card">
              <div style="height:160px;background:#f3f4f6;border-radius:8px 8px 0 0;overflow:hidden;position:relative">
                ${b.image ? `<img src="${imgSrc(b.image)}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'">` : '<div class="text-center text-muted" style="padding-top:60px">No image</div>'}
                <span style="position:absolute;top:8px;right:8px;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;color:#fff;background:${b.platform === 'damndeal' ? '#7C3AED' : '#0D7A30'}">${b.platform === 'damndeal' ? 'Online Store' : 'Quick Commerce'}</span>
                <div style="position:absolute;top:8px;left:8px">${regBadges}</div>
              </div>
              <div class="card-body" style="padding:12px">
                <div style="font-weight:600;margin-bottom:4px">${(b.title || 'Untitled').replace(/</g,'&lt;')}</div>
                <div class=\"text-sm\"><strong>Placement:</strong> ${b.placement || '-'}</div>\n                ${b.linkType && b.linkType !== 'none' ? `<div class=\"text-sm\"><strong>Link:</strong> ${b.linkType}${b.linkValue ? ' → ' + b.linkValue.substring(0,20) : ''}</div>` : ''}
                ${subNames.length ? `<div class="text-sm"><strong>Sub-Categories:</strong> ${subNames.join(', ')}</div>` : ''}
                <div class="text-sm text-muted">Order: ${b.sortOrder || 0} | ${b.isActive !== false ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-gray">Inactive</span>'}${(b.productIds || []).length ? ` | <span class="badge" style="background:#dbeafe;color:#1d4ed8;">📦 ${b.productIds.length} products</span>` : ''}</div>
                <div style="display:flex;gap:8px;margin-top:8px">
                  <button class="btn btn-outline btn-sm" onclick="editBanner('${b._id}')">Edit</button>
                  <button class="btn btn-danger btn-sm" onclick="delBanner('${b._id}')">Delete</button>
                </div>
              </div>
            </div>`;
          }).join("") || `<div class="empty-state"><p>No banners yet</p></div>`}
        </div>

        <!-- Banner Modal -->
        <div class="modal-overlay" id="banner-modal">
          <div class="modal" style="max-width:600px">
            <div class="modal-header"><h3 id="banner-modal-title">Add Banner</h3><button class="modal-close" onclick="closeModal('banner-modal')">&times;</button></div>
            <div class="modal-body">
              <div class="form-group"><label>Title</label><input class="form-control" id="b-title" placeholder="Banner title"></div>
              <div class="form-group">
                <label>Image</label>
                <div id="b-preview" style="margin-bottom:8px"></div>
                <input type="file" class="form-control" id="b-file" accept="image/jpeg,image/png,image/webp,image/gif" onchange="previewBannerImg(this)">
              </div>
              <div class="form-row">
                <div class="form-group"><label>Platform</label>
                  <select class="form-control" id="b-platform">
                    <option value="ddgo">Quick Commerce</option>
                    <option value="damndeal">Online Store</option>
                  </select>
                </div>
                <div class="form-group"><label>Placement</label>
                  <select class="form-control" id="b-place">
                    <option value="home_top">Home Top (Main Slider)</option>
                    <option value="home_square">Home Square (2 Inline)</option>
                    <option value="home_middle">Home Middle</option>
                    <option value="home_bottom">Home Bottom</option>
                    <option value="category_page">Category Page</option>
                    <option value="partner_page">Partner Page</option>
                  </select>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group"><label>Sort Order</label>
                  <input class="form-control" type="number" id="b-order" value="0">
                </div>
              </div>

              <div class="form-group">
                <label>Regions</label>
                <div style="display:flex;gap:14px;padding:6px 0">
                  <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="b-region-IN" value="IN" checked> 🇮🇳 IN</label>
                  <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="b-region-US" value="US"> 🇺🇸 US (damndeal.com)</label>
                </div>
              </div>

              <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-top:8px">
                <label style="font-weight:600;margin-bottom:8px;display:block">🔗 Banner Link</label>
                <div class="form-row">
                  <div class="form-group"><label>Link Type</label>
                    <select class="form-control" id="b-linkType" onchange="onLinkTypeChange()">
                      <option value="none">None</option>
                      <option value="category">Category</option>
                      <option value="product">Product</option>
                      <option value="url">URL</option>
                    </select>
                  </div>
                  <div class="form-group" id="b-linkValue-group" style="display:none">
                    <label id="b-linkValue-label">Link Value</label>
                    <div id="b-linkValue-container"></div>
                  </div>
                </div>
              </div>

              <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-top:8px">
                <label style="font-weight:600;margin-bottom:8px;display:block">🏷️ Overlay Sub-Categories (max 4)</label>
                <div class="form-row">
                  <div class="form-group"><label>Sub-Cat 1</label><select class="form-control" id="b-sub1">${subCatOptions('')}</select></div>
                  <div class="form-group"><label>Sub-Cat 2</label><select class="form-control" id="b-sub2">${subCatOptions('')}</select></div>
                </div>
                <div class="form-row">
                  <div class="form-group"><label>Sub-Cat 3</label><select class="form-control" id="b-sub3">${subCatOptions('')}</select></div>
                  <div class="form-group"><label>Sub-Cat 4</label><select class="form-control" id="b-sub4">${subCatOptions('')}</select></div>
                </div>
              </div>

              <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-top:8px" id="product-picker-section">
                <label style="font-weight:600;margin-bottom:8px;display:block">📦 Banner Products (shown when tapped)</label>
                <div class="form-group">
                  <input class="form-control" id="bp-search" placeholder="Type to search products..." oninput="filterBannerProducts()">
                </div>
                <div id="bp-search-results" style="max-height:180px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:12px;display:none;"></div>
                <div>
                  <label style="font-weight:600;margin-bottom:8px;display:block">Selected Products (<span id="bp-count">0</span>)</label>
                  <div id="bp-selected" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;"></div>
                </div>
              </div>

              <div class="form-group" style="margin-top:8px">
                <label><input type="checkbox" id="b-active" checked> Active</label>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" onclick="closeModal('banner-modal')">Cancel</button>
              <button class="btn btn-primary" onclick="saveBanner()">Save</button>
            </div>
          </div>
        </div>
      `;
    } catch (err) { content.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`; }
  }

  window.previewBannerImg = (input) => {
    const container = document.getElementById('b-preview');
    if (input.files && input.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        container.innerHTML = `<img src="${e.target.result}" style="width:100%;max-height:140px;object-fit:cover;border-radius:8px;border:2px solid #7c3aed;">`;
      };
      reader.readAsDataURL(input.files[0]);
    }
  };

  window.openBannerForm = () => {
    editId = null;
    selectedProductIds = [];
    load().then(() => setTimeout(() => {
      document.getElementById('banner-modal-title').textContent = 'Add Banner';
      document.getElementById('b-title').value = '';
      document.getElementById('b-file').value = '';
      document.getElementById('b-preview').innerHTML = '';
      document.getElementById('b-platform').value = 'ddgo';
      document.getElementById('b-place').value = 'home_top';
      document.getElementById('b-order').value = '0';
      document.getElementById('b-active').checked = true;
      document.getElementById('b-linkType').value = 'none';
      onLinkTypeChange();
      for (let i = 1; i <= 4; i++) document.getElementById('b-sub' + i).value = '';
      if (document.getElementById('bp-search')) document.getElementById('bp-search').value = '';
      renderBannerSelectedProducts();
      openModal('banner-modal');
    }, 50));
  };

  window.editBanner = async (id) => {
    editId = id;
    const data = await API.get('/admin/banners');
    const b = (data.banners || []).find(x => x._id === id);
    if (!b) return;
    selectedProductIds = (b.productIds || []).map(p => typeof p === 'object' ? p._id : p);
    await load();
    setTimeout(() => {
      document.getElementById('banner-modal-title').textContent = 'Edit Banner';
      document.getElementById('b-title').value = b.title || '';
      document.getElementById('b-file').value = '';
      const preview = document.getElementById('b-preview');
      if (b.image) {
        preview.innerHTML = `<img src="${imgSrc(b.image)}" style="width:100%;max-height:140px;object-fit:cover;border-radius:8px;border:2px solid #7c3aed;">`;
      } else { preview.innerHTML = ''; }
      document.getElementById('b-platform').value = b.platform || 'ddgo';
      document.getElementById('b-place').value = b.placement || 'home_top';
      document.getElementById('b-order').value = b.sortOrder || 0;
      document.getElementById('b-active').checked = b.isActive !== false;
      const regs = Array.isArray(b.regions) && b.regions.length ? b.regions : ['IN'];
      document.getElementById('b-region-IN').checked = regs.includes('IN');
      document.getElementById('b-region-US').checked = regs.includes('US');
      document.getElementById('b-linkType').value = b.linkType || 'none';
      onLinkTypeChange(b.linkValue || '');
      const subs = (b.subCategories || []).map(s => typeof s === 'object' ? s._id : s);
      for (let i = 1; i <= 4; i++) {
        const el = document.getElementById('b-sub' + i);
        el.innerHTML = subCatOptions(subs[i - 1] || '');
      }
      if (document.getElementById('bp-search')) document.getElementById('bp-search').value = '';
      renderBannerSelectedProducts();
      openModal('banner-modal');
    }, 50);
  };

  window.saveBanner = async () => {
    const title = document.getElementById('b-title').value.trim();
    const fileInput = document.getElementById('b-file');
    if (!title) return showToast('Title required', 'error');
    if (!editId && !fileInput.files.length) return showToast('Image required', 'error');

    const fd = new FormData();
    fd.append('title', title);
    fd.append('platform', document.getElementById('b-platform').value);
    fd.append('placement', document.getElementById('b-place').value);
    fd.append('sortOrder', document.getElementById('b-order').value);
    fd.append('isActive', document.getElementById('b-active').checked);
    if (fileInput.files[0]) fd.append('image', fileInput.files[0]);

    const regions = [];
    if (document.getElementById('b-region-IN').checked) regions.push('IN');
    if (document.getElementById('b-region-US').checked) regions.push('US');
    if (!regions.length) return showToast('Select at least one region', 'error');
    fd.append('regions', JSON.stringify(regions));

    const subIds = [];
    for (let i = 1; i <= 4; i++) {
      const v = document.getElementById('b-sub' + i).value;
      if (v) subIds.push(v);
    }
    fd.append('subCategories', JSON.stringify(subIds));
    fd.append('productIds', JSON.stringify(selectedProductIds));

    const linkType = document.getElementById('b-linkType').value;
    fd.append('linkType', linkType);
    if (linkType === 'category') {
      fd.append('linkValue', document.getElementById('b-linkValue-select')?.value || '');
    } else if (linkType === 'product') {
      fd.append('linkValue', document.getElementById('b-linkValue-select')?.value || '');
    } else if (linkType === 'url') {
      fd.append('linkValue', document.getElementById('b-linkValue-url')?.value || '');
    } else {
      fd.append('linkValue', '');
    }

    try {
      if (editId) await API.upload(`/admin/banners/${editId}`, fd, 'PUT');
      else await API.upload('/admin/banners', fd);
      closeModal('banner-modal');
      showToast(editId ? 'Banner updated' : 'Banner uploaded');
      load();
    } catch (err) { showToast(err.message, 'error'); }
  };

  window.delBanner = async (id) => {
    if (!confirm("Delete this banner?")) return;
    try { await API.delete(`/admin/banners/${id}`); showToast("Deleted"); load(); }
    catch (err) { showToast(err.message, "error"); }
  };

  // Product picker for square banners
  window.filterBannerProducts = function () {
    const q = (document.getElementById('bp-search')?.value || '').toLowerCase().trim();
    const container = document.getElementById('bp-search-results');
    if (!q || q.length < 2) { container.style.display = 'none'; return; }

    const matches = allProducts.filter(p =>
      (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)
    ).slice(0, 20);

    if (!matches.length) {
      container.innerHTML = '<div style="padding:12px;color:#9ca3af;">No products found</div>';
      container.style.display = 'block';
      return;
    }

    container.innerHTML = matches.map(p => {
      const already = selectedProductIds.includes(p._id);
      const pImg = p.images && p.images.length ? imgSrc(p.images[0]) : '';
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid #f3f4f6;cursor:pointer;${already ? 'opacity:0.4;' : ''}" onclick="${already ? '' : `addBannerProduct('${p._id}')`}">
        <div style="width:36px;height:36px;border-radius:6px;overflow:hidden;background:#f3f4f6;flex-shrink:0;">
          ${pImg ? `<img src="${pImg}" style="width:100%;height:100%;object-fit:cover;">` : ''}
        </div>
        <div style="flex:1;overflow:hidden;">
          <div style="font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${(p.name || '').replace(/</g,'&lt;')}</div>
          <div style="font-size:11px;color:#6b7280;">₹${p.sellingPrice || p.price || 0}</div>
        </div>
        <div style="font-size:11px;color:${already ? '#9ca3af' : '#10b981'};font-weight:600;">${already ? 'Added' : '+ Add'}</div>
      </div>`;
    }).join('');
    container.style.display = 'block';
  };

  window.addBannerProduct = function (id) {
    if (selectedProductIds.includes(id)) return;
    selectedProductIds.push(id);
    renderBannerSelectedProducts();
    filterBannerProducts();
  };

  window.removeBannerProduct = function (id) {
    selectedProductIds = selectedProductIds.filter(x => x !== id);
    renderBannerSelectedProducts();
    filterBannerProducts();
  };

  window.onLinkTypeChange = function (preselect) {
    const type = document.getElementById('b-linkType').value;
    const group = document.getElementById('b-linkValue-group');
    const label = document.getElementById('b-linkValue-label');
    const container = document.getElementById('b-linkValue-container');
    if (type === 'none') {
      group.style.display = 'none';
      return;
    }
    group.style.display = '';
    if (type === 'category') {
      label.textContent = 'Category';
      const opts = allCategories.map(c => {
        const sel = (preselect && c._id === preselect) ? ' selected' : '';
        return `<option value="${c._id}"${sel}>${(c.name || '').replace(/</g,'&lt;')}</option>`;
      }).join('');
      container.innerHTML = `<select class="form-control" id="b-linkValue-select"><option value="">— Select Category —</option>${opts}</select>`;
    } else if (type === 'product') {
      label.textContent = 'Product';
      const opts = allProducts.map(p => {
        const sel = (preselect && p._id === preselect) ? ' selected' : '';
        return `<option value="${p._id}"${sel}>${(p.name || '').replace(/</g,'&lt;')}</option>`;
      }).join('');
      container.innerHTML = `<select class="form-control" id="b-linkValue-select"><option value="">— Select Product —</option>${opts}</select>`;
    } else if (type === 'url') {
      label.textContent = 'URL';
      container.innerHTML = `<input class="form-control" id="b-linkValue-url" placeholder="https://..." value="${preselect || ''}">`;
    }
  };

  function renderBannerSelectedProducts() {
    const container = document.getElementById('bp-selected');
    const countEl = document.getElementById('bp-count');
    if (countEl) countEl.textContent = selectedProductIds.length;
    if (!container) return;

    container.innerHTML = selectedProductIds.map((pid, idx) => {
      const pImg = getProductImage(pid);
      const pName = getProductName(pid);
      return `<div style="position:relative;text-align:center;font-size:10px;background:#f9fafb;border-radius:8px;padding:4px;">
        <button onclick="removeBannerProduct('${pid}')" style="position:absolute;top:2px;right:2px;background:#ef4444;color:#fff;border:none;border-radius:50%;width:16px;height:16px;font-size:10px;cursor:pointer;line-height:16px;padding:0;">&times;</button>
        <div style="width:100%;aspect-ratio:1;background:#e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:2px;">
          ${pImg ? `<img src="${pImg}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'">` : ''}
        </div>
        <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${(pName || '').replace(/</g,'&lt;')}</div>
      </div>`;
    }).join('');
  }

  load();
})();
