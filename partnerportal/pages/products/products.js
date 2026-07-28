(function(){
  requireAuth();
  document.body.innerHTML = pageShell('Products');
  buildLayout('products');
  const content = document.getElementById('page-content');

  // KYC gate — block products until approved
  async function init(){
    var status = await checkKycStatus();
    if (status !== 'approved') {
      var msgs = {
        pending: 'Your KYC is under review. You can add products once it\'s verified.',
        rejected: 'Your KYC was rejected. Please re-submit to continue.',
      };
      content.innerHTML = '<div class="empty-state" style="padding:60px 20px">'
        + '<div class="icon">🔒</div>'
        + '<h3 style="margin:12px 0 8px">KYC Verification Required</h3>'
        + '<p>'+(msgs[status] || 'Please complete your KYC verification before adding products.')+'</p>'
        + '<a href="'+PP_BASE+'/pages/kyc/kyc.html" class="btn btn-primary mt-2">'+(status ? 'View KYC' : 'Complete KYC')+'</a>'
        + '</div>';
      return;
    }
    await loadCats();
    load();
  }

  let page = 1, search = '', catFilter = '', categories = [], subCategories = [];

  async function loadCats(){
    try {
      const r = await API.get('/admin/categories');
      categories = (r.categories || []).filter(c => c.platform === 'damndeal');
    } catch(_){ categories = []; }
    try {
      const r = await API.get('/admin/subcategories');
      subCategories = r.subCategories || [];
    } catch(_){ subCategories = []; }
  }

  async function load(p=1){
    page = p;
    content.innerHTML = '<div class="text-center"><div class="spinner"></div></div>';
    try {
      let ep = `/partner/products?page=${page}&limit=20`;
      if (search) ep += '&search='+encodeURIComponent(search);
      if (catFilter) ep += '&category='+catFilter;
      const data = await API.get(ep);
      const products = data.products || [];
      const pag = data.pagination || {};

      content.innerHTML = `
        <div class="toolbar">
          <div class="toolbar-left">
            <input class="search-input" placeholder="Search products..." value="${esc(search)}" onkeyup="if(event.key==='Enter'){window._search=this.value;loadP(1)}">
            <select class="form-control" style="width:160px" onchange="window._catF=this.value;loadP(1)">
              <option value="">All Categories</option>
              ${categories.map(c=>`<option value="${c._id}" ${catFilter===c._id?'selected':''}>${esc(c.name)}</option>`).join('')}
            </select>
            <span class="text-muted text-sm">${pag.total||products.length} products</span>
          </div>
          <button class="btn btn-sm btn-primary" onclick="openAdd()">+ Add Product</button>
        </div>

        <div class="card">
          <div class="card-body table-wrap">
            <table>
              <thead><tr><th></th><th>Name</th><th>Brand</th><th>Category</th><th>Price</th><th>MRP</th><th>Stock</th><th>GST</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                ${products.map(p=>`
                  <tr>
                    <td>${p.images?.length ? `<img src="${CONFIG.API_BASE.replace('/api','')}/${p.images[0]}" class="img-thumb">` : '-'}</td>
                    <td><strong>${esc(p.name)}</strong>${p.sku?'<br><small class="text-muted">'+esc(p.sku)+'</small>':''}</td>
                    <td class="text-sm">${esc(p.brand||'-')}</td>
                    <td>${esc(p.category?.name||'-')}</td>
                    <td>${fmtCurrency(p.sellingPrice)}</td>
                    <td class="text-muted">${fmtCurrency(p.mrp)}</td>
                    <td>${p.stock<=p.lowStockThreshold ? '<span style="color:var(--danger);font-weight:600">'+p.stock+'</span>' : p.stock}</td>
                    <td>${p.gstPercent}%</td>
                    <td>${statusBadge(p.approvalStatus)}${p.approvalStatus==='rejected'&&p.approvalNote?'<br><small class="text-muted">'+esc(p.approvalNote)+'</small>':''}</td>
                    <td>
                      <div class="d-flex gap-1">
                        <button class="btn btn-xs" onclick="openStock('${p._id}',${p.stock})">Stock</button>
                        <button class="btn btn-xs" onclick="openEdit('${p._id}')">Edit</button>
                        <button class="btn btn-xs btn-danger" onclick="delProduct('${p._id}')">Del</button>
                      </div>
                    </td>
                  </tr>`).join('')||'<tr><td colspan="10" class="text-center text-muted">No products</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
        <div class="pagination" id="pag"></div>

        <!-- Product Modal -->
        <div class="modal-overlay" id="prod-modal">
          <div class="modal" style="max-width:780px;max-height:90vh;overflow-y:auto">
            <div class="modal-header"><h3 id="prodTitle">Add Product</h3><button class="modal-close" onclick="closeModal('prod-modal')">&times;</button></div>
            <div class="modal-body">
              <div class="review-notice"><span>📋</span> Products will be reviewed by admin before going live.</div>
              <form id="prodForm" enctype="multipart/form-data">
                <input type="hidden" id="fPlatform" value="damndeal">

                <h4 class="section-h">Basic Information</h4>
                <div class="form-row">
                  <div class="form-group"><label>Product Name *</label><input class="form-control" id="fName" required placeholder="e.g. Samsung Galaxy S24 Ultra"></div>
                  <div class="form-group"><label>SKU</label><input class="form-control" id="fSku" placeholder="Your product code"></div>
                </div>
                <div class="form-group"><label>Description *</label><textarea class="form-control" id="fDesc" rows="3" required placeholder="Detailed product description..."></textarea></div>
                <div class="form-row">
                  <div class="form-group"><label>Category *</label><select class="form-control" id="fCat" required onchange="fillSubCats(this.value)">
                    <option value="">Select Category</option>${categories.map(c=>`<option value="${c._id}">${esc(c.name)}</option>`).join('')}
                  </select></div>
                  <div class="form-group"><label>Sub Category</label><select class="form-control" id="fSubCat"><option value="">None</option></select></div>
                </div>

                <h4 class="section-h">Product Details</h4>
                <div class="form-row-3">
                  <div class="form-group"><label>Brand *</label><input class="form-control" id="fBrand" required placeholder="e.g. Samsung"></div>
                  <div class="form-group"><label>Model</label><input class="form-control" id="fModel" placeholder="e.g. SM-S928B"></div>
                  <div class="form-group"><label>Color</label><input class="form-control" id="fColor" placeholder="e.g. Titanium Black"></div>
                </div>
                <div class="form-row-3">
                  <div class="form-group"><label>Size / Variant</label><input class="form-control" id="fSize" placeholder="e.g. XL, 256GB, 1kg"></div>
                  <div class="form-group"><label>Material</label><input class="form-control" id="fMaterial" placeholder="e.g. Cotton, Plastic"></div>
                  <div class="form-group"><label>Warranty</label><input class="form-control" id="fWarranty" placeholder="e.g. 1 Year Brand Warranty"></div>
                </div>
                <div class="form-row">
                  <div class="form-group"><label>Manufacturer</label><input class="form-control" id="fManufacturer" placeholder="Company name"></div>
                  <div class="form-group"><label>Country of Origin *</label><input class="form-control" id="fCountry" value="India" required></div>
                </div>
                <div class="form-group"><label>Return Policy</label><input class="form-control" id="fReturnPolicy" placeholder="e.g. 7 days easy return, 10 days replacement"></div>
                <div class="form-group"><label>Package Contents</label><input class="form-control" id="fPackage" placeholder="e.g. 1x Phone, 1x Charger, 1x Cable, 1x Manual"></div>
                <div class="form-group"><label>Highlights <small class="text-muted">(comma separated)</small></label><input class="form-control" id="fHighlights" placeholder="200MP Camera, 5000mAh Battery, Snapdragon 8 Gen 3"></div>

                <h4 class="section-h">Pricing</h4>
                <div class="form-row-3">
                  <div class="form-group"><label>Cost Price * <small>(₹)</small></label><input class="form-control" id="fCost" type="number" min="0" step="0.01" required></div>
                  <div class="form-group"><label>Selling Price * <small>(₹)</small></label><input class="form-control" id="fSell" type="number" min="0" step="0.01" required></div>
                  <div class="form-group"><label>MRP * <small>(₹)</small></label><input class="form-control" id="fMrp" type="number" min="0" step="0.01" required></div>
                </div>

                <h4 class="section-h">Tax & HSN</h4>
                <div class="form-row-3">
                  <div class="form-group"><label>GST %</label><select class="form-control" id="fGst">
                    <option value="0">0%</option><option value="5">5%</option><option value="12">12%</option><option value="18" selected>18%</option><option value="28">28%</option>
                  </select></div>
                  <div class="form-group">
                    <label>HSN Code *</label>
                    <div style="position:relative">
                      <input class="form-control" id="fHsn" placeholder="Type to search HSN..." autocomplete="off" required oninput="searchHSN(this.value)">
                      <div id="hsnDropdown" class="hsn-dropdown"></div>
                    </div>
                  </div>
                  <div class="form-group"><label><input type="checkbox" id="fGstInc" checked> GST Inclusive</label></div>
                </div>

                <h4 class="section-h">Inventory & Shipping</h4>
                <div class="form-row-3">
                  <div class="form-group"><label>Unit</label><select class="form-control" id="fUnit">
                    <option value="piece">Piece</option><option value="kg">Kg</option><option value="g">Gram</option><option value="litre">Litre</option><option value="ml">ML</option><option value="metre">Metre</option><option value="cm">CM</option><option value="pack">Pack</option><option value="box">Box</option><option value="dozen">Dozen</option>
                  </select></div>
                  <div class="form-group"><label>Stock *</label><input class="form-control" id="fStock" type="number" min="0" required value="0"></div>
                  <div class="form-group"><label>Low Stock Alert</label><input class="form-control" id="fLow" type="number" min="0" value="5"></div>
                </div>
                <div class="form-row-3">
                  <div class="form-group"><label>Barcode / EAN</label><input class="form-control" id="fBarcode" placeholder="e.g. 8901234567890"></div>
                  <div class="form-group"><label>Weight (g)</label><input class="form-control" id="fWeight" type="number" step="0.01" min="0"></div>
                  <div class="form-group"><label>Tags <small>(comma)</small></label><input class="form-control" id="fTags" placeholder="mobile, samsung, flagship"></div>
                </div>
                <div class="form-row-3">
                  <div class="form-group"><label>Shelf Life</label><input class="form-control" id="fShelfLife" placeholder="e.g. 12 months"></div>
                  <div class="form-group"><label>Min Order Qty</label><input class="form-control" id="fMinQty" type="number" min="1" value="1"></div>
                  <div class="form-group"><label>Max Order Qty</label><input class="form-control" id="fMaxQty" type="number" min="1" placeholder="Unlimited"></div>
                </div>
                <div class="form-row-3">
                  <div class="form-group"><label>Length (cm)</label><input class="form-control" id="fLength" type="number" step="0.1"></div>
                  <div class="form-group"><label>Width (cm)</label><input class="form-control" id="fWidth" type="number" step="0.1"></div>
                  <div class="form-group"><label>Height (cm)</label><input class="form-control" id="fHeight" type="number" step="0.1"></div>
                </div>
                <div class="form-row-3">
                  <div class="form-group"><label><input type="checkbox" id="fReturnable" checked> Returnable</label></div>
                  <div class="form-group"><label><input type="checkbox" id="fCOD" checked> COD Available</label></div>
                  <div class="form-group"></div>
                </div>

                <h4 class="section-h">Specifications</h4>
                <p class="text-sm text-muted" style="margin:-8px 0 8px">Add key-value specs like RAM, Display Size, Battery etc.</p>
                <div id="specsContainer"></div>
                <button type="button" class="btn btn-xs" onclick="addSpec()" style="margin-bottom:12px">+ Add Specification</button>

                <h4 class="section-h">Product Images</h4>
                <p class="text-sm text-muted" style="margin:-8px 0 8px">Upload clear product images (min 1, recommended 4+). First image is the main image.</p>
                <div class="form-group"><input class="form-control" id="fImages" type="file" accept="image/*" multiple></div>

                <div class="modal-footer" style="padding:0;border:none;margin-top:14px">
                  <button type="button" class="btn" onclick="closeModal('prod-modal')">Cancel</button>
                  <button type="submit" class="btn btn-primary">Submit for Review</button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <!-- Stock Modal -->
        <div class="modal-overlay" id="stock-modal">
          <div class="modal" style="max-width:380px">
            <div class="modal-header"><h3>Update Stock</h3><button class="modal-close" onclick="closeModal('stock-modal')">&times;</button></div>
            <div class="modal-body">
              <p class="text-sm text-muted mb-1">Current stock: <strong id="curStock">0</strong></p>
              <div class="form-group"><label>Type</label><select class="form-control" id="sType"><option value="add">Add</option><option value="remove">Remove</option><option value="adjustment">Adjustment</option></select></div>
              <div class="form-group"><label>Quantity</label><input class="form-control" id="sQty" type="number" min="1" value="1"></div>
              <div class="form-group"><label>Note</label><input class="form-control" id="sNote" placeholder="Optional note"></div>
              <div class="modal-footer" style="padding:0;border:none;margin-top:14px">
                <button class="btn" onclick="closeModal('stock-modal')">Cancel</button>
                <button class="btn btn-primary" onclick="saveStock()">Update</button>
              </div>
              <div class="mt-2"><button class="btn btn-outline btn-sm" onclick="loadLog()">View Inventory Log</button></div>
              <div id="logArea" class="mt-1"></div>
            </div>
          </div>
        </div>`;
      renderPagination('pag', page, pag.pages||1, loadP);
    } catch(e){ content.innerHTML = '<div class="empty-state"><p>'+esc(e.message)+'</p></div>'; }
  }

  // ── HSN Search ──
  let hsnTimer = null;
  window.searchHSN = function(q){
    clearTimeout(hsnTimer); const dd = document.getElementById('hsnDropdown');
    if(!q||q.length<2){dd.classList.remove('show');return;}
    hsnTimer = setTimeout(async()=>{
      try{const r=await API.get('/hsn-codes?q='+encodeURIComponent(q));const codes=r.codes||[];
        dd.innerHTML=codes.map(c=>`<div class="hsn-item" onclick="selectHSN('${c.code}',${c.gst})"><span><span class="code">${c.code}</span> — ${esc(c.description)}</span><span class="gst">GST ${c.gst}%</span></div>`).join('')||'<div style="padding:10px;color:#999;font-size:13px">No results</div>';
        dd.classList.add('show');
      }catch(_){}
    },300);
  };
  window.selectHSN = function(code,gst){document.getElementById('fHsn').value=code;document.getElementById('fGst').value=gst;document.getElementById('hsnDropdown').classList.remove('show');};
  document.addEventListener('click',e=>{const dd=document.getElementById('hsnDropdown');if(dd&&!e.target.closest('#fHsn')&&!e.target.closest('#hsnDropdown'))dd.classList.remove('show');});

  // ── Specifications ──
  window.addSpec = function(key='',val=''){const c=document.getElementById('specsContainer');if(!c)return;const r=document.createElement('div');r.className='spec-row';r.innerHTML=`<input class="form-control spec-key" placeholder="Key (e.g. RAM, Display)" value="${esc(key||'')}"><input class="form-control spec-val" placeholder="Value (e.g. 8 GB, 6.8 inch)" value="${esc(val||'')}"><button type="button" class="btn-rm" onclick="this.parentElement.remove()">&times;</button>`;c.appendChild(r);};
  function getSpecs(){const rows=document.querySelectorAll('.spec-row');const s=[];rows.forEach(r=>{const k=r.querySelector('.spec-key')?.value?.trim();const v=r.querySelector('.spec-val')?.value?.trim();if(k&&v)s.push({key:k,value:v});});return s;}

  window.loadP = function(p){ page=p; search=window._search||search; catFilter=window._catF||catFilter; load(p); };
  window.fillSubCats = function(catId){
    const sel = document.getElementById('fSubCat');
    const subs = subCategories.filter(s=> (s.category?._id||s.category) === catId);
    sel.innerHTML = '<option value="">None</option>' + subs.map(s=>`<option value="${s._id}">${esc(s.name)}</option>`).join('');
  };

  let editId = null;

  window.openAdd = function(){
    editId = null;
    load(page).then(()=>{
      document.getElementById('prodTitle').textContent='Add Product';
      document.getElementById('prodForm').reset();
      document.getElementById('fCountry').value='India';
      document.getElementById('fReturnable').checked=true;
      document.getElementById('fCOD').checked=true;
      document.getElementById('specsContainer').innerHTML='';
      openModal('prod-modal');
    });
  };

  window.openEdit = async function(id){
    try {
      const r = await API.get('/partner/products/'+id);
      const p = r.product;
      editId = id;
      await load(page);
      document.getElementById('prodTitle').textContent='Edit Product';
      document.getElementById('fName').value = p.name||'';
      document.getElementById('fSku').value = p.sku||'';
      document.getElementById('fDesc').value = p.description||'';
      document.getElementById('fCat').value = p.category?._id||p.category||'';
      fillSubCats(p.category?._id||p.category||'');
      document.getElementById('fSubCat').value = p.subCategory?._id||p.subCategory||'';
      document.getElementById('fBrand').value = p.brand||'';
      document.getElementById('fModel').value = p.model||'';
      document.getElementById('fColor').value = p.color||'';
      document.getElementById('fSize').value = p.size||'';
      document.getElementById('fMaterial').value = p.material||'';
      document.getElementById('fWarranty').value = p.warranty||'';
      document.getElementById('fManufacturer').value = p.manufacturer||'';
      document.getElementById('fCountry').value = p.countryOfOrigin||'India';
      document.getElementById('fReturnPolicy').value = p.returnPolicy||'';
      document.getElementById('fPackage').value = p.packageContents||'';
      document.getElementById('fHighlights').value = (p.highlights||[]).join(', ');
      document.getElementById('fCost').value = p.costPrice||'';
      document.getElementById('fSell').value = p.sellingPrice||'';
      document.getElementById('fMrp').value = p.mrp||'';
      document.getElementById('fGst').value = p.gstPercent||0;
      document.getElementById('fHsn').value = p.hsnCode||'';
      document.getElementById('fGstInc').checked = !!p.gstInclusive;
      document.getElementById('fUnit').value = p.unit||'piece';
      document.getElementById('fStock').value = p.stock||0;
      document.getElementById('fLow').value = p.lowStockThreshold||5;
      document.getElementById('fBarcode').value = p.barcode||'';
      document.getElementById('fWeight').value = p.weight||'';
      document.getElementById('fTags').value = (p.tags||[]).join(', ');
      document.getElementById('fShelfLife').value = p.shelfLife||'';
      document.getElementById('fMinQty').value = p.minOrderQty||1;
      document.getElementById('fMaxQty').value = p.maxOrderQty||'';
      document.getElementById('fLength').value = p.length||'';
      document.getElementById('fWidth').value = p.width||'';
      document.getElementById('fHeight').value = p.height||'';
      document.getElementById('fReturnable').checked = p.isReturnable!==false;
      document.getElementById('fCOD').checked = p.isCOD!==false;
      const sc=document.getElementById('specsContainer');sc.innerHTML='';(p.specifications||[]).forEach(s=>addSpec(s.key,s.value));
      openModal('prod-modal');
    } catch(e){ showToast(e.message,'error'); }
  };

  // handle form submit
  document.body.addEventListener('submit', async function(e){
    if (e.target.id !== 'prodForm') return;
    e.preventDefault();
    const fd = new FormData();
    fd.append('platform', 'damndeal');
    fd.append('name', document.getElementById('fName').value.trim());
    const sku = document.getElementById('fSku').value.trim(); if(sku) fd.append('sku', sku);
    fd.append('description', document.getElementById('fDesc').value.trim());
    fd.append('category', document.getElementById('fCat').value);
    const subCat = document.getElementById('fSubCat').value; if(subCat) fd.append('subCategory', subCat);
    // DamnDeal fields
    const a=(k,i)=>{const el=document.getElementById(i);if(el&&el.value.trim())fd.append(k,el.value.trim());};
    const b=(k,i)=>{const el=document.getElementById(i);if(el)fd.append(k,el.checked);};
    a('brand','fBrand');a('model','fModel');a('color','fColor');a('size','fSize');a('material','fMaterial');a('warranty','fWarranty');
    a('manufacturer','fManufacturer');a('countryOfOrigin','fCountry');a('returnPolicy','fReturnPolicy');a('packageContents','fPackage');
    const hl=document.getElementById('fHighlights')?.value?.trim();if(hl)fd.append('highlights',hl);
    // Pricing
    fd.append('costPrice', document.getElementById('fCost').value);
    fd.append('sellingPrice', document.getElementById('fSell').value);
    fd.append('mrp', document.getElementById('fMrp').value);
    fd.append('gstPercent', document.getElementById('fGst').value);
    fd.append('gstInclusive', document.getElementById('fGstInc').checked);
    const hsn = document.getElementById('fHsn').value.trim(); if(hsn) fd.append('hsnCode', hsn);
    // Inventory
    fd.append('unit', document.getElementById('fUnit').value);
    fd.append('stock', document.getElementById('fStock').value);
    fd.append('lowStockThreshold', document.getElementById('fLow').value);
    a('barcode','fBarcode');
    const wt=document.getElementById('fWeight').value;if(wt)fd.append('weight',wt);
    const tg=document.getElementById('fTags').value.trim();if(tg)fd.append('tags',tg);
    a('shelfLife','fShelfLife');
    const minQ=document.getElementById('fMinQty')?.value;if(minQ)fd.append('minOrderQty',minQ);
    const maxQ=document.getElementById('fMaxQty')?.value;if(maxQ)fd.append('maxOrderQty',maxQ);
    a('length','fLength');a('width','fWidth');a('height','fHeight');
    b('isReturnable','fReturnable');b('isCOD','fCOD');
    // Specs
    const specs=getSpecs();if(specs.length)fd.append('specifications',JSON.stringify(specs));
    // Images
    const files = document.getElementById('fImages').files;
    for (let i=0; i<files.length; i++) fd.append('images', files[i]);

    try {
      if (editId) {
        await API.upload('/partner/products/'+editId, fd, 'PUT');
        showToast('Product updated — sent for review','success');
      } else {
        await API.upload('/partner/products', fd);
        showToast('Product submitted for review','success');
      }
      closeModal('prod-modal');
      load(page);
    } catch(e){ showToast(e.message,'error'); }
  });

  window.delProduct = async function(id){
    if (!confirm('Deactivate this product?')) return;
    try { await API.delete('/partner/products/'+id); showToast('Product deactivated','success'); load(page); }
    catch(e){ showToast(e.message,'error'); }
  };

  /* ── Stock ── */
  let stockProdId = null;
  window.openStock = function(id, cur){
    stockProdId = id;
    load(page).then(()=>{
      document.getElementById('curStock').textContent = cur;
      document.getElementById('sType').value='add';
      document.getElementById('sQty').value=1;
      document.getElementById('sNote').value='';
      document.getElementById('logArea').innerHTML='';
      openModal('stock-modal');
    });
  };

  window.saveStock = async function(){
    const type = document.getElementById('sType').value;
    const quantity = parseInt(document.getElementById('sQty').value)||0;
    const note = document.getElementById('sNote').value.trim();
    if (quantity <= 0) { showToast('Enter valid quantity','error'); return; }
    try {
      await API.put('/partner/products/'+stockProdId+'/stock', { type, quantity, note });
      showToast('Stock updated','success');
      closeModal('stock-modal');
      load(page);
    } catch(e){ showToast(e.message,'error'); }
  };

  window.loadLog = async function(){
    const area = document.getElementById('logArea');
    area.innerHTML = '<div class="spinner"></div>';
    try {
      const r = await API.get('/partner/products/'+stockProdId+'/inventory-log?limit=10');
      const logs = r.logs || [];
      area.innerHTML = logs.length ? '<table style="font-size:12px"><thead><tr><th>Type</th><th>Qty</th><th>After</th><th>Date</th></tr></thead><tbody>'
        + logs.map(l=>`<tr><td>${statusBadge(l.type)}</td><td>${l.quantity}</td><td>${l.stockAfter}</td><td>${fmtDateTime(l.createdAt)}</td></tr>`).join('')
        + '</tbody></table>' : '<p class="text-sm text-muted">No logs</p>';
    } catch(e){ area.innerHTML = '<p class="text-sm text-muted">'+esc(e.message)+'</p>'; }
  };

  // ── Styles ──
  const style = document.createElement('style');
  style.textContent = `
    .section-h{margin:16px 0 10px;font-size:14px;font-weight:600;color:#7C3AED;border-bottom:1px solid #f0f0f0;padding-bottom:6px}
    .review-notice{background:#FFF8E1;border:1px solid #FFCC02;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:13px;display:flex;align-items:center;gap:8px}
    .hsn-dropdown{position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid #ddd;border-radius:6px;max-height:200px;overflow-y:auto;z-index:999;display:none;box-shadow:0 4px 12px rgba(0,0,0,.15)}
    .hsn-dropdown.show{display:block}
    .hsn-item{padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid #f0f0f0;display:flex;justify-content:space-between}
    .hsn-item:hover{background:#f0fdf4}.hsn-item .code{font-weight:600;color:#7C3AED}.hsn-item .gst{font-size:11px;color:#666}
    .spec-row{display:flex;gap:8px;margin-bottom:8px;align-items:center}.spec-row input{flex:1}
    .spec-row .btn-rm{width:28px;height:28px;line-height:28px;text-align:center;padding:0;border-radius:50%;color:var(--danger);border:1px solid var(--danger);background:none;cursor:pointer;font-size:16px}
  `;
  document.head.appendChild(style);

  // init checks KYC first, then loads products if approved
  init();
})();
