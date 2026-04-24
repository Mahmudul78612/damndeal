(async function () {
  document.body.innerHTML = pageShell("App Customization");
  buildLayout("app-customization");

  const content = document.getElementById("page-content");
  let sections = [];
  let allProducts = [];
  let allCategories = [];
  let allSubCategories = [];
  let activePlatform = "damndeal";
  let editId = null;

  function imgSrc(path) {
    if (!path) return '';
    return path.startsWith('http') ? path : CONFIG.API_BASE.replace('/api', '') + path;
  }

  async function loadProducts() {
    try {
      const res = await API.get('/admin/products?limit=500');
      allProducts = res.products || [];
    } catch (_) { allProducts = []; }
  }

  async function loadCategories() {
    try {
      const res = await API.get('/admin/categories');
      allCategories = res.categories || res || [];
    } catch (_) { allCategories = []; }
  }

  async function loadSubCategories() {
    try {
      const res = await API.get('/admin/subcategories');
      allSubCategories = res.subCategories || res || [];
    } catch (_) { allSubCategories = []; }
  }

  async function load() {
    content.innerHTML = `<div class="text-center"><div class="spinner"></div></div>`;
    try {
      if (!allProducts.length) await loadProducts();
      if (!allCategories.length) await loadCategories();
      if (!allSubCategories.length) await loadSubCategories();
      const data = await API.get('/admin/home-sections');
      sections = (data.sections || []).filter(s => s.type === 'product_grid' || s.type === 'category_section');
      render();
    } catch (err) {
      content.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`;
    }
  }

  function platformSections() {
    return sections.filter(s => (s.platform || 'ddgo') === activePlatform);
  }

  function switchPlatform(p) {
    activePlatform = p;
    render();
  }
  window.switchPlatform = switchPlatform;

  function getProductName(id) {
    const p = allProducts.find(x => x._id === id);
    return p ? p.name : id;
  }

  function getProductImage(id) {
    const p = allProducts.find(x => x._id === id);
    if (p && p.images && p.images.length) return imgSrc(p.images[0]);
    return '';
  }

  function render() {
    const filtered = platformSections();
    const isDamnDeal = activePlatform === 'damndeal';
    const tabColor = isDamnDeal ? '#7C3AED' : '#0D7A30';

    content.innerHTML = `
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
        <div>
          <h1 style="margin:0;">🎨 App Customization</h1>
          <p style="color:#6b7280;margin:4px 0 0;">Create product sections for each platform's home screen</p>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-sm" style="background:${isDamnDeal ? '#7C3AED' : '#f3e8ff'};color:${isDamnDeal ? '#fff' : '#7C3AED'};font-weight:700;" onclick="switchPlatform('damndeal')">🛒 Online Store</button>
          <button class="btn btn-sm" style="background:${!isDamnDeal ? '#0D7A30' : '#dcfce7'};color:${!isDamnDeal ? '#fff' : '#0D7A30'};font-weight:700;" onclick="switchPlatform('ddgo')">⚡ Quick Commerce</button>
        </div>
      </div>

      <div style="margin-bottom:16px;">
        <button class="btn btn-primary btn-sm" onclick="openSectionForm()" style="background:${tabColor}">+ Add Section</button>
      </div>

      ${filtered.length ? filtered.map(s => {
        const cols = s.data?.gridColumns || 4;
        const rows = s.data?.gridRows || 3;
        const pids = s.data?.productIds || [];
        const isCatSection = s.type === 'category_section';
        const linkType = s.data?.linkType || '';
        const linkValue = s.data?.linkValue || '';
        let linkLabel = '';
        if (isCatSection) {
          if (linkType === 'category') {
            const cat = allCategories.find(c => c._id === linkValue);
            linkLabel = cat ? cat.name : linkValue;
          } else {
            const sub = allSubCategories.find(c => c._id === linkValue);
            linkLabel = sub ? sub.name : linkValue;
          }
        }
        const typeBadge = isCatSection
          ? '<span class="badge" style="background:#dbeafe;color:#1d4ed8;">📂 Category Section</span>'
          : '<span class="badge" style="background:#fef3c7;color:#92400e;">📦 Product Grid</span>';
        return `
        <div class="card" style="margin-bottom:16px;border-left:4px solid ${tabColor};">
          <div class="card-body" style="padding:16px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
              <div>
                <h3 style="margin:0;font-size:18px;">${(s.title || '').replace(/</g,'&lt;')} ${typeBadge}</h3>
                ${isCatSection
                  ? `<span class="text-sm text-muted">${linkType === 'category' ? 'Category' : 'Sub-Category'}: <b>${linkLabel}</b> | Grid: ${cols}×${rows} | Order: ${s.sortOrder || 0} | ${s.isActive !== false ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-gray">Inactive</span>'}</span>`
                  : `<span class="text-sm text-muted">Grid: ${cols}×${rows} | ${pids.length} products | Order: ${s.sortOrder || 0} | ${s.isActive !== false ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-gray">Inactive</span>'}</span>`
                }
              </div>
              <div style="display:flex;gap:8px;">
                <button class="btn btn-outline btn-sm" onclick="editSection('${s._id}')">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="delSection('${s._id}')">Delete</button>
              </div>
            </div>
            ${!isCatSection && pids.length ? `
            <div style="display:grid;grid-template-columns:repeat(${Math.min(cols, 6)},1fr);gap:8px;">
              ${pids.slice(0, cols * rows).map(pid => {
                const pImg = getProductImage(pid);
                const pName = getProductName(pid);
                return `<div style="text-align:center;font-size:11px;">
                  <div style="width:100%;aspect-ratio:1;background:#f3f4f6;border-radius:8px;overflow:hidden;margin-bottom:4px;">
                    ${pImg ? `<img src="${pImg}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'">` : ''}
                  </div>
                  <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${(pName || '').replace(/</g,'&lt;')}</div>
                </div>`;
              }).join('')}
            </div>` : (!isCatSection ? '<p class="text-muted text-sm">No products selected</p>' : '')}
          </div>
        </div>`;
      }).join('') : `<div class="empty-state" style="margin-top:40px;"><p>No sections created for ${isDamnDeal ? 'Online Store' : 'Quick Commerce'} yet</p></div>`}

      <!-- Section Modal -->
      <div class="modal-overlay" id="section-modal">
        <div class="modal" style="max-width:800px;max-height:90vh;overflow-y:auto;">
          <div class="modal-header"><h3 id="section-modal-title">Add Section</h3><button class="modal-close" onclick="closeModal('section-modal')">&times;</button></div>
          <div class="modal-body">
            <div class="form-group"><label>Section Type</label>
              <select class="form-control" id="s-type" onchange="toggleSectionType()">
                <option value="product_grid">📦 Product Grid (Manual Products)</option>
                <option value="category_section">📂 Category Section (Auto Products)</option>
              </select>
            </div>
            <div class="form-group"><label>Section Title</label><input class="form-control" id="s-title" placeholder="e.g. Top Products, Daily Essentials"></div>
            <div class="form-row">
              <div class="form-group"><label>Grid Columns</label>
                <select class="form-control" id="s-cols">
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4" selected>4</option>
                </select>
              </div>
              <div class="form-group"><label>Grid Rows</label>
                <select class="form-control" id="s-rows">
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3" selected>3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                </select>
              </div>
              <div class="form-group"><label>Sort Order</label>
                <input class="form-control" type="number" id="s-order" value="10">
              </div>
            </div>
            <div class="form-group">
              <label><input type="checkbox" id="s-active" checked> Active</label>
            </div>
            <hr>
            <!-- Category Section Fields -->
            <div id="cat-section-fields" style="display:none;">
              <div class="form-group"><label style="font-weight:600;">🔗 Link Type</label>
                <select class="form-control" id="s-link-type" onchange="onLinkTypeChange()">
                  <option value="category">Category</option>
                  <option value="subcategory">Sub-Category</option>
                </select>
              </div>
              <div class="form-group" id="cat-select-group"><label style="font-weight:600;">📁 Select Category</label>
                <select class="form-control" id="s-category" onchange="onCategoryChange()">
                  <option value="">-- Select Category --</option>
                </select>
              </div>
              <div class="form-group" id="subcat-select-group" style="display:none;"><label style="font-weight:600;">📂 Select Sub-Category</label>
                <select class="form-control" id="s-subcategory">
                  <option value="">-- Select Sub-Category --</option>
                </select>
              </div>
            </div>
            <!-- Product Grid Fields -->
            <div id="product-section-fields">
              <div class="form-group">
                <label style="font-weight:600;">🔍 Search & Add Products</label>
                <input class="form-control" id="s-search" placeholder="Type to search products..." oninput="filterProducts()">
              </div>
              <div id="product-search-results" style="max-height:200px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:16px;display:none;"></div>
              <div>
              <label style="font-weight:600;margin-bottom:8px;display:block;">Selected Products (<span id="selected-count">0</span>)</label>
              <div id="selected-products" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;"></div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="closeModal('section-modal')">Cancel</button>
            <button class="btn btn-primary" onclick="saveSection()" style="background:${tabColor}">Save</button>
          </div>
        </div>
      </div>
    `;
  }

  let selectedProductIds = [];

  window.filterProducts = function () {
    const q = (document.getElementById('s-search')?.value || '').toLowerCase().trim();
    const container = document.getElementById('product-search-results');
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
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid #f3f4f6;cursor:pointer;${already ? 'opacity:0.4;' : ''}" onclick="${already ? '' : `addProduct('${p._id}')`}">
        <div style="width:40px;height:40px;border-radius:6px;overflow:hidden;background:#f3f4f6;flex-shrink:0;">
          ${pImg ? `<img src="${pImg}" style="width:100%;height:100%;object-fit:cover;">` : ''}
        </div>
        <div style="flex:1;overflow:hidden;">
          <div style="font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${(p.name || '').replace(/</g,'&lt;')}</div>
          <div style="font-size:11px;color:#6b7280;">₹${p.sellingPrice || p.price || 0}${p.category?.name ? ' • ' + p.category.name : ''}</div>
        </div>
        <div style="font-size:11px;color:${already ? '#9ca3af' : '#10b981'};font-weight:600;">${already ? 'Added' : '+ Add'}</div>
      </div>`;
    }).join('');
    container.style.display = 'block';
  };

  window.addProduct = function (id) {
    if (selectedProductIds.includes(id)) return;
    selectedProductIds.push(id);
    renderSelectedProducts();
    filterProducts();
  };

  window.removeProduct = function (id) {
    selectedProductIds = selectedProductIds.filter(x => x !== id);
    renderSelectedProducts();
    filterProducts();
  };

  function renderSelectedProducts() {
    const container = document.getElementById('selected-products');
    const countEl = document.getElementById('selected-count');
    if (countEl) countEl.textContent = selectedProductIds.length;
    if (!container) return;

    container.innerHTML = selectedProductIds.map((pid, idx) => {
      const pImg = getProductImage(pid);
      const pName = getProductName(pid);
      return `<div style="position:relative;text-align:center;font-size:11px;background:#f9fafb;border-radius:8px;padding:6px;">
        <div style="position:absolute;top:2px;left:4px;font-size:10px;font-weight:700;color:#6b7280;">#${idx + 1}</div>
        <button onclick="removeProduct('${pid}')" style="position:absolute;top:2px;right:4px;background:#ef4444;color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;line-height:18px;padding:0;">&times;</button>
        <div style="width:100%;aspect-ratio:1;background:#e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:4px;">
          ${pImg ? `<img src="${pImg}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'">` : ''}
        </div>
        <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${(pName || '').replace(/</g,'&lt;')}</div>
      </div>`;
    }).join('');
  }

  window.openSectionForm = function () {
    editId = null;
    selectedProductIds = [];
    render();
    setTimeout(() => {
      document.getElementById('section-modal-title').textContent = 'Add Section';
      document.getElementById('s-type').value = 'product_grid';
      document.getElementById('s-title').value = '';
      document.getElementById('s-cols').value = '4';
      document.getElementById('s-rows').value = '3';
      document.getElementById('s-order').value = '10';
      document.getElementById('s-active').checked = true;
      document.getElementById('s-search').value = '';
      document.getElementById('product-search-results').style.display = 'none';
      toggleSectionType();
      renderSelectedProducts();
      openModal('section-modal');
    }, 50);
  };

  window.editSection = async function (id) {
    editId = id;
    const s = sections.find(x => x._id === id);
    if (!s) return;
    selectedProductIds = [...(s.data?.productIds || [])];
    render();
    setTimeout(() => {
      document.getElementById('section-modal-title').textContent = 'Edit Section';
      document.getElementById('s-type').value = s.type || 'product_grid';
      document.getElementById('s-title').value = s.title || '';
      document.getElementById('s-cols').value = String(s.data?.gridColumns || 4);
      document.getElementById('s-rows').value = String(s.data?.gridRows || 3);
      document.getElementById('s-order').value = s.sortOrder || 0;
      document.getElementById('s-active').checked = s.isActive !== false;
      document.getElementById('s-search').value = '';
      toggleSectionType();
      // If category_section, set the dropdowns
      if (s.type === 'category_section') {
        const lt = s.data?.linkType || 'category';
        document.getElementById('s-link-type').value = lt;
        onLinkTypeChange();
        if (lt === 'category') {
          document.getElementById('s-category').value = s.data?.linkValue || '';
        } else {
          // Find the parent category of this subcategory
          const sub = allSubCategories.find(sc => sc._id === s.data?.linkValue);
          if (sub) {
            const catId = typeof sub.category === 'object' ? sub.category._id : sub.category;
            document.getElementById('s-category').value = catId || '';
            onCategoryChange();
            setTimeout(() => {
              document.getElementById('s-subcategory').value = s.data?.linkValue || '';
            }, 50);
          }
        }
      }
      renderSelectedProducts();
      openModal('section-modal');
    }, 50);
  };

  window.toggleSectionType = function () {
    const type = document.getElementById('s-type').value;
    const catFields = document.getElementById('cat-section-fields');
    const prodFields = document.getElementById('product-section-fields');
    if (type === 'category_section') {
      catFields.style.display = 'block';
      prodFields.style.display = 'none';
      populateCategoryDropdown();
    } else {
      catFields.style.display = 'none';
      prodFields.style.display = 'block';
    }
  };

  function populateCategoryDropdown() {
    const sel = document.getElementById('s-category');
    if (!sel) return;
    const platformCats = allCategories.filter(c => (c.platform || 'ddgo') === activePlatform);
    sel.innerHTML = '<option value="">-- Select Category --</option>' +
      platformCats.map(c => `<option value="${c._id}">${(c.name || '').replace(/</g,'&lt;')}</option>`).join('');
  }

  window.onLinkTypeChange = function () {
    const lt = document.getElementById('s-link-type').value;
    const catGroup = document.getElementById('cat-select-group');
    const subGroup = document.getElementById('subcat-select-group');
    catGroup.style.display = 'block';
    if (lt === 'subcategory') {
      subGroup.style.display = 'block';
      catGroup.querySelector('label').textContent = '📁 Select Parent Category';
    } else {
      subGroup.style.display = 'none';
      catGroup.querySelector('label').textContent = '📁 Select Category';
    }
  };

  window.onCategoryChange = function () {
    const catId = document.getElementById('s-category').value;
    const subSel = document.getElementById('s-subcategory');
    if (!subSel) return;
    const filtered = allSubCategories.filter(sc => {
      const scCat = typeof sc.category === 'object' ? sc.category._id : sc.category;
      return scCat === catId;
    });
    subSel.innerHTML = '<option value="">-- Select Sub-Category --</option>' +
      filtered.map(sc => `<option value="${sc._id}">${(sc.name || '').replace(/</g,'&lt;')}</option>`).join('');
  };

  window.saveSection = async function () {
    const title = document.getElementById('s-title').value.trim();
    if (!title) return showToast('Title required', 'error');

    const sectionType = document.getElementById('s-type').value;
    const payload = {
      title,
      type: sectionType,
      platform: activePlatform,
      sortOrder: parseInt(document.getElementById('s-order').value) || 0,
      isActive: document.getElementById('s-active').checked,
      data: {
        gridColumns: parseInt(document.getElementById('s-cols').value) || 4,
        gridRows: parseInt(document.getElementById('s-rows').value) || 3,
      },
    };

    if (sectionType === 'category_section') {
      const linkType = document.getElementById('s-link-type').value;
      let linkValue = '';
      if (linkType === 'subcategory') {
        linkValue = document.getElementById('s-subcategory').value;
        if (!linkValue) return showToast('Please select a sub-category', 'error');
      } else {
        linkValue = document.getElementById('s-category').value;
        if (!linkValue) return showToast('Please select a category', 'error');
      }
      payload.data.linkType = linkType;
      payload.data.linkValue = linkValue;
    } else {
      payload.data.productIds = selectedProductIds;
    }

    try {
      if (editId) {
        await API.put('/admin/home-sections/' + editId, payload);
      } else {
        await API.post('/admin/home-sections', payload);
      }
      closeModal('section-modal');
      showToast(editId ? 'Section updated' : 'Section created');
      await load();
    } catch (err) { showToast(err.message, 'error'); }
  };

  window.delSection = async function (id) {
    if (!confirm('Delete this section?')) return;
    try {
      await API.delete('/admin/home-sections/' + id);
      showToast('Section deleted');
      await load();
    } catch (err) { showToast(err.message, 'error'); }
  };

  await load();
})();
