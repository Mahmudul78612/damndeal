(function () {
  document.body.innerHTML = pageShell("CJ Dropshipping");
  buildLayout("cj-products");
  const content = document.getElementById("page-content");

  function esc(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }

  // ── Region-aware currency ──────────────────────────────────────────────
  // US (damndeal.com) → everything stays in USD ($). IN → INR (₹, CJ cost ×84).
  const REGION = (typeof getRegion === 'function') ? getRegion() : (localStorage.getItem('dd_region') || 'IN');
  const IS_US = REGION === 'US';
  const CUR = IS_US ? '$' : '₹';
  const USD_INR = 84; // estimate rate for IN conversion

  function usd(n) { return n ? '$' + parseFloat(n).toFixed(2) : '—'; }
  function fmt(n) { return IS_US ? '$' + parseFloat(n || 0).toFixed(2) : '₹' + Math.round(parseFloat(n || 0)); }
  // For the imported list — use the product's own region (price was saved in that currency)
  function money(n, regions) {
    if (!n) return '—';
    const isUs = Array.isArray(regions) ? (regions.includes('US') && !regions.includes('IN')) : (regions === 'US');
    return isUs ? '$' + parseFloat(n).toFixed(2) : '₹' + parseFloat(n).toFixed(0);
  }
  // Estimate a selling price from CJ USD cost, region-aware
  function estPrice(costUsd, margin) {
    const c = parseFloat(costUsd) || 0;
    return IS_US ? Math.round(c * margin * 100) / 100 : Math.ceil(c * USD_INR * margin);
  }

  let activeTab = "search";
  let searchResults = [], searchPage = 1, searchTotal = 0, searchKeyword = "";
  let importedPage = 1;
  let ddCategories = [];
  let ddSubCategories = [];

  // ── Load DD categories for import modal ────────────────────────────────
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

  // ── Tab rendering ──────────────────────────────────────────────────────
  function renderTabs() {
    return `
      <div class="platform-tabs" style="margin-bottom:16px">
        <button class="ptab ${activeTab==='search'?'active':''}" onclick="window._cjTab('search')">🔍 Search CJ</button>
        <button class="ptab ${activeTab==='imported'?'active':''}" onclick="window._cjTab('imported')">📦 Imported</button>
        <button class="ptab ${activeTab==='settings'?'active':''}" onclick="window._cjTab('settings')">⚙️ Settings</button>
        <span class="text-muted text-sm" style="margin-left:auto;align-self:center">Region: <b>${IS_US ? '🇺🇸 USA · USD' : '🇮🇳 India · INR'}</b></span>
      </div>`;
  }

  window._cjTab = function(tab) { activeTab = tab; renderPage(); };

  // ── SEARCH TAB ─────────────────────────────────────────────────────────
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
      // US region → only USA-warehouse products
      const cc = IS_US ? '&countryCode=US' : '';
      const data = await API.get(`/admin/cj/products/search?keyword=${encodeURIComponent(searchKeyword)}&page=${p}&size=20${cc}`);
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

  // ── Freight calculation for "Free Delivery" toggle ─────────────────────
  window.__cjFreight = { fee: 0 }; // fee is in the active region's currency
  window.__impCost = 0;            // CJ product cost (USD) for the open product

  // Live profit calculator — Net = Selling − CJ cost − CJ shipping − payment fee.
  // Payment fee: US Stripe 2.9%+$0.30 · IN Razorpay ~2%. Shows a loss warning in red.
  window._updateProfit = function() {
    const box = document.getElementById('imp-profit');
    if (!box) return;
    const sell = parseFloat(document.getElementById('imp-price')?.value) || 0;
    const costUsd = window.__impCost || 0;
    const cost = IS_US ? costUsd : costUsd * USD_INR;          // product cost in region currency
    const shipping = window.__cjFreight.fee || 0;             // CJ freight (region currency)
    const payFee = IS_US ? (sell * 0.029 + 0.30) : (sell * 0.02); // Stripe / Razorpay
    const totalCost = cost + shipping + payFee;
    const profit = sell - totalCost;
    const margin = sell > 0 ? (profit / sell * 100) : 0;
    const ok = profit > 0.0001;
    box.style.background = ok ? '#ecfdf5' : '#fef2f2';
    box.style.border = ok ? '1px solid #a7f3d0' : '1px solid #fecaca';
    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;color:#6b7280"><span>CJ product cost</span><span>${fmt(cost)}</span></div>
      <div style="display:flex;justify-content:space-between;color:#6b7280"><span>CJ shipping ${shipping ? '' : '(click Calculate)'}</span><span>${fmt(shipping)}</span></div>
      <div style="display:flex;justify-content:space-between;color:#6b7280"><span>${IS_US ? 'Stripe fee (2.9%+$0.30)' : 'Razorpay fee (~2%)'}</span><span>${fmt(payFee)}</span></div>
      <div style="display:flex;justify-content:space-between;border-top:1px dashed #d1d5db;margin-top:4px;padding-top:4px;font-weight:700;color:${ok ? '#059669' : '#dc2626'}">
        <span>${ok ? '✅ Net profit' : '⚠️ LOSS'}</span><span>${fmt(profit)} &nbsp;(${margin.toFixed(0)}% margin)</span>
      </div>
      ${ok ? '' : '<div style="color:#dc2626;margin-top:3px">Raise the selling price — you will lose money at this price.</div>'}`;
  };

  window._calcFreight = async function(vid) {
    const resultEl = document.getElementById('imp-freight-result');
    if (!resultEl) return;
    const weight = parseFloat(document.getElementById('imp-weight')?.value) || 500;
    resultEl.innerHTML = '<span class="spinner" style="display:inline-block;width:12px;height:12px"></span> Calculating...';
    try {
      const qs = `weight=${weight}&quantity=1${vid ? `&vid=${encodeURIComponent(vid)}` : ''}`;
      const r = await API.get(`/admin/cj/freight?${qs}`);
      // US → freight to USA in USD; IN → freight to India in INR
      const fee = IS_US ? (r.feeUsd || 0) : (r.feeInr || 0);
      window.__cjFreight = { fee, feeUsd: r.feeUsd || 0 };
      const days = (r.minDays && r.maxDays) ? `${r.minDays}-${r.maxDays} days` : (r.maxDays ? `~${r.maxDays} days` : '');
      if (!fee) {
        resultEl.innerHTML = `<span style="color:#dc2626">CJ returned ${CUR}0 — try increasing weight or this variant has no shipping data.</span>`;
      } else {
        resultEl.innerHTML = `<span style="color:#059669;font-weight:600">${fmt(fee)} freight</span>${days ? ' (ETA ' + days + ')' : ''}`;
      }
      if (document.getElementById('imp-include-freight')?.checked) {
        window._toggleFreightInPrice(true);
      }
      window._updateProfit(); // freight now known → real profit
    } catch (err) {
      resultEl.innerHTML = `<span style="color:#dc2626">Failed: ${esc(err.message)}</span>`;
    }
  };

  // add/remove freight from prices (keeps 2 decimals for USD)
  function bump(el, delta) {
    if (!el) return;
    let v = parseFloat(el.value || 0) + delta;
    v = Math.max(0, v);
    el.value = IS_US ? Math.round(v * 100) / 100 : Math.ceil(v);
  }
  window._toggleFreightInPrice = function(checked) {
    const fee = window.__cjFreight.fee || 0;
    if (!fee) return;
    const delta = checked ? fee : -fee;
    bump(document.getElementById('imp-price'), delta);
    bump(document.getElementById('imp-mrp'), delta);
    document.querySelectorAll('#imp-variants input[data-vid]').forEach(inp => bump(inp, delta));
    window._updateProfit();
  };

  // ── Import Modal ───────────────────────────────────────────────────────
  window._openImport = async function(idx) {
    const p = searchResults[idx];
    if (!p) return;
    window.__cjFreight = { fee: 0 };

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
    window.__impCost = parseFloat(defaultCostUsd) || 0;

    // region-aware estimate (US: USD ×1.3 · IN: USD ×84 ×1.3)
    const estimatedPrice = estPrice(defaultCostUsd, 1.3);
    const estimatedMrp = IS_US ? Math.round(estimatedPrice * 1.2 * 100) / 100 : Math.ceil(estimatedPrice * 1.2);

    const catOptions = ddCategories.map(c => `<option value="${c._id}">${esc(c.name)}</option>`).join('');

    const variantRows = variants.slice(0, 10).map(v => {
      const vp = estPrice(v.variantSellPrice, 1.3);
      return `
      <tr>
        <td style="font-size:12px">${esc(v.variantKey || v.variantNameEn)}</td>
        <td style="font-size:12px">${usd(v.variantSellPrice)}</td>
        <td><input type="number" step="${IS_US ? '0.01' : '1'}" class="form-control" style="width:90px;padding:4px" data-vid="${esc(v.vid)}" data-cjsku="${esc(v.variantSku)}" data-cost="${v.variantSellPrice}" placeholder="${CUR} price" value="${vp}"></td>
      </tr>`;
    }).join('');

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

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:8px">
        <div>
          <label class="form-label">Selling Price (${CUR}) * <span style="font-weight:400;color:#9ca3af">${IS_US ? 'before tax' : 'incl. GST'}</span></label>
          <input id="imp-price" class="form-control" type="number" step="${IS_US ? '0.01' : '1'}" value="${estimatedPrice}" oninput="window._updateProfit()">
        </div>
        <div>
          <label class="form-label">MRP (${CUR}) * <span style="font-weight:400;color:#9ca3af">strike-through</span></label>
          <input id="imp-mrp" class="form-control" type="number" step="${IS_US ? '0.01' : '1'}" value="${estimatedMrp}">
        </div>
      </div>

      <!-- LIVE profit calculator — keeps you in profit -->
      <div id="imp-profit" style="margin-bottom:12px;padding:10px 12px;border-radius:8px;font-size:12px"></div>

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
        <label class="form-label">${IS_US ? 'Sales Tax %' : 'GST %'} (inclusive in selling price)</label>
        <select id="imp-gst" class="form-control">
          <option value="0">0% (None)</option>
          <option value="3">3%</option>
          <option value="5">5%</option>
          <option value="8" ${IS_US ? 'selected' : ''}>8%</option>
          <option value="12">12%</option>
          <option value="18" ${IS_US ? '' : 'selected'}>18%</option>
          <option value="28">28%</option>
        </select>
        <small style="color:#6b7280;font-size:11px">Included in the selling price above. For accounting only.</small>
      </div>

      ${variants.length > 1 ? `
        <div style="margin-bottom:12px">
          <label class="form-label" style="margin-bottom:6px">Variant Pricing (set ${CUR} price for each)</label>
          <div style="max-height:200px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:6px">
            <table style="width:100%;font-size:13px">
              <thead><tr style="background:#f9fafb"><th style="padding:6px 8px;text-align:left">Variant</th><th style="padding:6px 8px">CJ Cost</th><th style="padding:6px 8px">Your Price (${CUR})</th></tr></thead>
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
    window._updateProfit();
  };

  window._confirmImport = async function(pid, sku, costUsd, images) {
    const name = document.getElementById('imp-name')?.value?.trim();
    const description = document.getElementById('imp-desc')?.value?.trim() || '';
    const price = parseFloat(document.getElementById('imp-price')?.value);
    const mrp = parseFloat(document.getElementById('imp-mrp')?.value);
    const categoryId = document.getElementById('imp-cat')?.value;
    const subCategoryId = document.getElementById('imp-subcat')?.value;
    const gstPercent = parseInt(document.getElementById('imp-gst')?.value || '0', 10);

    if (!name || !price || !mrp || !categoryId) {
      return showToast("Fill all required fields", "error");
    }

    const variantInputs = document.querySelectorAll('#imp-variants input[data-vid]');
    const cjVariants = Array.from(variantInputs).map(inp => {
      const vp = parseFloat(inp.value) || price;
      return {
        label: inp.closest('tr').querySelector('td:first-child').textContent.trim(),
        cjVid: inp.dataset.vid,
        cjSku: inp.dataset.cjsku,
        cjCostUsd: parseFloat(inp.dataset.cost),
        sellingPrice: vp,
        mrp: IS_US ? Math.round(vp * 1.2 * 100) / 100 : Math.ceil(vp * 1.2),
        stock: 999,
      };
    });

    try {
      const btn = document.querySelector('.modal-body .btn-primary');
      if (btn) { btn.disabled = true; btn.textContent = 'Importing...'; }

      let imgArr = [];
      if (Array.isArray(images)) imgArr = images;
      else if (typeof images === 'string' && images.trim()) {
        try { imgArr = JSON.parse(images.replace(/&quot;/g, '"')); } catch (_) { imgArr = []; }
      }

      await API.post('/admin/cj/products/import', {
        cjProductId: pid,
        cjVariantSku: sku,
        cjCostUsd: costUsd,
        cjShippingUsd: (window.__cjFreight && window.__cjFreight.feeUsd) || 0,
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
      showToast('Product imported successfully! 🎉', 'success');
    } catch (err) {
      showToast(err.message || 'Import failed', 'error');
      const btn = document.querySelector('.modal-body .btn-primary');
      if (btn) { btn.disabled = false; btn.textContent = '✅ Import to Online Store'; }
    }
  };

  // ── IMPORTED TAB ───────────────────────────────────────────────────────
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
              <th>Image</th><th>Name</th><th>CJ Cost</th><th>Selling Price</th><th>MRP</th><th>Region</th><th>Category</th><th>Status</th><th>Actions</th>
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
                  <td><strong>${money(p.sellingPrice, p.regions)}</strong></td>
                  <td>${money(p.mrp, p.regions)}</td>
                  <td style="font-size:11px">${(p.regions || ['IN']).join(', ')}</td>
                  <td style="font-size:12px">${esc(p.category?.name || '—')}</td>
                  <td><span class="badge ${p.isActive ? 'badge-success' : 'badge-danger'}">${p.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <button class="btn btn-sm btn-outline" onclick="window._editImported('${p._id}', ${p.sellingPrice}, ${p.mrp}, ${p.isActive}, '${(p.regions || []).includes('US') ? 'US' : 'IN'}')">Edit</button>
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

  window._editImported = function(id, price, mrp, isActive, region) {
    const cur = region === 'US' ? '$' : '₹';
    const step = region === 'US' ? '0.01' : '1';
    showModal(`
      <h3 style="margin-bottom:16px">Edit Pricing</h3>
      <div style="margin-bottom:12px">
        <label class="form-label">Selling Price (${cur})</label>
        <input id="edit-price" class="form-control" type="number" step="${step}" value="${price}">
      </div>
      <div style="margin-bottom:12px">
        <label class="form-label">MRP (${cur})</label>
        <input id="edit-mrp" class="form-control" type="number" step="${step}" value="${mrp}">
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

  // ── SETTINGS TAB ───────────────────────────────────────────────────────
  async function renderSettings() {
    content.innerHTML = renderTabs() + '<div class="text-center" style="padding:40px"><div class="spinner"></div></div>';
    try {
      const r = await API.get('/admin/cj/settings');
      const s = r.settings || {};
      content.innerHTML = renderTabs() + `
        <div class="card" style="max-width:500px">
          <h3 style="margin-bottom:4px">CJ Dropshipping API Settings</h3>
          <p style="color:#6b7280;font-size:13px;margin-bottom:20px">
            Get your API key from <a href="https://www.cjdropshipping.com/myCJ.html#/apikey" target="_blank" style="color:#6366f1">CJ Dashboard → API Key</a>
          </p>
          <div style="margin-bottom:16px">
            <label class="form-label">CJ API Key</label>
            <input id="cj-apikey" class="form-control" type="password" placeholder="Enter CJ API Key..." value="">
            <div style="font-size:12px;color:#6b7280;margin-top:4px">
              Status: ${s.configured ? '<span style="color:#059669;font-weight:600">✅ Configured</span>' : '<span style="color:#ef4444">❌ Not configured</span>'}
            </div>
          </div>
          <button class="btn btn-primary" onclick="window._saveCJSettings()">Save API Key</button>
        </div>

        <div class="card" style="max-width:500px;margin-top:16px">
          <h3 style="margin-bottom:12px">How it works</h3>
          <ol style="color:#374151;font-size:14px;line-height:1.8;padding-left:20px">
            <li>Get API Key from CJ Dropshipping dashboard</li>
            <li>Save it above</li>
            <li>Go to <strong>Search CJ</strong> tab → search products</li>
            <li>Set your selling price → Import</li>
            <li>Product appears on website automatically</li>
            <li>Customer orders → CJ ships directly to customer</li>
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

  // ── Main render ────────────────────────────────────────────────────────
  function renderPage() {
    if (activeTab === 'search') renderSearch();
    else if (activeTab === 'imported') renderImported(1);
    else if (activeTab === 'settings') renderSettings();
  }

  (async function init() {
    await loadDDCategories();
    await loadDDSubCategories();
    renderPage();
  })();

})();
