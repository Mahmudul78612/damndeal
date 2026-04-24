(function(){
  requireAuth();
  document.body.innerHTML = pageShell('Home Sections');
  buildLayout('home-sections');

  const main = document.getElementById('page-content');

  /* ── constants ── */
  const SECTION_TYPES = [
    { value: 'banner_carousel',    label: 'Banner Carousel',    icon: '🖼️', group: 'banner' },
    { value: 'custom_banner',      label: 'Custom Banner',      icon: '📐', group: 'banner' },
    { value: 'promo_section',      label: 'Promo Section',      icon: '🎯', group: 'promo' },
    { value: 'category_grid',      label: 'Category Grid',      icon: '🧩', group: 'product' },
    { value: 'category_section',   label: 'Category Section',   icon: '📦', group: 'product' },
    { value: 'horizontal_products',label: 'Horizontal Scroll',  icon: '↔️', group: 'product' },
    { value: 'grid_products',      label: 'Product Grid',       icon: '⊞',  group: 'product' },
    { value: 'popular_products',   label: 'Popular Products',   icon: '🔥', group: 'product' },
    { value: 'deal_of_day',        label: 'Deal of the Day',    icon: '⚡', group: 'product' },
    { value: 'product_grid',       label: 'Manual Product Grid', icon: '📋', group: 'product' },
  ];
  const CARD_STYLES = ['default','compact','minimal','big_image'];
  const LAYOUTS = ['horizontal','grid','list'];
  const SORT_OPTIONS = [
    { value: 'createdAt', label: 'Newest First' },
    { value: 'sellingPrice', label: 'Price' },
    { value: 'name', label: 'Name' },
  ];

  /* ── state ── */
  let sections = [];
  let categories = [];
  let previewPlatform = 'damndeal';

  /* ── helpers ── */
  function esc(s){ const d=document.createElement('div'); d.textContent=String(s||''); return d.innerHTML; }

  function typeBadge(type){
    const t = SECTION_TYPES.find(x=>x.value===type);
    const colors = { product:'#7C3AED', banner:'#2196F3', promo:'#E91E63' };
    const c = colors[t?.group]||'#666';
    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600;background:${c}15;color:${c}">${t?.icon||'?'} ${t?.label||type}</span>`;
  }

  function stylePreview(data){
    const parts = [];
    if(data?.placement) parts.push(data.placement);
    if(data?.layout) parts.push(data.layout);
    if(data?.columns) parts.push(data.columns+'col');
    if(data?.cardStyle && data.cardStyle!=='default') parts.push(data.cardStyle);
    if(data?.bgColor) parts.push(`<span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${data.bgColor};border:1px solid #ddd;vertical-align:middle"></span>`);
    return parts.length ? parts.join(' · ') : '—';
  }

  /* ── preview ── */
  window.setPreviewPlatform = function(p){ previewPlatform = p; render(); };

  function buildPreview(){
    const active = sections.filter(s => s.isActive !== false && (!s.platform || s.platform === previewPlatform));
    if(!active.length) return '<p style="text-align:center;color:#999;padding:40px 12px;font-size:13px">No active sections for this platform</p>';

    return active.map(s => {
      const d = s.data || {};
      const typeInfo = SECTION_TYPES.find(t=>t.value===s.type) || {};
      const colors = { product:'#7C3AED', banner:'#2196F3', promo:'#E91E63' };
      const accent = colors[typeInfo.group] || '#666';

      // Banner sections
      if(s.type === 'banner_carousel' || s.type === 'custom_banner'){
        const placement = d.placement || 'home_top';
        const isSquare = placement === 'home_square';
        const h = isSquare ? 100 : 140;
        const customBanners = Array.isArray(d.banners) ? d.banners.filter(b => b.image) : [];
        if(customBanners.length){
          const items = customBanners.slice(0, s.type === 'custom_banner' ? 1 : 5).map((b) => {
            const src = String(b.image).startsWith('http') ? b.image : CONFIG.UPLOADS_BASE + b.image;
            return `<div style="min-width:${s.type==='custom_banner'?'100%':'65%'};height:${h}px;border-radius:10px;overflow:hidden;background:#eee;border:1px solid #ddd"><img src="${src}" style="width:100%;height:100%;object-fit:cover"></div>`;
          }).join('');
          return `
            <div style="margin-bottom:8px;border-radius:12px;overflow:hidden;background:#fff;border:1px solid #e8e8e8;padding:6px">
              <div style="display:flex;gap:6px;overflow-x:auto">${items}</div>
              <div style="font-size:9px;color:#888;padding:4px 2px 0">custom upload · ${customBanners.length} banner(s)</div>
            </div>`;
        }
        return `
          <div style="margin-bottom:8px;border-radius:12px;overflow:hidden;background:linear-gradient(135deg,${accent}22,${accent}08);height:${h}px;display:flex;align-items:center;justify-content:center;border:1px dashed ${accent}44;position:relative">
            <div style="text-align:center">
              <div style="font-size:20px">${typeInfo.icon||'🖼️'}</div>
              <div style="font-size:10px;font-weight:600;color:${accent};margin-top:4px">${esc(s.title||typeInfo.label)}</div>
              <div style="font-size:9px;color:#999;margin-top:2px">${placement}</div>
            </div>
          </div>`;
      }

      // Promo sections
      if(s.type === 'promo_section'){
        const bgImg = d.bgImage ? (d.bgImage.startsWith('http') ? d.bgImage : CONFIG.UPLOADS_BASE + d.bgImage) : '';
        const bgCol = d.bgColor || '#E3F2FD';
        const pos = d.cardPosition || 'bottom';
        const cards = d.cards || [];
        const justify = pos === 'top' ? 'flex-start' : pos === 'middle' ? 'center' : 'flex-end';
        let cardsHtml = cards.map(c => `
          <div style="min-width:60px;width:60px;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.12)">
            <div style="height:80px;background:#f5f5f5;display:flex;align-items:center;justify-content:center">
              ${c.image ? `<img src="${c.image.startsWith('http') ? c.image : CONFIG.UPLOADS_BASE+c.image}" style="width:100%;height:100%;object-fit:cover">` : '<div style="width:14px;height:14px;background:#ddd;border-radius:3px"></div>'}
            </div>
          </div>
        `).join('');
        return `
          <div style="margin-bottom:8px;border-radius:12px;overflow:hidden;position:relative;min-height:160px;${bgImg ? `background:url(${bgImg}) center/cover` : `background:${bgCol}`};display:flex;flex-direction:column;justify-content:${justify};padding:10px 8px">
            <div style="display:flex;gap:6px;overflow-x:auto;padding:4px 0">${cardsHtml}</div>
          </div>`;
      }

      // Product sections
      const layout = d.layout || 'horizontal';
      const cols = d.columns || 3;
      const cardStyle = d.cardStyle || 'default';
      const bg = d.bgColor || '#ffffff';
      const showTitle = d.showTitle !== false;
      const showSeeAll = d.showSeeAll !== false;
      const catName = d.categoryName || '';
      const limit = d.limit || 10;

      let titleHtml = '';
      if(showTitle && s.title){
        titleHtml = `<div style="font-size:12px;font-weight:700;color:#1a1a1a;padding:6px 8px 4px">${esc(s.title)}</div>`;
      }

      // Card mock
      const cardH = cardStyle === 'big_image' ? 80 : cardStyle === 'compact' ? 50 : cardStyle === 'minimal' ? 55 : 65;
      const cardW = layout === 'horizontal' ? (d.itemWidth ? Math.min(d.itemWidth / 2.5, 80) : 65) : 'auto';

      let itemsHtml = '';
      const mockCount = Math.min(limit, layout === 'horizontal' ? 5 : cols * 2);

      if(layout === 'horizontal'){
        let cards = '';
        for(let i=0; i<mockCount; i++){
          cards += `
            <div style="min-width:${cardW}px;width:${cardW}px;background:#f5f5f5;border-radius:8px;margin-right:6px;overflow:hidden;border:1px solid #eee">
              <div style="height:${cardH * 0.55}px;background:#eaeaea;display:flex;align-items:center;justify-content:center">
                <div style="width:16px;height:16px;border-radius:4px;background:#ddd"></div>
              </div>
              ${cardStyle !== 'minimal' ? `
                <div style="padding:3px 4px">
                  <div style="height:4px;background:#ddd;border-radius:2px;width:80%;margin-bottom:3px"></div>
                  <div style="height:4px;background:#e0e0e0;border-radius:2px;width:50%"></div>
                </div>
              ` : ''}
            </div>`;
        }
        itemsHtml = `<div style="display:flex;overflow-x:auto;padding:4px 8px;gap:0">${cards}</div>`;
      } else {
        let cards = '';
        for(let i=0; i<mockCount; i++){
          cards += `
            <div style="background:#f5f5f5;border-radius:8px;overflow:hidden;border:1px solid #eee">
              <div style="height:${cardH * 0.55}px;background:#eaeaea;display:flex;align-items:center;justify-content:center">
                <div style="width:16px;height:16px;border-radius:4px;background:#ddd"></div>
              </div>
              ${cardStyle !== 'minimal' ? `
                <div style="padding:3px 4px">
                  <div style="height:4px;background:#ddd;border-radius:2px;width:80%;margin-bottom:3px"></div>
                  <div style="height:4px;background:#e0e0e0;border-radius:2px;width:50%"></div>
                </div>
              ` : ''}
            </div>`;
        }
        itemsHtml = `<div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:6px;padding:4px 8px">${cards}</div>`;
      }

      let seeAllHtml = '';
      if(showSeeAll && catName){
        seeAllHtml = `
          <div style="display:flex;justify-content:center;padding:6px 8px">
            <div style="display:inline-flex;align-items:center;gap:6px;background:#f3f3f3;border:1px solid #e0e0e0;border-radius:16px;padding:5px 10px">
              <div style="display:flex">
                <div style="width:18px;height:18px;border-radius:50%;background:#ddd;border:1.5px solid #fff"></div>
                <div style="width:18px;height:18px;border-radius:50%;background:#ccc;border:1.5px solid #fff;margin-left:-6px"></div>
                <div style="width:18px;height:18px;border-radius:50%;background:#bbb;border:1.5px solid #fff;margin-left:-6px"></div>
              </div>
              <span style="font-size:9px;font-weight:600;color:#666">see all</span>
            </div>
          </div>`;
      }

      // Type label at bottom
      const typeLabel = `<div style="font-size:8px;color:${accent};font-weight:600;padding:0 8px 4px;opacity:.6">${typeInfo.icon} ${typeInfo.label}</div>`;

      return `
        <div style="background:${bg};margin-bottom:8px;border-radius:10px;overflow:hidden;border:1px solid #f0f0f0">
          ${titleHtml}
          ${itemsHtml}
          ${seeAllHtml}
          ${typeLabel}
        </div>`;
    }).join('');
  }

  /* ── render ── */
  function render(){
    main.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div>
          <h2 style="margin:0;font-size:1.2rem;font-weight:700">Home Sections</h2>
          <p style="margin:4px 0 0;font-size:12px;color:var(--text-light)">Server-driven UI — changes reflect in app without update</p>
        </div>
        <button class="btn btn-primary" onclick="openAdd()">+ Add Section</button>
      </div>

      <div class="card" style="overflow:auto">
        <table class="table" id="secTable">
          <thead><tr>
            <th style="width:60px">Order</th>
            <th>Type</th>
            <th>Platform</th>
            <th>Title</th>
            <th>Style</th>
            <th style="width:60px">Active</th>
            <th style="width:200px">Actions</th>
          </tr></thead>
          <tbody>${sections.length ? sections.map((s,i)=>{
            return `
            <tr data-id="${s._id}">
              <td>
                <div style="display:flex;flex-direction:column;gap:2px;align-items:center">
                  ${i>0?`<button class="btn btn-sm" style="padding:0 6px;font-size:.65rem;line-height:1" onclick="move('${s._id}',-1)">▲</button>`:''}
                  <span style="font-weight:600;font-size:13px">${s.sortOrder ?? i}</span>
                  ${i<sections.length-1?`<button class="btn btn-sm" style="padding:0 6px;font-size:.65rem;line-height:1" onclick="move('${s._id}',1)">▼</button>`:''}
                </div>
              </td>
              <td>${typeBadge(s.type)}</td>
              <td><span class="badge ${s.platform==='ddgo'?'badge-success':'badge-primary'}" style="font-size:11px">${s.platform||'ddgo'}</span></td>
              <td style="font-weight:600">${esc(s.title||'—')}</td>
              <td style="font-size:12px">${stylePreview(s.data)}</td>
              <td>${s.isActive!==false ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-gray">No</span>'}</td>
              <td>
                <div style="display:flex;gap:4px;flex-wrap:wrap">
                  <button class="btn btn-sm" onclick="openEdit('${s._id}')" style="font-size:11px">✏️ Edit</button>
                  <button class="btn btn-sm btn-outline" onclick="duplicateSec('${s._id}')" style="font-size:11px">📋</button>
                  <button class="btn btn-sm ${s.isActive!==false?'btn-warning':'btn-primary'}" onclick="toggleActive('${s._id}',${s.isActive!==false})" style="font-size:11px">${s.isActive!==false?'Disable':'Enable'}</button>
                  <button class="btn btn-sm btn-danger" onclick="removeSec('${s._id}')" style="font-size:11px">🗑️</button>
                </div>
              </td>
            </tr>`;
          }).join('') : '<tr><td colspan="7" class="empty-state">No sections configured. Click + Add Section to get started.</td></tr>'}
          </tbody>
        </table>
      </div>

      <!-- ─── HOME PAGE PREVIEW ─── -->
      <div style="margin-top:24px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <h3 style="margin:0;font-size:1rem;font-weight:700">📱 Home Page Preview</h3>
          <div style="display:flex;gap:8px">
            <button class="btn btn-sm ${previewPlatform==='damndeal'?'btn-primary':'btn-outline'}" onclick="setPreviewPlatform('damndeal')" style="font-size:11px">Online Store</button>
            <button class="btn btn-sm ${previewPlatform==='ddgo'?'btn-primary':'btn-outline'}" onclick="setPreviewPlatform('ddgo')" style="font-size:11px">Quick Commerce</button>
          </div>
        </div>
        <div style="max-width:375px;margin:0 auto;background:#f8f8f8;border-radius:24px;border:2px solid #ddd;padding:12px 0;min-height:500px;box-shadow:0 4px 20px rgba(0,0,0,.1)">
          <!-- Phone frame -->
          <div style="width:40px;height:5px;background:#ddd;border-radius:3px;margin:0 auto 12px"></div>
          <div style="overflow-y:auto;max-height:600px;padding:0 8px" id="previewContainer">
            ${buildPreview()}
          </div>
          <div style="width:60px;height:5px;background:#ddd;border-radius:3px;margin:12px auto 0"></div>
        </div>
      </div>

      <!-- ─── MODAL ─── -->
      <div class="modal-overlay" id="modal">
        <div class="modal" style="width:600px;max-height:90vh;overflow-y:auto">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
            <h3 id="modalTitle" style="margin:0">Add Section</h3>
            <button class="btn btn-sm" onclick="closeModal('modal')" style="font-size:18px;padding:0 8px">×</button>
          </div>

          <!-- Basic Info -->
          <fieldset style="border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:12px">
            <legend style="font-size:12px;font-weight:700;color:var(--text-light);padding:0 6px">BASIC INFO</legend>
            <div class="form-row">
              <div class="form-group">
                <label>Section Type</label>
                <select class="form-control" id="fType" onchange="onTypeChange()">
                  <optgroup label="Product Sections">
                    ${SECTION_TYPES.filter(t=>t.group==='product').map(t=>`<option value="${t.value}">${t.icon} ${t.label}</option>`).join('')}
                  </optgroup>
                  <optgroup label="Promo Sections">
                    ${SECTION_TYPES.filter(t=>t.group==='promo').map(t=>`<option value="${t.value}">${t.icon} ${t.label}</option>`).join('')}
                  </optgroup>
                  <optgroup label="Banner Sections">
                    ${SECTION_TYPES.filter(t=>t.group==='banner').map(t=>`<option value="${t.value}">${t.icon} ${t.label}</option>`).join('')}
                  </optgroup>
                </select>
              </div>
              <div class="form-group">
                <label>Platform</label>
                <select class="form-control" id="fPlatform">
                  <option value="damndeal">Online Store</option>
                  <option value="ddgo">Quick Commerce</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group" style="flex:2">
                <label>Title <small style="color:var(--text-light)">(shown in app)</small></label>
                <input class="form-control" id="fTitle" placeholder="e.g. Fresh Vegetables, Today's Deals">
              </div>
              <div class="form-group" style="flex:1">
                <label>Sort Order</label>
                <input class="form-control" id="fSort" type="number" value="0" min="0">
              </div>
            </div>
          </fieldset>

          <!-- Data Source -->
          <fieldset id="sourceGroup" style="border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:12px">
            <legend style="font-size:12px;font-weight:700;color:var(--text-light);padding:0 6px">DATA SOURCE</legend>
            <div class="form-group" id="catGroup">
              <label>Category</label>
              <select class="form-control" id="fCategory">
                <option value="">— All Products (no filter) —</option>
                ${categories.map(c=>`<option value="${c._id}">${esc(c.name)} (${c.platform||'ddgo'})</option>`).join('')}
              </select>
            </div>
            <div class="form-row">
              <div class="form-group" id="limitGroup">
                <label>Product Limit</label>
                <input class="form-control" id="fLimit" type="number" value="10" min="1" max="50">
              </div>
              <div class="form-group" id="sortByGroup">
                <label>Sort By</label>
                <select class="form-control" id="fSortBy">
                  ${SORT_OPTIONS.map(o=>`<option value="${o.value}">${o.label}</option>`).join('')}
                </select>
              </div>
              <div class="form-group" id="sortDirGroup">
                <label>Direction</label>
                <select class="form-control" id="fSortDir">
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </div>
            </div>
          </fieldset>

          <!-- Style Config -->
          <fieldset id="styleGroup" style="border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:12px">
            <legend style="font-size:12px;font-weight:700;color:var(--text-light);padding:0 6px">STYLE & LAYOUT</legend>
            <div class="form-row">
              <div class="form-group" id="layoutGroup">
                <label>Layout</label>
                <select class="form-control" id="fLayout">
                  <option value="horizontal">Horizontal Scroll</option>
                  <option value="grid">Grid</option>
                  <option value="list">List</option>
                </select>
              </div>
              <div class="form-group" id="columnsGroup">
                <label>Grid Columns</label>
                <select class="form-control" id="fColumns">
                  <option value="2">2 Columns</option>
                  <option value="3" selected>3 Columns</option>
                  <option value="4">4 Columns</option>
                  <option value="5">5 Columns</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group" id="cardStyleGroup">
                <label>Card Style</label>
                <select class="form-control" id="fCardStyle">
                  <option value="default">Default (Image + Name + Price)</option>
                  <option value="compact">Compact (Small card)</option>
                  <option value="minimal">Minimal (Image only)</option>
                  <option value="big_image">Big Image</option>
                </select>
              </div>
              <div class="form-group" id="bgColorGroup">
                <label>Background Color</label>
                <div style="display:flex;gap:6px;align-items:center">
                  <input class="form-control" id="fBgColor" type="color" value="#ffffff" style="width:50px;height:34px;padding:2px;cursor:pointer">
                  <input class="form-control" id="fBgColorHex" placeholder="#ffffff" style="flex:1;font-family:monospace;font-size:12px">
                </div>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group" id="itemWidthGroup">
                <label>Item Width <small style="color:var(--text-light)">(horizontal)</small></label>
                <input class="form-control" id="fItemWidth" type="number" value="140" min="80" max="300" step="10">
              </div>
              <div class="form-group" id="itemHeightGroup">
                <label>Section Height <small style="color:var(--text-light)">(horizontal)</small></label>
                <input class="form-control" id="fItemHeight" type="number" value="220" min="150" max="400" step="10">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label><input type="checkbox" id="fShowTitle" checked> Show Section Title</label>
              </div>
              <div class="form-group" id="seeAllGroup">
                <label><input type="checkbox" id="fShowSeeAll" checked> Show "See All" Button</label>
              </div>
            </div>
          </fieldset>

          <!-- Banner Config -->
          <fieldset id="bannerGroup" style="border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:12px;display:none">
            <legend style="font-size:12px;font-weight:700;color:var(--text-light);padding:0 6px">BANNER CONFIG</legend>
            <div class="form-group" style="margin-bottom:10px">
              <label>Banner Source</label>
              <select class="form-control" id="fBannerSource" onchange="onBannerSourceModeChange()">
                <option value="custom">Upload in this layout (recommended)</option>
                <option value="placement">Use existing Banner Manager placement</option>
              </select>
            </div>

            <div class="form-group">
              <label>Banner Placement</label>
              <select class="form-control" id="fPlacement">
                <option value="home_top">Home Top (Main Carousel)</option>
                <option value="home_middle">Home Middle</option>
                <option value="home_bottom">Home Bottom</option>
                <option value="home_square">Home Square</option>
                <option value="category_page">Category Page</option>
                <option value="partner_page">Partner Page</option>
              </select>
              <small style="color:var(--text-light);margin-top:4px;display:block">Placement mode pulls from Banner Manager. Custom mode uploads directly here.</small>
            </div>

            <div id="bannerUploadGroup" style="display:none;margin-top:10px">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <label style="font-weight:600;font-size:13px;margin:0">Layout Banners</label>
                <button class="btn btn-sm btn-primary" type="button" onclick="addBannerItem()" style="font-size:11px">+ Add Banner</button>
              </div>
              <div id="bannerItems" style="display:flex;flex-direction:column;gap:8px"></div>
              <small style="color:var(--text-light);display:block;margin-top:6px">Upload banner image, choose link type and target value. No need to pre-create in Banners page.</small>
            </div>
          </fieldset>

          <!-- Promo Section Config -->
          <fieldset id="promoGroup" style="border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:12px;display:none">
            <legend style="font-size:12px;font-weight:700;color:var(--text-light);padding:0 6px">🎯 PROMO CONFIG</legend>

            <!-- Background -->
            <div class="form-row" style="margin-bottom:12px">
              <div class="form-group" style="flex:2">
                <label>Background Image</label>
                <input type="file" class="form-control" id="fPromoBg" accept="image/*" onchange="previewPromoBg(this)">
                <div id="promoBgPreview" style="margin-top:6px;border-radius:8px;overflow:hidden"></div>
              </div>
              <div class="form-group" style="flex:1">
                <label>Or Background Color</label>
                <div style="display:flex;gap:6px;align-items:center">
                  <input class="form-control" id="fPromoBgColor" type="color" value="#E3F2FD" style="width:50px;height:34px;padding:2px;cursor:pointer">
                  <input class="form-control" id="fPromoBgColorHex" placeholder="#E3F2FD" style="flex:1;font-family:monospace;font-size:12px">
                </div>
              </div>
            </div>

            <!-- Card Position -->
            <div class="form-group" style="margin-bottom:12px">
              <label>Cards Position on Background</label>
              <select class="form-control" id="fCardPosition">
                <option value="top">Top</option>
                <option value="middle">Middle (vertically centered)</option>
                <option value="bottom" selected>Bottom</option>
              </select>
            </div>

            <!-- Cards List -->
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <label style="font-weight:600;font-size:13px">Promo Cards</label>
              <button class="btn btn-sm btn-primary" type="button" onclick="addPromoCard()" style="font-size:11px">+ Add Card</button>
            </div>
            <div id="promoCards" style="display:flex;flex-direction:column;gap:8px"></div>
          </fieldset>

          <div class="form-group">
            <label><input type="checkbox" id="fActive" checked> Active</label>
          </div>

          <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:16px">
            <button class="btn" onclick="closeModal('modal')">Cancel</button>
            <button class="btn btn-primary" onclick="save()">💾 Save Section</button>
          </div>
        </div>
      </div>`;

    // sync color inputs
    const cp = document.getElementById('fBgColor');
    const ch = document.getElementById('fBgColorHex');
    if(cp && ch){
      cp.addEventListener('input', ()=>{ ch.value = cp.value; });
      ch.addEventListener('input', ()=>{ if(/^#[0-9a-f]{6}$/i.test(ch.value)) cp.value = ch.value; });
    }
    const pcp = document.getElementById('fPromoBgColor');
    const pch = document.getElementById('fPromoBgColorHex');
    if(pcp && pch){
      pcp.addEventListener('input', ()=>{ pch.value = pcp.value; });
      pch.addEventListener('input', ()=>{ if(/^#[0-9a-f]{6}$/i.test(pch.value)) pcp.value = pch.value; });
    }
  }

  /* ── type-dependent visibility ── */
  window.onTypeChange = function(){
    const t = document.getElementById('fType').value;
    const isProduct = ['category_grid','category_section','horizontal_products','grid_products','popular_products','deal_of_day'].includes(t);
    const isBanner = ['banner_carousel','custom_banner'].includes(t);
    const isPromo = t === 'promo_section';
    const isGrid = ['category_grid','grid_products','category_section'].includes(t);
    const isHorz = ['horizontal_products','popular_products','deal_of_day'].includes(t);
    const needsCat = ['category_section','horizontal_products','grid_products','popular_products','deal_of_day'].includes(t);

    document.getElementById('sourceGroup').style.display = isProduct ? '' : 'none';
    document.getElementById('styleGroup').style.display = isProduct ? '' : 'none';
    document.getElementById('bannerGroup').style.display = isBanner ? '' : 'none';
    document.getElementById('promoGroup').style.display = isPromo ? '' : 'none';

    document.getElementById('catGroup').style.display = needsCat ? '' : 'none';
    document.getElementById('sortByGroup').style.display = needsCat ? '' : 'none';
    document.getElementById('sortDirGroup').style.display = needsCat ? '' : 'none';

    // layout defaults
    const layoutEl = document.getElementById('fLayout');
    if(isHorz) layoutEl.value = 'horizontal';
    if(isGrid) layoutEl.value = 'grid';

    document.getElementById('columnsGroup').style.display = layoutEl.value === 'grid' ? '' : 'none';
    document.getElementById('itemWidthGroup').style.display = layoutEl.value === 'horizontal' ? '' : 'none';
    document.getElementById('itemHeightGroup').style.display = layoutEl.value === 'horizontal' ? '' : 'none';

    // seeAll only for category-linked sections
    document.getElementById('seeAllGroup').style.display = needsCat ? '' : 'none';

    if(isBanner) onBannerSourceModeChange();
  };

  /* ── promo card management ── */
  window.promoCards = []; // exposed on window for inline HTML handlers

  window.previewPromoBg = function(input){
    const preview = document.getElementById('promoBgPreview');
    if(input.files[0]){
      const url = URL.createObjectURL(input.files[0]);
      preview.innerHTML = `<img src="${url}" style="width:100%;max-height:120px;object-fit:cover;border-radius:8px">`;
    } else { preview.innerHTML = ''; }
  };

  window.addPromoCard = function(){
    promoCards.push({ image: null, categoryId: '', _newFile: null });
    renderPromoCards();
  };

  window.removePromoCard = function(idx){
    promoCards.splice(idx, 1);
    renderPromoCards();
  };

  window.movePromoCard = function(idx, dir){
    const newIdx = idx + dir;
    if(newIdx < 0 || newIdx >= promoCards.length) return;
    [promoCards[idx], promoCards[newIdx]] = [promoCards[newIdx], promoCards[idx]];
    renderPromoCards();
  };

  window.onPromoCardImage = function(idx, input){
    if(input.files[0]){
      promoCards[idx]._newFile = input.files[0];
      promoCards[idx]._previewUrl = URL.createObjectURL(input.files[0]);
      renderPromoCards();
    }
  };

  // ── banner upload management ─────────────────────────────────────────────
  let bannerItems = []; // [{title, image, linkType, linkValue, link, _newFile, _previewUrl}]

  window.addBannerItem = function(){
    bannerItems.push({ title: '', image: null, linkType: 'url', linkValue: '', link: '', _newFile: null });
    renderBannerItems();
  };

  window.removeBannerItem = function(idx){
    bannerItems.splice(idx, 1);
    renderBannerItems();
  };

  window.moveBannerItem = function(idx, dir){
    const newIdx = idx + dir;
    if(newIdx < 0 || newIdx >= bannerItems.length) return;
    [bannerItems[idx], bannerItems[newIdx]] = [bannerItems[newIdx], bannerItems[idx]];
    renderBannerItems();
  };

  window.onBannerItemImage = function(idx, input){
    if(input.files[0]){
      bannerItems[idx]._newFile = input.files[0];
      bannerItems[idx]._previewUrl = URL.createObjectURL(input.files[0]);
      renderBannerItems();
    }
  };

  window.onBannerSourceModeChange = function(){
    const mode = document.getElementById('fBannerSource')?.value || 'custom';
    const placementWrap = document.getElementById('fPlacement')?.closest('.form-group');
    const uploadWrap = document.getElementById('bannerUploadGroup');
    if(placementWrap) placementWrap.style.display = mode === 'placement' ? '' : 'none';
    if(uploadWrap) uploadWrap.style.display = mode === 'custom' ? '' : 'none';
  };

  window.renderBannerItems = function(){
    const container = document.getElementById('bannerItems');
    if(!container) return;
    container.innerHTML = bannerItems.map((b, i) => {
      const imgPreview = b._previewUrl || (b.image ? (String(b.image).startsWith('http') ? b.image : CONFIG.UPLOADS_BASE + b.image) : '');
      return `
        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px;background:#fafafa;display:flex;gap:10px;align-items:flex-start">
          <div style="min-width:100px;text-align:center">
            <div style="width:100px;height:70px;border-radius:8px;overflow:hidden;background:#eee;display:flex;align-items:center;justify-content:center;margin-bottom:4px;cursor:pointer" onclick="document.getElementById('bannerFile${i}').click()">
              ${imgPreview ? `<img src="${esc(imgPreview)}" style="width:100%;height:100%;object-fit:cover">` : '<span style="font-size:20px;color:#bbb">🖼️</span>'}
            </div>
            <input type="file" id="bannerFile${i}" accept="image/*" style="display:none" onchange="onBannerItemImage(${i},this)">
            <span style="font-size:9px;color:#999">click to upload</span>
          </div>

          <div style="flex:1;display:flex;flex-direction:column;gap:6px">
            <input class="form-control" style="font-size:12px" placeholder="Banner title (optional)" value="${esc(b.title || '')}" onchange="bannerItems[${i}].title=this.value">
            <div style="display:grid;grid-template-columns:120px 1fr;gap:6px">
              <select class="form-control" style="font-size:12px" onchange="bannerItems[${i}].linkType=this.value">
                <option value="url" ${b.linkType==='url'?'selected':''}>URL</option>
                <option value="category" ${b.linkType==='category'?'selected':''}>Category ID</option>
                <option value="subcategory" ${b.linkType==='subcategory'?'selected':''}>SubCategory ID</option>
                <option value="product" ${b.linkType==='product'?'selected':''}>Product ID</option>
              </select>
              <input class="form-control" style="font-size:12px" placeholder="Link / ID value" value="${esc(b.linkValue || b.link || '')}" onchange="bannerItems[${i}].linkValue=this.value;bannerItems[${i}].link=this.value">
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:3px;min-width:28px">
            ${i>0?`<button class="btn btn-sm" onclick="moveBannerItem(${i},-1)" style="padding:1px 6px;font-size:10px">▲</button>`:''}
            ${i<bannerItems.length-1?`<button class="btn btn-sm" onclick="moveBannerItem(${i},1)" style="padding:1px 6px;font-size:10px">▼</button>`:''}
            <button class="btn btn-sm btn-danger" onclick="removeBannerItem(${i})" style="padding:1px 6px;font-size:10px">✕</button>
          </div>
        </div>`;
    }).join('');
  };

  window.renderPromoCards = function(){
    const container = document.getElementById('promoCards');
    if(!container) return;
    container.innerHTML = promoCards.map((c, i) => {
      const imgPreview = c._previewUrl || (c.image ? (c.image.startsWith('http') ? c.image : CONFIG.UPLOADS_BASE + c.image) : '');
      return `
        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px;background:#fafafa;display:flex;gap:10px;align-items:flex-start">
          <!-- Image -->
          <div style="min-width:80px;text-align:center">
            <div style="width:80px;height:70px;border-radius:8px;overflow:hidden;background:#eee;display:flex;align-items:center;justify-content:center;margin-bottom:4px;cursor:pointer" onclick="document.getElementById('promoCardFile${i}').click()">
              ${imgPreview ? `<img src="${esc(imgPreview)}" style="width:100%;height:100%;object-fit:cover">` : '<span style="font-size:20px;color:#bbb">📷</span>'}
            </div>
            <input type="file" id="promoCardFile${i}" accept="image/*" style="display:none" onchange="onPromoCardImage(${i},this)">
            <span style="font-size:9px;color:#999">click to upload</span>
          </div>
          <!-- Fields -->
          <div style="flex:1;display:flex;flex-direction:column;gap:6px">
            <select class="form-control" style="font-size:12px" onchange="promoCards[${i}].categoryId=this.value">
              <option value="">— Link to Category —</option>
              ${categories.map(cat=>`<option value="${cat._id}" ${c.categoryId===cat._id?'selected':''}>${esc(cat.name)} (${cat.platform||'ddgo'})</option>`).join('')}
            </select>
          </div>
          <!-- Controls -->
          <div style="display:flex;flex-direction:column;gap:3px;min-width:28px">
            ${i>0?`<button class="btn btn-sm" onclick="movePromoCard(${i},-1)" style="padding:1px 6px;font-size:10px">▲</button>`:''}
            ${i<promoCards.length-1?`<button class="btn btn-sm" onclick="movePromoCard(${i},1)" style="padding:1px 6px;font-size:10px">▼</button>`:''}
            <button class="btn btn-sm btn-danger" onclick="removePromoCard(${i})" style="padding:1px 6px;font-size:10px">✕</button>
          </div>
        </div>`;
    }).join('');
  };

  /* ── load ── */
  async function load(){
    try{
      const [secRes, catRes] = await Promise.all([
        API.get('/admin/home-sections'),
        API.get('/admin/categories'),
      ]);
      sections = secRes.data || secRes.sections || secRes || [];
      if(!Array.isArray(sections)) sections = [];
      sections.sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));

      categories = catRes.data || catRes.categories || catRes || [];
      if(!Array.isArray(categories)) categories = [];
    }catch(e){ sections=[]; categories=[]; showToast(e.message,'error'); }
    render();
  }

  /* ── populate form from data ── */
  function setFormData(data){
    if(!data) return;
    if(data.sourceMode) document.getElementById('fBannerSource').value = data.sourceMode;
    if(data.placement) document.getElementById('fPlacement').value = data.placement;
    if(Array.isArray(data.banners)) {
      bannerItems = data.banners.map(b => ({ ...b, _newFile: null }));
      renderBannerItems();
    }
    if(data.layout) document.getElementById('fLayout').value = data.layout;
    if(data.columns) document.getElementById('fColumns').value = data.columns;
    if(data.cardStyle) document.getElementById('fCardStyle').value = data.cardStyle;
    if(data.bgColor){
      document.getElementById('fBgColor').value = data.bgColor;
      document.getElementById('fBgColorHex').value = data.bgColor;
    }
    if(data.itemWidth) document.getElementById('fItemWidth').value = data.itemWidth;
    if(data.itemHeight) document.getElementById('fItemHeight').value = data.itemHeight;
    if(data.showTitle === false) document.getElementById('fShowTitle').checked = false;
    if(data.showSeeAll === false) document.getElementById('fShowSeeAll').checked = false;
    if(data.sortBy) document.getElementById('fSortBy').value = data.sortBy;
    if(data.sortDir) document.getElementById('fSortDir').value = data.sortDir;
    if(data.limit) document.getElementById('fLimit').value = data.limit;
    if(data.categoryId) document.getElementById('fCategory').value = data.categoryId;
    else if(data.linkValue) document.getElementById('fCategory').value = data.linkValue;
    onBannerSourceModeChange();
  }

  /* ── collect form → data object ── */
  function getFormData(){
    const type = document.getElementById('fType').value;
    const isBanner = ['banner_carousel','custom_banner'].includes(type);

    if(isBanner){
      return { placement: document.getElementById('fPlacement').value };
    }

    const data = {};
    const catId = document.getElementById('fCategory').value;
    const layout = document.getElementById('fLayout').value;

    if(catId) { data.categoryId = catId; data.linkType = 'category'; data.linkValue = catId; }
    data.limit = parseInt(document.getElementById('fLimit').value)||10;
    data.layout = layout;
    data.sortBy = document.getElementById('fSortBy').value;
    data.sortDir = document.getElementById('fSortDir').value;

    if(layout === 'grid'){
      data.columns = parseInt(document.getElementById('fColumns').value)||3;
    } else {
      data.itemWidth = parseInt(document.getElementById('fItemWidth').value)||140;
      data.itemHeight = parseInt(document.getElementById('fItemHeight').value)||220;
    }

    data.cardStyle = document.getElementById('fCardStyle').value;

    const bgHex = document.getElementById('fBgColorHex').value || document.getElementById('fBgColor').value;
    if(bgHex && bgHex !== '#ffffff') data.bgColor = bgHex;

    data.showTitle = document.getElementById('fShowTitle').checked;
    data.showSeeAll = document.getElementById('fShowSeeAll').checked;

    return data;
  }

  /* ── add / edit ── */
  let editId = null;

  window.openAdd = function(){
    editId = null;
    render();
    document.getElementById('modalTitle').textContent='Add Section';
    document.getElementById('fType').value='category_section';
    document.getElementById('fPlatform').value='damndeal';
    document.getElementById('fSort').value = sections.length;
    document.getElementById('fTitle').value='';
    document.getElementById('fActive').checked=true;
    // defaults
    document.getElementById('fLimit').value='10';
    document.getElementById('fCategory').value='';
    document.getElementById('fLayout').value='horizontal';
    document.getElementById('fColumns').value='3';
    document.getElementById('fCardStyle').value='default';
    document.getElementById('fBgColor').value='#ffffff';
    document.getElementById('fBgColorHex').value='';
    document.getElementById('fItemWidth').value='140';
    document.getElementById('fItemHeight').value='220';
    document.getElementById('fShowTitle').checked=true;
    document.getElementById('fShowSeeAll').checked=true;
    document.getElementById('fSortBy').value='createdAt';
    document.getElementById('fSortDir').value='desc';
    document.getElementById('fPlacement').value='home_top';
    document.getElementById('fBannerSource').value='custom';
    bannerItems = [];
    renderBannerItems();
    // Reset promo
    promoCards = [];
    document.getElementById('fPromoBgColor').value='#E3F2FD';
    document.getElementById('fPromoBgColorHex').value='';
    document.getElementById('fCardPosition').value='bottom';
    document.getElementById('fPromoBg').value='';
    document.getElementById('promoBgPreview').innerHTML='';
    renderPromoCards();
    onTypeChange();
    openModal('modal');
  };

  window.openEdit = function(id){
    const s = sections.find(x=>x._id===id);
    if(!s) return;
    editId = id;
    render();
    document.getElementById('modalTitle').textContent='Edit Section';
    document.getElementById('fType').value = s.type||'category_section';
    document.getElementById('fPlatform').value = s.platform||'ddgo';
    document.getElementById('fSort').value = s.sortOrder||0;
    document.getElementById('fTitle').value = s.title||'';
    document.getElementById('fActive').checked = s.isActive!==false;
    document.getElementById('fPlacement').value = s.data?.placement || 'home_top';
    // reset defaults then override with saved data
    document.getElementById('fLimit').value='10';
    document.getElementById('fCategory').value='';
    document.getElementById('fLayout').value='horizontal';
    document.getElementById('fColumns').value='3';
    document.getElementById('fCardStyle').value='default';
    document.getElementById('fBgColor').value='#ffffff';
    document.getElementById('fBgColorHex').value='';
    document.getElementById('fItemWidth').value='140';
    document.getElementById('fItemHeight').value='220';
    document.getElementById('fShowTitle').checked=true;
    document.getElementById('fShowSeeAll').checked=true;
    document.getElementById('fSortBy').value='createdAt';
    document.getElementById('fSortDir').value='desc';
    document.getElementById('fBannerSource').value = s.data?.sourceMode || 'placement';
    bannerItems = Array.isArray(s.data?.banners) ? s.data.banners.map(b => ({ ...b, _newFile: null })) : [];
    renderBannerItems();
    // Promo data
    promoCards = (s.data?.cards || []).map(c => ({...c}));
    document.getElementById('fPromoBgColor').value = s.data?.bgColor || '#E3F2FD';
    document.getElementById('fPromoBgColorHex').value = s.data?.bgColor || '';
    document.getElementById('fCardPosition').value = s.data?.cardPosition || 'bottom';
    document.getElementById('fPromoBg').value = '';
    const bgImg = s.data?.bgImage;
    document.getElementById('promoBgPreview').innerHTML = bgImg
      ? `<img src="${bgImg.startsWith('http') ? bgImg : CONFIG.UPLOADS_BASE + bgImg}" style="width:100%;max-height:120px;object-fit:cover;border-radius:8px">`
      : '';
    renderPromoCards();
    setFormData(s.data);
    onTypeChange();
    openModal('modal');
  };

  window.save = async function(){
    const type = document.getElementById('fType').value;
    const platform = document.getElementById('fPlatform').value;
    const sortOrder = parseInt(document.getElementById('fSort').value)||0;
    const title = document.getElementById('fTitle').value.trim();
    const isActive = document.getElementById('fActive').checked;

    if(!title){ showToast('Title is required','error'); return; }

    // ── Banner section — direct layout upload support ──
    if(['banner_carousel','custom_banner'].includes(type)){
      const sourceMode = document.getElementById('fBannerSource').value || 'custom';
      if(sourceMode === 'custom' && !bannerItems.length){
        showToast('Add at least one banner item','error');
        return;
      }

      const fd = new FormData();
      fd.append('title', title);
      fd.append('type', type);
      fd.append('platform', platform);
      fd.append('sortOrder', sortOrder);
      fd.append('isActive', isActive);
      fd.append('sourceMode', sourceMode);
      fd.append('placement', document.getElementById('fPlacement').value || 'home_top');
      if(editId) fd.append('editId', editId);

      const payloadBanners = bannerItems.map((b) => {
        const item = {
          title: b.title || '',
          linkType: b.linkType || 'url',
          linkValue: b.linkValue || b.link || '',
          link: b.link || b.linkValue || '',
          image: b.image || null,
        };
        if(b._newFile) item._newImage = true;
        return item;
      });

      fd.append('banners', JSON.stringify(payloadBanners));
      bannerItems.forEach((b) => {
        if(b._newFile) fd.append('bannerImages', b._newFile);
      });

      try {
        await API.upload('/admin/home-sections/banner', fd);
        showToast(editId ? 'Banner section updated' : 'Banner section created', 'success');
        closeModal('modal');
        load();
      } catch (e) {
        showToast(e.message, 'error');
      }
      return;
    }

    // ── Promo section — uses FormData upload ──
    if(type === 'promo_section'){
      const fd = new FormData();
      fd.append('title', title);
      fd.append('platform', platform);
      fd.append('sortOrder', sortOrder);
      fd.append('isActive', isActive);
      if(editId) fd.append('editId', editId);

      const bgFile = document.getElementById('fPromoBg').files[0];
      if(bgFile) fd.append('bgImage', bgFile);

      // Existing bg image path (for edit without re-uploading)
      const existingBgEl = document.getElementById('promoBgPreview').querySelector('img');
      if(!bgFile && existingBgEl){
        const src = existingBgEl.getAttribute('src');
        // Extract relative path
        const rel = src.includes('/uploads/') ? src.substring(src.indexOf('/uploads/')) : '';
        if(rel) fd.append('existingBgImage', rel);
      }

      const bgColor = document.getElementById('fPromoBgColorHex').value || document.getElementById('fPromoBgColor').value;
      fd.append('bgColor', bgColor);
      fd.append('cardPosition', document.getElementById('fCardPosition').value);

      // Cards — mark which ones need new images, append files in order
      const cardsForJson = promoCards.map(c => {
        const card = { categoryId: c.categoryId, image: c.image || null };
        if(c._newFile) card._newImage = true;
        return card;
      });
      fd.append('cards', JSON.stringify(cardsForJson));

      // Append new image files in same order as _newImage cards
      promoCards.forEach(c => {
        if(c._newFile) fd.append('cardImages', c._newFile);
      });

      try{
        await API.upload('/admin/home-sections/promo', fd);
        showToast(editId ? 'Promo updated' : 'Promo created', 'success');
        closeModal('modal');
        load();
      }catch(e){ showToast(e.message,'error'); }
      return;
    }

    // ── Regular section save ──
    const needsCat = ['category_section'].includes(type);
    if(needsCat && !document.getElementById('fCategory').value){
      showToast('Please select a category','error'); return;
    }

    const data = getFormData();
    if(data === null) return;

    const payload = { type, platform, sortOrder, title, data, isActive };

    try{
      if(editId){
        await API.put('/admin/home-sections/'+editId, payload);
        showToast('Section updated','success');
      } else {
        await API.post('/admin/home-sections', payload);
        showToast('Section created','success');
      }
      closeModal('modal');
      load();
    }catch(e){ showToast(e.message,'error'); }
  };

  /* ── duplicate ── */
  window.duplicateSec = async function(id){
    const s = sections.find(x=>x._id===id);
    if(!s) return;
    try{
      await API.post('/admin/home-sections', {
        type: s.type, platform: s.platform, title: s.title + ' (copy)',
        data: s.data, isActive: false, sortOrder: (s.sortOrder||0)+1,
      });
      showToast('Duplicated','success');
      load();
    }catch(e){ showToast(e.message,'error'); }
  };

  /* ── reorder ── */
  window.move = async function(id, dir){
    const idx = sections.findIndex(x=>x._id===id);
    if(idx<0) return;
    const swapIdx = idx+dir;
    if(swapIdx<0||swapIdx>=sections.length) return;
    const order = sections.map(s=>s._id);
    [order[idx], order[swapIdx]] = [order[swapIdx], order[idx]];
    try{
      await API.put('/admin/home-sections/reorder', { order });
      showToast('Reordered','success');
      load();
    }catch(e){ showToast(e.message,'error'); }
  };

  window.toggleActive = async function(id, current){
    try{
      await API.put('/admin/home-sections/'+id, { isActive: !current });
      showToast(current?'Disabled':'Enabled','success');
      load();
    }catch(e){ showToast(e.message,'error'); }
  };

  window.removeSec = async function(id){
    if(!confirm('Delete this section?')) return;
    try{
      await API.delete('/admin/home-sections/'+id);
      showToast('Deleted','success');
      load();
    }catch(e){ showToast(e.message,'error'); }
  };

  load();
})();
