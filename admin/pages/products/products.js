(function () {
  document.body.innerHTML = pageShell("Products");
  buildLayout("products");
  const content = document.getElementById("page-content");

  function esc(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }

  let page = 1, platform = "ddgo", statusFilter = "", searchQ = "", categoryFilter = "";
  let categories = [], subCategories = [], partners = [];
  let viewMode = "compact";

  async function loadMeta() {
    try { const r = await API.get("/admin/categories"); categories = r.categories || []; } catch (_) { categories = []; }
    try { const r = await API.get("/admin/subcategories"); subCategories = r.subCategories || []; } catch (_) { subCategories = []; }
    try { const r = await API.get("/admin/partners?limit=500"); partners = r.partners || []; } catch (_) { partners = []; }
  }

  function catsByPlatform() { return categories.filter((c) => c.platform === platform); }
  function subsByCat(catId) { return subCategories.filter((s) => (s.category?._id || s.category) === catId); }
  function imgUrl(path) {
    if (!path) return '';
    const raw = String(path);
    if (/^https?:\/\//i.test(raw)) return raw;
    const base = CONFIG.UPLOADS_BASE || CONFIG.API_BASE.replace('/api', '');
    if (raw.startsWith('/')) return `${base}${raw}`;
    return `${base}/${raw}`;
  }

  async function load(p = 1) {
    page = p;
    content.innerHTML = '<div class="text-center" style="padding:40px"><div class="spinner"></div></div>';
    try {
      let ep = `/admin/products?page=${page}&limit=30&platform=${platform}`;
      // Phase 2: scope products list to currently selected admin region (IN/US)
      try { var _r = (typeof getRegion === 'function') ? getRegion() : (localStorage.getItem('dd_region') || 'IN'); if (_r) ep += '&region=' + _r; } catch (_) {}
      if (statusFilter) ep += "&approvalStatus=" + statusFilter;
      if (categoryFilter) ep += "&category=" + categoryFilter;
      if (searchQ) ep += "&search=" + encodeURIComponent(searchQ);
      const data = await API.get(ep);
      const products = data.products || [];
      const pag = data.pagination || {};
      const pCats = catsByPlatform();

      content.innerHTML = `
        <div class="platform-tabs">
          <button class="ptab ${platform === "ddgo" ? "active" : ""}" onclick="switchPlatform('ddgo')">Quick Commerce</button>
          <button class="ptab ${platform === "damndeal" ? "active" : ""}" onclick="switchPlatform('damndeal')">Online Store</button>
        </div>
        <div class="cat-chips">
          <button class="chip ${!categoryFilter ? 'active' : ''}" onclick="filterCat('')">All</button>
          ${pCats.map(c => `<button class="chip ${categoryFilter === c._id ? 'active' : ''}" onclick="filterCat('${c._id}')">${esc(c.name)}</button>`).join('')}
        </div>
        <div class="toolbar">
          <div class="toolbar-left">
            <input class="search-input" placeholder="Search products..." value="${esc(searchQ)}" onkeyup="if(event.key==='Enter'){window._sq=this.value;loadP(1)}">
            <select class="form-control" style="width:130px" onchange="window._sf=this.value;loadP(1)">
              <option value="">All Status</option>
              <option value="pending" ${statusFilter === "pending" ? "selected" : ""}>Pending</option>
              <option value="approved" ${statusFilter === "approved" ? "selected" : ""}>Approved</option>
              <option value="rejected" ${statusFilter === "rejected" ? "selected" : ""}>Rejected</option>
            </select>
            <span class="text-muted text-sm">${pag.total || 0} products</span>
          </div>
          <div class="toolbar-right">
            <div class="view-toggle">
              <button class="vt-btn ${viewMode === 'compact' ? 'active' : ''}" onclick="setView('compact')" title="Grid">&#9638;</button>
              <button class="vt-btn ${viewMode === 'table' ? 'active' : ''}" onclick="setView('table')" title="Table">&#9776;</button>
            </div>
            <button class="btn btn-sm btn-primary" onclick="openAdd()">+ Add Product</button>
            <button class="btn btn-sm" style="background:#10b981;color:#fff" onclick="openImportCsv()">📥 Import CSV</button>
          </div>
        </div>
        ${viewMode === 'compact' ? renderCompactGrid(products) : renderTable(products)}
        <div class="pagination" id="pag"></div>
        ${buildModal()}
      `;
      renderPagination("pag", page, pag.pages || 1, loadP);
    } catch (e) { content.innerHTML = '<div class="empty-state"><p>' + esc(e.message) + '</p></div>'; }
  }

  function renderCompactGrid(products) {
    if (!products.length) return '<div class="empty-state"><p>No products found</p></div>';
    return `<div class="prod-grid">${products.map(p => {
      const img = p.images && p.images.length ? imgUrl(p.images[0]) : '';
      const variantCount = (p.variants || []).length;
      const totalStock = variantCount > 0 ? (p.variants || []).reduce((s, v) => s + (v.stock || 0), 0) : p.stock;
      const lowStock = totalStock <= (p.lowStockThreshold || 5);
      return `<div class="prod-card" onclick="openEdit('${p._id}')">
        <div class="prod-card-img">${img ? `<img src="${img}" alt="">` : '<div class="no-img">&#128230;</div>'}</div>
        <div class="prod-card-body">
          <div class="prod-card-name">${esc(p.name)}</div>
          ${p.sku ? `<div class="prod-card-sku">${esc(p.sku)}</div>` : ''}
          <div class="prod-card-cat">${esc(p.category && p.category.name ? p.category.name : '-')}</div>
          <div class="prod-card-price-row">
            <span class="prod-price">${fmtCurrency(p.sellingPrice)}</span>
            ${p.mrp > p.sellingPrice ? `<span class="prod-mrp">${fmtCurrency(p.mrp)}</span>` : ''}
          </div>
          <div class="prod-card-meta">
            <span class="prod-stock ${lowStock ? 'low' : ''}" title="Stock">${totalStock} in stock</span>
            ${variantCount > 0 ? `<span class="prod-variants">${variantCount} variant${variantCount > 1 ? 's' : ''}</span>` : ''}
          </div>
          <div class="prod-card-foot">
            ${statusBadge(p.approvalStatus)}
            <span class="prod-partner">${esc(p.partner && p.partner.name ? p.partner.name : '')}</span>
          </div>
        </div>
        <div class="prod-card-actions" onclick="event.stopPropagation()">
          ${p.approvalStatus === 'pending' ? `<button class="act-btn act-ok" onclick="reviewProd('${p._id}','approved')" title="Approve">&#10003;</button><button class="act-btn act-no" onclick="reviewProd('${p._id}','rejected')" title="Reject">&#10007;</button>` : ''}
          <button class="act-btn act-del" onclick="delProduct('${p._id}')" title="Delete">&#128465;</button>
        </div>
      </div>`;
    }).join('')}</div>`;
  }

  function renderTable(products) {
    if (!products.length) return '<div class="empty-state"><p>No products found</p></div>';
    const dd = platform === "damndeal";
    return `<div class="card"><div class="card-body table-wrap"><table>
      <thead><tr><th style="width:40px"></th><th>Name</th>${dd ? "<th>Brand</th>" : ""}<th>Category</th><th>Price</th><th>MRP</th><th>Stock</th><th>Variants</th><th>Partner</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>
        ${products.map(p => {
          const vCount = (p.variants || []).length;
          return `<tr>
            <td>${p.images && p.images.length ? `<img src="${imgUrl(p.images[0])}" class="img-thumb">` : '-'}</td>
            <td><strong>${esc(p.name)}</strong>${p.sku ? '<br><small class="text-muted">' + esc(p.sku) + '</small>' : ''}</td>
            ${dd ? `<td class="text-sm">${esc(p.brand || '-')}</td>` : ''}
            <td>${esc(p.category && p.category.name ? p.category.name : '-')}</td>
            <td>${fmtCurrency(p.sellingPrice)}</td>
            <td class="text-muted">${fmtCurrency(p.mrp)}</td>
            <td>${(() => { const ts = (p.variants||[]).length > 0 ? (p.variants||[]).reduce((s,v) => s + (v.stock||0), 0) : p.stock; return ts <= (p.lowStockThreshold||5) ? '<span style="color:var(--danger);font-weight:600">' + ts + '</span>' : ts; })()}</td>
            <td>${vCount > 0 ? `<span class="badge badge-info">${vCount}</span>` : '-'}</td>
            <td class="text-sm">${esc(p.partner && p.partner.name ? p.partner.name : (p.partner && p.partner.phone ? p.partner.phone : '-'))}</td>
            <td>${statusBadge(p.approvalStatus)}</td>
            <td><div class="d-flex gap-1">
              ${p.approvalStatus === 'pending' ? `<button class="btn btn-xs btn-success" onclick="reviewProd('${p._id}','approved')">&#10003;</button><button class="btn btn-xs btn-danger" onclick="reviewProd('${p._id}','rejected')">&#10007;</button>` : ''}
              <button class="btn btn-xs" onclick="openEdit('${p._id}')">Edit</button>
              <button class="btn btn-xs btn-danger" onclick="delProduct('${p._id}')">Del</button>
            </div></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div></div>`;
  }

  function buildModal() {
    const pCats = catsByPlatform(), dd = platform === "damndeal";
    return `<div class="modal-overlay" id="prod-modal"><div class="modal prod-modal-lg">
      <div class="modal-header">
        <h3 id="prodTitle">Add Product</h3>
        <button class="modal-close" onclick="closeModal('prod-modal')">&times;</button>
      </div>
      <div class="modal-body">
        <form id="prodForm">
          <div class="form-tabs" id="formTabs">
            <button type="button" class="ftab active" data-tab="tab-basic">Basic Info</button>
            <button type="button" class="ftab" data-tab="tab-pricing">Pricing &amp; Tax</button>
            <button type="button" class="ftab" data-tab="tab-variants">Variants</button>
            <button type="button" class="ftab" data-tab="tab-inventory">Inventory</button>
            <button type="button" class="ftab" data-tab="tab-images">Images</button>
            ${dd ? '<button type="button" class="ftab" data-tab="tab-ecom">Online Store</button>' : ''}
          </div>

          <div class="tab-panel active" id="tab-basic">
            <div class="form-row">
              <div class="form-group fg-2"><label>Product Name *</label><input class="form-control" id="fName" required placeholder="e.g. Toor Dal Premium"></div>
              <div class="form-group"><label>SKU</label><input class="form-control" id="fSku" placeholder="Auto or manual"></div>
            </div>
            <div class="form-group"><label>Description</label><textarea class="form-control" id="fDesc" rows="3" placeholder="Detailed product description..."></textarea></div>
            <div class="form-row">
              <div class="form-group">
                <label>Storefront Regions *</label>
                <div style="display:flex;gap:14px;align-items:center;padding-top:6px">
                  <label style="display:flex;gap:6px;align-items:center;font-weight:500;cursor:pointer">
                    <input type="checkbox" class="region-chk" value="IN" checked> 🇮🇳 India
                  </label>
                  <label style="display:flex;gap:6px;align-items:center;font-weight:500;cursor:pointer">
                    <input type="checkbox" class="region-chk" value="US"> 🇺🇸 USA
                  </label>
                </div>
              </div>
              <div class="form-group">
                <label>Source</label>
                <select class="form-control" id="fSource">
                  <option value="manual">Manual</option>
                  <option value="cj">CJ Dropshipping</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>Category *</label><select class="form-control" id="fCat" required onchange="fillSubCats(this.value)"><option value="">Select category</option>${pCats.map(c => `<option value="${c._id}">${esc(c.name)}</option>`).join('')}</select></div>
              <div class="form-group"><label>Sub Category</label><select class="form-control" id="fSubCat"><option value="">None</option></select></div>
              <div class="form-group"><label>Partner</label><select class="form-control" id="fPartner"><option value="">Admin (self)</option>${partners.map(p => `<option value="${p._id}">${esc(p.name || p.phone)}</option>`).join('')}</select></div>
            </div>
          </div>

          <div class="tab-panel" id="tab-pricing">
            <div class="pricing-note"><span class="info-icon">&#128161;</span> Base pricing applies when product has no variants. If variants are added, each variant has its own pricing.</div>
            <div id="variantPricingNote" class="pricing-note" style="display:none;background:#EFF6FF;border-color:#93C5FD;color:#1E40AF">
              <span class="info-icon">&#128176;</span>
              <div>Pricing is managed per variant. Base prices below are used as fallback/display price.
                <br><small>Go to Variants tab to set pricing for each variant.</small>
              </div>
            </div>
            <div class="form-row-3" id="basePricingRow">
              <div class="form-group"><label id="fCostLabel">Cost Price</label><input class="form-control" id="fCost" type="number" min="0" step="0.01" placeholder="&#8377;"></div>
              <div class="form-group" id="baseSellGroup"><label>Selling Price</label><input class="form-control" id="fSell" type="number" min="0" step="0.01" placeholder="&#8377;"></div>
              <div class="form-group" id="baseMrpGroup"><label>MRP</label><input class="form-control" id="fMrp" type="number" min="0" step="0.01" placeholder="&#8377;"></div>
            </div>
            <div id="usdPricingBlock" style="display:none;margin-top:8px;padding:12px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px">
              <h4 class="section-h" style="margin:0 0 10px 0;color:#92400E">🇺🇸 USA Pricing (USD)</h4>
              <div class="form-row">
                <div class="form-group"><label>USD Selling Price</label><input class="form-control" id="fUsdSell" type="number" min="0" step="0.01" placeholder="$"></div>
                <div class="form-group"><label>USD MRP</label><input class="form-control" id="fUsdMrp" type="number" min="0" step="0.01" placeholder="$"></div>
              </div>
              <small id="usdPricingNote" style="color:#92400E">Shown to customers on damndeal.com. If left blank, base ₹ price will be used as fallback.</small>
            </div>
            <div id="taxInfoSection">
            <h4 class="section-h">Tax Information</h4>
            <div class="form-row-3">
              <div class="form-group"><label>GST %</label>
                <select class="form-control" id="fGst">
                  <option value="0">0% (Exempt)</option><option value="5">5%</option><option value="12">12%</option><option value="18" selected>18%</option><option value="28">28%</option>
                </select>
              </div>
              <div class="form-group">
                <label>HSN Code <a href="https://services.gst.gov.in/services/searchhsnsac" target="_blank" class="hsn-gov-link" title="Search on GST Portal">&#128279; Find HSN</a></label>
                <div style="position:relative">
                  <input class="form-control" id="fHsn" placeholder="Type to search HSN..." autocomplete="off" oninput="searchHSN(this.value)">
                  <div id="hsnDropdown" class="hsn-dropdown"></div>
                </div>
              </div>
              <div class="form-group" style="display:flex;align-items:flex-end;padding-bottom:8px">
                <label class="cb-label"><input type="checkbox" id="fGstInc" checked> <span>GST Inclusive</span></label>
              </div>
            </div>
            </div>
            <div id="usSalesTaxNote" style="display:none;font-size:12px;color:#92400E;background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:10px 12px;margin-top:8px">
              🇺🇸 Sales tax is handled automatically at checkout (set the US rate in Settings). No per-product tax needed.
            </div>
          </div>

          <div class="tab-panel" id="tab-variants">
            <div class="variant-header">
              <label class="cb-label"><input type="checkbox" id="fHasVariants" onchange="toggleVariants(this.checked)"> <span>This product has variants</span></label>
              <p class="text-muted text-sm" style="margin-top:4px">Add size, quantity, or pack variants with individual pricing &amp; stock</p>
            </div>
            <div id="variantSection" style="display:none">
              <div class="variant-presets">
                <span class="text-sm text-muted">Quick add:</span>
                <button type="button" class="preset-btn" onclick="addPresetVariants('size')">Sizes (S/M/L/XL)</button>
                <button type="button" class="preset-btn" onclick="addPresetVariants('weight')">Weight (250g-2kg)</button>
                <button type="button" class="preset-btn" onclick="addPresetVariants('volume')">Volume (100ml-1L)</button>
                <button type="button" class="preset-btn" onclick="addPresetVariants('pack')">Packs (1-6)</button>
              </div>
              <div class="variant-table-wrap">
                <table class="variant-table">
                  <thead><tr><th style="width:180px">Variant Label</th><th>Cost</th><th>Selling</th><th>MRP</th><th>Stock</th><th>SKU</th><th style="width:40px"></th></tr></thead>
                  <tbody id="variantBody"></tbody>
                </table>
              </div>
              <button type="button" class="btn btn-sm" onclick="addVariantRow()" style="margin-top:8px">+ Add Variant</button>
            </div>
          </div>

          <div class="tab-panel" id="tab-inventory">
            <div id="baseStockRow" class="form-row-3">
              <div class="form-group"><label>Unit</label>
                <select class="form-control" id="fUnit">
                  <option value="piece">Piece</option><option value="kg">Kg</option><option value="g">Gram</option>
                  <option value="litre">Litre</option><option value="ml">ML</option><option value="metre">Metre</option>
                  <option value="cm">CM</option><option value="pack">Pack</option><option value="box">Box</option>
                  <option value="dozen">Dozen</option><option value="bottle">Bottle</option><option value="packet">Packet</option>
                  <option value="pair">Pair</option><option value="set">Set</option>
                </select>
              </div>
              <div class="form-group" id="stockFieldWrap"><label>Stock</label><input class="form-control" id="fStock" type="number" min="0" value="0"></div>
              <div class="form-group"><label>Low Stock Alert</label><input class="form-control" id="fLow" type="number" min="0" value="5"></div>
            </div>
            <div id="variantStockInfo" class="pricing-note" style="display:none;background:#EFF6FF;border-color:#93C5FD;color:#1E40AF">
              <span class="info-icon">&#128230;</span>
              <div>Stock is managed per variant. Total stock: <strong id="variantStockTotal">0</strong>
                <br><small>Go to Variants tab to update stock for each variant.</small>
              </div>
            </div>
            <div class="form-row-3">
              <div class="form-group"><label>Barcode</label><input class="form-control" id="fBarcode" placeholder="Scan or type"></div>
              <div class="form-group"><label>Weight (g)</label><input class="form-control" id="fWeight" type="number" step="0.01" min="0"></div>
              <div class="form-group"><label>Tags <small>(comma separated)</small></label><input class="form-control" id="fTags" placeholder="organic, premium"></div>
            </div>
          </div>

          <div class="tab-panel" id="tab-images">
            <div class="img-upload-zone" id="imgUploadZone">
              <input type="file" id="fImages" accept="image/*" multiple style="display:none" onchange="previewImages(this.files)">
              <div class="img-upload-placeholder" onclick="document.getElementById('fImages').click()">
                <span class="upload-icon">&#128248;</span>
                <p>Click to upload or drag &amp; drop</p>
                <small>JPG, PNG, WebP - Max 5MB each, up to 10 images</small>
              </div>
            </div>
            <div id="imgPreviewGrid" class="img-preview-grid"></div>
            <div id="existingImages" class="img-preview-grid" style="margin-top:12px"></div>
          </div>

          ${dd ? `<div class="tab-panel" id="tab-ecom">
            <h4 class="section-h dd-h">Product Details</h4>
            <div class="form-row-3">
              <div class="form-group"><label>Brand</label><input class="form-control" id="fBrand" placeholder="e.g. Nike"></div>
              <div class="form-group"><label>Model</label><input class="form-control" id="fModel"></div>
              <div class="form-group"><label>Color</label><input class="form-control" id="fColor"></div>
            </div>
            <div class="form-row-3">
              <div class="form-group"><label>Material</label><input class="form-control" id="fMaterial"></div>
              <div class="form-group"><label>Warranty</label><input class="form-control" id="fWarranty"></div>
              <div class="form-group"><label>Country of Origin</label><input class="form-control" id="fCountry" value="India"></div>
            </div>
            <div class="form-group"><label>Manufacturer</label><input class="form-control" id="fManufacturer"></div>
            <div class="form-group"><label>Return Policy</label><input class="form-control" id="fReturnPolicy" placeholder="e.g. 7 days easy return"></div>
            <div class="form-group"><label>Package Contents</label><input class="form-control" id="fPackage" placeholder="e.g. 1 shirt, 1 tag"></div>
            <div class="form-group"><label>Highlights <small>(comma)</small></label><input class="form-control" id="fHighlights" placeholder="Pure cotton, Machine washable"></div>
            <div class="form-row-3">
              <div class="form-group"><label>Shelf Life</label><input class="form-control" id="fShelfLife"></div>
              <div class="form-group"><label>Min Order Qty</label><input class="form-control" id="fMinQty" type="number" min="1" value="1"></div>
              <div class="form-group"><label>Max Order Qty</label><input class="form-control" id="fMaxQty" type="number" min="1"></div>
            </div>
            <div class="form-row-3">
              <div class="form-group"><label>Length (cm)</label><input class="form-control" id="fLength" type="number" step="0.1"></div>
              <div class="form-group"><label>Width (cm)</label><input class="form-control" id="fWidth" type="number" step="0.1"></div>
              <div class="form-group"><label>Height (cm)</label><input class="form-control" id="fHeight" type="number" step="0.1"></div>
            </div>
            <div class="form-row-3">
              <div class="form-group"><label class="cb-label"><input type="checkbox" id="fReturnable" checked> <span>Returnable</span></label></div>
              <div class="form-group"><label class="cb-label"><input type="checkbox" id="fCOD" checked> <span>COD Available</span></label></div>
              <div class="form-group"><label class="cb-label"><input type="checkbox" id="fFeatured"> <span>Featured</span></label></div>
            </div>
            <div class="form-group">
              <label>Delivery Fee Override (₹) <small>— leave empty to use global rule</small></label>
              <input class="form-control" id="fDeliveryFee" type="number" min="0" step="1" placeholder="Empty = global rule. 0 = always free for this product. Any number = flat fee.">
              <small style="color:var(--text-light);font-size:11px">If set, this product's fee will override the global &quot;below ₹X → ₹Y&quot; rule. Use 0 to make this specific product always free.</small>
            </div>
            <h4 class="section-h dd-h">Specifications</h4>
            <div id="specsContainer"></div>
            <button type="button" class="btn btn-xs" onclick="addSpec()" style="margin-bottom:12px">+ Add Specification</button>
          </div>` : ''}

          <div class="modal-footer">
            <button type="button" class="btn" onclick="closeModal('prod-modal')">Cancel</button>
            <button type="submit" class="btn btn-primary" id="saveBtn">Save Product</button>
          </div>
        </form>
      </div>
    </div></div>
    ${buildStyles()}`;
  }

  // Show a clean USD-only pricing UI when the product sells in the US.
  // (Hides the ₹ base Selling/MRP + India GST to avoid the dual-price confusion.)
  window.toggleUsdBlock = function () {
    var blk = document.getElementById('usdPricingBlock');
    if (!blk) return;
    var us = document.querySelector('.region-chk[value="US"]');
    var isUS = !!(us && us.checked);
    blk.style.display = isUS ? '' : 'none';

    var show = function (id, on) { var el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
    show('baseSellGroup', !isUS);   // ₹ selling price — India only
    show('baseMrpGroup', !isUS);    // ₹ MRP — India only
    show('taxInfoSection', !isUS);  // GST — India only
    show('usSalesTaxNote', isUS);   // US sales-tax note

    var costL = document.getElementById('fCostLabel');
    var costI = document.getElementById('fCost');
    if (costL) costL.textContent = isUS ? 'Cost Price ($)' : 'Cost Price';
    if (costI) costI.placeholder = isUS ? '$' : '₹';
    var note = document.getElementById('usdPricingNote');
    if (note) note.textContent = isUS
      ? 'These USD prices are shown to customers on damndeal.com.'
      : 'Shown to customers on damndeal.com. If left blank, base ₹ price will be used as fallback.';
  };
  document.body.addEventListener('change', function (e) {
    if (e.target && e.target.classList && e.target.classList.contains('region-chk')) {
      window.toggleUsdBlock();
    }
  });

  window.toggleVariants = function (on) {
    document.getElementById('variantSection').style.display = on ? 'block' : 'none';
    // Hide base stock field when variants are enabled
    var stockWrap = document.getElementById('stockFieldWrap');
    var variantInfo = document.getElementById('variantStockInfo');
    var variantPriceNote = document.getElementById('variantPricingNote');
    if (stockWrap) stockWrap.style.display = on ? 'none' : '';
    if (variantInfo) variantInfo.style.display = on ? 'flex' : 'none';
    if (variantPriceNote) variantPriceNote.style.display = on ? 'flex' : 'none';
    if (on) updateVariantStockTotal();
  };

  window.updateVariantStockTotal = function () {
    var rows = document.querySelectorAll('#variantBody tr');
    var total = 0;
    rows.forEach(function(r) { total += parseInt((r.querySelector('.v-stock') || {}).value) || 0; });
    var el = document.getElementById('variantStockTotal');
    if (el) el.textContent = total;
  };

  window.addVariantRow = function (label, cost, sell, mrp, stock, sku) {
    label = label || ''; cost = cost || ''; sell = sell || ''; mrp = mrp || ''; stock = stock || ''; sku = sku || '';
    const tbody = document.getElementById('variantBody');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input class="form-control v-label" placeholder="e.g. S, 1kg, 500ml" value="${esc(label)}"></td>
      <td><input class="form-control v-cost" type="number" min="0" step="0.01" value="${cost}" placeholder="Cost"></td>
      <td><input class="form-control v-sell" type="number" min="0" step="0.01" value="${sell}" placeholder="Sell"></td>
      <td><input class="form-control v-mrp" type="number" min="0" step="0.01" value="${mrp}" placeholder="MRP"></td>
      <td><input class="form-control v-stock" type="number" min="0" value="${stock}" placeholder="0" style="width:70px" oninput="updateVariantStockTotal()"></td>
      <td><input class="form-control v-sku" value="${esc(sku)}" placeholder="SKU" style="width:90px"></td>
      <td><button type="button" class="btn-rm" onclick="this.closest('tr').remove()">&times;</button></td>
    `;
    tbody.appendChild(tr);
  };

  window.addPresetVariants = function (type) {
    var presets = {
      size: ['S','M','L','XL','XXL'],
      weight: ['250g','500g','1 kg','2 kg'],
      volume: ['100ml','200ml','500ml','1 Litre'],
      pack: ['1 Pack','3 Pack','6 Pack']
    };
    (presets[type] || []).forEach(function(v) { addVariantRow(v); });
  };

  function getVariants() {
    var rows = document.querySelectorAll('#variantBody tr');
    var variants = [];
    rows.forEach(function(r) {
      var label = (r.querySelector('.v-label') || {}).value || '';
      label = label.trim();
      if (!label) return;
      variants.push({
        label: label,
        costPrice: parseFloat((r.querySelector('.v-cost') || {}).value) || 0,
        sellingPrice: parseFloat((r.querySelector('.v-sell') || {}).value) || 0,
        mrp: parseFloat((r.querySelector('.v-mrp') || {}).value) || 0,
        stock: parseInt((r.querySelector('.v-stock') || {}).value) || 0,
        sku: ((r.querySelector('.v-sku') || {}).value || '').trim()
      });
    });
    return variants;
  }

  var selectedFiles = [];

  window.previewImages = function (files) {
    var grid = document.getElementById('imgPreviewGrid');
    selectedFiles = Array.from(files);
    grid.innerHTML = selectedFiles.map(function(f, i) {
      var url = URL.createObjectURL(f);
      return '<div class="img-preview-item"><img src="' + url + '" alt=""><button type="button" class="img-rm" onclick="removeNewImage(' + i + ')">&times;</button>' + (i === 0 ? '<span class="img-primary-tag">Primary</span>' : '') + '</div>';
    }).join('');
  };

  window.removeNewImage = function (idx) {
    selectedFiles.splice(idx, 1);
    var dt = new DataTransfer();
    selectedFiles.forEach(function(f) { dt.items.add(f); });
    document.getElementById('fImages').files = dt.files;
    previewImages(dt.files);
  };

  var imagesToRemove = [];
  function showExistingImages(images) {
    imagesToRemove = [];
    var grid = document.getElementById('existingImages');
    if (!images || !images.length) { grid.innerHTML = ''; return; }
    grid.innerHTML = '<p class="text-sm text-muted" style="margin-bottom:6px;width:100%">Current images:</p>' +
      images.map(function(img, i) { return '<div class="img-preview-item" id="eimg-' + i + '"><img src="' + imgUrl(img) + '" alt=""><button type="button" class="img-rm" onclick="markRemoveImage(' + i + ',\'' + esc(img) + '\')">&times;</button>' + (i === 0 ? '<span class="img-primary-tag">Primary</span>' : '') + '</div>'; }).join('');
  }

  window.markRemoveImage = function (idx, path) {
    imagesToRemove.push(path);
    var el = document.getElementById('eimg-' + idx);
    if (el) el.style.display = 'none';
  };

  var hsnTimer = null;
  window.searchHSN = function (q) {
    clearTimeout(hsnTimer);
    var dd = document.getElementById('hsnDropdown');
    if (!q || q.length < 2) { dd.classList.remove('show'); return; }
    hsnTimer = setTimeout(async function() {
      try {
        var r = await API.get('/hsn-codes?q=' + encodeURIComponent(q));
        var codes = r.codes || [];
        dd.innerHTML = codes.map(function(c) { return '<div class="hsn-item" onclick="selectHSN(\'' + c.code + '\',' + c.gst + ')"><span><span class="code">' + c.code + '</span> - ' + esc(c.description) + '</span><span class="gst">GST ' + c.gst + '%</span></div>'; }).join('') || '<div style="padding:10px;color:#999;font-size:13px">No results - <a href="https://services.gst.gov.in/services/searchhsnsac" target="_blank">Search on GST Portal</a></div>';
        dd.classList.add('show');
      } catch (_) { }
    }, 300);
  };
  window.selectHSN = function (code, gst) {
    document.getElementById('fHsn').value = code;
    document.getElementById('fGst').value = gst;
    document.getElementById('hsnDropdown').classList.remove('show');
  };
  document.addEventListener('click', function(e) {
    var dd = document.getElementById('hsnDropdown');
    if (dd && !e.target.closest('#fHsn') && !e.target.closest('#hsnDropdown')) dd.classList.remove('show');
  });

  window.addSpec = function (key, val) {
    var c = document.getElementById('specsContainer'); if (!c) return;
    var r = document.createElement('div'); r.className = 'spec-row';
    r.innerHTML = '<input class="form-control spec-key" placeholder="Key" value="' + esc(key || '') + '"><input class="form-control spec-val" placeholder="Value" value="' + esc(val || '') + '"><button type="button" class="btn-rm" onclick="this.parentElement.remove()">&times;</button>';
    c.appendChild(r);
  };
  function getSpecs() {
    var rows = document.querySelectorAll('.spec-row');
    var s = [];
    rows.forEach(function(r) { var k = (r.querySelector('.spec-key') || {}).value || ''; var v = (r.querySelector('.spec-val') || {}).value || ''; k = k.trim(); v = v.trim(); if (k && v) s.push({ key: k, value: v }); });
    return s;
  }

  document.body.addEventListener('click', function (e) {
    var tab = e.target.closest('.ftab');
    if (!tab) return;
    var target = tab.dataset.tab;
    document.querySelectorAll('.ftab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
    tab.classList.add('active');
    var tgt = document.getElementById(target);
    if (tgt) tgt.classList.add('active');
  });

  window.fillSubCats = function (catId) {
    var sel = document.getElementById('fSubCat');
    var subs = subsByCat(catId);
    sel.innerHTML = '<option value="">None</option>' + subs.map(function(s) { return '<option value="' + s._id + '">' + esc(s.name) + '</option>'; }).join('');
  };
  window.switchPlatform = function (p) { platform = p; page = 1; statusFilter = ''; searchQ = ''; categoryFilter = ''; load(1); };
  window.loadP = function (p) { searchQ = window._sq || searchQ; statusFilter = window._sf || statusFilter; load(p); };
  window.filterCat = function (catId) { categoryFilter = catId; page = 1; load(1); };
  window.setView = function (v) { viewMode = v; load(page); };

  var editId = null;

  window.openAdd = function () {
    editId = null;
    load(page).then(function() {
      document.getElementById('prodTitle').textContent = 'Add Product';
      document.getElementById('prodForm').reset();
      document.getElementById('fGst').value = '18';
      document.getElementById('fGstInc').checked = true;
      if (platform === 'damndeal') {
        var c = document.getElementById('fCountry'); if (c) c.value = 'India';
        var r = document.getElementById('fReturnable'); if (r) r.checked = true;
        var cod = document.getElementById('fCOD'); if (cod) cod.checked = true;
      }
      if (document.getElementById('specsContainer')) document.getElementById('specsContainer').innerHTML = '';
      document.getElementById('variantBody').innerHTML = '';
      document.getElementById('fHasVariants').checked = false;
      toggleVariants(false);
      document.getElementById('imgPreviewGrid').innerHTML = '';
      document.getElementById('existingImages').innerHTML = '';
      selectedFiles = [];
      imagesToRemove = [];
      // Phase 2: reset region/source/USD price fields. Default region follows
      // the admin's active region switcher (US mode → new product is US).
      var _adminRegion = (typeof getRegion === 'function') ? getRegion() : (localStorage.getItem('dd_region') || 'IN');
      var _defReg = _adminRegion === 'US' ? 'US' : 'IN';
      document.querySelectorAll('.region-chk').forEach(function (c) { c.checked = c.value === _defReg; });
      var srcEl = document.getElementById('fSource'); if (srcEl) srcEl.value = 'manual';
      var us1 = document.getElementById('fUsdSell'); if (us1) us1.value = '';
      var us2 = document.getElementById('fUsdMrp'); if (us2) us2.value = '';
      toggleUsdBlock();
      document.querySelectorAll('.ftab').forEach(function(t, i) { t.classList.toggle('active', i === 0); });
      document.querySelectorAll('.tab-panel').forEach(function(p, i) { p.classList.toggle('active', i === 0); });
      openModal('prod-modal');
    });
  };

  window.openEdit = async function (id) {
    try {
      var r = await API.get('/admin/products/' + id);
      var p = r.product;
      editId = id;
      await load(page);

      document.getElementById('prodTitle').textContent = 'Edit Product';
      document.getElementById('fName').value = p.name || '';
      document.getElementById('fSku').value = p.sku || '';
      document.getElementById('fDesc').value = p.description || '';
      document.getElementById('fCat').value = (p.category && p.category._id) || p.category || '';
      fillSubCats((p.category && p.category._id) || p.category || '');
      document.getElementById('fSubCat').value = (p.subCategory && p.subCategory._id) || p.subCategory || '';
      document.getElementById('fPartner').value = (p.partner && p.partner._id) || p.partner || '';
      document.getElementById('fCost').value = p.costPrice || '';
      document.getElementById('fSell').value = p.sellingPrice || '';
      document.getElementById('fMrp').value = p.mrp || '';
      document.getElementById('fGst').value = p.gstPercent != null ? p.gstPercent : 18;
      document.getElementById('fHsn').value = p.hsnCode || '';
      document.getElementById('fGstInc').checked = !!p.gstInclusive;
      document.getElementById('fUnit').value = p.unit || 'piece';
      document.getElementById('fStock').value = p.stock != null ? p.stock : 0;
      document.getElementById('fLow').value = p.lowStockThreshold != null ? p.lowStockThreshold : 5;
      document.getElementById('fBarcode').value = p.barcode || '';
      document.getElementById('fWeight').value = p.weight || '';
      document.getElementById('fTags').value = (p.tags || []).join(', ');

      var hasV = p.hasVariants || (p.variants && p.variants.length > 0);
      document.getElementById('fHasVariants').checked = hasV;
      toggleVariants(hasV);
      document.getElementById('variantBody').innerHTML = '';
      if (p.variants && p.variants.length > 0) {
        p.variants.forEach(function(v) { addVariantRow(v.label, v.costPrice, v.sellingPrice, v.mrp, v.stock, v.sku || ''); });
      }

      document.getElementById('imgPreviewGrid').innerHTML = '';
      selectedFiles = [];
      imagesToRemove = [];
      showExistingImages(p.images || []);

      // Phase 2: regions / source / USD prices
      var regs = (p.regions && p.regions.length) ? p.regions : ['IN'];
      document.querySelectorAll('.region-chk').forEach(function (c) { c.checked = regs.indexOf(c.value) >= 0; });
      var srcEl2 = document.getElementById('fSource'); if (srcEl2) srcEl2.value = p.source || 'manual';
      var usdSell = document.getElementById('fUsdSell'); if (usdSell) usdSell.value = (p.prices && p.prices.US && p.prices.US.sellingPrice) || '';
      var usdMrp = document.getElementById('fUsdMrp'); if (usdMrp) usdMrp.value = (p.prices && p.prices.US && p.prices.US.mrp) || '';
      toggleUsdBlock();

      if (platform === 'damndeal') {
        var f = function(i, v) { var el = document.getElementById(i); if (el) el.value = v || ''; };
        var c = function(i, v) { var el = document.getElementById(i); if (el) el.checked = !!v; };
        f('fBrand', p.brand); f('fModel', p.model); f('fColor', p.color);
        f('fMaterial', p.material); f('fWarranty', p.warranty); f('fManufacturer', p.manufacturer);
        f('fCountry', p.countryOfOrigin || 'India'); f('fReturnPolicy', p.returnPolicy);
        f('fPackage', p.packageContents); f('fHighlights', (p.highlights || []).join(', '));
        f('fShelfLife', p.shelfLife); f('fMinQty', p.minOrderQty || 1); f('fMaxQty', p.maxOrderQty);
        f('fLength', p.length); f('fWidth', p.width); f('fHeight', p.height);
        c('fReturnable', p.isReturnable !== false); c('fCOD', p.isCOD !== false); c('fFeatured', p.isFeatured);
        var dfEl = document.getElementById('fDeliveryFee');
        if (dfEl) dfEl.value = (p.deliveryFee !== null && p.deliveryFee !== undefined) ? p.deliveryFee : '';
        var sc = document.getElementById('specsContainer');
        if (sc) { sc.innerHTML = ''; (p.specifications || []).forEach(function(s) { addSpec(s.key, s.value); }); }
      }

      document.querySelectorAll('.ftab').forEach(function(t, i) { t.classList.toggle('active', i === 0); });
      document.querySelectorAll('.tab-panel').forEach(function(p, i) { p.classList.toggle('active', i === 0); });
      openModal('prod-modal');
    } catch (e) { showToast(e.message, 'error'); }
  };

  document.body.addEventListener('submit', async function (e) {
    if (e.target.id !== 'prodForm') return;
    e.preventDefault();

    var fd = new FormData();
    fd.append('platform', platform);
    fd.append('name', document.getElementById('fName').value.trim());
    var sku = document.getElementById('fSku').value.trim(); if (sku) fd.append('sku', sku);
    fd.append('description', document.getElementById('fDesc').value.trim());
    fd.append('category', document.getElementById('fCat').value);
    var subCat = document.getElementById('fSubCat').value; if (subCat) fd.append('subCategory', subCat);
    var ptr = document.getElementById('fPartner').value; if (ptr) fd.append('partner', ptr);

    // US-only product: the visible pricing is USD. Mirror it into the base
    // price fields (which are hidden) so the record stays valid, and skip GST.
    var _us = document.querySelector('.region-chk[value="US"]');
    var _in = document.querySelector('.region-chk[value="IN"]');
    var usOnly = !!(_us && _us.checked) && !(_in && _in.checked);
    var _uSell = parseFloat((document.getElementById('fUsdSell') || {}).value) || 0;
    var _uMrp = parseFloat((document.getElementById('fUsdMrp') || {}).value) || 0;
    var baseSell = document.getElementById('fSell').value;
    var baseMrp = document.getElementById('fMrp').value;
    if (usOnly) {
      if (!parseFloat(baseSell)) baseSell = _uSell || baseSell;
      if (!parseFloat(baseMrp)) baseMrp = _uMrp || baseMrp;
    }
    fd.append('costPrice', document.getElementById('fCost').value);
    fd.append('sellingPrice', baseSell);
    fd.append('mrp', baseMrp);
    fd.append('gstPercent', usOnly ? '0' : document.getElementById('fGst').value);
    fd.append('gstInclusive', document.getElementById('fGstInc').checked);
    var hsn = document.getElementById('fHsn').value.trim(); if (hsn) fd.append('hsnCode', hsn);

    fd.append('unit', document.getElementById('fUnit').value);
    fd.append('stock', document.getElementById('fStock').value);
    fd.append('lowStockThreshold', document.getElementById('fLow').value);
    var bc = document.getElementById('fBarcode').value.trim(); if (bc) fd.append('barcode', bc);
    var wt = document.getElementById('fWeight').value; if (wt) fd.append('weight', wt);
    var tg = document.getElementById('fTags').value.trim(); if (tg) fd.append('tags', tg);

    var hasVariants = document.getElementById('fHasVariants').checked;
    fd.append('hasVariants', hasVariants);
    if (hasVariants) {
      var variants = getVariants();
      if (variants.length > 0) {
        fd.append('variants', JSON.stringify(variants));
        // Auto-calculate total stock from variants
        var totalVStock = variants.reduce(function(s, v) { return s + (v.stock || 0); }, 0);
        fd.set('stock', totalVStock);
      }
    }

    if (imagesToRemove.length > 0) fd.append('removeImages', JSON.stringify(imagesToRemove));

    // Phase 2: regions + source + per-region prices
    var regions = Array.from(document.querySelectorAll('.region-chk'))
      .filter(function (c) { return c.checked; })
      .map(function (c) { return c.value; });
    if (regions.length === 0) regions = ['IN'];
    fd.append('regions', JSON.stringify(regions));
    var srcSel = document.getElementById('fSource');
    if (srcSel) fd.append('source', srcSel.value);
    var usdSellV = parseFloat((document.getElementById('fUsdSell') || {}).value) || 0;
    var usdMrpV = parseFloat((document.getElementById('fUsdMrp') || {}).value) || 0;
    if (regions.indexOf('US') >= 0 && (usdSellV > 0 || usdMrpV > 0)) {
      fd.append('prices', JSON.stringify({ US: { sellingPrice: usdSellV || null, mrp: usdMrpV || null } }));
    }

    if (platform === 'damndeal') {
      var a = function(k, i) { var el = document.getElementById(i); if (el && el.value.trim()) fd.append(k, el.value.trim()); };
      var b = function(k, i) { var el = document.getElementById(i); if (el) fd.append(k, el.checked); };
      a('brand', 'fBrand'); a('model', 'fModel'); a('color', 'fColor');
      a('material', 'fMaterial'); a('warranty', 'fWarranty'); a('manufacturer', 'fManufacturer');
      a('countryOfOrigin', 'fCountry'); a('returnPolicy', 'fReturnPolicy'); a('packageContents', 'fPackage');
      a('shelfLife', 'fShelfLife');
      var hl = document.getElementById('fHighlights'); if (hl && hl.value.trim()) fd.append('highlights', hl.value.trim());
      var minQ = document.getElementById('fMinQty'); if (minQ && minQ.value) fd.append('minOrderQty', minQ.value);
      var maxQ = document.getElementById('fMaxQty'); if (maxQ && maxQ.value) fd.append('maxOrderQty', maxQ.value);
      a('length', 'fLength'); a('width', 'fWidth'); a('height', 'fHeight');
      b('isReturnable', 'fReturnable'); b('isCOD', 'fCOD'); b('isFeatured', 'fFeatured');
      var dfInput = document.getElementById('fDeliveryFee');
      if (dfInput) {
        var dfVal = dfInput.value.trim();
        // Empty string = use global rule (send empty so backend treats as null)
        fd.append('deliveryFee', dfVal === '' ? '' : dfVal);
      }
      var specs = getSpecs(); if (specs.length) fd.append('specifications', JSON.stringify(specs));
    }

    var files = document.getElementById('fImages').files;
    for (var i = 0; i < files.length; i++) fd.append('images', files[i]);

    try {
      if (editId) {
        await API.upload('/admin/products/' + editId, fd, 'PUT');
        showToast('Product updated', 'success');
      } else {
        await API.upload('/admin/products', fd);
        showToast('Product created', 'success');
      }
      closeModal('prod-modal');
      load(page);
    } catch (e) { showToast(e.message, 'error'); }
  });

  window.reviewProd = async function (id, status) {
    var note = '';
    if (status === 'rejected') { note = prompt('Reason for rejection:'); if (note === null) return; }
    try {
      await API.put('/admin/products/' + id + '/review', { status: status, note: note });
      showToast('Product ' + status, 'success');
      load(page);
    } catch (e) { showToast(e.message, 'error'); }
  };

  window.delProduct = async function (id) {
    if (!confirm('Permanently delete this product?')) return;
    try {
      await API.delete('/admin/products/' + id);
      showToast('Product deleted', 'success');
      load(page);
    } catch (e) { showToast(e.message, 'error'); }
  };

  function buildStyles() {
    return '<style>' +
      '.platform-tabs{display:flex;gap:0;margin-bottom:12px;border-bottom:2px solid #e5e7eb}' +
      '.ptab{padding:10px 24px;border:none;background:none;cursor:pointer;font-weight:600;font-size:14px;border-bottom:3px solid transparent;margin-bottom:-2px;color:#666;transition:all .2s}' +
      '.ptab.active{color:var(--primary);border-bottom-color:var(--primary)}.ptab:hover{color:var(--primary)}' +
      '.cat-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;padding:2px 0}' +
      '.chip{padding:5px 14px;border-radius:20px;border:1px solid var(--border);background:#fff;font-size:12px;cursor:pointer;font-weight:500;transition:all .2s;white-space:nowrap}' +
      '.chip.active,.chip:hover{background:var(--primary);color:#fff;border-color:var(--primary)}' +
      '.toolbar-right{display:flex;align-items:center;gap:10px}' +
      '.view-toggle{display:flex;border:1px solid var(--border);border-radius:6px;overflow:hidden}' +
      '.vt-btn{padding:6px 10px;border:none;background:#fff;cursor:pointer;font-size:14px;line-height:1;transition:all .15s}' +
      '.vt-btn.active{background:var(--primary);color:#fff}' +
      '.prod-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}' +
      '.prod-card{background:#fff;border:1px solid var(--border);border-radius:10px;overflow:hidden;cursor:pointer;transition:all .2s;position:relative}' +
      '.prod-card:hover{box-shadow:var(--shadow-md);transform:translateY(-1px)}' +
      '.prod-card-img{height:140px;background:#f9fafb;display:flex;align-items:center;justify-content:center;overflow:hidden}' +
      '.prod-card-img img{width:100%;height:100%;object-fit:cover}' +
      '.no-img{font-size:32px;opacity:.5}' +
      '.prod-card-body{padding:10px 12px}' +
      '.prod-card-name{font-weight:600;font-size:13px;line-height:1.3;height:34px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}' +
      '.prod-card-sku{font-size:11px;color:var(--text-light);margin-top:2px}' +
      '.prod-card-cat{font-size:11px;color:var(--primary);margin-top:3px;font-weight:500}' +
      '.prod-card-price-row{margin-top:6px;display:flex;align-items:center;gap:6px}' +
      '.prod-price{font-size:15px;font-weight:700;color:var(--text)}' +
      '.prod-mrp{font-size:12px;color:var(--text-light);text-decoration:line-through}' +
      '.prod-card-meta{display:flex;gap:8px;margin-top:6px;align-items:center}' +
      '.prod-stock{font-size:11px;color:var(--success);font-weight:500}' +
      '.prod-stock.low{color:var(--danger)}' +
      '.prod-variants{font-size:10px;background:var(--info);color:#fff;padding:1px 6px;border-radius:10px;font-weight:600}' +
      '.prod-card-foot{display:flex;align-items:center;justify-content:space-between;margin-top:8px;padding-top:6px;border-top:1px solid var(--border)}' +
      '.prod-partner{font-size:11px;color:var(--text-light)}' +
      '.prod-card-actions{position:absolute;top:6px;right:6px;display:flex;gap:4px;opacity:0;transition:opacity .2s}' +
      '.prod-card:hover .prod-card-actions{opacity:1}' +
      '.act-btn{width:26px;height:26px;border:none;border-radius:6px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.9);box-shadow:0 1px 3px rgba(0,0,0,.15)}' +
      '.act-btn:hover{transform:scale(1.1)}' +
      '.act-ok{color:var(--success)}.act-no{color:var(--danger)}.act-del{color:var(--danger)}' +
      '.prod-modal-lg{max-width:800px;max-height:92vh;overflow:hidden;display:flex;flex-direction:column}' +
      '.prod-modal-lg .modal-body{overflow-y:auto;flex:1}' +
      '.form-tabs{display:flex;gap:0;border-bottom:2px solid #e5e7eb;margin-bottom:16px;overflow-x:auto}' +
      '.ftab{padding:8px 16px;border:none;background:none;cursor:pointer;font-weight:500;font-size:13px;border-bottom:2px solid transparent;margin-bottom:-2px;color:#888;white-space:nowrap;transition:all .2s}' +
      '.ftab.active{color:var(--primary);border-bottom-color:var(--primary);font-weight:600}' +
      '.ftab:hover{color:var(--primary)}' +
      '.tab-panel{display:none}.tab-panel.active{display:block}' +
      '.section-h{margin:16px 0 10px;font-size:14px;color:var(--primary);font-weight:600}' +
      '.dd-h{color:#7C3AED}' +
      '.fg-2{flex:2}' +
      '.pricing-note{background:#FEFCE8;border:1px solid #FDE68A;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:13px;display:flex;align-items:center;gap:8px;color:#92400E}' +
      '.info-icon{font-size:18px}' +
      '.variant-header{margin-bottom:14px}' +
      '.variant-presets{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;align-items:center}' +
      '.preset-btn{padding:5px 12px;border:1px dashed var(--border);border-radius:8px;background:#fff;font-size:12px;cursor:pointer;transition:all .2s}' +
      '.preset-btn:hover{border-color:var(--primary);color:var(--primary);background:var(--primary-bg,#f5f0ff)}' +
      '.variant-table-wrap{overflow-x:auto;border:1px solid var(--border);border-radius:8px}' +
      '.variant-table{width:100%;border-collapse:collapse}' +
      '.variant-table th{background:#f9fafb;padding:8px 10px;font-size:12px;text-align:left;font-weight:600;color:var(--text-light);border-bottom:1px solid var(--border);white-space:nowrap}' +
      '.variant-table td{padding:6px 6px;border-bottom:1px solid #f3f4f6}' +
      '.variant-table .form-control{padding:6px 8px;font-size:13px}' +
      '.btn-rm{width:28px;height:28px;border:1px solid var(--danger);border-radius:50%;background:none;color:var(--danger);cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;transition:all .15s}' +
      '.btn-rm:hover{background:var(--danger);color:#fff}' +
      '.img-upload-zone{border:2px dashed var(--border);border-radius:12px;overflow:hidden;transition:all .2s}' +
      '.img-upload-zone:hover{border-color:var(--primary)}' +
      '.img-upload-placeholder{padding:30px;text-align:center;cursor:pointer}' +
      '.upload-icon{font-size:36px;display:block;margin-bottom:8px}' +
      '.img-upload-placeholder p{margin:0;font-weight:500;color:var(--text)}' +
      '.img-upload-placeholder small{color:var(--text-light)}' +
      '.img-preview-grid{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}' +
      '.img-preview-item{width:90px;height:90px;border-radius:8px;overflow:hidden;position:relative;border:1px solid var(--border)}' +
      '.img-preview-item img{width:100%;height:100%;object-fit:cover}' +
      '.img-rm{position:absolute;top:3px;right:3px;width:20px;height:20px;border-radius:50%;border:none;background:rgba(0,0,0,.6);color:#fff;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center}' +
      '.img-primary-tag{position:absolute;bottom:0;left:0;right:0;background:var(--primary);color:#fff;font-size:9px;text-align:center;padding:2px;font-weight:600}' +
      '.hsn-dropdown{position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid #ddd;border-radius:6px;max-height:200px;overflow-y:auto;z-index:999;display:none;box-shadow:0 4px 12px rgba(0,0,0,.15)}' +
      '.hsn-dropdown.show{display:block}' +
      '.hsn-item{padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid #f0f0f0;display:flex;justify-content:space-between}' +
      '.hsn-item:hover{background:#f0fdf4}.hsn-item .code{font-weight:600;color:var(--primary)}.hsn-item .gst{font-size:11px;color:#666}' +
      '.hsn-gov-link{font-size:11px;color:var(--info);margin-left:6px;text-decoration:none}' +
      '.hsn-gov-link:hover{text-decoration:underline}' +
      '.spec-row{display:flex;gap:8px;margin-bottom:8px;align-items:center}' +
      '.spec-row input{flex:1}' +
      '.cb-label{display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:500}' +
      '.cb-label input{width:16px;height:16px;accent-color:var(--primary)}' +
      '.modal-footer{padding:12px 0 0;border-top:1px solid var(--border);margin-top:16px;display:flex;justify-content:flex-end;gap:8px}' +
      '.form-row-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}' +
      '@media(max-width:768px){.prod-grid{grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}.prod-card-img{height:110px}.form-tabs{gap:0}.ftab{padding:6px 10px;font-size:12px}.variant-table{font-size:12px}.prod-modal-lg{max-width:100%;margin:8px}.form-row-3{grid-template-columns:1fr}}' +
    '</style>';
  }

  /* ─── CSV Import ─── */
  window.openImportCsv = function() {
    let host = document.getElementById('csvImportModal');
    if (host) host.remove();
    host = document.createElement('div');
    host.id = 'csvImportModal';
    host.className = 'modal show';
    host.style.cssText = 'display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000';
    const catOpts = categories.map(c => '<option value="' + c._id + '">' + esc(c.name) + ' (' + (c.platform || 'damndeal') + ')</option>').join('');
    host.innerHTML =
      '<div style="background:#fff;border-radius:12px;max-width:560px;width:92%;max-height:90vh;overflow:auto;padding:20px">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">' +
          '<h3 style="margin:0">📥 Import Products from CSV</h3>' +
          '<button onclick="document.getElementById(\'csvImportModal\').remove()" style="border:none;background:none;font-size:22px;cursor:pointer">×</button>' +
        '</div>' +
        '<p style="font-size:12px;color:#666;margin:0 0 14px">Supports DeoDap / Shopify-format CSV. Multiple rows per Handle are merged. Images will be downloaded.</p>' +
        '<div class="form-group"><label>CSV File *</label><input type="file" id="csvFile" accept=".csv,text/csv" class="form-control"></div>' +
        '<div class="form-group"><label>Category *</label>' +
          '<select id="csvCategory" class="form-control" onchange="onCsvCatChange()"><option value="">— Select Category —</option>' + catOpts + '</select>' +
        '</div>' +
        '<div class="form-group"><label>Sub-Category (optional)</label>' +
          '<select id="csvSubCategory" class="form-control"><option value="">— None —</option></select>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
          '<div class="form-group"><label>Platform</label><select id="csvPlatform" class="form-control"><option value="damndeal">Online Store</option><option value="ddgo">Quick Commerce</option></select></div>' +
          '<div class="form-group"><label>GST %</label><select id="csvGst" class="form-control"><option>0</option><option>5</option><option>12</option><option selected>18</option><option>28</option></select></div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
          '<div class="form-group"><label>Default Stock (if blank)</label><input type="number" id="csvStock" value="100" class="form-control"></div>' +
          '<div class="form-group"><label>Margin % (over cost)</label><input type="number" id="csvMargin" value="40" class="form-control"></div>' +
        '</div>' +
        '<div class="form-group"><label style="display:flex;align-items:center;gap:8px;font-weight:normal"><input type="checkbox" id="csvUseCsvPrice" checked> Use CSV "Variant Price" as selling price (otherwise apply margin to cost)</label></div>' +
        '<div class="form-group"><label style="display:flex;align-items:center;gap:8px;font-weight:normal"><input type="checkbox" id="csvDownload" checked> Download images to server (recommended; uncheck to store remote URLs)</label></div>' +
        '<div id="csvImportResult" style="margin:12px 0;font-size:13px"></div>' +
        '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">' +
          '<button class="btn" onclick="document.getElementById(\'csvImportModal\').remove()">Cancel</button>' +
          '<button class="btn btn-primary" id="csvImportBtn" onclick="runCsvImport()">Import</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(host);
  };

  window.onCsvCatChange = function() {
    const catId = document.getElementById('csvCategory').value;
    const sel = document.getElementById('csvSubCategory');
    const subs = subCategories.filter(s => (s.category && (s.category._id || s.category)) == catId);
    sel.innerHTML = '<option value="">— None —</option>' +
      subs.map(s => '<option value="' + s._id + '">' + esc(s.name) + '</option>').join('');
  };

  window.runCsvImport = async function() {
    const file = document.getElementById('csvFile').files[0];
    const categoryId = document.getElementById('csvCategory').value;
    if (!file) { showToast('Choose a CSV file', 'error'); return; }
    if (!categoryId) { showToast('Select a category', 'error'); return; }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('categoryId', categoryId);
    const sub = document.getElementById('csvSubCategory').value;
    if (sub) fd.append('subCategoryId', sub);
    fd.append('platform', document.getElementById('csvPlatform').value);
    fd.append('gstPercent', document.getElementById('csvGst').value);
    fd.append('defaultStock', document.getElementById('csvStock').value);
    fd.append('marginPercent', document.getElementById('csvMargin').value);
    fd.append('useCsvPrice', document.getElementById('csvUseCsvPrice').checked);
    fd.append('downloadImages', document.getElementById('csvDownload').checked);

    const btn = document.getElementById('csvImportBtn');
    const resultEl = document.getElementById('csvImportResult');
    btn.disabled = true; btn.textContent = 'Importing… (may take a while)';
    resultEl.innerHTML = '<div style="padding:8px;background:#f3f4f6;border-radius:6px">⏳ Uploading & downloading images, please wait…</div>';
    try {
      const res = await API.upload('/admin/products/import-csv', fd);
      if (!res.success) throw new Error(res.message || 'Import failed');
      const s = res.summary || {};
      resultEl.innerHTML =
        '<div style="padding:10px;background:#ecfdf5;border:1px solid #10b981;border-radius:6px;color:#065f46">' +
          '<strong>✅ Done</strong><br>' +
          'Total groups: ' + s.totalGroups + '<br>' +
          'Created: ' + s.created + '<br>' +
          'Skipped: ' + s.skipped + '<br>' +
          'Errors: ' + s.errors +
        '</div>' +
        (res.skipped && res.skipped.length ? '<details style="margin-top:8px"><summary>Skipped</summary><pre style="font-size:11px;background:#fafafa;padding:8px;max-height:160px;overflow:auto">' + esc(JSON.stringify(res.skipped, null, 2)) + '</pre></details>' : '') +
        (res.errors && res.errors.length ? '<details style="margin-top:8px"><summary style="color:#b91c1c">Errors</summary><pre style="font-size:11px;background:#fef2f2;padding:8px;max-height:160px;overflow:auto">' + esc(JSON.stringify(res.errors, null, 2)) + '</pre></details>' : '');
      btn.textContent = 'Done';
      showToast('Imported ' + s.created + ' products', 'success');
      load();
    } catch (e) {
      resultEl.innerHTML = '<div style="padding:10px;background:#fef2f2;border:1px solid #ef4444;border-radius:6px;color:#991b1b">❌ ' + esc(e.message) + '</div>';
      btn.disabled = false; btn.textContent = 'Retry';
    }
  };

  loadMeta().then(function() { load(); });
})();
