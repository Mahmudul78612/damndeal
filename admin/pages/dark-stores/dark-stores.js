(function(){
  requireAuth();
  document.body.innerHTML = pageShell('DDGo Stores');
  buildLayout('dark-stores');

  const main = document.getElementById('page-content');

  let stores = [];
  let editingId = null;

  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  /* Minutes-from-midnight <-> "HH:MM", which is what <input type=time> wants. */
  function toTime(min){
    if (min == null) return '';
    const h = Math.floor(min / 60), m = min % 60;
    return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
  }
  function val(id){ const el = document.getElementById(id); return el ? el.value : ''; }
  function checked(id){ const el = document.getElementById(id); return el ? el.checked : false; }

  function statusPill(s){
    if (!s.isActive)          return '<span class="badge" style="background:#f1f1f1;color:#888">Inactive</span>';
    if (!s.isAcceptingOrders) return '<span class="badge" style="background:#FEF3C7;color:#92400E">Paused</span>';
    if (!s.isOpenNow)         return '<span class="badge" style="background:#E5E7EB;color:#4B5563">Closed now</span>';
    return '<span class="badge" style="background:#D1FAE5;color:#065F46">Open</span>';
  }

  function shell(){
    return ''
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">'
      +   '<div>'
      +     '<h2 style="margin:0;font-size:1.3rem;display:flex;align-items:center;gap:8px"><span style="font-size:1.6rem">🏬</span> DDGo Stores</h2>'
      +     '<p style="color:var(--text-light);font-size:13px;margin:4px 0 0">Our own dark stores. Each delivers inside its own radius — partner shops set theirs from the partner portal.</p>'
      +   '</div>'
      +   '<div style="display:flex;gap:8px">'
      +     '<button class="btn btn-outline" id="btnCoverage">📍 Test an address</button>'
      +     '<button class="btn btn-primary" id="btnNew">+ New Store</button>'
      +   '</div>'
      + '</div>'
      + '<div style="display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:16px">'
      +   '<button class="ds-tab" data-tab="stores">Stores</button>'
      +   '<button class="ds-tab" data-tab="demand">Where people ask</button>'
      +   '<button class="ds-tab" data-tab="perf">Performance</button>'
      + '</div>'
      + '<style>.ds-tab{background:none;border:none;padding:9px 14px;font-size:13px;font-weight:600;'
      + 'color:var(--text-light);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}'
      + '.ds-tab.on{color:#7C3AED;border-bottom-color:#7C3AED}</style>'
      + '<div id="store-list"></div>'

      /* ── Store form ── */
      + '<div class="modal-overlay" id="store-modal">'
      +   '<div class="modal" style="max-width:820px">'
      +     '<div class="modal-header"><h3 id="store-modal-title">New Store</h3>'
      +       '<button class="modal-close" onclick="closeModal(\'store-modal\')">&times;</button></div>'
      +     '<div class="modal-body">'
      +       '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 18px">'
      +         '<div>'
      +           fld('Store name *','f_name','text')
      +           fld('Store code *','f_code','text','Short code for order labels, e.g. PTA01')
      +           fld('Latitude *','f_lat','number','Google Maps par jagah pe right-click → numbers pe click karke copy')
      +           fld('Longitude *','f_lng','number')
      +           fld('Delivery radius (km) *','f_radius','number','Store ke pin se kitni door tak deliver karega')
      +           fld('Prep time (mins)','f_prep','number','Picking + packing, rider ETA me add hota hai')
      +         '</div>'
      +         '<div>'
      +           fld('Address','f_address','text')
      +           fld('City','f_city','text')
      +           fld('State','f_state','text')
      +           fld('Pincode','f_pincode','text')
      +           fld('Contact name','f_cname','text')
      +           fld('Contact phone','f_cphone','text')
      +         '</div>'
      +       '</div>'
      +       '<hr style="border:none;border-top:1px solid var(--border);margin:8px 0 16px">'
      +       '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 18px">'
      +         '<div>'
      +           '<label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:10px">'
      +             '<input type="checkbox" id="f_always"> Open 24×7</label>'
      +           fld('Opens at','f_opens','time')
      +           fld('Closes at','f_closes','time')
      +           '<label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px">Closed on</label>'
      +           '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">' + dayBoxes() + '</div>'
      +         '</div>'
      +         '<div>'
      +           fld('Minimum order (0 = platform default)','f_minorder','number')
      +           fld('Delivery fee (0 = platform default)','f_fee','number')
      +           fld('Free delivery above (0 = platform default)','f_free','number')
      +           fld('Priority','f_priority','number','Do stores ek hi address cover karein to zyada wala jeetega')
      +           '<label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">Region</label>'
      +           '<select class="form-control" id="f_region" style="margin-bottom:12px">'
      +             '<option value="IN">🇮🇳 India — damndeal.in</option>'
      +             '<option value="US">🇺🇸 USA — damndeal.com</option>'
      +           '</select>'
      +           '<div style="display:flex;gap:16px">'
      +             '<label style="display:flex;align-items:center;gap:6px;font-size:13px"><input type="checkbox" id="f_active" checked> Active</label>'
      +             '<label style="display:flex;align-items:center;gap:6px;font-size:13px"><input type="checkbox" id="f_accepting" checked> Accepting orders</label>'
      +           '</div>'
      +         '</div>'
      +       '</div>'
      +     '</div>'
      +     '<div class="modal-footer">'
      +       '<button class="btn btn-outline" onclick="closeModal(\'store-modal\')">Cancel</button>'
      +       '<button class="btn btn-primary" id="btnSaveStore">Save store</button>'
      +     '</div>'
      +   '</div>'
      + '</div>'

      /* ── Shelf: what this store actually carries ── */
      + '<div class="modal-overlay" id="shelf-modal">'
      +   '<div class="modal" style="max-width:900px">'
      +     '<div class="modal-header"><h3 id="shelf-title">Stock</h3>'
      +       '<button class="modal-close" onclick="closeModal(\'shelf-modal\')">&times;</button></div>'
      +     '<div class="modal-body" style="max-height:70vh;overflow:auto">'
      +       '<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">'
      +         '<input class="form-control" id="sh_q" placeholder="Search this shelf..." style="flex:1;min-width:180px">'
      +         '<label style="font-size:12.5px;display:flex;align-items:center;gap:5px">'
      +           '<input type="checkbox" id="sh_low"> Only low stock</label>'
      +         '<button class="btn btn-primary" id="btnAddProducts">+ Add products</button>'
      +       '</div>'
      +       '<div id="sh_summary" style="font-size:12.5px;color:var(--text-light);margin-bottom:10px"></div>'
      +       '<div id="sh_list"></div>'
      +     '</div>'
      +   '</div>'
      + '</div>'

      /* ── Picker: DDGo products this store does not carry yet ── */
      + '<div class="modal-overlay" id="pick-modal">'
      +   '<div class="modal" style="max-width:760px">'
      +     '<div class="modal-header"><h3>Add products to this store</h3>'
      +       '<button class="modal-close" onclick="closeModal(\'pick-modal\')">&times;</button></div>'
      +     '<div class="modal-body" style="max-height:65vh;overflow:auto">'
      +       '<input class="form-control" id="pk_q" placeholder="Search Quick Commerce products..." style="margin-bottom:12px">'
      +       '<div id="pk_list"></div>'
      +     '</div>'
      +     '<div class="modal-footer">'
      +       '<button class="btn btn-outline" onclick="closeModal(\'pick-modal\')">Cancel</button>'
      +       '<button class="btn btn-primary" id="btnAddSelected">Add selected</button>'
      +     '</div>'
      +   '</div>'
      + '</div>'

      /* ── Coverage tester ── */
      + '<div class="modal-overlay" id="cov-modal">'
      +   '<div class="modal">'
      +     '<div class="modal-header"><h3>Test an address</h3>'
      +       '<button class="modal-close" onclick="closeModal(\'cov-modal\')">&times;</button></div>'
      +     '<div class="modal-body">'
      +       '<p style="font-size:12.5px;color:var(--text-light);margin:0 0 12px">Ek pin daal ke dekho ki wahan khada customer ko kya milega.</p>'
      +       fld('Latitude','c_lat','number')
      +       fld('Longitude','c_lng','number')
      +       '<div id="c_out" style="margin-top:12px"></div>'
      +     '</div>'
      +     '<div class="modal-footer">'
      +       '<button class="btn btn-outline" onclick="closeModal(\'cov-modal\')">Close</button>'
      +       '<button class="btn btn-primary" id="btnCheckCov">Check</button>'
      +     '</div>'
      +   '</div>'
      + '</div>';
  }

  function dayBoxes(){
    return DAYS.map(function(d, i){
      return '<label style="font-size:12px;display:flex;align-items:center;gap:3px">'
        + '<input type="checkbox" class="f_day" value="' + i + '"> ' + d + '</label>';
    }).join('');
  }

  function fld(label, id, type, hint){
    return '<div style="margin-bottom:14px">'
      + '<label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">'+label+'</label>'
      + '<input class="form-control" id="'+id+'" type="'+(type||'text')+'">'
      + (hint ? '<div style="font-size:11px;color:var(--text-light);margin-top:3px">'+hint+'</div>' : '')
      + '</div>';
  }

  function renderList(){
    document.getElementById('store-list').innerHTML = stores.length === 0
      ? '<div class="card" style="padding:48px;text-align:center;color:var(--text-light)">'
        + '<div style="font-size:36px;margin-bottom:8px">🏬</div>'
        + '<div style="font-weight:600;margin-bottom:4px">No dark stores yet</div>'
        + '<div style="font-size:13px">Ek store banao, pin drop karo, aur radius set karo.</div>'
        + '</div>'
      : '<div class="card" style="padding:0;overflow-x:auto"><table class="table" style="margin:0"><thead><tr>'
        + '<th>Store</th><th>City</th><th>Radius</th><th>Hours</th><th>Region</th><th>Status</th><th></th>'
        + '</tr></thead><tbody>'
        + stores.map(function(s){
            return '<tr>'
              + '<td><div style="font-weight:600">'+esc(s.name)+'</div>'
                + '<div style="font-size:11px;color:var(--text-light)"><code>'+esc(s.code)+'</code> · '
                + (s.lat != null ? Number(s.lat).toFixed(4)+', '+Number(s.lng).toFixed(4) : 'no pin') + '</div></td>'
              + '<td>'+esc(s.city||'—')+'</td>'
              + '<td><b>'+s.radiusKm+'</b> km</td>'
              + '<td style="font-size:12px">'+(s.alwaysOpen ? '24×7' : toTime(s.opensAtMin)+'–'+toTime(s.closesAtMin))+'</td>'
              + '<td style="font-size:12px">'+((s.regions||[]).join(', ')||'—')+'</td>'
              + '<td>'+statusPill(s)+'</td>'
              + '<td style="text-align:right;white-space:nowrap">'
                + '<button class="btn btn-sm btn-primary" data-shelf="'+s._id+'">Stock</button> '
                + '<button class="btn btn-sm btn-outline" data-edit="'+s._id+'">Edit</button> '
                + '<button class="btn btn-sm btn-danger" data-del="'+s._id+'">Delete</button>'
              + '</td>'
              + '</tr>';
          }).join('')
        + '</tbody></table></div>';

    main.querySelectorAll('[data-edit]').forEach(function(b){
      b.onclick = function(){ openForm(stores.find(function(s){ return s._id === b.dataset.edit; })); };
    });
    main.querySelectorAll('[data-del]').forEach(function(b){
      b.onclick = function(){ del(b.dataset.del); };
    });
    main.querySelectorAll('[data-shelf]').forEach(function(b){
      b.onclick = function(){ openShelf(stores.find(function(s){ return s._id === b.dataset.shelf; })); };
    });
  }

  function openForm(s){
    s = s || {};
    editingId = s._id || null;
    document.getElementById('store-modal-title').textContent = editingId ? ('Edit ' + (s.name || 'store')) : 'New Store';

    const set = function(id, v){ const el = document.getElementById(id); if (el) el.value = v == null ? '' : v; };
    set('f_name', s.name); set('f_code', s.code);
    set('f_lat', s.lat); set('f_lng', s.lng);
    set('f_radius', s.radiusKm != null ? s.radiusKm : 5);
    set('f_prep', s.prepTimeMins != null ? s.prepTimeMins : 8);
    set('f_address', s.address); set('f_city', s.city); set('f_state', s.state); set('f_pincode', s.pincode);
    set('f_cname', s.contactName); set('f_cphone', s.contactPhone);
    set('f_opens', toTime(s.opensAtMin != null ? s.opensAtMin : 480));
    set('f_closes', toTime(s.closesAtMin != null ? s.closesAtMin : 1380));
    set('f_minorder', s.minOrderAmount || 0); set('f_fee', s.deliveryFee || 0);
    set('f_free', s.freeDeliveryAbove || 0); set('f_priority', s.priority || 0);
    document.getElementById('f_region').value = (s.regions && s.regions[0]) || 'IN';
    document.getElementById('f_always').checked = !!s.alwaysOpen;
    document.getElementById('f_active').checked = s.isActive !== false;
    document.getElementById('f_accepting').checked = s.isAcceptingOrders !== false;
    document.querySelectorAll('.f_day').forEach(function(c){
      c.checked = (s.closedDays || []).indexOf(parseInt(c.value,10)) >= 0;
    });

    openModal('store-modal');
  }

  async function save(){
    const closedDays = Array.prototype.slice.call(document.querySelectorAll('.f_day:checked'))
      .map(function(c){ return parseInt(c.value,10); });

    const body = {
      name: val('f_name'), code: val('f_code'),
      lat: val('f_lat'), lng: val('f_lng'),
      radiusKm: val('f_radius'), prepTimeMins: val('f_prep'),
      address: val('f_address'), city: val('f_city'), state: val('f_state'), pincode: val('f_pincode'),
      contactName: val('f_cname'), contactPhone: val('f_cphone'),
      alwaysOpen: checked('f_always'),
      opensAt: val('f_opens'), closesAt: val('f_closes'), closedDays: closedDays,
      minOrderAmount: val('f_minorder'), deliveryFee: val('f_fee'), freeDeliveryAbove: val('f_free'),
      priority: val('f_priority'), regions: [val('f_region')],
      isActive: checked('f_active'), isAcceptingOrders: checked('f_accepting'),
    };

    const btn = document.getElementById('btnSaveStore');
    btn.disabled = true;
    try {
      if (editingId) await API.put('/admin/dark-stores/' + editingId, body);
      else await API.post('/admin/dark-stores', body);
      showToast('Store saved', 'success');
      closeModal('store-modal');
      load();
    } catch(e){
      showToast(e.message, 'error');
    }
    btn.disabled = false;
  }

  async function del(id){
    const s = stores.find(function(x){ return x._id === id; });
    if (!confirm('Delete "' + (s ? s.name : 'this store') + '"?\n\nIske radius ke customers ko DDGo dikhna band ho jayega, jab tak koi doosra store unhe cover na kare.')) return;
    try {
      await API.delete('/admin/dark-stores/' + id);
      showToast('Store deleted', 'success');
      load();
    } catch(e){ showToast(e.message, 'error'); }
  }

  async function checkCoverage(){
    const lat = val('c_lat'), lng = val('c_lng');
    const out = document.getElementById('c_out');
    if (!lat || !lng) { out.innerHTML = '<div style="color:#B91C1C;font-size:13px">Dono numbers daalo.</div>'; return; }
    out.innerHTML = '<div class="spinner"></div>';
    try {
      const r = await API.get('/admin/dark-stores/coverage?lat='+encodeURIComponent(lat)+'&lng='+encodeURIComponent(lng));
      out.innerHTML = (r.stores || []).length
        ? '<div style="font-weight:600;margin-bottom:8px;color:'+(r.serviceable ? '#065F46' : '#92400E')+'">'
          + (r.serviceable ? '✅ Serviceable right now' : '⚠️ Cover to hota hai, par abhi sab band hain') + '</div>'
          + r.stores.map(function(s){
              return '<div style="border:1px solid var(--border);border-radius:8px;padding:8px 10px;margin-bottom:6px;font-size:13px">'
                + '<b>'+esc(s.name)+'</b> <span style="color:var(--text-light)">('+esc(s.type)+')</span><br>'
                + s.distanceKm+' km away · radius '+s.radiusKm+' km · ETA '+s.etaMins+' min · '
                + (s.isOpen ? '<span style="color:#065F46">open</span>' : '<span style="color:#B91C1C">closed</span>')
                + '</div>';
            }).join('')
        : '<div style="color:#B91C1C;font-size:13px">❌ Koi store yahan tak nahi pahunchta. Customer ko "not delivering to your area yet" dikhega.</div>';
    } catch(e){
      out.innerHTML = '<div style="color:#B91C1C;font-size:13px">'+esc(e.message)+'</div>';
    }
  }

  async function load(){
    try {
      const r = await API.get('/admin/dark-stores');
      stores = r.items || [];
    } catch(e){
      showToast(e.message, 'error');
      stores = [];
    }
    renderList();
  }

  /* Where customers asked and got turned away, clustered to roughly a
     neighbourhood. This is the only honest input to "open a store where?" —
     everything else is a guess. */
  async function loadDemand(){
    const box = document.getElementById('store-list');
    box.innerHTML = '<div class="text-center" style="padding:40px"><div class="spinner"></div></div>';
    try {
      const r = await API.get('/admin/dark-stores/demand?days=90');
      box.innerHTML = !(r.clusters || []).length
        ? '<div class="card" style="padding:40px;text-align:center;color:var(--text-light)">'
          + '<div style="font-size:32px;margin-bottom:8px">&#128205;</div>'
          + '<div style="font-weight:600">No out-of-area requests yet</div>'
          + '<div style="font-size:13px;margin-top:4px">Jab koi aisa customer aayega jise hum cover nahi karte, uska pin yahan aayega.</div>'
          + '</div>'
        : '<div class="card" style="padding:0;overflow-x:auto">'
          + '<div style="padding:12px 16px;font-size:12.5px;color:var(--text-light);border-bottom:1px solid var(--border)">'
          + 'Last ' + r.days + ' days &middot; ' + r.total + ' requests. Sabse upar wale area me store kholna sabse zyada faayda dega.'
          + '</div>'
          + '<table class="table" style="margin:0"><thead><tr>'
          + '<th>Area</th><th>Requests</th><th>Left a phone</th><th>Last asked</th><th></th>'
          + '</tr></thead><tbody>'
          + r.clusters.map(function(c){
              return '<tr>'
                + '<td><b>' + esc(c.city || 'Unknown') + '</b>'
                  + '<div style="font-size:11px;color:var(--text-light)">' + c.lat + ', ' + c.lng
                  + (c.pincode ? ' &middot; ' + esc(c.pincode) : '') + '</div></td>'
                + '<td><b>' + c.requests + '</b></td>'
                + '<td>' + c.withPhone + '</td>'
                + '<td style="font-size:12px">' + new Date(c.lastAt).toLocaleDateString() + '</td>'
                + '<td style="text-align:right"><a class="btn btn-sm btn-outline" target="_blank" rel="noopener"'
                  + ' href="https://www.google.com/maps?q=' + c.lat + ',' + c.lng + '">Map</a></td>'
                + '</tr>';
            }).join('')
          + '</tbody></table></div>';
    } catch(e){
      box.innerHTML = '<div class="card" style="padding:24px;color:#B91C1C">' + esc(e.message) + '</div>';
    }
  }

  async function loadPerf(){
    const box = document.getElementById('store-list');
    box.innerHTML = '<div class="text-center" style="padding:40px"><div class="spinner"></div></div>';
    try {
      const r = await API.get('/admin/dark-stores/performance?days=30');
      var rows = (r.stores || []).map(function(s){
        return '<tr>'
          + '<td><b>' + esc(s.name) + '</b>'
            + (s.code ? '<div style="font-size:11px;color:var(--text-light)"><code>' + esc(s.code) + '</code></div>' : '')
          + '</td>'
          + '<td>' + s.orders + '</td>'
          + '<td>' + s.delivered + '</td>'
          + '<td>' + s.cancelled + '</td>'
          + '<td><b>' + s.fulfilmentRate + '%</b></td>'
          + '<td>' + s.avgDistanceKm + ' km</td>'
          + '<td><b>' + s.revenue.toLocaleString() + '</b></td>'
          + '</tr>';
      }).join('');

      box.innerHTML = '<div class="card" style="padding:0;overflow-x:auto">'
        + '<div style="padding:12px 16px;font-size:12.5px;color:var(--text-light);border-bottom:1px solid var(--border)">'
        + 'DDGo orders, last ' + r.days + ' days'
        + '</div>'
        + (rows
          ? '<table class="table" style="margin:0"><thead><tr>'
            + '<th>Store</th><th>Orders</th><th>Delivered</th><th>Cancelled</th><th>Fulfilment</th><th>Avg distance</th><th>Revenue</th>'
            + '</tr></thead><tbody>' + rows + '</tbody></table>'
          : '<div style="padding:40px;text-align:center;color:var(--text-light);font-size:13px">Abhi koi DDGo order nahi hua.</div>')
        + '</div>'
        + ((r.idle || []).length
          ? '<div class="card" style="margin-top:12px;padding:14px 16px">'
            + '<div style="font-weight:600;font-size:13px;margin-bottom:6px">Ek bhi order nahi mila (' + r.idle.length + ')</div>'
            + '<div style="font-size:12.5px;color:var(--text-light)">'
            + r.idle.map(function(s){ return esc(s.name) + (s.city ? ' - ' + esc(s.city) : ''); }).join(' &middot; ')
            + '</div></div>'
          : '');
    } catch(e){
      box.innerHTML = '<div class="card" style="padding:24px;color:#B91C1C">' + esc(e.message) + '</div>';
    }
  }

  /* ── Shelf ──
     Stocking is the daily job, so this is built around typing a number and
     moving on: the stock box saves on blur, nothing needs a Save button, and
     the row turns amber the moment it drops to the low-stock mark. */
  let shelfStore = null;

  function openShelf(store){
    if (!store) return;
    shelfStore = store;
    document.getElementById('shelf-title').textContent = 'Stock — ' + store.name;
    document.getElementById('sh_q').value = '';
    document.getElementById('sh_low').checked = false;
    openModal('shelf-modal');
    loadShelf();
  }

  async function loadShelf(){
    if (!shelfStore) return;
    const box = document.getElementById('sh_list');
    box.innerHTML = '<div class="text-center" style="padding:30px"><div class="spinner"></div></div>';
    const q = document.getElementById('sh_q').value.trim();
    const low = document.getElementById('sh_low').checked;
    try {
      const r = await API.get('/admin/dark-stores/' + shelfStore._id + '/inventory'
        + '?q=' + encodeURIComponent(q) + (low ? '&low=true' : ''));

      document.getElementById('sh_summary').innerHTML = r.summary.total === 0 ? ''
        : '<b>' + r.summary.total + '</b> products &middot; '
          + '<span style="color:#065F46">' + r.summary.inStock + ' in stock</span> &middot; '
          + '<span style="color:#92400E">' + r.summary.low + ' low</span> &middot; '
          + '<span style="color:#B91C1C">' + r.summary.out + ' out</span>';

      if (!r.items.length){
        box.innerHTML = '<div style="padding:36px;text-align:center;color:var(--text-light)">'
          + '<div style="font-size:30px;margin-bottom:8px">&#128230;</div>'
          + '<div style="font-weight:600">' + (q || low ? 'Kuch nahi mila' : 'Is store me abhi kuch nahi rakha') + '</div>'
          + (q || low ? '' : '<div style="font-size:13px;margin-top:4px">"+ Add products" se shuru karo. Jo product yahan nahi hai, wo is store pe customer ko dikhega hi nahi.</div>')
          + '</div>';
        return;
      }

      box.innerHTML = '<table class="table" style="margin:0"><thead><tr>'
        + '<th>Product</th><th style="width:110px">Stock</th><th style="width:120px">Price</th>'
        + '<th style="width:90px">Live</th><th style="width:60px"></th>'
        + '</tr></thead><tbody>'
        + r.items.map(function(i){
            return '<tr' + (i.isLow ? ' style="background:#FFFBEB"' : '') + '>'
              + '<td><div style="font-weight:600">' + esc(i.name) + '</div>'
                + '<div style="font-size:11px;color:var(--text-light)">'
                + (i.unit ? esc(i.unit) + ' &middot; ' : '')
                + (i.productActive ? '' : '<span style="color:#B91C1C">product disabled</span> &middot; ')
                + (i.stock === 0 ? '<span style="color:#B91C1C">out of stock</span>'
                   : i.isLow ? '<span style="color:#92400E">low (' + i.lowStockAt + ' pe warning)</span>' : 'ok')
                + '</div></td>'
              + '<td><input class="form-control sh-stock" data-p="' + i.product + '" type="number" min="0" value="' + i.stock + '" style="padding:5px 8px"></td>'
              + '<td><input class="form-control sh-price" data-p="' + i.product + '" type="number" min="0" value="' + i.sellingPrice + '" style="padding:5px 8px"'
                + ' title="' + (i.hasPriceOverride ? 'Is store ka apna price' : 'Catalogue price - badloge to sirf is store pe lagega') + '"></td>'
              + '<td><input type="checkbox" class="sh-live" data-p="' + i.product + '"' + (i.isActive ? ' checked' : '') + '></td>'
              + '<td style="text-align:right"><button class="btn btn-sm btn-danger sh-del" data-p="' + i.product + '" title="Is store se hatao">&times;</button></td>'
              + '</tr>';
          }).join('')
        + '</tbody></table>';

      // Save on blur — an operator counting crates should not hunt for a button.
      box.querySelectorAll('.sh-stock').forEach(function(el){
        el.onchange = function(){ saveShelf(el.dataset.p, { stock: el.value }); };
      });
      box.querySelectorAll('.sh-price').forEach(function(el){
        el.onchange = function(){ saveShelf(el.dataset.p, { sellingPrice: el.value }); };
      });
      box.querySelectorAll('.sh-live').forEach(function(el){
        el.onchange = function(){ saveShelf(el.dataset.p, { isActive: el.checked }); };
      });
      box.querySelectorAll('.sh-del').forEach(function(el){
        el.onclick = function(){ removeFromShelf(el.dataset.p); };
      });
    } catch(e){
      box.innerHTML = '<div style="padding:20px;color:#B91C1C">' + esc(e.message) + '</div>';
    }
  }

  async function saveShelf(productId, patch){
    try {
      await API.put('/admin/dark-stores/' + shelfStore._id + '/inventory',
        Object.assign({ product: productId }, patch));
      showToast('Saved', 'success');
      loadShelf();
    } catch(e){
      showToast(e.message, 'error');
      loadShelf();   // put the field back to what the server actually holds
    }
  }

  async function removeFromShelf(productId){
    if (!confirm('Is store se hata dein?\n\nStock ka record chala jayega. Sirf bech-na band karna ho to "Live" uncheck karo.')) return;
    try {
      await API.delete('/admin/dark-stores/' + shelfStore._id + '/inventory/' + productId);
      showToast('Removed', 'success');
      loadShelf();
    } catch(e){ showToast(e.message, 'error'); }
  }

  /* ── Picker ── */
  async function loadPicker(){
    const box = document.getElementById('pk_list');
    box.innerHTML = '<div class="text-center" style="padding:30px"><div class="spinner"></div></div>';
    const q = document.getElementById('pk_q').value.trim();
    try {
      const r = await API.get('/admin/dark-stores/' + shelfStore._id + '/stockable?q=' + encodeURIComponent(q));
      if (!r.products.length){
        box.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-light);font-size:13px">'
          + (q ? 'Kuch nahi mila.' : 'Saare Quick Commerce products pehle se is store me hain.<br>Naye product Products page pe "Quick Commerce" tab se banao.')
          + '</div>';
        return;
      }
      box.innerHTML = '<table class="table" style="margin:0"><thead><tr>'
        + '<th style="width:40px"></th><th>Product</th><th style="width:110px">Stock</th><th style="width:120px">Price</th>'
        + '</tr></thead><tbody>'
        + r.products.map(function(p){
            return '<tr>'
              + '<td><input type="checkbox" class="pk-on" data-p="' + p._id + '"></td>'
              + '<td><div style="font-weight:600">' + esc(p.name) + '</div>'
                + '<div style="font-size:11px;color:var(--text-light)">catalogue ' + p.sellingPrice
                + (p.isActive ? '' : ' &middot; <span style="color:#B91C1C">disabled</span>') + '</div></td>'
              + '<td><input class="form-control pk-stock" data-p="' + p._id + '" type="number" min="0" value="0" style="padding:5px 8px"></td>'
              + '<td><input class="form-control pk-price" data-p="' + p._id + '" type="number" min="0" value="0" placeholder="' + p.sellingPrice + '" style="padding:5px 8px" title="Khaali/0 = catalogue price"></td>'
              + '</tr>';
          }).join('')
        + '</tbody></table>';

      // Typing a stock number is the intent to stock it — no need to also tick.
      box.querySelectorAll('.pk-stock').forEach(function(el){
        el.onchange = function(){
          const cb = box.querySelector('.pk-on[data-p="' + el.dataset.p + '"]');
          if (cb && parseFloat(el.value) > 0) cb.checked = true;
        };
      });
    } catch(e){
      box.innerHTML = '<div style="padding:20px;color:#B91C1C">' + esc(e.message) + '</div>';
    }
  }

  async function addSelected(){
    const box = document.getElementById('pk_list');
    const items = [];
    box.querySelectorAll('.pk-on:checked').forEach(function(cb){
      const id = cb.dataset.p;
      const st = box.querySelector('.pk-stock[data-p="' + id + '"]');
      const pr = box.querySelector('.pk-price[data-p="' + id + '"]');
      items.push({ product: id, stock: st ? st.value : 0, sellingPrice: pr && pr.value ? pr.value : 0 });
    });
    if (!items.length){ showToast('Pehle koi product select karo', 'error'); return; }

    const btn = document.getElementById('btnAddSelected');
    btn.disabled = true;
    try {
      const r = await API.post('/admin/dark-stores/' + shelfStore._id + '/inventory/bulk', { items: items });
      showToast(r.added + ' added, ' + r.updated + ' updated' + (r.skipped ? ', ' + r.skipped + ' skipped' : ''), 'success');
      closeModal('pick-modal');
      loadShelf();
    } catch(e){ showToast(e.message, 'error'); }
    btn.disabled = false;
  }

  function setTab(name){
    document.querySelectorAll('.ds-tab').forEach(function(b){
      b.classList.toggle('on', b.dataset.tab === name);
    });
    var onStores = name === 'stores';
    document.getElementById('btnNew').style.display = onStores ? '' : 'none';
    document.getElementById('btnCoverage').style.display = onStores ? '' : 'none';
    if (onStores) load();
    else if (name === 'demand') loadDemand();
    else loadPerf();
  }

  main.innerHTML = shell();
  document.getElementById('btnNew').onclick = function(){ openForm({}); };
  document.getElementById('btnSaveStore').onclick = save;
  document.getElementById('btnCoverage').onclick = function(){
    document.getElementById('c_out').innerHTML = '';
    openModal('cov-modal');
  };
  document.getElementById('btnCheckCov').onclick = checkCoverage;
  document.querySelectorAll('.ds-tab').forEach(function(b){
    b.onclick = function(){ setTab(b.dataset.tab); };
  });

  var shDebounce;
  document.getElementById('sh_q').oninput = function(){
    clearTimeout(shDebounce); shDebounce = setTimeout(loadShelf, 300);
  };
  document.getElementById('sh_low').onchange = loadShelf;
  document.getElementById('btnAddProducts').onclick = function(){
    document.getElementById('pk_q').value = '';
    openModal('pick-modal');
    loadPicker();
  };
  var pkDebounce;
  document.getElementById('pk_q').oninput = function(){
    clearTimeout(pkDebounce); pkDebounce = setTimeout(loadPicker, 300);
  };
  document.getElementById('btnAddSelected').onclick = addSelected;

  setTab('stores');
})();
