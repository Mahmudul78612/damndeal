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

  const DESKTOP_SECTION_TYPES = [
    { value: 'hero_carousel',       label: 'Hero Carousel',       icon: '🖼️', group: 'banner' },
    { value: 'banner_2col',         label: 'Banner 2-Column',     icon: '⬜⬜', group: 'banner' },
    { value: 'banner_3col',         label: 'Banner 3-Column',     icon: '⬜⬜⬜', group: 'banner' },
    { value: 'banner_single',       label: 'Full-Width Banner',   icon: '🖼️', group: 'banner' },
    { value: 'category_products',   label: 'Category + Products', icon: '📦', group: 'product' },
    { value: 'product_grid',        label: 'Product Grid',        icon: '⊞',  group: 'product' },
    { value: 'deal_strip',          label: 'Deal Strip',          icon: '⚡', group: 'product' },
    { value: 'promo_full',          label: 'Promo Full-Width',    icon: '🎯', group: 'banner' },
    { value: 'featured_categories', label: 'Featured Categories', icon: '📂', group: 'other' },
    { value: 'rich_text',           label: 'Rich Text',           icon: '📝', group: 'content' },
    { value: 'image_with_text',     label: 'Image + Text',        icon: '🖼️', group: 'content' },
    { value: 'trust_badges',        label: 'Trust Badges',        icon: '✅', group: 'content' },
    { value: 'newsletter',          label: 'Newsletter',          icon: '✉️', group: 'content' },
    { value: 'countdown',           label: 'Countdown Timer',     icon: '⏱️', group: 'content' },
    { value: 'testimonials',        label: 'Testimonials',        icon: '⭐', group: 'content' },
    { value: 'ugc_video',           label: 'UGC Video Reels',     icon: '🎬', group: 'content' },
  ];

  /* ── state ── */
  let sections = [];
  let categories = [];
  let previewPlatform = 'damndeal';
  let activeSite = 'in';   // 'in' | 'com'
  let comView = 'mobile';  // 'mobile' | 'desktop'

  window.switchSite = function(s){ activeSite = s; load(); };
  window.switchComView = function(v){ comView = v; load(); };

  /* ── helpers ── */
  function esc(s){ const d=document.createElement('div'); d.textContent=String(s||''); return d.innerHTML; }

  function typeBadge(type, typeList){
    const list = typeList || SECTION_TYPES;
    const t = list.find(x=>x.value===type);
    const colors = { product:'#7C3AED', banner:'#2196F3', promo:'#E91E63', other:'#6B7280' };
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
    const isComDesktop = activeSite === 'com' && comView === 'desktop';
    const siteLabel = activeSite === 'in' ? 'damndeal.in' : (comView === 'mobile' ? 'damndeal.com – Mobile Web' : 'damndeal.com – Desktop');
    const currentTypes = isComDesktop ? DESKTOP_SECTION_TYPES : SECTION_TYPES;

    main.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div>
          <h2 style="margin:0;font-size:1.2rem;font-weight:700">Home Sections</h2>
          <p style="margin:4px 0 0;font-size:12px;color:var(--text-light)">Server-driven UI — changes reflect without app update</p>
        </div>
        <button class="btn btn-primary" onclick="${isComDesktop ? 'openDesktopAdd()' : 'openAdd()'}">+ Add Section</button>
      </div>

      <!-- ── Site Tabs ── -->
      <div style="display:flex;gap:8px;margin-bottom:12px;border-bottom:2px solid #e5e7eb;padding-bottom:10px">
        <button class="btn ${activeSite==='in'?'btn-primary':'btn-outline'}" onclick="switchSite('in')" style="font-size:13px">
          🇮🇳 damndeal.in
        </button>
        <button class="btn ${activeSite==='com'?'btn-primary':'btn-outline'}" onclick="switchSite('com')" style="font-size:13px">
          🌍 damndeal.com
        </button>
      </div>

      ${activeSite === 'com' ? `
      <!-- ── .com Sub-tabs ── -->
      <div style="display:flex;gap:8px;margin-bottom:16px;padding:10px 12px;background:#f8f9fa;border-radius:10px;border:1px solid #e5e7eb">
        <button class="btn ${comView==='mobile'?'btn-primary':'btn-outline'}" onclick="switchComView('mobile')" style="font-size:12px">
          📱 Mobile Web
        </button>
        <button class="btn ${comView==='desktop'?'btn-primary':'btn-outline'}" onclick="switchComView('desktop')" style="font-size:12px">
          🖥️ Desktop
        </button>
        <span style="margin-left:auto;font-size:11px;color:var(--text-light);line-height:30px">
          ${comView==='mobile' ? 'Home layout for damndeal.com mobile browsers' : 'Home layout for damndeal.com desktop browsers'}
        </span>
      </div>
      ` : ''}

      <!-- ── Table ── -->
      <div class="card" style="overflow:auto">
        <div style="padding:10px 14px;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;gap:8px">
          <span style="font-size:12px;font-weight:600;color:var(--text-light)">${siteLabel}</span>
          <span class="badge badge-primary" style="font-size:10px">${sections.length} section${sections.length!==1?'s':''}</span>
        </div>
        <table class="table" id="secTable">
          <thead><tr>
            <th style="width:60px">Order</th>
            <th>Type</th>
            <th>Title</th>
            ${!isComDesktop ? '<th>Platform</th>' : ''}
            <th>Style</th>
            <th style="width:60px">Active</th>
            <th style="width:220px">Actions</th>
          </tr></thead>
          <tbody>${sections.length ? sections.map((s,i)=>{
            const editFn = isComDesktop ? `openDesktopEdit('${s._id}')` : `openEdit('${s._id}')`;
            return `
            <tr data-id="${s._id}">
              <td>
                <div style="display:flex;flex-direction:column;gap:2px;align-items:center">
                  ${i>0?`<button class="btn btn-sm" style="padding:0 6px;font-size:.65rem;line-height:1" onclick="move('${s._id}',-1)">▲</button>`:''}
                  <span style="font-weight:600;font-size:13px">${s.sortOrder ?? i}</span>
                  ${i<sections.length-1?`<button class="btn btn-sm" style="padding:0 6px;font-size:.65rem;line-height:1" onclick="move('${s._id}',1)">▼</button>`:''}
                </div>
              </td>
              <td>${typeBadge(s.type, currentTypes)}</td>
              <td style="font-weight:600">${esc(s.title||'—')}</td>
              ${!isComDesktop ? `<td><span class="badge ${s.platform==='ddgo'?'badge-success':'badge-primary'}" style="font-size:11px">${s.platform||'ddgo'}</span></td>` : ''}
              <td style="font-size:12px">${stylePreview(s.data)}</td>
              <td>${s.isActive!==false ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-gray">No</span>'}</td>
              <td>
                <div style="display:flex;gap:4px;flex-wrap:wrap">
                  <button class="btn btn-sm" onclick="${editFn}" style="font-size:11px">✏️ Edit</button>
                  <button class="btn btn-sm ${s.isActive!==false?'btn-warning':'btn-primary'}" onclick="toggleActive('${s._id}',${s.isActive!==false})" style="font-size:11px">${s.isActive!==false?'Disable':'Enable'}</button>
                  <button class="btn btn-sm btn-danger" onclick="removeSec('${s._id}')" style="font-size:11px">🗑️</button>
                </div>
              </td>
            </tr>`;
          }).join('') : `<tr><td colspan="7" class="empty-state">No sections yet for ${siteLabel}. Click + Add Section to get started.</td></tr>`}
          </tbody>
        </table>
      </div>

      <!-- ── Preview ── -->
      <div style="margin-top:24px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <h3 style="margin:0;font-size:1rem;font-weight:700">${isComDesktop ? '🖥️ Desktop Preview' : '📱 Mobile Preview'}</h3>
          ${activeSite==='in' ? `
          <div style="display:flex;gap:8px">
            <button class="btn btn-sm ${previewPlatform==='damndeal'?'btn-primary':'btn-outline'}" onclick="setPreviewPlatform('damndeal')" style="font-size:11px">Online Store</button>
            <button class="btn btn-sm ${previewPlatform==='ddgo'?'btn-primary':'btn-outline'}" onclick="setPreviewPlatform('ddgo')" style="font-size:11px">Quick Commerce</button>
          </div>` : ''}
        </div>
        ${isComDesktop ? `
        <div style="max-width:960px;margin:0 auto;background:#fff;border-radius:12px;border:2px solid #ddd;padding:16px;min-height:400px;box-shadow:0 4px 20px rgba(0,0,0,.08)">
          <div style="height:36px;background:#f0f0f0;border-radius:6px;margin-bottom:12px;display:flex;align-items:center;padding:0 12px;gap:6px">
            <div style="width:12px;height:12px;border-radius:50%;background:#ff5f57"></div>
            <div style="width:12px;height:12px;border-radius:50%;background:#febc2e"></div>
            <div style="width:12px;height:12px;border-radius:50%;background:#28c840"></div>
            <div style="flex:1;background:#fff;height:22px;border-radius:4px;margin:0 8px"></div>
          </div>
          <div id="previewContainer">${buildPreview()}</div>
        </div>` : `
        <div style="max-width:375px;margin:0 auto;background:#f8f8f8;border-radius:24px;border:2px solid #ddd;padding:12px 0;min-height:500px;box-shadow:0 4px 20px rgba(0,0,0,.1)">
          <div style="width:40px;height:5px;background:#ddd;border-radius:3px;margin:0 auto 12px"></div>
          <div style="overflow-y:auto;max-height:600px;padding:0 8px" id="previewContainer">
            ${buildPreview()}
          </div>
          <div style="width:60px;height:5px;background:#ddd;border-radius:3px;margin:12px auto 0"></div>
        </div>`}
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
                <select class="form-control" id="fPlatform" ${activeSite==='com'?'disabled':''}>
                  <option value="damndeal">Online Store</option>
                  ${activeSite==='in'?'<option value="ddgo">Quick Commerce</option>':''}
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

  /* ── Desktop section modal (for .com Desktop tab) ── */
  let desktopEditId = null;

  window.openDesktopAdd = function(){
    desktopEditId = null;
    showDesktopModal();
  };

  window.openDesktopEdit = function(id){
    desktopEditId = id;
    const s = sections.find(x=>x._id===id);
    if(!s) return;
    showDesktopModal(s);
  };

  // Desktop banner upload state
  window.dtBanners = []; // [{image, linkType, linkValue, _file, _previewUrl}]
  let dtContentImage = { image: '', _file: null }; // image_with_text single image

  window.onDtcImageFile = function(input){
    if(input.files && input.files[0]){
      dtContentImage._file = input.files[0];
      const url = URL.createObjectURL(input.files[0]);
      const prev = document.getElementById('dtcImagePreview');
      if(prev) prev.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover">`;
    }
  };

  const DT_BANNER_TYPES = ['hero_carousel','banner_2col','banner_3col','banner_single','promo_full'];
  const DT_CONTENT_TYPES = ['rich_text','image_with_text','trust_badges','newsletter','countdown','testimonials','ugc_video'];
  function dtBannerCount(type){
    return type==='hero_carousel'?5 : type==='banner_2col'?2 : type==='banner_3col'?3 : 1;
  }

  function showDesktopModal(s){
    const types = DESKTOP_SECTION_TYPES;
    const isEdit = !!s;
    let modal = document.getElementById('desktopModal');
    if(!modal){
      modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.id = 'desktopModal';
      document.body.appendChild(modal);
    }

    // Seed banner data from existing section
    dtBanners = [];
    dtContentImage = { image: s?.data?.image || '', _file: null };
    const sType = s?.type || 'banner_2col';
    if(DT_BANNER_TYPES.includes(sType)){
      const d = s?.data || {};
      if(sType==='banner_single' || sType==='promo_full'){
        dtBanners = [{ image: d.image||'', linkType: d.linkType||'category', linkValue: d.linkValue||'' }];
      } else {
        dtBanners = (d.banners||[]).map(b => ({ image:b.image||'', linkType:b.linkType||'category', linkValue:b.linkValue||'' }));
      }
    }

    modal.innerHTML = `
      <div class="modal" style="width:560px;max-height:88vh;overflow-y:auto">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <h3 style="margin:0">${isEdit?'Edit':'Add'} Desktop Section <span style="font-size:12px;color:var(--text-light)">damndeal.com</span></h3>
          <button class="btn btn-sm" onclick="document.getElementById('desktopModal').classList.remove('show')" style="font-size:18px;padding:0 8px">×</button>
        </div>

        <fieldset style="border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:12px">
          <legend style="font-size:12px;font-weight:700;color:var(--text-light);padding:0 6px">BASIC INFO</legend>
          <div class="form-row">
            <div class="form-group">
              <label>Section Type</label>
              <select class="form-control" id="dtType" onchange="onDtTypeChange()">
                <optgroup label="Banners">
                  ${types.filter(t=>t.group==='banner').map(t=>`<option value="${t.value}" ${s?.type===t.value?'selected':''}>${t.icon} ${t.label}</option>`).join('')}
                </optgroup>
                <optgroup label="Products">
                  ${types.filter(t=>t.group==='product').map(t=>`<option value="${t.value}" ${s?.type===t.value?'selected':''}>${t.icon} ${t.label}</option>`).join('')}
                </optgroup>
                <optgroup label="Content (Shopify-style)">
                  ${types.filter(t=>t.group==='content').map(t=>`<option value="${t.value}" ${s?.type===t.value?'selected':''}>${t.icon} ${t.label}</option>`).join('')}
                </optgroup>
                <optgroup label="Other">
                  ${types.filter(t=>t.group==='other').map(t=>`<option value="${t.value}" ${s?.type===t.value?'selected':''}>${t.icon} ${t.label}</option>`).join('')}
                </optgroup>
              </select>
            </div>
            <div class="form-group">
              <label>Sort Order</label>
              <input class="form-control" id="dtSort" type="number" value="${s?.sortOrder??sections.length}" min="0">
            </div>
          </div>
          <div class="form-group">
            <label>Title</label>
            <input class="form-control" id="dtTitle" placeholder="e.g. Featured Products, Top Deals" value="${esc(s?.title||'')}">
          </div>
        </fieldset>

        <!-- Banner Config -->
        <fieldset id="dtBannerConfig" style="border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:12px;display:none">
          <legend style="font-size:12px;font-weight:700;color:var(--text-light);padding:0 6px">BANNER IMAGES</legend>
          <div id="dtBannerSlots"></div>
        </fieldset>

        <!-- Product Config -->
        <fieldset id="dtProductConfig" style="border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:12px;display:none">
          <legend style="font-size:12px;font-weight:700;color:var(--text-light);padding:0 6px">DATA CONFIG</legend>
          <div class="form-row">
            <div class="form-group">
              <label>Category</label>
              <select class="form-control" id="dtCategory">
                <option value="">— All Products —</option>
                ${categories.filter(c=>c.platform==='damndeal'||!c.platform).map(c=>`<option value="${c._id}" ${s?.data?.categoryId===c._id?'selected':''}>${esc(c.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Product Limit</label>
              <input class="form-control" id="dtLimit" type="number" value="${s?.data?.limit||10}" min="1" max="50">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Grid Columns</label>
              <select class="form-control" id="dtColumns">
                ${[2,3,4,5,6].map(n=>`<option value="${n}" ${(s?.data?.columns||4)==n?'selected':''}>${n} Columns</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Sort By</label>
              <select class="form-control" id="dtSortBy">
                <option value="createdAt" ${s?.data?.sortBy==='createdAt'?'selected':''}>Newest First</option>
                <option value="sellingPrice" ${s?.data?.sortBy==='sellingPrice'?'selected':''}>Price (Low)</option>
                <option value="-sellingPrice" ${s?.data?.sortBy==='-sellingPrice'?'selected':''}>Price (High)</option>
                <option value="name" ${s?.data?.sortBy==='name'?'selected':''}>Name</option>
              </select>
            </div>
          </div>
        </fieldset>

        <!-- Content Config (Shopify-style content sections) -->
        <fieldset id="dtContentConfig" style="border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:12px;display:none">
          <legend style="font-size:12px;font-weight:700;color:var(--text-light);padding:0 6px">CONTENT</legend>

          <div id="dtcImageRow" style="display:none">
            <label style="display:block;margin-bottom:4px">Image <span style="color:#999;font-weight:400">(auto-compressed to WebP on upload)</span></label>
            <div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:8px">
              <div style="text-align:center">
                <div id="dtcImagePreview" style="width:150px;height:96px;border-radius:8px;overflow:hidden;background:#f0f0f0;border:2px dashed #ccc;display:flex;align-items:center;justify-content:center;cursor:pointer" onclick="document.getElementById('dtcImageFile').click()">
                  ${(()=>{const im=s?.data?.image; if(!im) return '<span style="font-size:26px;color:#bbb">📷</span>'; const src=String(im).startsWith('http')?im:CONFIG.UPLOADS_BASE+im; return `<img src="${esc(src)}" style="width:100%;height:100%;object-fit:cover">`;})()}
                </div>
                <input type="file" id="dtcImageFile" accept="image/*" style="display:none" onchange="onDtcImageFile(this)">
                <div style="font-size:9px;color:#999;margin-top:3px">click to upload</div>
              </div>
              <div class="form-group" style="flex:1">
                <label>Image Side</label>
                <select class="form-control" id="dtcImageSide">
                  <option value="left" ${s?.data?.imageSide!=='right'?'selected':''}>Left</option>
                  <option value="right" ${s?.data?.imageSide==='right'?'selected':''}>Right</option>
                </select>
              </div>
            </div>
          </div>

          <div class="form-group" id="dtcHeadingRow">
            <label>Heading</label>
            <input class="form-control" id="dtcHeading" placeholder="e.g. Why shop with us" value="${esc(s?.data?.heading||'')}">
          </div>

          <div class="form-group" id="dtcTextRow">
            <label>Text</label>
            <textarea class="form-control" id="dtcText" rows="3" placeholder="Supporting text…">${esc(s?.data?.text||'')}</textarea>
          </div>

          <div class="form-group" id="dtcBadgesRow" style="display:none">
            <label>Badges <span style="color:#999;font-weight:400">(one per line: icon | title | subtitle)</span></label>
            <textarea class="form-control" id="dtcBadges" rows="4" placeholder="🚚 | Free Shipping | On orders over $50&#10;🔒 | Secure Checkout | 100% protected&#10;↩️ | Easy Returns | 30-day policy">${esc((s?.data?.badges||[]).map(b=>[b.icon,b.title,b.subtitle].filter(x=>x!=null).join(' | ')).join('\n'))}</textarea>
          </div>

          <div class="form-group" id="dtcPlaceholderRow" style="display:none">
            <label>Email Input Placeholder</label>
            <input class="form-control" id="dtcPlaceholder" placeholder="Enter your email" value="${esc(s?.data?.placeholder||'')}">
          </div>

          <div class="form-group" id="dtcEndTimeRow" style="display:none">
            <label>Countdown ends at</label>
            <input class="form-control" id="dtcEndTime" type="datetime-local" value="${esc((s?.data?.endTime||'').slice(0,16))}">
          </div>

          <div class="form-group" id="dtcTestimonialsRow" style="display:none">
            <label>Testimonials <span style="color:#999;font-weight:400">(one per line: name | rating(1-5) | review text | location)</span></label>
            <textarea class="form-control" id="dtcTestimonials" rows="5" placeholder="Aisha K. | 5 | Amazing quality, fast delivery! | New York&#10;Mike R. | 4 | Great value for money | Texas">${esc((s?.data?.items||[]).map(t=>[t.name,t.rating,t.text,t.location].filter(x=>x!=null&&x!=='').join(' | ')).join('\n'))}</textarea>
          </div>

          <div class="form-group" id="dtcVideosRow" style="display:none">
            <label>UGC Videos <span style="color:#999;font-weight:400">(one per line: videoURL | link | caption)</span></label>
            <textarea class="form-control" id="dtcVideos" rows="5" placeholder="https://youtube.com/shorts/abc123 | /categories/CATEGORY_ID | Summer Collection&#10;https://site.com/clip.mp4 | /product/PRODUCT_ID | Best Seller">${esc((s?.data?.videos||[]).map(v=>[v.url,v.linkValue,v.caption].filter(x=>x!=null&&x!=='').join(' | ')).join('\n'))}</textarea>
            <p style="font-size:10px;color:#999;margin:3px 0 0">Link: paste a <b>/categories/ID</b> or <b>/product/ID</b> path (copy the ID from Categories/Products page), or any URL. Video: YouTube/Shorts link or a direct .mp4 URL.</p>
          </div>

          <div id="dtcButtonRow">
            <div class="form-row">
              <div class="form-group">
                <label>Button Label <span style="color:#999;font-weight:400">(optional)</span></label>
                <input class="form-control" id="dtcBtnLabel" placeholder="Shop Now" value="${esc(s?.data?.buttonLabel||'')}">
              </div>
              <div class="form-group">
                <label>Button Color</label>
                <input class="form-control" id="dtcBtnColor" type="color" value="${esc(s?.data?.buttonColor||'#111827')}" style="height:38px;padding:2px">
              </div>
            </div>
            <div class="form-group">
              <label>Button Link <span style="color:#999;font-weight:400">(URL or /categories/ID)</span></label>
              <input class="form-control" id="dtcBtnLink" placeholder="https://... or /categories/ID" value="${esc(s?.data?.buttonLink||'')}">
            </div>
          </div>
        </fieldset>

        <!-- Design (applies to every section type) -->
        <fieldset style="border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:12px">
          <legend style="font-size:12px;font-weight:700;color:var(--text-light);padding:0 6px">🎨 DESIGN (optional)</legend>
          <div class="form-row">
            <div class="form-group">
              <label>Background Color</label>
              <input class="form-control" id="dtBg" type="color" value="${esc(s?.data?.bgColor||'#ffffff')}" style="height:38px;padding:2px">
            </div>
            <div class="form-group">
              <label>Vertical Padding</label>
              <select class="form-control" id="dtPad">
                ${['none','sm','md','lg'].map(p=>`<option value="${p}" ${(s?.data?.paddingY||'none')===p?'selected':''}>${p.toUpperCase()}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Text Align</label>
              <select class="form-control" id="dtAlign">
                ${['left','center','right'].map(a=>`<option value="${a}" ${(s?.data?.align||'left')===a?'selected':''}>${a}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label><input type="checkbox" id="dtFullWidth" ${s?.data?.fullWidth?'checked':''}> Full-width band (edge-to-edge)</label>
            </div>
            <div class="form-group">
              <label><input type="checkbox" id="dtRounded" ${s?.data?.rounded?'checked':''}> Rounded corners</label>
            </div>
          </div>
          <p style="font-size:11px;color:#999;margin:4px 0 0">Leave background white & padding NONE to keep the default look. Full-width band needs a background color.</p>
        </fieldset>

        <div class="form-group">
          <label><input type="checkbox" id="dtActive" ${s?.isActive!==false?'checked':''}> Active</label>
        </div>

        <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:16px">
          <button class="btn" onclick="document.getElementById('desktopModal').classList.remove('show')">Cancel</button>
          <button class="btn btn-primary" onclick="saveDesktop()">💾 Save Section</button>
        </div>
      </div>`;

    modal.classList.add('show');
    onDtTypeChange();
  }

  window.onDtTypeChange = function(){
    const type = document.getElementById('dtType').value;
    const isBanner = DT_BANNER_TYPES.includes(type);
    const isContent = DT_CONTENT_TYPES.includes(type);
    document.getElementById('dtBannerConfig').style.display = isBanner ? '' : 'none';
    document.getElementById('dtProductConfig').style.display = (isBanner || isContent) ? 'none' : '';
    document.getElementById('dtContentConfig').style.display = isContent ? '' : 'none';

    if(isContent){
      // Toggle the type-specific rows inside the content config.
      const show = (id, on) => { const el = document.getElementById(id); if(el) el.style.display = on ? '' : 'none'; };
      const hasButton = ['rich_text','image_with_text','newsletter','countdown'].includes(type);
      const hasText   = ['rich_text','image_with_text','newsletter','countdown'].includes(type);
      show('dtcImageRow',        type==='image_with_text');
      show('dtcBadgesRow',       type==='trust_badges');
      show('dtcEndTimeRow',      type==='countdown');
      show('dtcTestimonialsRow', type==='testimonials');
      show('dtcVideosRow',       type==='ugc_video');
      show('dtcHeadingRow',      !['trust_badges','testimonials','ugc_video'].includes(type));
      show('dtcTextRow',         hasText);
      show('dtcPlaceholderRow',  type==='newsletter');
      show('dtcButtonRow',       hasButton);
    }

    if(isBanner){
      const count = dtBannerCount(type);
      const isCarousel = type==='hero_carousel';
      while(dtBanners.length < (isCarousel ? Math.max(1, dtBanners.length) : count)) dtBanners.push({ image:'', linkType:'category', linkValue:'' });
      if(!isCarousel) dtBanners = dtBanners.slice(0, count);
      renderDtBanners(type);
    }
  };

  window.renderDtBanners = function(type){
    const container = document.getElementById('dtBannerSlots');
    if(!container) return;
    const isCarousel = type==='hero_carousel';
    container.innerHTML = dtBanners.map((b,i) => {
      const imgSrc = b._previewUrl || (b.image ? (b.image.startsWith('http') ? b.image : CONFIG.UPLOADS_BASE + b.image) : '');
      return `
        <div style="border:1px solid #eee;border-radius:8px;padding:10px;margin-bottom:8px;background:#fafafa;display:flex;gap:10px;align-items:flex-start">
          <div style="min-width:110px;text-align:center">
            <div style="width:110px;height:64px;border-radius:6px;overflow:hidden;background:#eee;display:flex;align-items:center;justify-content:center;cursor:pointer;border:2px dashed #ccc" onclick="document.getElementById('dtBannerFile${i}').click()">
              ${imgSrc ? `<img src="${esc(imgSrc)}" style="width:100%;height:100%;object-fit:cover">` : '<span style="font-size:22px;color:#bbb">📷</span>'}
            </div>
            <input type="file" id="dtBannerFile${i}" accept="image/*" style="display:none" onchange="onDtBannerFile(${i},this)">
            <span style="font-size:9px;color:#999">Slide ${i+1} — click to upload</span>
          </div>
          <div style="flex:1;display:flex;flex-direction:column;gap:6px">
            <select class="form-control" style="font-size:12px" onchange="dtBanners[${i}].linkType=this.value;dtBanners[${i}].linkValue='';renderDtBanners('${type}')">
              <option value="category" ${b.linkType==='category'?'selected':''}>Category</option>
              <option value="url" ${b.linkType==='url'?'selected':''}>URL</option>
              <option value="none" ${b.linkType==='none'?'selected':''}>No Link</option>
            </select>
            ${b.linkType==='category' ? `
              <select class="form-control" style="font-size:12px" onchange="dtBanners[${i}].linkValue=this.value">
                <option value="">— Select Category —</option>
                ${categories.filter(c=>c.platform==='damndeal'||!c.platform).map(c=>`<option value="${c._id}" ${b.linkValue===c._id?'selected':''}>${esc(c.name)}</option>`).join('')}
              </select>` : b.linkType==='url' ? `
              <input class="form-control" style="font-size:12px" placeholder="https://..." value="${esc(b.linkValue||'')}" onchange="dtBanners[${i}].linkValue=this.value">` : ''}
            ${isCarousel && dtBanners.length>1 ? `<button type="button" class="btn btn-sm btn-danger" style="font-size:10px;align-self:flex-start" onclick="dtBanners.splice(${i},1);renderDtBanners('${type}')">Remove</button>` : ''}
          </div>
        </div>`;
    }).join('');
    if(isCarousel && dtBanners.length < 5){
      container.innerHTML += `<button type="button" class="btn btn-sm" style="font-size:11px" onclick="dtBanners.push({image:'',linkType:'category',linkValue:''});renderDtBanners('${type}')">+ Add Slide (${dtBanners.length}/5)</button>`;
    }
  };

  window.onDtBannerFile = function(i, input){
    if(input.files[0]){
      dtBanners[i]._file = input.files[0];
      dtBanners[i]._previewUrl = URL.createObjectURL(input.files[0]);
      renderDtBanners(document.getElementById('dtType').value);
    }
  };

  // Collect the optional DESIGN fields (only non-default values are stored).
  function dtDesign(){
    const d = {};
    const bg = (document.getElementById('dtBg').value||'').toLowerCase();
    if(bg && bg !== '#ffffff') d.bgColor = bg;
    const pad = document.getElementById('dtPad').value;
    if(pad && pad !== 'none') d.paddingY = pad;
    const align = document.getElementById('dtAlign').value;
    if(align && align !== 'left') d.align = align;
    if(document.getElementById('dtFullWidth').checked) d.fullWidth = true;
    if(document.getElementById('dtRounded').checked) d.rounded = true;
    return d;
  }

  // Collect content fields for Shopify-style content sections.
  function dtContent(type){
    const d = {};
    const val = id => (document.getElementById(id)?.value || '').trim();
    if(type !== 'trust_badges'){
      const h = val('dtcHeading'); if(h) d.heading = h;
      const t = val('dtcText');    if(t) d.text = t;
    }
    if(type === 'image_with_text'){
      d.imageSide = document.getElementById('dtcImageSide').value;
      // image is attached separately in saveDesktop (file upload)
    }
    if(type === 'trust_badges'){
      d.badges = val('dtcBadges').split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{
        const [icon,title,subtitle] = l.split('|').map(x=>(x||'').trim());
        return { icon: icon||'✅', title: title||'', subtitle: subtitle||'' };
      });
    }
    if(type === 'newsletter'){
      const ph = val('dtcPlaceholder'); if(ph) d.placeholder = ph;
    }
    if(type === 'countdown'){
      const et = val('dtcEndTime'); if(et) d.endTime = et;
    }
    if(type === 'testimonials'){
      d.items = val('dtcTestimonials').split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{
        const [name,rating,text,location] = l.split('|').map(x=>(x||'').trim());
        return { name: name||'Customer', rating: parseInt(rating)||5, text: text||'', location: location||'' };
      });
    }
    if(type === 'ugc_video'){
      const linkTypeOf = lv => lv.startsWith('/categories/') ? 'category' : (lv.startsWith('/product/') ? 'product' : 'url');
      const linkValOf  = lv => lv.startsWith('/categories/') ? lv.split('/categories/')[1] : (lv.startsWith('/product/') ? lv.split('/product/')[1] : lv);
      d.videos = val('dtcVideos').split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{
        const [url,link,caption] = l.split('|').map(x=>(x||'').trim());
        const v = { url: url||'', caption: caption||'' };
        if(link){ v.linkType = linkTypeOf(link); v.linkValue = linkValOf(link); }
        return v;
      }).filter(v=>v.url);
    }
    if(type==='rich_text' || type==='image_with_text' || type==='newsletter' || type==='countdown'){
      const bl = val('dtcBtnLabel');
      if(bl){
        d.buttonLabel = bl;
        const link = val('dtcBtnLink');
        if(link){ d.buttonLink = link; d.buttonLinkType = 'url'; }
        d.buttonColor = document.getElementById('dtcBtnColor').value;
      }
    }
    return d;
  }

  window.saveDesktop = async function(){
    const title = document.getElementById('dtTitle').value.trim();
    if(!title){ showToast('Title is required','error'); return; }
    const type = document.getElementById('dtType').value;
    const sortOrder = parseInt(document.getElementById('dtSort').value)||0;
    const isActive = document.getElementById('dtActive').checked;
    const isBanner = DT_BANNER_TYPES.includes(type);
    const isContent = DT_CONTENT_TYPES.includes(type);
    const design = dtDesign();

    try{
      if(isBanner){
        // Validate at least one image
        const hasImg = dtBanners.some(b => b.image || b._file);
        if(!hasImg){ showToast('Upload at least one banner image','error'); return; }

        const fd = new FormData();
        fd.append('title', title);
        fd.append('type', type);
        fd.append('platform', 'damndeal');
        fd.append('sortOrder', sortOrder);
        fd.append('isActive', isActive);
        fd.append('regions', JSON.stringify(['US']));

        const data = {};
        if(type==='banner_single' || type==='promo_full'){
          data.linkType = dtBanners[0]?.linkType || 'none';
          data.linkValue = dtBanners[0]?.linkValue || '';
          data.image = dtBanners[0]?.image || '';
          if(dtBanners[0]?._file){ fd.append('images', dtBanners[0]._file); delete data.image; }
        } else {
          const active = dtBanners.filter(b => b.image || b._file);
          data.banners = active.map(b => {
            const banner = { image:b.image||'', linkType:b.linkType||'none', linkValue:b.linkValue||'' };
            if(b._file) banner._newImage = true;
            return banner;
          });
          active.forEach(b => { if(b._file) fd.append('images', b._file); });
        }
        Object.assign(data, design); // design controls apply to banners too
        fd.append('data', JSON.stringify(data));

        if(desktopEditId){
          await API.upload('/admin/desktop-home-sections/'+desktopEditId+'/with-images', fd, 'PUT');
        } else {
          await API.upload('/admin/desktop-home-sections/with-images', fd);
        }
      } else if(type === 'image_with_text'){
        // Image + Text uses a single uploaded (and compressed) image.
        const fd = new FormData();
        fd.append('title', title);
        fd.append('type', type);
        fd.append('platform', 'damndeal');
        fd.append('sortOrder', sortOrder);
        fd.append('isActive', isActive);
        fd.append('regions', JSON.stringify(['US']));
        const data = { ...dtContent(type), ...design };
        if(dtContentImage.image) data.image = dtContentImage.image; // keep existing if no new file
        fd.append('data', JSON.stringify(data));
        if(dtContentImage._file) fd.append('images', dtContentImage._file);
        if(desktopEditId) await API.upload('/admin/desktop-home-sections/'+desktopEditId+'/with-images', fd, 'PUT');
        else await API.upload('/admin/desktop-home-sections/with-images', fd);
      } else if(isContent){
        const payload = {
          title, type, sortOrder, isActive,
          platform: 'damndeal', regions: ['US'],
          data: { ...dtContent(type), ...design },
        };
        if(desktopEditId) await API.put('/admin/desktop-home-sections/'+desktopEditId, payload);
        else await API.post('/admin/desktop-home-sections', payload);
      } else {
        const payload = {
          title, type, sortOrder, isActive,
          platform: 'damndeal', regions: ['US'],
          data: {
            categoryId: document.getElementById('dtCategory').value || undefined,
            limit: parseInt(document.getElementById('dtLimit').value)||10,
            columns: parseInt(document.getElementById('dtColumns').value)||4,
            sortBy: document.getElementById('dtSortBy').value,
            ...design,
          },
        };
        if(desktopEditId) await API.put('/admin/desktop-home-sections/'+desktopEditId, payload);
        else await API.post('/admin/desktop-home-sections', payload);
      }
      showToast(desktopEditId?'Section updated':'Section created','success');
      document.getElementById('desktopModal').classList.remove('show');
      load();
    }catch(e){ showToast(e.message,'error'); }
  };

  /* ── load ── */
  async function load(){
    try{
      const catRes = await API.get('/admin/categories?region=all');
      categories = catRes.data || catRes.categories || catRes || [];
      if(!Array.isArray(categories)) categories = [];

      let secUrl;
      if(activeSite === 'in'){
        secUrl = '/admin/home-sections?region=IN';
      } else if(comView === 'mobile'){
        secUrl = '/admin/home-sections?region=US&platform=damndeal';
      } else {
        secUrl = '/admin/desktop-home-sections?region=US';
      }
      const secRes = await API.get(secUrl);
      sections = secRes.data || secRes.sections || secRes || [];
      if(!Array.isArray(sections)) sections = [];
      sections.sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
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
      fd.append('regions', JSON.stringify(activeSite === 'com' ? ['US'] : ['IN']));
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
      fd.append('regions', JSON.stringify(activeSite === 'com' ? ['US'] : ['IN']));
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

    // Tag with correct region
    const regions = activeSite === 'com' ? ['US'] : ['IN'];
    const payload = { type, platform, sortOrder, title, data, isActive, regions };

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

  /* ── API base for current view ── */
  function apiBase(){
    return (activeSite === 'com' && comView === 'desktop')
      ? '/admin/desktop-home-sections'
      : '/admin/home-sections';
  }

  /* ── reorder ── */
  window.move = async function(id, dir){
    const idx = sections.findIndex(x=>x._id===id);
    if(idx<0) return;
    const swapIdx = idx+dir;
    if(swapIdx<0||swapIdx>=sections.length) return;
    const order = sections.map(s=>s._id);
    [order[idx], order[swapIdx]] = [order[swapIdx], order[idx]];
    try{
      await API.put(apiBase()+'/reorder', { order });
      showToast('Reordered','success');
      load();
    }catch(e){ showToast(e.message,'error'); }
  };

  window.toggleActive = async function(id, current){
    try{
      await API.put(apiBase()+'/'+id, { isActive: !current });
      showToast(current?'Disabled':'Enabled','success');
      load();
    }catch(e){ showToast(e.message,'error'); }
  };

  window.removeSec = async function(id){
    if(!confirm('Delete this section?')) return;
    try{
      await API.delete(apiBase()+'/'+id);
      showToast('Deleted','success');
      load();
    }catch(e){ showToast(e.message,'error'); }
  };

  load();
})();
