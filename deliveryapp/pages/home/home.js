(function(){
  if(!requireAuth()) return;

  document.body.innerHTML = appShell('home');
  const $page = document.getElementById('pageContent');

  let orders = [], filter = 'active';

  async function init(){
    loadOnlineStatus();
    startLocationTracking();
    render();
    await loadOrders();
  }

  function render(){
    $page.innerHTML = `
      <div class="stat-row" id="statsRow">
        <div class="stat-card"><div class="label">Today's Deliveries</div><div class="value" id="sTodayDel">—</div></div>
        <div class="stat-card"><div class="label">Today's Earnings</div><div class="value" id="sTodayEarn">—</div></div>
      </div>

      <div class="flex-between mb-1">
        <h3 style="font-size:15px;font-weight:600">My Orders</h3>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm ${filter==='active'?'btn-primary':'btn-outline'}" onclick="setFilter('active')">Active</button>
          <button class="btn btn-sm ${filter==='delivered'?'btn-primary':'btn-outline'}" onclick="setFilter('delivered')">Done</button>
          <button class="btn btn-sm ${filter==='failed'?'btn-primary':'btn-outline'}" onclick="setFilter('failed')">Failed</button>
        </div>
      </div>
      <div id="ordersList"></div>
    `;
    renderOrders();
    loadStats();
  }

  async function loadStats(){
    try{
      const d = await API.get('/delivery/earnings');
      const el1 = document.getElementById('sTodayDel');
      const el2 = document.getElementById('sTodayEarn');
      if(el1) el1.textContent = d.period?.deliveries ?? d.totalDeliveries ?? 0;
      if(el2) el2.textContent = fmtCurrency(d.period?.totalCollected ?? d.totalEarnings ?? 0);
    }catch(e){}
  }

  async function loadOrders(){
    const $list = document.getElementById('ordersList');
    if($list) $list.innerHTML = '<div class="text-center mt-2"><span class="spinner"></span></div>';
    try{
      let status = '';
      if(filter==='active') status = 'assigned,picked_up,on_the_way';
      else if(filter==='delivered') status = 'delivered';
      else if(filter==='failed') status = 'failed';
      const d = await API.get('/delivery/assignments?limit=50&status='+status);
      orders = d.orders || d.data || d || [];
      if(!Array.isArray(orders)) orders = [];
      renderOrders();
    }catch(e){
      if($list) $list.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>${esc(e.message)}</p></div>`;
    }
  }

  function renderOrders(){
    const $list = document.getElementById('ordersList');
    if(!$list) return;
    if(!orders.length){
      $list.innerHTML = `<div class="empty-state"><div class="icon">📦</div><p>${filter==='active'?'No active orders right now':'No orders found'}</p></div>`;
      return;
    }
    $list.innerHTML = orders.map(o => {
      const addr = o.deliveryAddress || o.address || {};
      const addrText = addr.street || addr.fullAddress || addr.addressLine || 'Address N/A';
      const items = (o.items||[]).length;
      return `
      <div class="order-card" onclick="openOrder('${o._id}')">
        <div class="top">
          <span class="order-num">#${esc(o.orderNumber||o._id?.slice(-6))}</span>
          ${statusBadge(o.deliveryStatus||o.status)}
        </div>
        <div class="addr"><span class="pin">📍</span><span>${esc(addrText)}</span></div>
        <div class="meta">
          <span>${items} item${items!==1?'s':''} · ${esc(o.paymentMethod||'—')}</span>
          <span class="fw-600" style="color:var(--primary)">${fmtCurrency(o.totalAmount||o.grandTotal||0)}</span>
        </div>
      </div>`;
    }).join('');
  }

  window.setFilter = function(f){ filter=f; render(); loadOrders(); };
  window.openOrder = function(id){ window.location.href='../order/order.html?id='+id; };

  init();
})();
