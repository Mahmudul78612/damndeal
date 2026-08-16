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

  main.innerHTML = shell();
  document.getElementById('btnNew').onclick = function(){ openForm({}); };
  document.getElementById('btnSaveStore').onclick = save;
  document.getElementById('btnCoverage').onclick = function(){
    document.getElementById('c_out').innerHTML = '';
    openModal('cov-modal');
  };
  document.getElementById('btnCheckCov').onclick = checkCoverage;

  load();
})();
