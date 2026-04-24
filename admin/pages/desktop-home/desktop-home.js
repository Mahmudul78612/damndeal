(function(){
  requireAuth();
  document.body.innerHTML = pageShell('Desktop Home Layout');
  buildLayout('desktop-home');

  const main = document.getElementById('page-content');

  /* ── Section type definitions ── */
  const SECTION_TYPES = [
    { value: 'hero_carousel',       label: 'Hero Carousel',       icon: '🖼️', group: 'banner',  desc: 'Full-width banner slider (upload up to 5)' },
    { value: 'banner_2col',         label: 'Banner 2-Column',     icon: '⬜⬜', group: 'banner', desc: '2 banners side by side' },
    { value: 'banner_3col',         label: 'Banner 3-Column',     icon: '⬜⬜⬜', group: 'banner', desc: '3 banners in a row' },
    { value: 'banner_single',       label: 'Full-Width Banner',   icon: '🖼️', group: 'banner',  desc: 'Single full-width banner image' },
    { value: 'category_products',   label: 'Category + Products', icon: '📦', group: 'product', desc: 'Category header with product grid' },
    { value: 'product_grid',        label: 'Product Grid',        icon: '⊞',  group: 'product', desc: 'Product grid (2-6 columns)' },
    { value: 'deal_strip',          label: 'Deal Strip',          icon: '⚡', group: 'product', desc: 'Horizontal deal of the day cards' },
    { value: 'promo_full',          label: 'Promo Full-Width',    icon: '🎯', group: 'banner',  desc: 'Full-width promotional image' },
    { value: 'featured_categories', label: 'Featured Categories', icon: '📂', group: 'other',   desc: 'Category icons showcase row' },
  ];

  const SORT_OPTIONS = [
    { value: 'createdAt', label: 'Newest First' },
    { value: 'sellingPrice', label: 'Price (Low-High)' },
    { value: '-sellingPrice', label: 'Price (High-Low)' },
    { value: 'name', label: 'Name' },
  ];

  /* ── state (exposed on window for inline HTML handlers) ── */
  let sections = [];
  let categories = [];
  let subCategories = [];
  let allProducts = [];
  let editId = null;
  window.bannerData = [];
  window.selectedType = 'hero_carousel';

  /* ── helpers ── */
  function esc(s){ const d=document.createElement('div'); d.textContent=String(s||''); return d.innerHTML; }

  function normalizeLinkType(v){
    const t = String(v || 'none').trim().toLowerCase();
    if(['category','subcategory','product','url','none'].includes(t)) return t;
    return 'none';
  }

  function normalizeLinkValue(v){
    if(v == null) return '';
    if(typeof v === 'object') {
      return String(v._id || v.id || v.value || '').trim();
    }
    return String(v).trim();
  }

  function normalizeBanner(b){
    return {
      ...b,
      linkType: normalizeLinkType(b?.linkType),
      linkValue: normalizeLinkValue(b?.linkValue),
    };
  }

  function typeBadge(type){
    const t = SECTION_TYPES.find(x=>x.value===type);
    const colors = { product:'#7C3AED', banner:'#2196F3', other:'#10B981' };
    const c = colors[t?.group]||'#666';
    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600;background:${c}15;color:${c}">${t?.icon||'?'} ${t?.label||type}</span>`;
  }

  function dataPreview(s){
    const d = s.data || {};
    const parts = [];
    if(d.columns) parts.push(d.columns+' col');
    if(d.limit) parts.push('limit '+d.limit);
    if(d.categoryName) parts.push(d.categoryName);
    if(d.banners?.length) parts.push(d.banners.length+' banners');
    return parts.length ? parts.join(' · ') : '—';
  }

  /* ── Desktop Preview ── */
  function buildDesktopPreview(){
    const active = sections.filter(s => s.isActive !== false);
    if(!active.length) return '<p style="text-align:center;color:#999;padding:60px 20px">No sections yet. Click + Add Section to design your desktop home page.</p>';

    return active.map(s => {
      const d = s.data || {};
      const t = SECTION_TYPES.find(x=>x.value===s.type);
      const colors = { product:'#7C3AED', banner:'#2196F3', other:'#10B981' };
      const accent = colors[t?.group] || '#666';

      switch(s.type){
        case 'hero_carousel':
          return `<div style="height:60px;background:linear-gradient(135deg,${accent}22,${accent}08);border-radius:8px;display:flex;align-items:center;justify-content:center;border:1px dashed ${accent}44;margin-bottom:6px">
            <div style="text-align:center"><span style="font-size:14px">🖼️</span><div style="font-size:9px;font-weight:600;color:${accent}">${esc(s.title)}</div></div></div>`;

        case 'banner_2col':
          return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:6px">
            ${(d.banners||[{},{}]).slice(0,2).map(b => `<div style="height:45px;background:${b.image?`url(${b.image.startsWith('http')?b.image:CONFIG.UPLOADS_BASE+b.image}) center/cover`:`linear-gradient(135deg,${accent}15,${accent}08)`};border-radius:6px;border:1px dashed ${accent}33;display:flex;align-items:center;justify-content:center"><span style="font-size:9px;color:${accent}">Banner</span></div>`).join('')}
          </div>`;

        case 'banner_3col':
          return `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:6px">
            ${(d.banners||[{},{},{}]).slice(0,3).map(b => `<div style="height:45px;background:${b.image?`url(${b.image.startsWith('http')?b.image:CONFIG.UPLOADS_BASE+b.image}) center/cover`:`linear-gradient(135deg,${accent}15,${accent}08)`};border-radius:6px;border:1px dashed ${accent}33;display:flex;align-items:center;justify-content:center"><span style="font-size:9px;color:${accent}">Banner</span></div>`).join('')}
          </div>`;

        case 'banner_single':
        case 'promo_full':
          return `<div style="height:50px;background:${d.image?`url(${d.image.startsWith('http')?d.image:CONFIG.UPLOADS_BASE+d.image}) center/cover`:`linear-gradient(135deg,${accent}15,${accent}08)`};border-radius:6px;border:1px dashed ${accent}33;display:flex;align-items:center;justify-content:center;margin-bottom:6px">
            <span style="font-size:9px;color:${accent}">${esc(s.title)}</span></div>`;

        case 'category_products':
        case 'product_grid':
        case 'deal_strip': {
          const cols = d.columns || 5;
          const titleHtml = s.title ? `<div style="font-size:10px;font-weight:700;color:#333;padding:3px 0">${esc(s.title)}</div>` : '';
          let grid = '';
          const count = Math.min(d.limit||6, cols);
          for(let i=0;i<count;i++){
            grid += `<div style="background:#f0f0f0;border-radius:4px;height:${s.type==='deal_strip'?30:40}px;border:1px solid #e5e5e5"></div>`;
          }
          return `<div style="margin-bottom:6px;padding:4px;background:#fff;border-radius:6px;border:1px solid #f0f0f0">
            ${titleHtml}
            <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:3px">${grid}</div>
          </div>`;
        }

        case 'featured_categories':
          return `<div style="display:flex;gap:4px;margin-bottom:6px;padding:4px">
            ${Array(6).fill(0).map(()=>`<div style="width:32px;height:32px;background:#f0f0f0;border-radius:50%;border:1px solid #e5e5e5"></div>`).join('')}
          </div>`;

        default:
          return '';
      }
    }).join('');
  }

  /* ── Render ── */
  function render(){
    main.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div>
          <h2 style="margin:0;font-size:1.2rem;font-weight:700">🖥️ Desktop Home Layout</h2>
          <p style="margin:4px 0 0;font-size:12px;color:var(--text-light)">Design the website desktop home page. Mobile home uses the existing Home Sections.</p>
        </div>
        <button class="btn btn-primary" onclick="openAdd()">+ Add Section</button>
      </div>

      <div style="display:grid;grid-template-columns:1fr 340px;gap:16px">
        <!-- Sections Table -->
        <div class="card" style="overflow:auto">
          <table class="table" id="secTable">
            <thead><tr>
              <th style="width:50px">Order</th>
              <th>Type</th>
              <th>Title</th>
              <th>Config</th>
              <th style="width:50px">Active</th>
              <th style="width:180px">Actions</th>
            </tr></thead>
            <tbody>${sections.length ? sections.map((s,i)=> `
              <tr>
                <td>
                  <div style="display:flex;flex-direction:column;gap:2px;align-items:center">
                    ${i>0?`<button class="btn btn-sm" style="padding:0 6px;font-size:.65rem" onclick="move('${s._id}',-1)">▲</button>`:''}
                    <span style="font-weight:600;font-size:13px">${s.sortOrder??i}</span>
                    ${i<sections.length-1?`<button class="btn btn-sm" style="padding:0 6px;font-size:.65rem" onclick="move('${s._id}',1)">▼</button>`:''}
                  </div>
                </td>
                <td>${typeBadge(s.type)}</td>
                <td style="font-weight:600">${esc(s.title||'—')}</td>
                <td style="font-size:12px">${dataPreview(s)}</td>
                <td>${s.isActive!==false?'<span class="badge badge-success">Yes</span>':'<span class="badge badge-gray">No</span>'}</td>
                <td>
                  <div style="display:flex;gap:4px;flex-wrap:wrap">
                    <button class="btn btn-sm" onclick="openEdit('${s._id}')" style="font-size:11px">✏️</button>
                    <button class="btn btn-sm ${s.isActive!==false?'btn-warning':'btn-primary'}" onclick="toggleActive('${s._id}',${s.isActive!==false})" style="font-size:11px">${s.isActive!==false?'Off':'On'}</button>
                    <button class="btn btn-sm btn-danger" onclick="removeSec('${s._id}')" style="font-size:11px">🗑️</button>
                  </div>
                </td>
              </tr>`).join('') : '<tr><td colspan="6" class="empty-state">No desktop sections. Click + Add Section to start.</td></tr>'}
            </tbody>
          </table>
        </div>

        <!-- Desktop Preview -->
        <div>
          <div style="font-size:13px;font-weight:700;margin-bottom:8px">🖥️ Desktop Preview</div>
          <div style="background:#fafafa;border:2px solid #ddd;border-radius:12px;padding:12px;min-height:400px;box-shadow:0 2px 12px rgba(0,0,0,.08)">
            <div style="display:flex;gap:4px;margin-bottom:8px">
              <div style="width:8px;height:8px;background:#ff5f57;border-radius:50%"></div>
              <div style="width:8px;height:8px;background:#febc2e;border-radius:50%"></div>
              <div style="width:8px;height:8px;background:#28c840;border-radius:50%"></div>
            </div>
            <div style="background:#7C3AED;border-radius:6px;padding:6px 10px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
              <span style="color:#fff;font-size:11px;font-weight:700">Online Store</span>
              <div style="background:rgba(255,255,255,.2);border-radius:4px;padding:2px 20px"><span style="color:rgba(255,255,255,.6);font-size:9px">Search...</span></div>
            </div>
            ${buildDesktopPreview()}
          </div>
        </div>
      </div>

      <!-- ─── MODAL ─── -->
      <div class="modal-overlay" id="modal">
        <div class="modal" style="width:640px;max-height:90vh;overflow-y:auto">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
            <h3 id="modalTitle" style="margin:0">Add Section</h3>
            <button class="btn btn-sm" onclick="closeModal('modal')" style="font-size:18px;padding:0 8px">×</button>
          </div>

          <!-- Type Selection -->
          <fieldset style="border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:12px">
            <legend style="font-size:12px;font-weight:700;color:var(--text-light);padding:0 6px">SECTION TYPE</legend>
            <div id="typeGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
              ${SECTION_TYPES.map(t => `
                <div class="type-card" data-type="${t.value}" onclick="selectType('${t.value}')" style="border:2px solid #e5e7eb;border-radius:8px;padding:8px;cursor:pointer;text-align:center;transition:all .15s">
                  <div style="font-size:18px">${t.icon}</div>
                  <div style="font-size:11px;font-weight:600;margin-top:2px">${t.label}</div>
                  <div style="font-size:9px;color:#999;margin-top:2px">${t.desc}</div>
                </div>
              `).join('')}
            </div>
          </fieldset>

          <!-- Basic Info -->
          <fieldset style="border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:12px">
            <legend style="font-size:12px;font-weight:700;color:var(--text-light);padding:0 6px">BASIC INFO</legend>
            <div class="form-row">
              <div class="form-group" style="flex:2">
                <label>Title</label>
                <input class="form-control" id="fTitle" placeholder="Section title">
              </div>
              <div class="form-group" style="flex:1">
                <label>Sort Order</label>
                <input class="form-control" id="fSort" type="number" value="0" min="0">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Platform</label>
                <select class="form-control" id="fPlatform">
                  <option value="damndeal">Online Store</option>
                  <option value="ddgo">Quick Commerce</option>
                </select>
              </div>
              <div class="form-group">
                <label><input type="checkbox" id="fActive" checked> Active</label>
              </div>
            </div>
          </fieldset>

          <!-- Banner Config (for banner_2col, banner_3col, banner_single, promo_full) -->
          <fieldset id="bannerConfig" style="border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:12px;display:none">
            <legend style="font-size:12px;font-weight:700;color:var(--text-light);padding:0 6px">BANNER IMAGES</legend>
            <div id="bannerSlots"></div>
          </fieldset>

          <!-- Product Config (for category_products, product_grid, deal_strip) -->
          <fieldset id="productConfig" style="border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:12px;display:none">
            <legend style="font-size:12px;font-weight:700;color:var(--text-light);padding:0 6px">PRODUCT CONFIG</legend>
            <div class="form-row">
              <div class="form-group" style="flex:1">
                <label>Category</label>
                <select class="form-control" id="fCategory" onchange="onCategoryChange()">
                  <option value="">— All Products —</option>
                  ${categories.map(c=>`<option value="${c._id}">${esc(c.name)}</option>`).join('')}
                </select>
              </div>
              <div class="form-group" style="flex:1">
                <label>Sub-Category</label>
                <select class="form-control" id="fSubCategory">
                  <option value="">— All —</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Columns</label>
                <select class="form-control" id="fColumns">
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5" selected>5</option>
                  <option value="6">6</option>
                </select>
              </div>
              <div class="form-group">
                <label>Product Limit</label>
                <input class="form-control" id="fLimit" type="number" value="10" min="1" max="50">
              </div>
              <div class="form-group">
                <label>Sort By</label>
                <select class="form-control" id="fSortBy">
                  ${SORT_OPTIONS.map(o=>`<option value="${o.value}">${o.label}</option>`).join('')}
                </select>
              </div>
            </div>

            <!-- Specific Products Selector -->
            <div id="productSelectorWrap" style="margin-top:8px">
              <label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:4px;margin-bottom:6px">
                <input type="checkbox" id="fUseProductIds" onchange="toggleProductSelector()"> Select specific products
              </label>
              <div id="productSelector" style="display:none">
                <input class="form-control" id="prodSearchInput" placeholder="Search products to add..." style="font-size:12px;margin-bottom:6px" oninput="filterGridProducts(this.value)">
                <div id="prodSearchResults" style="max-height:160px;overflow-y:auto;border:1px solid #eee;border-radius:6px;margin-bottom:8px;display:none"></div>
                <div id="selectedProducts" style="display:flex;flex-wrap:wrap;gap:6px"></div>
              </div>
            </div>
          </fieldset>

          <!-- Category Config (for featured_categories) -->
          <fieldset id="categoryConfig" style="border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:12px;display:none">
            <legend style="font-size:12px;font-weight:700;color:var(--text-light);padding:0 6px">CATEGORIES</legend>
            <p style="font-size:12px;color:#666;margin-bottom:8px">Select categories to feature (leave empty for all):</p>
            <div id="catCheckboxes" style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;max-height:200px;overflow-y:auto">
              ${categories.map(c=>`<label style="font-size:12px;display:flex;align-items:center;gap:4px"><input type="checkbox" class="cat-check" value="${c._id}"> ${esc(c.name)}</label>`).join('')}
            </div>
          </fieldset>

          <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:16px">
            <button class="btn" onclick="closeModal('modal')">Cancel</button>
            <button class="btn btn-primary" onclick="save()">💾 Save Section</button>
          </div>
        </div>
      </div>`;

    // Type card hover
    document.querySelectorAll('.type-card').forEach(card => {
      card.addEventListener('mouseenter', ()=> card.style.borderColor='#7C3AED');
      card.addEventListener('mouseleave', ()=> { if(!card.classList.contains('selected')) card.style.borderColor='#e5e7eb'; });
    });
  }

  /* ── Type selection ── */
  // selectedType lives on window (see top of file)

  window.selectType = function(type){
    window.selectedType = type;
    document.querySelectorAll('.type-card').forEach(c => {
      c.classList.remove('selected');
      c.style.borderColor = '#e5e7eb';
      c.style.background = '';
    });
    const el = document.querySelector(`.type-card[data-type="${type}"]`);
    if(el){
      el.classList.add('selected');
      el.style.borderColor = '#7C3AED';
      el.style.background = '#7C3AED08';
    }

    // Show/hide config sections
    const isBanner = ['hero_carousel','banner_2col','banner_3col','banner_single','promo_full'].includes(type);
    const isProduct = ['category_products','product_grid','deal_strip'].includes(type);
    const isCatFeat = type === 'featured_categories';

    document.getElementById('bannerConfig').style.display = isBanner ? '' : 'none';
    document.getElementById('productConfig').style.display = isProduct ? '' : 'none';
    document.getElementById('categoryConfig').style.display = isCatFeat ? '' : 'none';

    // Build banner slots
    if(isBanner) buildBannerSlots(type);
  };

  /* ── Banner slot management (window.bannerData declared at top) ── */

  function buildLinkValueField(i, linkType, linkValue) {
    if (linkType === 'category') {
      return `<select class="form-control" style="font-size:12px" onchange="bannerData[${i}].linkValue=this.value">
        <option value="">— Select Category —</option>
        ${categories.map(c => `<option value="${c._id}" ${linkValue === c._id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
      </select>`;
    }
    if (linkType === 'subcategory') {
      return `<select class="form-control" style="font-size:12px" onchange="bannerData[${i}].linkValue=this.value">
        <option value="">— Select Sub-Category —</option>
        ${categories.map(cat => {
          const subs = subCategories.filter(s => s.category === cat._id || s.category?._id === cat._id);
          if (!subs.length) return '';
          return `<optgroup label="${esc(cat.name)}">
            ${subs.map(s => `<option value="${s._id}" ${linkValue === s._id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
          </optgroup>`;
        }).join('')}
      </select>`;
    }
    if (linkType === 'product') {
      return `<div>
        <input class="form-control" style="font-size:12px;margin-bottom:4px" placeholder="Search product..." oninput="filterProductDropdown(${i},this.value)" onfocus="showProductDropdown(${i})">
        <div id="prodDrop${i}" style="display:none;max-height:150px;overflow-y:auto;border:1px solid #ddd;border-radius:6px;background:#fff">
          ${allProducts.slice(0, 50).map(p => `<div class="prod-opt" style="padding:6px 8px;font-size:11px;cursor:pointer;border-bottom:1px solid #f5f5f5;display:flex;align-items:center;gap:6px${linkValue === p._id ? ';background:#7C3AED10;font-weight:600' : ''}" onmousedown="selectProduct(${i},'${p._id}','${esc(p.name).replace(/'/g, "\\'")}')">
            ${p.images?.[0] ? `<img src="${CONFIG.UPLOADS_BASE}${p.images[0]}" style="width:24px;height:24px;border-radius:4px;object-fit:cover">` : '<span style="width:24px;height:24px;background:#eee;border-radius:4px;display:inline-block"></span>'}
            <span>${esc(p.name)}</span>
            <span style="margin-left:auto;color:#999;font-size:10px">₹${p.sellingPrice||0}</span>
          </div>`).join('')}
        </div>
        ${linkValue ? `<div style="margin-top:4px;padding:4px 8px;background:#7C3AED10;border-radius:4px;font-size:11px;display:flex;align-items:center;gap:4px">
          ✓ ${esc(allProducts.find(p=>p._id===linkValue)?.name || linkValue)}
          <span style="margin-left:auto;cursor:pointer;color:#999" onclick="bannerData[${i}].linkValue='';buildBannerSlots(selectedType)">×</span>
        </div>` : ''}
      </div>`;
    }
    if (linkType === 'url') {
      return `<input class="form-control" style="font-size:12px" value="${esc(linkValue || '')}" placeholder="https://example.com" onchange="bannerData[${i}].linkValue=this.value">`;
    }
    return '<span style="font-size:11px;color:#999">No link</span>';
  }

  window.showProductDropdown = function(i) {
    document.getElementById('prodDrop' + i).style.display = '';
    setTimeout(() => {
      document.addEventListener('click', function handler(e) {
        const dd = document.getElementById('prodDrop' + i);
        if (dd && !dd.contains(e.target)) { dd.style.display = 'none'; document.removeEventListener('click', handler); }
      });
    }, 100);
  };

  window.filterProductDropdown = function(i, q) {
    const dd = document.getElementById('prodDrop' + i);
    if (!dd) return;
    dd.style.display = '';
    const lower = q.toLowerCase();
    const filtered = lower ? allProducts.filter(p => p.name.toLowerCase().includes(lower)) : allProducts;
    dd.innerHTML = filtered.slice(0, 50).map(p => `<div class="prod-opt" style="padding:6px 8px;font-size:11px;cursor:pointer;border-bottom:1px solid #f5f5f5;display:flex;align-items:center;gap:6px" onmousedown="selectProduct(${i},'${p._id}','${esc(p.name).replace(/'/g, "\\'")}')">
      ${p.images?.[0] ? `<img src="${CONFIG.UPLOADS_BASE}${p.images[0]}" style="width:24px;height:24px;border-radius:4px;object-fit:cover">` : '<span style="width:24px;height:24px;background:#eee;border-radius:4px;display:inline-block"></span>'}
      <span>${esc(p.name)}</span>
      <span style="margin-left:auto;color:#999;font-size:10px">₹${p.sellingPrice||0}</span>
    </div>`).join('') || '<div style="padding:8px;font-size:11px;color:#999;text-align:center">No products found</div>';
  };

  window.selectProduct = function(i, id, name) {
    bannerData[i].linkValue = id;
    buildBannerSlots(selectedType);
  };

  window.buildBannerSlots = function(type){
    const count = type === 'hero_carousel' ? 5 : type === 'banner_2col' ? 2 : type === 'banner_3col' ? 3 : 1;
    const isCarousel = type === 'hero_carousel';
    while(bannerData.length < count) bannerData.push({ image:'', link:'', linkType:'category', linkValue:'' });
    if(!isCarousel) bannerData = bannerData.slice(0, count);

    if(isCarousel){
      // For carousel: ensure at least 1 slot, max 5
      if(!bannerData.length) bannerData.push({ image:'', link:'', linkType:'category', linkValue:'' });
      if(bannerData.length > 5) bannerData = bannerData.slice(0, 5);
    }

    const container = document.getElementById('bannerSlots');
    container.innerHTML = bannerData.map((b, i) => {
      const imgSrc = b._previewUrl || (b.image ? (b.image.startsWith('http') ? b.image : CONFIG.UPLOADS_BASE + b.image) : '');
      const hasContent = imgSrc || b._file;
      return `
        <div style="border:1px solid #eee;border-radius:8px;padding:10px;margin-bottom:8px;background:#fafafa">
          <div style="display:flex;gap:10px;align-items:flex-start">
            <div style="min-width:120px;text-align:center">
              <div style="width:120px;height:70px;border-radius:6px;overflow:hidden;background:#eee;display:flex;align-items:center;justify-content:center;cursor:pointer;border:2px dashed #ccc" onclick="document.getElementById('bannerFile${i}').click()">
                ${imgSrc ? `<img src="${esc(imgSrc)}" style="width:100%;height:100%;object-fit:cover">` : '<span style="font-size:24px;color:#bbb">📷</span>'}
              </div>
              <input type="file" id="bannerFile${i}" accept="image/*" style="display:none" onchange="onBannerFile(${i},this)">
              <span style="font-size:9px;color:#999">Click to upload</span>
            </div>
            <div style="flex:1">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                <span style="font-size:11px;font-weight:600;color:#666">Slide ${i+1}</span>
                ${isCarousel && hasContent ? `<button type="button" style="border:none;background:#fee;color:#c00;font-size:10px;padding:2px 8px;border-radius:4px;cursor:pointer" onclick="removeCarouselSlide(${i})">Remove</button>` : ''}
              </div>
              <div class="form-group" style="margin-bottom:6px">
                <label style="font-size:11px">Link Type</label>
                <select class="form-control" style="font-size:12px" onchange="bannerData[${i}].linkType=this.value;bannerData[${i}].linkValue='';buildBannerSlots('${type}')">
                  <option value="category" ${b.linkType==='category'?'selected':''}>Category</option>
                  <option value="subcategory" ${b.linkType==='subcategory'?'selected':''}>Sub-Category</option>
                  <option value="product" ${b.linkType==='product'?'selected':''}>Product</option>
                  <option value="url" ${b.linkType==='url'?'selected':''}>URL</option>
                  <option value="none" ${b.linkType==='none'?'selected':''}>None</option>
                </select>
              </div>
              <div class="form-group">
                <label style="font-size:11px">Link Value</label>
                ${buildLinkValueField(i, b.linkType, b.linkValue)}
              </div>
            </div>
          </div>
        </div>`;
    }).join('');
    if(isCarousel) {
      const filledCount = bannerData.filter(b => b.image || b._file || b._previewUrl).length;
      if(filledCount < 5) {
        container.innerHTML += `<div style="text-align:center;padding:8px">
          <button type="button" class="btn btn-sm" style="font-size:11px" onclick="addCarouselSlide()">+ Add Slide (${filledCount}/5)</button>
        </div>`;
      }
    }
  };

  window.addCarouselSlide = function(){
    const filledCount = bannerData.filter(b => b.image || b._file || b._previewUrl).length;
    if(filledCount >= 5) return;
    bannerData.push({ image:'', link:'', linkType:'category', linkValue:'' });
    buildBannerSlots(selectedType);
  };

  window.removeCarouselSlide = function(idx){
    bannerData.splice(idx, 1);
    buildBannerSlots(selectedType);
  };

  window.onBannerFile = function(idx, input){
    if(input.files[0]){
      bannerData[idx]._file = input.files[0];
      bannerData[idx]._previewUrl = URL.createObjectURL(input.files[0]);
      buildBannerSlots(selectedType);
    }
  };

  /* ── Sub-category dropdown ── */
  window.onCategoryChange = function(){
    const catId = document.getElementById('fCategory').value;
    const subSel = document.getElementById('fSubCategory');
    if(!subSel) return;
    const subs = catId ? subCategories.filter(s => (s.category?._id || s.category) === catId) : [];
    subSel.innerHTML = '<option value="">— All —</option>' + subs.map(s => `<option value="${s._id}">${esc(s.name)}</option>`).join('');
  };

  /* ── Product selector for product_grid ── */
  let selectedProductIds = [];

  window.toggleProductSelector = function(){
    const checked = document.getElementById('fUseProductIds').checked;
    document.getElementById('productSelector').style.display = checked ? '' : 'none';
    if(!checked) selectedProductIds = [];
    renderSelectedProducts();
  };

  window.filterGridProducts = function(q){
    const container = document.getElementById('prodSearchResults');
    if(!container) return;
    const lower = q.toLowerCase();
    if(!q) { container.style.display = 'none'; return; }
    const filtered = allProducts.filter(p => p.name.toLowerCase().includes(lower) && !selectedProductIds.includes(p._id));
    container.style.display = '';
    container.innerHTML = filtered.slice(0, 30).map(p => `
      <div style="padding:6px 10px;font-size:12px;cursor:pointer;border-bottom:1px solid #f5f5f5;display:flex;align-items:center;gap:6px;hover" onmouseover="this.style.background='#f9f9f9'" onmouseout="this.style.background=''" onclick="addGridProduct('${p._id}')">
        ${p.images?.[0] ? `<img src="${CONFIG.UPLOADS_BASE}${p.images[0]}" style="width:28px;height:28px;border-radius:4px;object-fit:cover">` : '<span style="width:28px;height:28px;background:#eee;border-radius:4px;display:inline-block"></span>'}
        <span>${esc(p.name)}</span>
        <span style="margin-left:auto;color:#999;font-size:10px">₹${p.sellingPrice||0}</span>
      </div>
    `).join('') || '<div style="padding:10px;font-size:11px;color:#999;text-align:center">No products found</div>';
  };

  window.addGridProduct = function(id){
    if(!selectedProductIds.includes(id)) selectedProductIds.push(id);
    document.getElementById('prodSearchInput').value = '';
    document.getElementById('prodSearchResults').style.display = 'none';
    renderSelectedProducts();
  };

  window.removeGridProduct = function(id){
    selectedProductIds = selectedProductIds.filter(x => x !== id);
    renderSelectedProducts();
  };

  function renderSelectedProducts(){
    const container = document.getElementById('selectedProducts');
    if(!container) return;
    container.innerHTML = selectedProductIds.map(id => {
      const p = allProducts.find(x => x._id === id);
      return `<div style="display:flex;align-items:center;gap:4px;padding:4px 8px;background:#7C3AED10;border:1px solid #7C3AED30;border-radius:6px;font-size:11px">
        ${p?.images?.[0] ? `<img src="${CONFIG.UPLOADS_BASE}${p.images[0]}" style="width:20px;height:20px;border-radius:3px;object-fit:cover">` : ''}
        <span>${esc(p?.name || id)}</span>
        <span style="cursor:pointer;color:#999;margin-left:4px;font-weight:700" onclick="removeGridProduct('${id}')">×</span>
      </div>`;
    }).join('') || '<span style="font-size:11px;color:#999">No products selected</span>';
  }

  /* ── Load data ── */
  async function load(){
    try{
      const [secRes, catRes, subRes, prodRes] = await Promise.all([
        API.get('/admin/desktop-home-sections'),
        API.get('/admin/categories'),
        API.get('/admin/subcategories'),
        API.get('/admin/products?limit=500&fields=name,images,sellingPrice,category'),
      ]);
      sections = (secRes.sections || []).map((s) => {
        const d = { ...(s.data || {}) };
        if(Array.isArray(d.banners)) d.banners = d.banners.map(normalizeBanner);
        if(d.linkType || d.linkValue) {
          d.linkType = normalizeLinkType(d.linkType);
          d.linkValue = normalizeLinkValue(d.linkValue);
        }
        return { ...s, data: d };
      });
      sections.sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
      categories = catRes.categories || [];
      subCategories = subRes.subCategories || subRes.subcategories || [];
      allProducts = prodRes.products || [];
    }catch(e){ sections=[]; categories=[]; showToast(e.message,'error'); }
    render();
  }

  /* ── Add / Edit ── */
  window.openAdd = function(){
    editId = null;
    selectedProductIds = [];
    render();
    document.getElementById('modalTitle').textContent='Add Section';
    document.getElementById('fTitle').value='';
    document.getElementById('fSort').value = sections.length;
    document.getElementById('fPlatform').value='damndeal';
    document.getElementById('fActive').checked=true;
    document.getElementById('fCategory').value='';
    document.getElementById('fSubCategory').innerHTML='<option value="">— All —</option>';
    document.getElementById('fColumns').value='5';
    document.getElementById('fLimit').value='10';
    document.getElementById('fSortBy').value='createdAt';
    document.getElementById('fUseProductIds').checked=false;
    document.getElementById('productSelector').style.display='none';
    bannerData = [];
    document.querySelectorAll('.cat-check').forEach(c=>c.checked=false);
    renderSelectedProducts();
    selectType('hero_carousel');
    openModal('modal');
  };

  window.openEdit = function(id){
    const s = sections.find(x=>x._id===id);
    if(!s) return;
    editId = id;
    render();
    document.getElementById('modalTitle').textContent='Edit Section';
    document.getElementById('fTitle').value = s.title||'';
    document.getElementById('fSort').value = s.sortOrder||0;
    document.getElementById('fPlatform').value = s.platform||'damndeal';
    document.getElementById('fActive').checked = s.isActive!==false;

    const d = s.data || {};
    document.getElementById('fCategory').value = d.categoryId||'';
    onCategoryChange();
    if(d.subCategoryId) setTimeout(()=>{ document.getElementById('fSubCategory').value = d.subCategoryId; }, 50);
    document.getElementById('fColumns').value = d.columns||5;
    document.getElementById('fLimit').value = d.limit||10;
    document.getElementById('fSortBy').value = d.sortBy||'createdAt';

    // Product IDs
    selectedProductIds = d.productIds || [];
    const useIds = selectedProductIds.length > 0;
    document.getElementById('fUseProductIds').checked = useIds;
    document.getElementById('productSelector').style.display = useIds ? '' : 'none';
    renderSelectedProducts();

    // Banner data
    bannerData = (d.banners||[]).map(normalizeBanner);
    if(s.type==='banner_single'||s.type==='promo_full'){
      bannerData = [{
        image: d.image||'',
        link: d.link||'',
        linkType: normalizeLinkType(d.linkType),
        linkValue: normalizeLinkValue(d.linkValue),
      }];
    }
    if(s.type==='hero_carousel'){
      bannerData = (d.banners||[]).map(normalizeBanner);
      if(!bannerData.length) bannerData.push({ image:'', link:'', linkType:'category', linkValue:'' });
    }

    // Category checkboxes
    const catIds = d.categoryIds || [];
    document.querySelectorAll('.cat-check').forEach(c=>{
      c.checked = catIds.includes(c.value);
    });

    selectType(s.type);
    openModal('modal');
  };

  /* ── Save ── */
  window.save = async function(){
    const title = document.getElementById('fTitle').value.trim();
    const sortOrder = parseInt(document.getElementById('fSort').value)||0;
    const platform = document.getElementById('fPlatform').value;
    const isActive = document.getElementById('fActive').checked;

    if(!title){ showToast('Title is required','error'); return; }

    const type = selectedType;
    const isBannerType = ['hero_carousel','banner_2col','banner_3col','banner_single','promo_full'].includes(type);
    const isProduct = ['category_products','product_grid','deal_strip'].includes(type);
    const isCatFeat = type === 'featured_categories';

    // ── Banner types with image upload ──
    if(isBannerType){
      const fd = new FormData();
      fd.append('title', title);
      fd.append('type', type);
      fd.append('platform', platform);
      fd.append('sortOrder', sortOrder);
      fd.append('isActive', isActive);

      const data = {};
      if(type === 'banner_single' || type === 'promo_full'){
        data.link = String(bannerData[0]?.link || '').trim();
        data.linkType = normalizeLinkType(bannerData[0]?.linkType);
        data.linkValue = normalizeLinkValue(bannerData[0]?.linkValue);
        data.image = bannerData[0]?.image || '';
        if(bannerData[0]?._file) {
          fd.append('images', bannerData[0]._file);
          delete data.image;
        }
      } else {
        // Filter out empty slots (no image, no file) for hero_carousel
        const activeBanners = type === 'hero_carousel'
          ? bannerData.filter(b => b.image || b._file || b._previewUrl)
          : bannerData;
        data.banners = activeBanners.map(b => {
          const banner = {
            image: b.image||'',
            link: String(b.link || '').trim(),
            linkType: normalizeLinkType(b.linkType),
            linkValue: normalizeLinkValue(b.linkValue),
          };
          if(b._file) banner._newImage = true;
          return banner;
        });
        activeBanners.forEach(b => {
          if(b._file) fd.append('images', b._file);
        });
      }
      fd.append('data', JSON.stringify(data));

      try{
        if(editId){
          await API.upload('/admin/desktop-home-sections/'+editId+'/with-images', fd, 'PUT');
        } else {
          await API.upload('/admin/desktop-home-sections/with-images', fd);
        }
        showToast(editId?'Updated':'Created','success');
        closeModal('modal');
        load();
      }catch(e){ showToast(e.message,'error'); }
      return;
    }

    // ── Product / other types ──
    const data = {};
    if(isProduct){
      const catId = document.getElementById('fCategory').value;
      if(catId) data.categoryId = catId;
      const subCatId = document.getElementById('fSubCategory')?.value;
      if(subCatId) data.subCategoryId = subCatId;
      data.columns = parseInt(document.getElementById('fColumns').value)||5;
      data.limit = parseInt(document.getElementById('fLimit').value)||10;
      data.sortBy = document.getElementById('fSortBy').value;
      if(document.getElementById('fUseProductIds').checked && selectedProductIds.length > 0){
        data.productIds = selectedProductIds;
      }
    }
    if(isCatFeat){
      data.categoryIds = [...document.querySelectorAll('.cat-check:checked')].map(c=>c.value);
    }

    const payload = { title, type, platform, sortOrder, isActive, data };

    try{
      if(editId){
        await API.put('/admin/desktop-home-sections/'+editId, payload);
        showToast('Updated','success');
      } else {
        await API.post('/admin/desktop-home-sections', payload);
        showToast('Created','success');
      }
      closeModal('modal');
      load();
    }catch(e){ showToast(e.message,'error'); }
  };

  /* ── Reorder ── */
  window.move = async function(id, dir){
    const idx = sections.findIndex(x=>x._id===id);
    if(idx<0) return;
    const swapIdx = idx+dir;
    if(swapIdx<0||swapIdx>=sections.length) return;
    const order = sections.map((s,i) => ({ id: s._id, sortOrder: i }));
    order[idx].sortOrder = swapIdx;
    order[swapIdx].sortOrder = idx;
    try{
      await API.put('/admin/desktop-home-sections/reorder', { order });
      showToast('Reordered','success');
      load();
    }catch(e){ showToast(e.message,'error'); }
  };

  window.toggleActive = async function(id, current){
    try{
      await API.put('/admin/desktop-home-sections/'+id, { isActive: !current });
      showToast(current?'Disabled':'Enabled','success');
      load();
    }catch(e){ showToast(e.message,'error'); }
  };

  window.removeSec = async function(id){
    if(!confirm('Delete this section?')) return;
    try{
      await API.delete('/admin/desktop-home-sections/'+id);
      showToast('Deleted','success');
      load();
    }catch(e){ showToast(e.message,'error'); }
  };

  load();
})();
