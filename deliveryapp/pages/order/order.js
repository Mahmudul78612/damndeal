(function(){
  if(!requireAuth()) return;

  const orderId = new URLSearchParams(window.location.search).get('id');
  if(!orderId){ window.location.href='../home/home.html'; return; }

  document.body.innerHTML = `
    <div class="app-header">
      <div style="display:flex;align-items:center;gap:10px">
        <button onclick="window.location.href='../home/home.html'" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer">←</button>
        <span class="brand" style="font-size:15px">Order Details</span>
      </div>
      <div class="header-right">
        <button class="header-btn" id="onlineToggle" onclick="toggleOnline()">
          <span class="status-dot offline" id="statusDot"></span><span id="statusLabel">Offline</span>
        </button>
      </div>
    </div>
    <div class="app-body" id="pageContent"><div class="text-center mt-2"><span class="spinner"></span></div></div>
  `;

  loadOnlineStatus();
  let order = null;

  async function load(){
    try{
      order = await API.get('/delivery/assignments/'+orderId);
      if(order.order) order = order.order;
      render();
    }catch(e){
      document.getElementById('pageContent').innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>${esc(e.message)}</p></div>`;
    }
  }

  function render(){
    const $p = document.getElementById('pageContent');
    const ds = order.deliveryStatus || 'assigned';
    const isDone = ds==='delivered'||ds==='failed';
    const addr = order.deliveryAddress || order.address || {};
    const partnerAddr = order.partnerAddress || order.pickupAddress || order.partner?.address || {};
    const partnerName = order.partner?.businessName || order.partner?.name || 'Shop';
    const custName = order.user?.name || order.customer?.name || 'Customer';
    const custPhone = order.user?.phone || order.customer?.phone || '';

    // Steps bar
    const steps = [
      {key:'assigned',label:'Assigned',icon:'📋'},
      {key:'picked_up',label:'Picked Up',icon:'🛍️'},
      {key:'on_the_way',label:'On The Way',icon:'🚀'},
      {key:'delivered',label:'Delivered',icon:'✅'}
    ];
    const stepIdx = steps.findIndex(s=>s.key===ds);

    $p.innerHTML = `
      <!-- Status Steps -->
      <div class="card">
        <div class="card-body" style="padding:16px 10px">
          <div class="steps">
            ${steps.map((s,i)=>{
              let cls = i<stepIdx?'done': i===stepIdx?'active':'';
              if(ds==='failed' && i>=stepIdx) cls = i===stepIdx?'active':'';
              return `<div class="step ${cls}">
                <div class="dot">${i<stepIdx?'✓':s.icon}</div>
                <span class="label">${s.label}</span>
              </div>`;
            }).join('')}
          </div>
          ${ds==='failed'?'<div class="text-center mt-1"><span class="badge badge-danger">❌ Delivery Failed</span></div>':''}
        </div>
      </div>

      <!-- Order Info -->
      <div class="card">
        <div class="card-header">
          <h3>#${esc(order.orderNumber||orderId.slice(-6))}</h3>
          <span class="fw-600" style="color:var(--primary)">${fmtCurrency(order.totalAmount||order.grandTotal||0)}</span>
        </div>
        <div class="card-body">
          <div class="text-sm text-muted mb-1">${fmtDateTime(order.createdAt)}</div>
          <div class="flex-between text-sm">
            <span>Payment: <b>${esc(order.paymentMethod||'—')}</b></span>
            <span>${statusBadge(order.paymentStatus||'pending')}</span>
          </div>
          ${order.deliveryOtp && !isDone ? `<div class="mt-1 text-sm"><b>Delivery OTP:</b> <span style="font-size:18px;font-weight:700;color:var(--primary);letter-spacing:2px">${esc(order.deliveryOtp)}</span></div>` : ''}
        </div>
      </div>

      <!-- Items -->
      <div class="card">
        <div class="card-header"><h3>Items (${(order.items||[]).length})</h3></div>
        <div class="card-body" style="padding:8px 14px">
          ${(order.items||[]).map(it=>{
            const prod = it.product || {};
            const img = prod.images?.[0] || '';
            return `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)">
              ${img ? `<img src="${CONFIG.API_BASE.replace('/api','')}/${img}" style="width:40px;height:40px;border-radius:6px;object-fit:cover">` : '<div style="width:40px;height:40px;border-radius:6px;background:var(--bg);display:flex;align-items:center;justify-content:center">📦</div>'}
              <div style="flex:1"><div class="text-sm fw-600">${esc(prod.name||it.name||'Product')}</div><div class="text-xs text-muted">Qty: ${it.quantity||1}</div></div>
              <span class="fw-600 text-sm">${fmtCurrency(it.price||0)}</span>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Shop / Pickup Location -->
      <div class="direction-card">
        <div class="label">PICKUP FROM</div>
        <div class="address">🏪 ${esc(partnerName)}</div>
        <div class="text-sm" style="opacity:.8;margin-bottom:8px">${esc(partnerAddr.street||partnerAddr.fullAddress||partnerAddr.addressLine||'')}</div>
        ${partnerAddr.lat||partnerAddr.location?.coordinates ? `<button class="nav-link" onclick="openDirections(${partnerAddr.lat||partnerAddr.location?.coordinates?.[1]||0},${partnerAddr.lng||partnerAddr.location?.coordinates?.[0]||0},'Shop')">📍 Get Directions</button>` : ''}
      </div>

      <!-- Customer / Delivery Location -->
      <div class="direction-card" style="background:linear-gradient(135deg,#065F46,#10B981)">
        <div class="label">DELIVER TO</div>
        <div class="address">👤 ${esc(custName)} ${custPhone?'· '+esc(custPhone):''}</div>
        <div class="text-sm" style="opacity:.8;margin-bottom:8px">${esc(addr.street||addr.fullAddress||addr.addressLine||'')}</div>
        ${addr.lat||addr.location?.coordinates ? `<button class="nav-link" onclick="openDirections(${addr.lat||addr.location?.coordinates?.[1]||0},${addr.lng||addr.location?.coordinates?.[0]||0},'Customer')">📍 Get Directions</button>` : ''}
      </div>

      <!-- ACTION BUTTONS (Swipe) -->
      <div id="actionArea">${renderActions(ds)}</div>
    `;
  }

  function renderActions(ds){
    if(ds==='delivered') return '<div class="text-center mt-2"><span class="badge badge-success" style="font-size:14px;padding:8px 20px">✅ Delivered Successfully</span></div>';
    if(ds==='failed') return '<div class="text-center mt-2"><span class="badge badge-danger" style="font-size:14px;padding:8px 20px">❌ Delivery Failed</span><div class="mt-1 text-sm text-muted">'+(order.note||'')+'</div></div>';

    let html = '';
    if(ds==='assigned'){
      html += `
        <div class="swipe-container" id="swipePickup">
          <div class="swipe-fill"></div>
          <div class="swipe-track">Swipe to Pick Up →</div>
          <div class="swipe-thumb">🛍️</div>
        </div>`;
    }
    if(ds==='picked_up'){
      html += `
        <div class="swipe-container" id="swipeOtw">
          <div class="swipe-fill"></div>
          <div class="swipe-track">Swipe — On The Way →</div>
          <div class="swipe-thumb">🚀</div>
        </div>`;
    }
    if(ds==='on_the_way'){
      html += `
        <div class="form-group mt-1">
          <label>Customer OTP (ask the customer)</label>
          <input type="tel" class="form-control" id="deliverOtpInput" placeholder="Enter 4-digit OTP" maxlength="4" inputmode="numeric">
        </div>
        <div class="swipe-container" id="swipeDeliver">
          <div class="swipe-fill"></div>
          <div class="swipe-track">Swipe to Deliver →</div>
          <div class="swipe-thumb">✅</div>
        </div>`;
    }

    // fail button (always available if not done)
    if(!['delivered','failed'].includes(ds)){
      html += `<button class="btn btn-outline mt-1" style="color:var(--danger);border-color:var(--danger)" onclick="showFailModal()">❌ Mark as Failed</button>`;
    }

    return html;
  }

  function bindSwipes(){
    setTimeout(()=>{
      const sPickup = document.getElementById('swipePickup');
      const sOtw = document.getElementById('swipeOtw');
      const sDeliver = document.getElementById('swipeDeliver');

      initSwipe(sPickup, async()=>{
        try{ await API.put('/delivery/assignments/'+orderId+'/pickup'); showToast('Order picked up!'); await load(); }
        catch(e){ showToast(e.message,'error'); sPickup.classList.remove('done'); }
      });
      initSwipe(sOtw, async()=>{
        try{ await API.put('/delivery/assignments/'+orderId+'/on-the-way'); showToast('On the way!'); await load(); }
        catch(e){ showToast(e.message,'error'); sOtw.classList.remove('done'); }
      });
      initSwipe(sDeliver, async()=>{
        const otp = (document.getElementById('deliverOtpInput')||{}).value||'';
        try{ await API.put('/delivery/assignments/'+orderId+'/deliver',{otp}); showToast('Delivered successfully! 🎉'); await load(); }
        catch(e){ showToast(e.message,'error'); sDeliver.classList.remove('done'); }
      });
    }, 100);
  }

  // Override render to add swipe binding
  const _origRender = render;
  render = function(){ _origRender(); bindSwipes(); };

  window.showFailModal = function(){
    const overlay = document.createElement('div');
    overlay.className='modal-overlay show';
    overlay.innerHTML=`
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-handle"></div>
        <div class="modal-body">
          <h3 style="margin-bottom:12px">Mark Delivery Failed</h3>
          <div class="form-group">
            <label>Reason</label>
            <select class="form-control" id="failReason">
              <option value="Customer not available">Customer not available</option>
              <option value="Wrong address">Wrong address</option>
              <option value="Customer refused">Customer refused</option>
              <option value="Customer unreachable">Customer unreachable</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div class="form-group" id="failOtherGroup" style="display:none">
            <label>Describe reason</label>
            <input type="text" class="form-control" id="failOtherInput" placeholder="Type reason...">
          </div>
          <div class="swipe-container swipe-danger" id="swipeFail">
            <div class="swipe-fill"></div>
            <div class="swipe-track">Swipe to Confirm Fail →</div>
            <div class="swipe-thumb">❌</div>
          </div>
          <button class="btn btn-outline mt-1" onclick="closeModal()">Cancel</button>
        </div>
      </div>`;

    overlay.addEventListener('click',()=>closeModal());
    document.body.appendChild(overlay);

    document.getElementById('failReason').addEventListener('change',function(){
      document.getElementById('failOtherGroup').style.display = this.value==='Other'?'':'none';
    });

    setTimeout(()=>{
      initSwipe(document.getElementById('swipeFail'), async()=>{
        let reason = document.getElementById('failReason').value;
        if(reason==='Other') reason = document.getElementById('failOtherInput').value.trim()||'Other';
        try{
          await API.put('/delivery/assignments/'+orderId+'/fail',{reason});
          showToast('Marked as failed');
          closeModal(); await load();
        }catch(e){ showToast(e.message,'error'); }
      });
    },100);
  };

  window.closeModal = function(){
    const o = document.querySelector('.modal-overlay');
    if(o) o.remove();
  };

  // CSS for modal bottom-up (added to style.css already, but just in case)
  const sty = document.createElement('style');
  sty.textContent = `.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center;z-index:200}.modal{background:#fff;border-radius:16px 16px 0 0;width:100%;max-width:480px;padding-bottom:20px}.modal-handle{width:36px;height:4px;border-radius:2px;background:#E5E7EB;margin:10px auto}.modal-body{padding:4px 20px 0}`;
  document.head.appendChild(sty);

  load();
})();
