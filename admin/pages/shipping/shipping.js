(function(){
  requireAuth();
  document.body.innerHTML = pageShell('Shipping & Logistics');
  buildLayout('shipping');

  const main = document.getElementById('page-content');
  function esc(s){ const d=document.createElement('div'); d.textContent=String(s||''); return d.innerHTML; }

  /* ══════════════════════════════════════════
     TABS
     ══════════════════════════════════════════ */
  const TABS = [
    { id: 'pincode',   label: '📍 Pincode Check',      desc: 'Check serviceability & TAT' },
    { id: 'cost',      label: '💰 Cost Calculator',     desc: 'Estimate shipping charges' },
    { id: 'waybill',   label: '🏷️ Fetch Waybills',      desc: 'Pre-fetch AWB numbers' },
    { id: 'pickup',    label: '📦 Pickup Request',      desc: 'Schedule courier pickup' },
    { id: 'warehouse', label: '🏭 Warehouses',          desc: 'Manage pickup locations' },
  ];

  let activeTab = 'pincode';

  function render(){
    main.innerHTML = `
      <div style="max-width:900px;margin:0 auto">
        <!-- Tab Bar -->
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:24px">
          ${TABS.map(t => `
            <button onclick="switchTab('${t.id}')" style="padding:10px 18px;border-radius:10px;border:2px solid ${activeTab===t.id?'#7C3AED':'#e5e7eb'};background:${activeTab===t.id?'#7C3AED08':'#fff'};cursor:pointer;font-size:13px;font-weight:${activeTab===t.id?'700':'500'};color:${activeTab===t.id?'#7C3AED':'#666'};transition:all .2s">
              ${t.label}
            </button>
          `).join('')}
        </div>

        <!-- Tab Content -->
        <div id="tabContent"></div>
      </div>
    `;
    renderTab();
  }

  window.switchTab = function(tab){
    activeTab = tab;
    render();
  };

  function renderTab(){
    const el = document.getElementById('tabContent');
    if(activeTab === 'pincode')   return renderPincode(el);
    if(activeTab === 'cost')      return renderCost(el);
    if(activeTab === 'waybill')   return renderWaybill(el);
    if(activeTab === 'pickup')    return renderPickup(el);
    if(activeTab === 'warehouse') return renderWarehouse(el);
  }

  /* ══════════════════════════════════════════
     📍 PINCODE CHECK + TAT
     ══════════════════════════════════════════ */
  function renderPincode(el){
    el.innerHTML = `
      <div class="card" style="padding:24px;border-radius:16px;background:#fff;border:1px solid #eee">
        <h3 style="margin:0 0 4px;font-size:16px;color:#111">📍 Pincode Serviceability & Expected TAT</h3>
        <p style="margin:0 0 20px;font-size:12px;color:#999">Check if a pincode is serviceable and get expected delivery time</p>

        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
          <div style="flex:1;min-width:120px">
            <label style="font-size:11px;font-weight:600;color:#666;display:block;margin-bottom:4px">Destination Pincode</label>
            <input id="pPin" class="form-control" placeholder="e.g. 110001" maxlength="6" style="font-size:14px">
          </div>
          <div style="flex:1;min-width:120px">
            <label style="font-size:11px;font-weight:600;color:#666;display:block;margin-bottom:4px">Origin Pincode (optional)</label>
            <input id="pOrigin" class="form-control" placeholder="From settings if empty" maxlength="6" style="font-size:14px">
          </div>
          <button onclick="checkPin()" class="btn btn-primary" style="height:40px;padding:0 24px;font-size:13px">Check</button>
        </div>
        <div id="pinResult" style="margin-top:16px"></div>
      </div>
    `;
  }

  window.checkPin = async function(){
    const pin = document.getElementById('pPin').value.trim();
    const origin = document.getElementById('pOrigin').value.trim();
    if(!pin || pin.length !== 6){ showToast('Enter valid 6-digit pincode','error'); return; }

    const el = document.getElementById('pinResult');
    el.innerHTML = '<div style="text-align:center;padding:16px;color:#999">Checking...</div>';

    try{
      const [svc, tat] = await Promise.all([
        API.get('/admin/shipping/check-pincode?pincode='+pin),
        origin ? API.get(`/admin/shipping/expected-tat?o_pin=${origin}&d_pin=${pin}`) : Promise.resolve(null),
      ]);

      el.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:4px">
          <div style="padding:16px;border-radius:12px;background:${svc.serviceable?'#dcfce7':'#fee2e2'}">
            <div style="font-size:22px;font-weight:700;color:${svc.serviceable?'#16a34a':'#dc2626'}">${svc.serviceable?'✅ Serviceable':'❌ Not Serviceable'}</div>
            ${svc.city?`<div style="font-size:12px;color:#666;margin-top:4px">${esc(svc.city)}, ${esc(svc.state)}</div>`:''}
          </div>
          <div style="padding:16px;border-radius:12px;background:#f0f9ff">
            <div style="font-size:12px;color:#666;font-weight:600">Payment</div>
            <div style="margin-top:4px;display:flex;gap:8px">
              <span style="padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;background:${svc.cod?'#dcfce7':'#fee2e2'};color:${svc.cod?'#16a34a':'#dc2626'}">COD ${svc.cod?'✓':'✗'}</span>
              <span style="padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;background:${svc.prepaid?'#dcfce7':'#fee2e2'};color:${svc.prepaid?'#16a34a':'#dc2626'}">Prepaid ${svc.prepaid?'✓':'✗'}</span>
            </div>
          </div>
          ${tat && tat.expectedDays ? `
            <div style="padding:16px;border-radius:12px;background:#faf5ff">
              <div style="font-size:12px;color:#666;font-weight:600">Expected TAT</div>
              <div style="font-size:22px;font-weight:700;color:#7C3AED;margin-top:4px">${tat.expectedDays} days</div>
              ${tat.estimatedDate?`<div style="font-size:11px;color:#999;margin-top:2px">ETA: ${tat.estimatedDate}</div>`:''}
            </div>
          ` : ''}
        </div>
      `;
    }catch(e){ el.innerHTML = `<div style="color:#dc2626;font-size:13px;padding:12px;background:#fee2e2;border-radius:8px">${esc(e.message)}</div>`; }
  };

  /* ══════════════════════════════════════════
     💰 COST CALCULATOR
     ══════════════════════════════════════════ */
  function renderCost(el){
    el.innerHTML = `
      <div class="card" style="padding:24px;border-radius:16px;background:#fff;border:1px solid #eee">
        <h3 style="margin:0 0 4px;font-size:16px;color:#111">💰 Shipping Cost Calculator</h3>
        <p style="margin:0 0 20px;font-size:12px;color:#999">Estimate courier charges for a shipment</p>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px">
          <div>
            <label style="font-size:11px;font-weight:600;color:#666;display:block;margin-bottom:4px">Origin Pincode</label>
            <input id="cOrigin" class="form-control" placeholder="e.g. 110001" maxlength="6">
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:#666;display:block;margin-bottom:4px">Destination Pincode *</label>
            <input id="cDest" class="form-control" placeholder="e.g. 400001" maxlength="6">
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:#666;display:block;margin-bottom:4px">Weight (grams)</label>
            <input id="cWeight" class="form-control" type="number" value="500" min="1">
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:#666;display:block;margin-bottom:4px">Payment Mode</label>
            <select id="cMode" class="form-control">
              <option value="Pre-paid">Prepaid</option>
              <option value="COD">COD</option>
            </select>
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:#666;display:block;margin-bottom:4px">COD Amount (₹)</label>
            <input id="cCod" class="form-control" type="number" value="0" min="0">
          </div>
          <div style="display:flex;align-items:flex-end">
            <button onclick="calcCost()" class="btn btn-primary" style="width:100%;height:40px;font-size:13px">Calculate</button>
          </div>
        </div>
        <div id="costResult" style="margin-top:16px"></div>
      </div>
    `;
  }

  window.calcCost = async function(){
    const dest = document.getElementById('cDest').value.trim();
    if(!dest || dest.length !== 6){ showToast('Enter valid destination pincode','error'); return; }

    const el = document.getElementById('costResult');
    el.innerHTML = '<div style="text-align:center;padding:16px;color:#999">Calculating...</div>';

    try{
      const res = await API.post('/admin/shipping/calculate-cost', {
        originPin: document.getElementById('cOrigin').value.trim() || undefined,
        destinationPin: dest,
        weight: parseInt(document.getElementById('cWeight').value) || 500,
        paymentMode: document.getElementById('cMode').value,
        codAmount: parseInt(document.getElementById('cCod').value) || 0,
      });

      el.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-top:4px">
          <div style="padding:16px;border-radius:12px;background:#f0fdf4;text-align:center">
            <div style="font-size:11px;color:#666;font-weight:600">Total Charge</div>
            <div style="font-size:24px;font-weight:700;color:#16a34a;margin-top:4px">₹${res.totalCharge}</div>
          </div>
          <div style="padding:16px;border-radius:12px;background:#f8fafc;text-align:center">
            <div style="font-size:11px;color:#666;font-weight:600">Freight</div>
            <div style="font-size:18px;font-weight:700;color:#334155;margin-top:4px">₹${res.freightCharge}</div>
          </div>
          <div style="padding:16px;border-radius:12px;background:#f8fafc;text-align:center">
            <div style="font-size:11px;color:#666;font-weight:600">COD Charge</div>
            <div style="font-size:18px;font-weight:700;color:#334155;margin-top:4px">₹${res.codCharge}</div>
          </div>
          <div style="padding:16px;border-radius:12px;background:#f8fafc;text-align:center">
            <div style="font-size:11px;color:#666;font-weight:600">GST</div>
            <div style="font-size:18px;font-weight:700;color:#334155;margin-top:4px">₹${res.gstCharge}</div>
          </div>
          ${res.chargeableWeight ? `
          <div style="padding:16px;border-radius:12px;background:#faf5ff;text-align:center">
            <div style="font-size:11px;color:#666;font-weight:600">Charged Weight</div>
            <div style="font-size:18px;font-weight:700;color:#7C3AED;margin-top:4px">${res.chargeableWeight}g</div>
          </div>` : ''}
          ${res.estimatedDays ? `
          <div style="padding:16px;border-radius:12px;background:#faf5ff;text-align:center">
            <div style="font-size:11px;color:#666;font-weight:600">Est. Days</div>
            <div style="font-size:18px;font-weight:700;color:#7C3AED;margin-top:4px">${res.estimatedDays}</div>
          </div>` : ''}
        </div>
      `;
    }catch(e){ el.innerHTML = `<div style="color:#dc2626;font-size:13px;padding:12px;background:#fee2e2;border-radius:8px">${esc(e.message)}</div>`; }
  };

  /* ══════════════════════════════════════════
     🏷️ FETCH WAYBILLS
     ══════════════════════════════════════════ */
  function renderWaybill(el){
    el.innerHTML = `
      <div class="card" style="padding:24px;border-radius:16px;background:#fff;border:1px solid #eee">
        <h3 style="margin:0 0 4px;font-size:16px;color:#111">🏷️ Pre-Fetch Waybill Numbers</h3>
        <p style="margin:0 0 20px;font-size:12px;color:#999">Get AWB numbers in advance for pre-assignment to shipments</p>

        <div style="display:flex;gap:12px;align-items:flex-end">
          <div>
            <label style="font-size:11px;font-weight:600;color:#666;display:block;margin-bottom:4px">Count</label>
            <input id="wCount" class="form-control" type="number" value="1" min="1" max="50" style="width:100px">
          </div>
          <button onclick="fetchWB()" class="btn btn-primary" style="height:40px;padding:0 24px;font-size:13px">Fetch Waybills</button>
        </div>
        <div id="wbResult" style="margin-top:16px"></div>
      </div>
    `;
  }

  window.fetchWB = async function(){
    const count = parseInt(document.getElementById('wCount').value) || 1;
    const el = document.getElementById('wbResult');
    el.innerHTML = '<div style="text-align:center;padding:16px;color:#999">Fetching...</div>';

    try{
      const res = await API.get('/admin/shipping/fetch-waybill?count='+count);
      const wbs = res.waybills || [];
      el.innerHTML = `
        <div style="background:#f8fafc;border-radius:12px;padding:16px">
          <div style="font-size:12px;font-weight:600;color:#666;margin-bottom:8px">${wbs.length} Waybill(s) fetched:</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            ${wbs.map(w => `
              <div style="padding:8px 14px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;font-family:monospace;font-size:13px;font-weight:600;color:#334155;cursor:pointer" onclick="navigator.clipboard.writeText('${esc(w)}');showToast('Copied!','success')" title="Click to copy">
                ${esc(w)}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }catch(e){ el.innerHTML = `<div style="color:#dc2626;font-size:13px;padding:12px;background:#fee2e2;border-radius:8px">${esc(e.message)}</div>`; }
  };

  /* ══════════════════════════════════════════
     📦 PICKUP REQUEST
     ══════════════════════════════════════════ */
  function renderPickup(el){
    const today = new Date().toISOString().split('T')[0];
    el.innerHTML = `
      <div class="card" style="padding:24px;border-radius:16px;background:#fff;border:1px solid #eee">
        <h3 style="margin:0 0 4px;font-size:16px;color:#111">📦 Create Pickup Request</h3>
        <p style="margin:0 0 20px;font-size:12px;color:#999">Request Delhivery to pick up packages from your warehouse</p>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
          <div>
            <label style="font-size:11px;font-weight:600;color:#666;display:block;margin-bottom:4px">Pickup Date</label>
            <input id="pkDate" class="form-control" type="date" value="${today}">
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:#666;display:block;margin-bottom:4px">Pickup Time</label>
            <input id="pkTime" class="form-control" type="time" value="12:00">
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:#666;display:block;margin-bottom:4px">Warehouse / Location Name</label>
            <input id="pkLoc" class="form-control" placeholder="Your registered warehouse name">
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:#666;display:block;margin-bottom:4px">Expected Packages</label>
            <input id="pkCount" class="form-control" type="number" value="1" min="1">
          </div>
        </div>
        <div style="margin-top:16px">
          <button onclick="createPickup()" class="btn btn-primary" style="padding:10px 28px;font-size:13px">🚛 Create Pickup Request</button>
        </div>
        <div id="pickupResult" style="margin-top:16px"></div>
      </div>
    `;
  }

  window.createPickup = async function(){
    const el = document.getElementById('pickupResult');
    el.innerHTML = '<div style="text-align:center;padding:16px;color:#999">Creating pickup request...</div>';

    try{
      const res = await API.post('/admin/shipping/pickup-request', {
        pickupDate: document.getElementById('pkDate').value,
        pickupTime: document.getElementById('pkTime').value + ':00',
        pickupLocation: document.getElementById('pkLoc').value.trim() || undefined,
        expectedPackages: parseInt(document.getElementById('pkCount').value) || 1,
      });

      el.innerHTML = `
        <div style="padding:20px;border-radius:12px;background:#f0fdf4;border:1px solid #bbf7d0">
          <div style="font-size:16px;font-weight:700;color:#16a34a">✅ Pickup Request Created</div>
          ${res.pickupId ? `<div style="font-size:13px;color:#666;margin-top:4px">Pickup ID: <strong>${esc(res.pickupId)}</strong></div>` : ''}
          <div style="font-size:12px;color:#999;margin-top:4px">${esc(res.message)}</div>
        </div>
      `;
    }catch(e){ el.innerHTML = `<div style="color:#dc2626;font-size:13px;padding:12px;background:#fee2e2;border-radius:8px">${esc(e.message)}</div>`; }
  };

  /* ══════════════════════════════════════════
     🏭 WAREHOUSE MANAGEMENT
     ══════════════════════════════════════════ */
  function renderWarehouse(el){
    el.innerHTML = `
      <div class="card" style="padding:24px;border-radius:16px;background:#fff;border:1px solid #eee">
        <h3 style="margin:0 0 4px;font-size:16px;color:#111">🏭 Client Warehouse</h3>
        <p style="margin:0 0 20px;font-size:12px;color:#999">Create or update your Delhivery pickup warehouse / location</p>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
          <div>
            <label style="font-size:11px;font-weight:600;color:#666;display:block;margin-bottom:4px">Warehouse Name *</label>
            <input id="whName" class="form-control" placeholder="e.g. Main Warehouse">
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:#666;display:block;margin-bottom:4px">Phone *</label>
            <input id="whPhone" class="form-control" placeholder="10-digit phone" maxlength="10">
          </div>
          <div style="grid-column:1/-1">
            <label style="font-size:11px;font-weight:600;color:#666;display:block;margin-bottom:4px">Address *</label>
            <input id="whAddr" class="form-control" placeholder="Full street address">
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:#666;display:block;margin-bottom:4px">City *</label>
            <input id="whCity" class="form-control" placeholder="City">
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:#666;display:block;margin-bottom:4px">State *</label>
            <input id="whState" class="form-control" placeholder="State">
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:#666;display:block;margin-bottom:4px">Pincode *</label>
            <input id="whPin" class="form-control" placeholder="6-digit" maxlength="6">
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:#666;display:block;margin-bottom:4px">Registered Name</label>
            <input id="whReg" class="form-control" placeholder="Client name from Delhivery">
          </div>
        </div>
        <div style="margin-top:16px;display:flex;gap:10px">
          <button onclick="createWH()" class="btn btn-primary" style="padding:10px 24px;font-size:13px">🏗️ Create Warehouse</button>
          <button onclick="updateWH()" class="btn" style="padding:10px 24px;font-size:13px;border:1px solid #7C3AED;color:#7C3AED">✏️ Update Warehouse</button>
        </div>
        <div id="whResult" style="margin-top:16px"></div>
      </div>
    `;
  }

  function getWhData(){
    const name = document.getElementById('whName').value.trim();
    const phone = document.getElementById('whPhone').value.trim();
    const address = document.getElementById('whAddr').value.trim();
    const city = document.getElementById('whCity').value.trim();
    const state = document.getElementById('whState').value.trim();
    const pincode = document.getElementById('whPin').value.trim();
    const registeredName = document.getElementById('whReg').value.trim() || undefined;
    if(!name||!phone||!address||!city||!state||!pincode){ showToast('Fill all required fields','error'); return null; }
    return { name, phone, address, city, state, pincode, registeredName };
  }

  window.createWH = async function(){
    const data = getWhData();
    if(!data) return;

    const el = document.getElementById('whResult');
    el.innerHTML = '<div style="text-align:center;padding:16px;color:#999">Creating warehouse...</div>';

    try{
      const res = await API.post('/admin/shipping/warehouse', data);
      el.innerHTML = `
        <div style="padding:16px;border-radius:12px;background:#f0fdf4;border:1px solid #bbf7d0">
          <div style="font-size:15px;font-weight:700;color:#16a34a">✅ Warehouse Created</div>
          <div style="font-size:12px;color:#666;margin-top:4px">${esc(res.warehouseName || res.message)}</div>
        </div>
      `;
    }catch(e){ el.innerHTML = `<div style="color:#dc2626;font-size:13px;padding:12px;background:#fee2e2;border-radius:8px">${esc(e.message)}</div>`; }
  };

  window.updateWH = async function(){
    const data = getWhData();
    if(!data) return;

    const el = document.getElementById('whResult');
    el.innerHTML = '<div style="text-align:center;padding:16px;color:#999">Updating warehouse...</div>';

    try{
      const res = await API.put('/admin/shipping/warehouse', data);
      el.innerHTML = `
        <div style="padding:16px;border-radius:12px;background:#f0fdf4;border:1px solid #bbf7d0">
          <div style="font-size:15px;font-weight:700;color:#16a34a">✅ Warehouse Updated</div>
          <div style="font-size:12px;color:#666;margin-top:4px">${esc(res.message)}</div>
        </div>
      `;
    }catch(e){ el.innerHTML = `<div style="color:#dc2626;font-size:13px;padding:12px;background:#fee2e2;border-radius:8px">${esc(e.message)}</div>`; }
  };

  /* ── Init ── */
  render();
})();
