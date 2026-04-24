(function () {
  document.body.innerHTML = pageShell("CJ Dropshipping");
  buildLayout("cj-products");
  const content = document.getElementById("page-content");

  function esc(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }
  function usd(n) { return n ? '$' + parseFloat(n).toFixed(2) : 'â€”'; }
  function inr(n) { return n ? 'â‚¹' + parseFloat(n).toFixed(0) : 'â€”'; }

  let activeTab = "search"; // "search" | "imported" | "settings"
  let searchResults = [], searchPage = 1, searchTotal = 0, searchKeyword = "";
  let importedPage = 1;
  let ddCategories = [];
  let ddSubCategories = [];

  // â”€â”€ Load DD categories for import modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function loadDDCategories() {
    try {
      const r = await API.get("/admin/categories?platform=damndeal&limit=200");
      ddCategories = (r.categories || []).filter(c => c.platform === "damndeal");
    } catch (_) { ddCategories = []; }
  }

  async function loadDDSubCategories() {
    try {
      const r = await API.get("/admin/subcategories?platform=damndeal");
      ddSubCategories = r.subCategories || [];
    } catch (_) { ddSubCategories = []; }
  }

  // â”€â”€ Tab rendering â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function renderTabs() {
    return `
      <div class="platform-tabs" style="margin-bottom:16px">
        <button class="ptab ${activeTab==='search'?'active':''}" onclick="window._cjTab('search')">ðŸ” Search CJ</button>
        <button class="ptab ${activeTab==='imported'?'active':''}" onclick="window._cjTab('imported')">ðŸ“¦ Imported</button>
        <button class="ptab ${activeTab==='settings'?'active':''}" onclick="window._cjTab('settings')">âš™ï¸ Settings</button>
      </div>`;
  }

  window._cjTab = function(tab) { activeTab = tab; renderPage(); };

  // â”€â”€ SEARCH TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function renderSearch() {
    content.innerHTML = renderTabs() + `
      <div class="toolbar">
        <div class="toolbar-left">
          <input id="cj-kw" class="search-input" placeholder="Search products on CJ..." value="${esc(searchKeyword)}" style="width:280px">
          <button class="btn btn-primary btn-sm" onclick="window._cjSearch(1)">Search</button>
          ${searchTotal ? `<span class="text-muted text-sm">${searchTotal.toLocaleString()} results</span>` : ''}
        </div>
      </div>
      <div id="cj-results">${searchResults.length === 0 ? '<div class="text-center text-muted" style="padding:60px">Enter a keyword to search CJ Dropshipping catalog</div>' : ''}</div>
      <div id="cj-pagination"></div>`;

    document.getElementById('cj-kw').addEventListener('keydown', e => { if (e.key === 'Enter') window._cjSearch(1); });
    if (searchResults.length) renderSearchResults();
  }

  window._cjSearch = async function(p = 1) {
    searchKeyword = document.getElementById('cj-kw')?.value?.trim() || searchKeyword;
    if (!searchKeyword) return showToast("Enter a keyword", "error");
    searchPage = p;

    const resultsDiv = document.getElementById('cj-results');
    resultsDiv.innerHTML = '<div class="text-center" style="padding:40px"><div class="spinner"></div></div>';

    try {
      const data = await API.get(`/admin/cj/products/search?keyword=${encodeURIComponent(searchKeyword)}&page=${p}&size=20`);
      searchResults = data.products || [];
      searchTotal = data.total || 0;
      renderSearchResults();

      const pagDiv = document.getElementById('cj-pagination');
      if (data.pages > 1) {
        renderPagination('cj-pagination', p, data.pages, window._cjSearch);
      } else {
        pagDiv.innerHTML = '';
      }
    } catch (err) {
      resultsDiv.innerHTML = `<div class="alert alert-danger">${esc(err.message)}</div>`;
    }
  };

  function renderSearchResults() {
    const div = document.getElementById('cj-results');
    if (!searchResults.length) {
      div.innerHTML = '<div class="text-center text-muted" style="padding:40px">No results found</div>';
      return;
    }

    div.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;margin-top:8px">
        ${searchResults.map((p, i) => `
          <div class="card" style="padding:0;overflow:hidden">
            <img src="${esc(p.bigImage)}" style="width:100%;height:180px;object-fit:cover" onerror="this.src='https://placehold.co/220x180/f3f4f6/9ca3af?text=No+Image'">
            <div style="padding:12px">
              <div style="font-size:13px;font-weight:600;line-height:1.3;margin-bottom:6px;height:38px;overflow:hidden">${esc(p.nameEn)}</div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                <span style="color:#059669;font-weight:700">${usd(p.sellPrice)}</span>
                <span style="font-size:11px;color:#6b7280">${esc(p.threeCategoryName || '')}</span>
              </div>
              <div style="font-size:11px;color:#9ca3af;margin-bottom:10px">SKU: ${esc(p.sku)}</div>
              <button class="btn btn-primary btn-sm" style="width:100%" onclick="window._openImport(${i})">+ Import</button>
            </div>
          </div>
        `).join('')}
      </div>`;
  }

  // ── Freight calculation for "Free Delivery" toggle ───────────────────
  window.__cjFreight = { feeInr: 0 };

  window._calcFreight = async function(vid) {
    const resultEl = document.getElementById('imp-freight-result');
    if (!resultEl) return;
    const weight = parseFloat(document.getElementById('imp-weight')?.value) || 500;
    resultEl.innerHTML = '<span class="spinner" style="display:inline-block;width:12px;height:12px"></span> Calculating...';
    try {
      const qs = `weight=${weight}&quantity=1${vid ? `&vid=${encodeURIComponent(vid)}` : ''}`;
      const r = await API.get(`/admin/cj/freight?${qs}`);
      window.__cjFreight.feeInr = r.feeInr || 0;
      const days = (r.minDays && r.maxDays) ? `${r.minDays}-${r.maxDays} days` : (r.maxDays ? `~${r.maxDays} days` : '');
      if (!r.feeInr) {
        resultEl.innerHTML = `<span style="color:#dc2626">CJ returned ₹0 — try increasing weight or this variant has no shipping data.</span>`;
      } else {
        resultEl.innerHTML = `<span style="color:#059669;font-weight:600">₹${r.feeInr.toFixed(0)} freight</span> ($${(r.feeUsd||0).toFixed(2)}${days ? ', ETA ' + days : ''})`;
      }
      // Auto-apply if checkbox already on
      if (document.getElementById('imp-include-freight')?.checked) {
        window._toggleFreightInPrice(true);
      }
    } catch (err) {
      resultEl.innerHTML = `<span style="color:#dc2626">Failed: ${esc(err.message)}</span>`;
    }
  };

  window._toggleFreightInPrice = function(checked) {
    const fee = window.__cjFreight.feeInr || 0;
    if (!fee) return;
    const priceEl = document.getElementById('imp-price');
    const mrpEl = document.getElementById('imp-mrp');
    const variantInputs = document.querySelectorAll('#imp-variants input[data-vid]');
    const delta = checked ? fee : -fee;
    if (priceEl) priceEl.value = Math.max(0, Math.ceil(parseFloat(priceEl.value || 0) + delta));
    if (mrpEl) mrpEl.value = Math.max(0, Math.ceil(parseFloat(mrpEl.value || 0) + delta));
    variantInputs.forEach(inp => {
      inp.value = Math.max(0, Math.ceil(parseFloat(inp.value || 0) + delta));
    });
  };

  // â”€â”€ Import Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  window._openImport = async function(idx) {
    const p = searchResults[idx];
    if (!p) return;

    // Reset freight cache for new product
    window.__cjFreight = { feeInr: 0 };

    // Show loading modal first
    showModal(`
      <h3 style="margin-bottom:16px">Import: ${esc(p.nameEn)}</h3>
      <div class="text-center" style="padding:20px"><div class="spinner"></div><p class="text-muted" style="margin-top:8px">Loading product details...</p></div>
    `);

    let details = null;
    try {
      const r = await API.get(`/admin/cj/products/${encodeURIComponent(p.id || p.productId || p.pid)}`);
      details = r.product;
    } catch (_) { details = null; }

    const variants = details?.variants || [];
    const images = details?.productImageSet || (p.bigImage ? [p.bigImage] : []);
    const description = details?.productDescription || details?.description || '';
    const defaultCostUsd = details?.sellPrice || p.sellPrice || 0;

    // Estimate INR (approx 84x + 20% margin)
    const estimatedInr = Math.ceil(parseFloat(defaultCostUsd) * 84 * 1.3);
    const estimatedMrp = Math.ceil(estimatedInr * 1.2);

    const catOptions = ddCategories.map(c => `<option value="${c._id}">${esc(c.name)}</option>`).join('');

    const variantRows = variants.slice(0, 10).map(v => `
      <tr>
        <td style="font-size:12px">${esc(v.variantKey || v.variantNameEn)}</td>
        <td style="font-size:12px">${usd(v.variantSellPrice)}</td>
        <td><input type="number" class="form-control" style="width:90px;padding:4px" data-vid="${esc(v.vid)}" data-cjsku="${esc(v.variantSku)}" data-cost="${v.variantSellPrice}" placeholder="â‚¹ price" value="${Math.ceil(parseFloat(v.variantSellPrice || 0) * 84 * 1.3)}"></td>
      </tr>
    `).join('');

    showModal(`
      <h3 style="margin-bottom:4px">Import Product</h3>
      <p style="color:#6b7280;font-size:13px;margin-bottom:16px">${esc(p.nameEn)}</p>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
        <img src="${esc(images[0] || '')}" style="width:100%;height:160px;object-fit:cover;border-radius:8px;grid-column:span 1" onerror="this.src='https://placehold.co/200x160/f3f4f6/9ca3af?text=No+Image'">
        <div>
          <div style="font-size:12px;color:#6b7280">CJ Cost (USD)</div>
          <div style="font-size:18px;font-weight:700;color:#059669;margin-bottom:8px">${usd(defaultCostUsd)}</div>
          <div style="font-size:12px;color:#6b7280">CJ SKU</div>
          <div style="font-size:13px;margin-bottom:8px">${esc(p.sku || details?.productSku)}</div>
          <div style="font-size:12px;color:#6b7280">Stock</div>
          <div style="font-size:13px">${p.warehouseInventoryNum ? p.warehouseInventoryNum.toLocaleString() : 'Available'}</div>
        </div>
      </div>

      <div style="margin-bottom:12px">
        <label class="form-label">Product Name *</label>
        <input id="imp-name" class="form-control" value="${esc(p.nameEn)}">
      </div>

      <div style="margin-bottom:12px">
        <label class="form-label">Description</label>
        <textarea id="imp-desc" class="form-control" style="height:100px;resize:vertical" placeholder="Product description...">${esc(description)}</textarea>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div>
          <label class="form-label">Selling Price (â‚¹) *</label>
          <input id="imp-price" class="form-control" type="number" value="${estimatedInr}">
        </div>
        <div>
          <label class="form-label">MRP (â‚¹) *</label>
          <input id="imp-mrp" class="form-control" type="number" value="${estimatedMrp}">
        </div>
      </div>

      <!-- Free Delivery: auto-add CJ freight into price -->
      <div style="margin-bottom:12px;padding:10px;border:1px dashed #c7d2fe;border-radius:8px;background:#f5f3ff">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <div style="font-size:13px;font-weight:600;color:#4c1d95">🚚 Free Delivery (add CJ freight to price)</div>
          <div style="display:flex;gap:6px;align-items:center">
            <label style="font-size:11px;color:#6b7280">Weight (g)</label>
            <input id="imp-weight" type="number" class="form-control" style="width:90px;padding:4px 6px" value="${parseFloat(details?.productWeight) || 500}">
            <button class="btn btn-sm btn-outline" type="button" onclick="window._calcFreight('${esc((variants[0]?.vid) || details?.vid || '')}')">Calculate</button>
          </div>
        </div>
        <div id="imp-freight-result" style="margin-top:8px;font-size:12px;color:#6b7280">Click <b>Calculate</b> to fetch CJ freight estimate.</div>
        <label style="display:flex;align-items:center;gap:6px;margin-top:8px;font-size:12px;cursor:pointer">
          <input type="checkbox" id="imp-include-freight" onchange="window._toggleFreightInPrice(this.checked)">
          <span>Include freight in selling price (so customer sees <b>Free Delivery</b>)</span>
        </label>
      </div>

      <div style="margin-bottom:12px">
        <label class="form-label">Online Store Category *</label>
        <select id="imp-cat" class="form-control">
          <option value="">-- Select Category --</option>
          ${catOptions}
        </select>
      </div>

      <div style="margin-bottom:12px">
        <label class="form-label">Sub Category (optional)</label>
        <select id="imp-subcat" class="form-control" disabled>
          <option value="">-- Select Category first --</option>
        </select>
      </div>

      <div style="margin-bottom:12px">
        <label class="form-label">GST % (inclusive in selling price)</label>
        <select id="imp-gst" class="form-control">
          <option value="0">0% (No GST)</option>
          <option value="3">3%</option>
          <option value="5">5%</option>
          <option value="12">12%</option>
          <option value="18" selected>18% (Default)</option>
          <option value="28">28%</option>
        </select>
        <small style="color:#6b7280;font-size:11px">GST is included in the selling price above. For accounting only.</small>
      </div>

      ${variants.length > 1 ? `
        <div style="margin-bottom:12px">
          <label class="form-label" style="margin-bottom:6px">Variant Pricing (set INR price for each)</label>
          <div style="max-height:200px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:6px">
            <table style="width:100%;font-size:13px">
              <thead><tr style="background:#f9fafb"><th style="padding:6px 8px;text-align:left">Variant</th><th style="padding:6px 8px">CJ Cost</th><th style="padding:6px 8px">Your Price (â‚¹)</th></tr></thead>
              <tbody id="imp-variants">${variantRows}</tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <div style="display:flex;gap:10px;margin-top:16px">
        <button class="btn btn-primary" style="flex:1" onclick="window._confirmImport('${esc(p.id || p.productId)}', '${esc(p.sku)}', ${parseFloat(defaultCostUsd)}, ${JSON.stringify(images.slice(0,5)).replace(/"/g,'&quot;')})">✅ Import to Online Store</button>
        <button class="btn btn-outline" onclick="closeModal('_generic-modal')">Cancel</button>
      </div>
    `);

    const catEl = document.getElementById('imp-cat');
    const subEl = document.getElementById('imp-subcat');
    const renderSubCats = () => {
      const catId = catEl?.value;
      const list = ddSubCategories.filter(s => (s.category?._id || s.category) === catId);
      if (!subEl) return;
      if (!catId) {
        subEl.disabled = true;
        subEl.innerHTML = '<option value="">-- Select Category first --</option>';
        return;
      }
      subEl.disabled = false;
      subEl.innerHTML = `<option value="">-- Optional: Select Sub Category --</option>${list.map(s => `<option value="${s._id}">${esc(s.name)}</option>`).join('')}`;
    };
    catEl?.addEventListener('change', renderSubCats);
    renderSubCats();
  };

  window._confirmImport = async function(pid, sku, costUsd, images) {
    const name = document.getElementById('imp-name')?.value?.trim();
    const description = document.getElementById('imp-desc')?.value?.trim() || '';
    const price = parseFloat(document.getElementById('imp-price')?.value);
    const mrp = parseFloat(document.getElementById('imp-mrp')?.value);
    const categoryId = document.getElementById('imp-cat')?.value;
    const subCategoryId = document.getElementById('imp-subcat')?.value;
    const gstPercent = parseInt(document.getElementById('imp-gst')?.value || '18', 10);

    if (!name || !price || !mrp || !categoryId) {
      return showToast("Fill all required fields", "error");
    }

    // Collect variant pricing
    const variantInputs = document.querySelectorAll('#imp-variants input[data-vid]');
    const cjVariants = Array.from(variantInputs).map(inp => ({
      label: inp.closest('tr').querySelector('td:first-child').textContent.trim(),
      cjVid: inp.dataset.vid,
      cjSku: inp.dataset.cjsku,
      cjCostUsd: parseFloat(inp.dataset.cost),
      sellingPrice: parseFloat(inp.value) || price,
      mrp: Math.ceil(parseFloat(inp.value) * 1.2) || mrp,
      stock: 999,
    }));

    try {
      const btn = document.querySelector('.modal-body .btn-primary');
      if (btn) { btn.disabled = true; btn.textContent = 'Importing...'; }

      // Images may arrive as array (inline JS arg) or as serialized string.
      let imgArr = [];
      if (Array.isArray(images)) {
        imgArr = images;
      } else if (typeof images === 'string' && images.trim()) {
        try {
          imgArr = JSON.parse(images.replace(/&quot;/g, '"'));
        } catch (_) {
          imgArr = [];
        }
      }

      await API.post('/admin/cj/products/import', {
        cjProductId: pid,
        cjVariantSku: sku,
        cjCostUsd: costUsd,
        name,
        description,
        sellingPrice: price,
        mrp,
        categoryId,
        subCategoryId: subCategoryId || null,
        platform: 'damndeal',
        gstPercent,
        images: imgArr,
        cjVariants: cjVariants.length > 0 ? cjVariants : [],
      });

      closeModal('_generic-modal');
      showToast('Product imported successfully! ðŸŽ‰', 'success');
    } catch (err) {
      showToast(err.message || 'Import failed', 'error');
      const btn = document.querySelector('.modal-body .btn-primary');
      if (btn) { btn.disabled = false; btn.textContent = '✅ Import to Online Store'; }
    }
  };

  // â”€â”€ IMPORTED TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function renderImported(p = 1) {
    importedPage = p;
    content.innerHTML = renderTabs() + '<div class="text-center" style="padding:40px"><div class="spinner"></div></div>';
    try {
      const data = await API.get(`/admin/cj/imported?page=${p}&limit=20`);
      const products = data.products || [];
      const pag = data.pagination || {};

      let tableHTML = '';
      if (!products.length) {
        tableHTML = '<div class="text-center text-muted" style="padding:60px">No CJ products imported yet.<br><button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="window._cjTab(\'search\')">Search & Import</button></div>';
      } else {
        tableHTML = `
          <div class="toolbar" style="margin-bottom:12px">
            <div class="toolbar-left"><span class="text-muted text-sm">${pag.total || 0} imported products</span></div>
            <div class="toolbar-right"><button class="btn btn-primary btn-sm" onclick="window._cjTab('search')">+ Import More</button></div>
          </div>
          <div class="table-wrapper">
          <table class="data-table">
            <thead><tr>
              <th>Image</th><th>Name</th><th>CJ Cost</th><th>Selling Price</th><th>MRP</th><th>Category</th><th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody>
              ${products.map(p => `
                <tr>
                  <td><img src="${esc(p.images?.[0] || '')}" style="width:48px;height:48px;object-fit:cover;border-radius:6px" onerror="this.src='https://placehold.co/48x48/f3f4f6/9ca3af?text=?'"></td>
                  <td style="max-width:200px">
                    <div style="font-weight:500;font-size:13px">${esc(p.name)}</div>
                    <div style="font-size:11px;color:#9ca3af">CJ: ${esc(p.cjVariantSku || p.cjProductId)}</div>
                  </td>
                  <td>${usd(p.cjCostPrice)}</td>
                  <td><strong>${inr(p.sellingPrice)}</strong></td>
                  <td>${inr(p.mrp)}</td>
                  <td style="font-size:12px">${esc(p.category?.name || 'â€”')}</td>
                  <td><span class="badge ${p.isActive ? 'badge-success' : 'badge-danger'}">${p.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <button class="btn btn-sm btn-outline" onclick="window._editImported('${p._id}', ${p.sellingPrice}, ${p.mrp}, ${p.isActive})">Edit</button>
                    <button class="btn btn-sm btn-outline" style="color:#ef4444;border-color:#ef4444" onclick="window._deleteImported('${p._id}', '${esc(p.name)}')">Delete</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          </div>`;
      }

      content.innerHTML = renderTabs() + tableHTML + '<div id="imp-pagination"></div>';
      if (pag.pages > 1) renderPagination('imp-pagination', p, pag.pages, renderImported);
    } catch (err) {
      content.innerHTML = renderTabs() + `<div class="alert alert-danger">${esc(err.message)}</div>`;
    }
  }

  window._editImported = function(id, price, mrp, isActive) {
    showModal(`
      <h3 style="margin-bottom:16px">Edit Pricing</h3>
      <div style="margin-bottom:12px">
        <label class="form-label">Selling Price (â‚¹)</label>
        <input id="edit-price" class="form-control" type="number" value="${price}">
      </div>
      <div style="margin-bottom:12px">
        <label class="form-label">MRP (â‚¹)</label>
        <input id="edit-mrp" class="form-control" type="number" value="${mrp}">
      </div>
      <div style="margin-bottom:16px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="edit-active" ${isActive ? 'checked' : ''}> Active
        </label>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-primary" style="flex:1" onclick="window._saveEditImported('${id}')">Save</button>
        <button class="btn btn-outline" onclick="closeModal('_generic-modal')">Cancel</button>
      </div>
    `);
  };

  window._saveEditImported = async function(id) {
    const sellingPrice = parseFloat(document.getElementById('edit-price')?.value);
    const mrp = parseFloat(document.getElementById('edit-mrp')?.value);
    const isActive = document.getElementById('edit-active')?.checked;
    try {
      await API.put(`/admin/cj/imported/${id}`, { sellingPrice, mrp, isActive });
      closeModal('_generic-modal');
      showToast('Updated!', 'success');
      renderImported(importedPage);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  window._deleteImported = function(id, name) {
    showModal(`
      <h3>Delete Product</h3>
      <p>Remove <strong>${esc(name)}</strong> from Online Store?</p>
      <div style="display:flex;gap:10px;margin-top:16px">
        <button class="btn btn-danger" style="flex:1" onclick="window._confirmDeleteImported('${id}')">Delete</button>
        <button class="btn btn-outline" onclick="closeModal('_generic-modal')">Cancel</button>
      </div>
    `);
  };

  window._confirmDeleteImported = async function(id) {
    try {
      await API.delete(`/admin/cj/imported/${id}`);
      closeModal('_generic-modal');
      showToast('Deleted', 'success');
      renderImported(importedPage);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // â”€â”€ SETTINGS TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function renderSettings() {
    content.innerHTML = renderTabs() + '<div class="text-center" style="padding:40px"><div class="spinner"></div></div>';
    try {
      const r = await API.get('/admin/cj/settings');
      const s = r.settings || {};
      content.innerHTML = renderTabs() + `
        <div class="card" style="max-width:500px">
          <h3 style="margin-bottom:4px">CJ Dropshipping API Settings</h3>
          <p style="color:#6b7280;font-size:13px;margin-bottom:20px">
            Get your API key from <a href="https://www.cjdropshipping.com/myCJ.html#/apikey" target="_blank" style="color:#6366f1">CJ Dashboard â†’ API Key</a>
          </p>
          <div style="margin-bottom:16px">
            <label class="form-label">CJ API Key</label>
            <input id="cj-apikey" class="form-control" type="password" placeholder="Enter CJ API Key..." value="${s.cj_api_key && s.cj_api_key !== '****null' ? s.cj_api_key : ''}">
            <div style="font-size:12px;color:#6b7280;margin-top:4px">
              Status: ${s.configured ? '<span style="color:#059669;font-weight:600">âœ… Configured</span>' : '<span style="color:#ef4444">âŒ Not configured</span>'}
            </div>
          </div>
          <button class="btn btn-primary" onclick="window._saveCJSettings()">Save API Key</button>
        </div>

        <div class="card" style="max-width:500px;margin-top:16px">
          <h3 style="margin-bottom:12px">How it works</h3>
          <ol style="color:#374151;font-size:14px;line-height:1.8;padding-left:20px">
            <li>Get API Key from CJ Dropshipping dashboard</li>
            <li>Save it above</li>
            <li>Go to <strong>Search CJ</strong> tab â†’ search products</li>
            <li>Set your selling price â†’ Import</li>
            <li>Product appears on website automatically</li>
            <li>Customer orders â†’ CJ ships directly to customer</li>
          </ol>
        </div>`;
    } catch (err) {
      content.innerHTML = renderTabs() + `<div class="alert alert-danger">${esc(err.message)}</div>`;
    }
  }

  window._saveCJSettings = async function() {
    const key = document.getElementById('cj-apikey')?.value?.trim();
    if (!key) return showToast("Enter API key", "error");
    try {
      await API.post('/admin/cj/settings', { cj_api_key: key });
      showToast('API Key saved!', 'success');
      renderSettings();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // â”€â”€ Main render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function renderPage() {
    if (activeTab === 'search') renderSearch();
    else if (activeTab === 'imported') renderImported(1);
    else if (activeTab === 'settings') renderSettings();
  }

  // â”€â”€ Init â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  (async function init() {
    await loadDDCategories();
    await loadDDSubCategories();
    renderPage();
  })();

})();

