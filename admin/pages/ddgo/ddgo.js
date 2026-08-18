(function(){
  requireAuth();
  document.body.innerHTML = pageShell('DDGo Command Center');
  buildLayout('ddgo');

  var main = document.getElementById('page-content');
  var tab = 'orders';
  var stores = [];          // dark stores, for the store filter + rider assignment
  var riders = [];
  var knownOrderIds = {};   // beep only for orders we have not seen this session
  var firstOrderLoad = true;
  var pollTimer = null;

  var GREEN = '#0D7A30';
  var STATUS_FLOW = ['placed','confirmed','processing','ready','shipped','delivered'];
  var STATUS_LABEL = {
    placed:'New', confirmed:'Accepted', processing:'Packing', ready:'Ready',
    shipped:'On the way', delivered:'Delivered', cancelled:'Cancelled', returned:'Returned',
  };
  var STATUS_COLOR = {
    placed:'#B91C1C', confirmed:'#1D4ED8', processing:'#92400E', ready:'#92400E',
    shipped:GREEN, delivered:'#065F46', cancelled:'#6B7280', returned:'#6B7280',
  };

  /* A short beep for a new order — an operator is not staring at this tab. */
  function beep(){
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; g.gain.value = 0.08;
      o.start(); setTimeout(function(){ o.stop(); ctx.close(); }, 350);
    } catch(e){ /* audio blocked until first interaction — fine */ }
  }

  function esc2(s){ return esc(String(s == null ? '' : s)); }

  function shell(){
    return ''
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;flex-wrap:wrap;gap:10px">'
      +   '<div><h2 style="margin:0;font-size:1.3rem;display:flex;align-items:center;gap:8px">'
      +     '<span style="width:26px;height:26px;border-radius:7px;background:'+GREEN+';display:inline-grid;place-items:center;color:#fff;font-size:14px">⚡</span>'
      +     ' DDGo Command Center</h2>'
      +   '<p style="color:var(--text-light);font-size:13px;margin:4px 0 0">Quick commerce ka poora operation — live orders, approvals, stores, riders — ek jagah.</p></div>'
      +   '<div id="dd-stats" style="display:flex;gap:10px;flex-wrap:wrap"></div>'
      + '</div>'
      + '<div style="display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:16px;flex-wrap:wrap">'
      +   tabBtn('orders','🔴 Live Orders')
      +   tabBtn('approvals','✅ Product Approvals')
      +   tabBtn('stores','🏬 Stores')
      +   tabBtn('riders','🚴 Riders')
      +   tabBtn('demand','📍 Demand')
      + '</div>'
      + '<style>.dd-tab{background:none;border:none;padding:9px 14px;font-size:13px;font-weight:600;color:var(--text-light);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}'
      + '.dd-tab.on{color:'+GREEN+';border-bottom-color:'+GREEN+'}'
      + '.dd-chip{font-size:11px;font-weight:800;padding:3px 9px;border-radius:99px;display:inline-block}'
      + '.dd-stat{background:var(--card,#fff);border:1px solid var(--border);border-radius:12px;padding:8px 14px;text-align:center}'
      + '.dd-stat b{display:block;font-size:18px}.dd-stat span{font-size:11px;color:var(--text-light)}</style>'
      + '<div id="dd-body"></div>';
  }
  function tabBtn(k, label){ return '<button class="dd-tab" data-t="'+k+'">'+label+'</button>'; }

  function setTab(k){
    tab = k;
    document.querySelectorAll('.dd-tab').forEach(function(b){ b.classList.toggle('on', b.dataset.t === k); });
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (k === 'orders') { loadOrders(); pollTimer = setInterval(loadOrders, 15000); }
    else if (k === 'approvals') loadApprovals();
    else if (k === 'stores') loadStores();
    else if (k === 'riders') loadRiders();
    else loadDemand();
  }

  /* ── header stats ── */
  async function loadStats(){
    try {
      var r = await API.get('/admin/dark-stores/performance?days=1');
      var t = (r.stores || []).reduce(function(a,s){ a.o += s.orders; a.r += s.revenue; return a; }, {o:0, r:0});
      var live = await API.get('/admin/orders?platform=ddgo&tab=active&limit=1');
      document.getElementById('dd-stats').innerHTML =
        '<div class="dd-stat"><b style="color:#B91C1C">'+(live.pagination ? live.pagination.total : (live.total||0))+'</b><span>naye orders</span></div>'
        + '<div class="dd-stat"><b>'+t.o+'</b><span>aaj ke orders</span></div>'
        + '<div class="dd-stat"><b>'+t.r.toLocaleString()+'</b><span>aaj ka revenue</span></div>';
    } catch(e){ /* stats are decoration; the tabs still work */ }
  }

  /* ── Live orders ── */
  async function loadOrders(){
    var box = document.getElementById('dd-body');
    if (firstOrderLoad) box.innerHTML = '<div class="text-center" style="padding:40px"><div class="spinner"></div></div>';
    try {
      var storeQ = (document.getElementById('f_store') || {}).value || '';
      var r = await API.get('/admin/orders?platform=ddgo&limit=40' + (storeQ ? '&store='+storeQ : ''));
      var orders = r.orders || [];

      // Beep once per genuinely new "placed" order.
      var fresh = orders.filter(function(o){ return o.status === 'placed' && !knownOrderIds[o._id]; });
      orders.forEach(function(o){ knownOrderIds[o._id] = 1; });
      if (!firstOrderLoad && fresh.length) beep();
      firstOrderLoad = false;

      var storeOpts = '<option value="">All stores</option>' + stores.map(function(s){
        return '<option value="'+s._id+'"'+(storeQ===s._id?' selected':'')+'>'+esc2(s.name)+'</option>';
      }).join('') + '<option value="none"'+(storeQ==='none'?' selected':'')+'>Unassigned</option>';

      box.innerHTML =
        '<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">'
        + '<select class="form-control" id="f_store" style="max-width:260px">'+storeOpts+'</select>'
        + '<span style="font-size:11.5px;color:var(--text-light)">Har 15 sec khud refresh · naya order aane par 🔔 beep</span>'
        + '</div>'
        + (!orders.length
          ? '<div class="card" style="padding:40px;text-align:center;color:var(--text-light)">Abhi koi DDGo order nahi.</div>'
          : '<div class="card" style="padding:0;overflow-x:auto"><table class="table" style="margin:0"><thead><tr>'
            + '<th>Order</th><th>Store</th><th>Customer</th><th>Total</th><th>Status</th><th>Rider</th><th style="min-width:210px">Actions</th>'
            + '</tr></thead><tbody>'
            + orders.map(orderRow).join('')
            + '</tbody></table></div>');

      document.getElementById('f_store').onchange = loadOrders;
      bindOrderActions(box, orders);
    } catch(e){
      box.innerHTML = '<div class="card" style="padding:22px;color:#B91C1C">'+esc2(e.message)+'</div>';
    }
    loadStats();
  }

  function orderRow(o){
    var next = STATUS_FLOW[STATUS_FLOW.indexOf(o.status) + 1];
    var riderOpts = '<option value="">assign rider…</option>' + riders.map(function(b){
      return '<option value="'+b._id+'">'+esc2(b.name)+(b.store&&b.store.name?' ('+esc2(b.store.name)+')':'')+'</option>';
    }).join('');
    return '<tr'+(o.status==='placed'?' style="background:#FEF2F2"':'')+'>'
      + '<td><b>'+esc2(o.orderNumber)+'</b><div style="font-size:11px;color:var(--text-light)">'+new Date(o.createdAt).toLocaleTimeString()+' · '+(o.paymentMethod||'').toUpperCase()+'</div></td>'
      + '<td>'+esc2(o.store ? o.store.name : (o.partner ? o.partner.name : '—'))+'</td>'
      + '<td>'+esc2((o.deliveryAddress&&o.deliveryAddress.city)||'—')+'</td>'
      + '<td><b>'+(o.grandTotal||0).toLocaleString()+'</b></td>'
      + '<td><span class="dd-chip" style="background:'+(STATUS_COLOR[o.status]||'#888')+'22;color:'+(STATUS_COLOR[o.status]||'#888')+'">'+(STATUS_LABEL[o.status]||o.status)+'</span></td>'
      + '<td style="font-size:12px">'+esc2(o.deliveryBoy && o.deliveryBoy.name ? o.deliveryBoy.name : '—')+'</td>'
      + '<td style="white-space:nowrap">'
        + (next && o.status!=='delivered' && o.status!=='cancelled'
            ? '<button class="btn btn-sm btn-primary" data-adv="'+o._id+'" data-next="'+next+'">→ '+STATUS_LABEL[next]+'</button> ' : '')
        + (['placed','confirmed','processing','ready'].indexOf(o.status)>=0
            ? '<select class="form-control" data-rider="'+o._id+'" style="display:inline-block;width:150px;padding:4px 6px;font-size:12px">'+riderOpts+'</select>' : '')
      + '</td></tr>';
  }

  function bindOrderActions(box, orders){
    box.querySelectorAll('[data-adv]').forEach(function(b){
      b.onclick = async function(){
        b.disabled = true;
        try { await API.put('/admin/orders/'+b.dataset.adv+'/status', { status: b.dataset.next }); showToast('Order → '+STATUS_LABEL[b.dataset.next]); }
        catch(e){ showToast(e.message,'error'); }
        loadOrders();
      };
    });
    box.querySelectorAll('[data-rider]').forEach(function(sel){
      sel.onchange = async function(){
        if (!sel.value) return;
        try { await API.put('/admin/orders/'+sel.dataset.rider+'/assign-delivery', { deliveryBoyId: sel.value }); showToast('Rider assigned'); }
        catch(e){ showToast(e.message,'error'); }
        loadOrders();
      };
    });
  }

  /* ── Product approvals ── */
  async function loadApprovals(){
    var box = document.getElementById('dd-body');
    box.innerHTML = '<div class="text-center" style="padding:40px"><div class="spinner"></div></div>';
    try {
      var r = await API.get('/admin/products?platform=ddgo&approvalStatus=pending&limit=50&region=all');
      var items = r.products || [];
      box.innerHTML = !items.length
        ? '<div class="card" style="padding:40px;text-align:center;color:var(--text-light)">Koi DDGo product review me nahi. ✨</div>'
        : '<div class="card" style="padding:0;overflow-x:auto"><table class="table" style="margin:0"><thead><tr>'
          + '<th></th><th>Product</th><th>Seller</th><th>Price</th><th>Stock</th><th></th></tr></thead><tbody>'
          + items.map(function(p){
              return '<tr>'
                + '<td>'+((p.images&&p.images[0])?'<img src="'+esc2(CONFIG.UPLOADS_BASE ? (p.images[0].indexOf("http")===0?p.images[0]:CONFIG.UPLOADS_BASE+p.images[0]) : p.images[0])+'" style="width:42px;height:42px;object-fit:cover;border-radius:8px">':'—')+'</td>'
                + '<td><b>'+esc2(p.name)+'</b><div style="font-size:11px;color:var(--text-light)">'+esc2(p.category&&p.category.name||'')+' · '+esc2(p.unit||'')+'</div></td>'
                + '<td style="font-size:12px">'+esc2(p.partner&&p.partner.name||'—')+'</td>'
                + '<td>'+(p.sellingPrice||0)+' <span style="color:var(--text-light);text-decoration:line-through;font-size:11px">'+(p.mrp||0)+'</span></td>'
                + '<td>'+(p.stock||0)+'</td>'
                + '<td style="white-space:nowrap">'
                  + '<button class="btn btn-sm btn-primary" data-ok="'+p._id+'">Approve</button> '
                  + '<button class="btn btn-sm btn-danger" data-no="'+p._id+'">Reject</button>'
                + '</td></tr>';
            }).join('')
          + '</tbody></table></div>';
      box.querySelectorAll('[data-ok]').forEach(function(b){
        b.onclick = async function(){ try { await API.put('/admin/products/'+b.dataset.ok+'/review',{status:'approved'}); showToast('Approved'); } catch(e){ showToast(e.message,'error'); } loadApprovals(); };
      });
      box.querySelectorAll('[data-no]').forEach(function(b){
        b.onclick = async function(){
          var note = prompt('Reject kyu? (seller ko dikhega)') || '';
          try { await API.put('/admin/products/'+b.dataset.no+'/review',{status:'rejected', note:note}); showToast('Rejected'); } catch(e){ showToast(e.message,'error'); }
          loadApprovals();
        };
      });
    } catch(e){ box.innerHTML = '<div class="card" style="padding:22px;color:#B91C1C">'+esc2(e.message)+'</div>'; }
  }

  /* ── Stores (summary + jump to full manager) ── */
  async function loadStores(){
    var box = document.getElementById('dd-body');
    box.innerHTML = '<div class="text-center" style="padding:40px"><div class="spinner"></div></div>';
    try {
      var perf = await API.get('/admin/dark-stores/performance?days=30');
      var byId = {}; (perf.stores||[]).forEach(function(s){ byId[s.storeId] = s; });
      box.innerHTML =
        '<div style="display:flex;justify-content:flex-end;margin-bottom:10px">'
        + '<a class="btn btn-primary btn-sm" href="../dark-stores/dark-stores.html">Manage stores →</a></div>'
        + '<div class="card" style="padding:0;overflow-x:auto"><table class="table" style="margin:0"><thead><tr>'
        + '<th>Store</th><th>City</th><th>Radius</th><th>Status</th><th>30d orders</th><th>30d revenue</th><th>Fulfilment</th>'
        + '</tr></thead><tbody>'
        + stores.map(function(s){
            var p = byId[s._id] || {orders:0, revenue:0, fulfilmentRate:0};
            return '<tr><td><b>'+esc2(s.name)+'</b> <code style="font-size:10px">'+esc2(s.code)+'</code></td>'
              + '<td>'+esc2(s.city||'—')+'</td><td>'+s.radiusKm+' km</td>'
              + '<td>'+(s.isActive ? (s.isOpenNow ? '<span class="dd-chip" style="background:#D1FAE5;color:#065F46">Open</span>' : '<span class="dd-chip" style="background:#E5E7EB;color:#4B5563">Closed</span>') : '<span class="dd-chip" style="background:#f1f1f1;color:#888">Inactive</span>')+'</td>'
              + '<td>'+p.orders+'</td><td>'+p.revenue.toLocaleString()+'</td><td>'+p.fulfilmentRate+'%</td></tr>';
          }).join('')
        + '</tbody></table></div>';
    } catch(e){ box.innerHTML = '<div class="card" style="padding:22px;color:#B91C1C">'+esc2(e.message)+'</div>'; }
  }

  /* ── Riders ── */
  async function loadRiders(){
    var box = document.getElementById('dd-body');
    box.innerHTML = '<div class="text-center" style="padding:40px"><div class="spinner"></div></div>';
    try {
      var r = await API.get('/admin/delivery-boys?limit=100');
      riders = r.deliveryBoys || [];
      var storeOpts = function(cur){
        return '<option value="">Floating (koi bhi order)</option>' + stores.map(function(s){
          return '<option value="'+s._id+'"'+(cur===s._id?' selected':'')+'>'+esc2(s.name)+'</option>';
        }).join('');
      };
      box.innerHTML = !riders.length
        ? '<div class="card" style="padding:40px;text-align:center;color:var(--text-light)">Koi delivery boy nahi. Delivery Boys page se add karo.</div>'
        : '<div class="card" style="padding:0;overflow-x:auto"><table class="table" style="margin:0"><thead><tr>'
          + '<th>Rider</th><th>Phone</th><th>Online</th><th>Home store (DDGo shift)</th></tr></thead><tbody>'
          + riders.map(function(b){
              return '<tr><td><b>'+esc2(b.name)+'</b></td>'
                + '<td style="font-size:12px">'+esc2(b.phone||(b.user&&b.user.phone)||'—')+'</td>'
                + '<td>'+(b.isOnline?'<span class="dd-chip" style="background:#D1FAE5;color:#065F46">Online</span>':'<span class="dd-chip" style="background:#f1f1f1;color:#888">Off</span>')+'</td>'
                + '<td><select class="form-control" data-boy="'+b._id+'" style="max-width:260px;padding:5px 8px">'+storeOpts(b.store&&b.store._id?b.store._id:(b.store||''))+'</select></td>'
                + '</tr>';
            }).join('')
          + '</tbody></table></div>';
      box.querySelectorAll('[data-boy]').forEach(function(sel){
        sel.onchange = async function(){
          try { await API.put('/admin/delivery-boys/'+sel.dataset.boy+'/store', { store: sel.value || null }); showToast('Saved'); }
          catch(e){ showToast(e.message,'error'); }
        };
      });
    } catch(e){ box.innerHTML = '<div class="card" style="padding:22px;color:#B91C1C">'+esc2(e.message)+'</div>'; }
  }

  /* ── Demand ── */
  async function loadDemand(){
    var box = document.getElementById('dd-body');
    box.innerHTML = '<div class="text-center" style="padding:40px"><div class="spinner"></div></div>';
    try {
      var r = await API.get('/admin/dark-stores/demand?days=90');
      box.innerHTML = !(r.clusters||[]).length
        ? '<div class="card" style="padding:40px;text-align:center;color:var(--text-light)">Abhi koi out-of-area request nahi — jaha hum nahi pahunchte waha se koi aaya hi nahi.</div>'
        : '<div class="card" style="padding:0;overflow-x:auto">'
          + '<div style="padding:12px 16px;font-size:12.5px;color:var(--text-light);border-bottom:1px solid var(--border)">Last '+r.days+' days · '+r.total+' requests. Sabse upar wala area = agla store.</div>'
          + '<table class="table" style="margin:0"><thead><tr><th>Area</th><th>Requests</th><th>Phone diya</th><th></th></tr></thead><tbody>'
          + r.clusters.map(function(c){
              return '<tr><td><b>'+esc2(c.city||'Unknown')+'</b> <span style="font-size:11px;color:var(--text-light)">'+c.lat+', '+c.lng+'</span></td>'
                + '<td><b>'+c.requests+'</b></td><td>'+c.withPhone+'</td>'
                + '<td style="text-align:right"><a class="btn btn-sm btn-outline" target="_blank" rel="noopener" href="https://www.google.com/maps?q='+c.lat+','+c.lng+'">Map</a></td></tr>';
            }).join('')
          + '</tbody></table></div>';
    } catch(e){ box.innerHTML = '<div class="card" style="padding:22px;color:#B91C1C">'+esc2(e.message)+'</div>'; }
  }

  /* ── boot ── */
  main.innerHTML = shell();
  document.querySelectorAll('.dd-tab').forEach(function(b){ b.onclick = function(){ setTab(b.dataset.t); }; });

  Promise.all([
    API.get('/admin/dark-stores').then(function(r){ stores = r.items || []; }).catch(function(){}),
    API.get('/admin/delivery-boys?limit=100').then(function(r){ riders = r.deliveryBoys || []; }).catch(function(){}),
  ]).then(function(){ setTab('orders'); });

  window.addEventListener('beforeunload', function(){ if (pollTimer) clearInterval(pollTimer); });
})();
