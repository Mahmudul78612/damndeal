(async function () {
  document.body.innerHTML = pageShell("Orders");
  buildLayout("orders");

  const content = document.getElementById("page-content");
  let page = 1, statusFilter = "";
  let tabFilter = "all";
  let selectedOrders = new Set();
  let allOrdersData = []; // current page orders cache
  let rejectOrderId = null;

  function resolveImageUrl(path) {
    if (!path) return "";
    const raw = String(path);
    if (/^https?:\/\//i.test(raw)) return raw;
    const base = CONFIG.UPLOADS_BASE || CONFIG.API_BASE.replace('/api', '');
    if (raw.startsWith('/')) return `${base}${raw}`;
    return `${base}/${raw}`;
  }

  function getSelectedCount() { return selectedOrders.size; }

  function updateBulkBar() {
    const bar = document.getElementById('bulk-bar');
    if (!bar) return;
    const count = getSelectedCount();
    if (count === 0) {
      bar.style.display = 'none';
      return;
    }
    bar.style.display = 'flex';

    // Categorize selected orders
    const selected = allOrdersData.filter(o => selectedOrders.has(o._id));
    const shippable = selected.filter(o => ['confirmed','processing','ready'].includes(o.status) && !o.shipping?.awb);
    const pickupable = selected.filter(o => o.shipping?.awb && ['shipped','confirmed','processing','ready'].includes(o.status));

    document.getElementById('bulk-count').textContent = `${count} selected`;
    document.getElementById('bulk-ship-btn').style.display = shippable.length ? '' : 'none';
    document.getElementById('bulk-ship-btn').textContent = `📦 Create Shipment (${shippable.length})`;
    document.getElementById('bulk-pickup-btn').style.display = pickupable.length ? '' : 'none';
    document.getElementById('bulk-pickup-btn').textContent = `🚛 Request Pickup (${pickupable.length})`;
  }

  async function load(p = 1) {
    page = p;
    selectedOrders.clear();
    content.innerHTML = `<div class="text-center"><div class="spinner"></div></div>`;
    try {
      let ep = `/admin/orders?page=${page}&limit=20`;
      if (tabFilter && tabFilter !== 'all') ep += `&tab=${tabFilter}`;
      if (statusFilter) ep += `&status=${statusFilter}`;
      const data = await API.get(ep);
      const orders = data.orders || [];
      allOrdersData = orders;
      const total = data.total || 0;
      const pages = data.pages || 1;

      content.innerHTML = `
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          <button class="btn btn-sm ${tabFilter === 'all' ? 'btn-primary' : 'btn-outline'}" onclick="setOrderTab('all')">All</button>
          <button class="btn btn-sm ${tabFilter === 'active' ? 'btn-primary' : 'btn-outline'}" onclick="setOrderTab('active')">Active</button>
          <button class="btn btn-sm ${tabFilter === 'accepted' ? 'btn-primary' : 'btn-outline'}" onclick="setOrderTab('accepted')">Accepted</button>
          <button class="btn btn-sm ${tabFilter === 'rejected' ? 'btn-primary' : 'btn-outline'}" onclick="setOrderTab('rejected')">Rejected</button>
        </div>

        <div class="toolbar">
          <div class="toolbar-left">
            <select class="form-control" style="width:160px" onchange="filterOrd(this.value)">
              <option value="">All Status</option>
              ${['placed','confirmed','processing','ready','shipped','delivered','cancelled','returned'].map(s => `<option value="${s}" ${statusFilter===s?"selected":""}>${s}</option>`).join("")}
            </select>
            <span class="text-muted text-sm">${total} orders</span>
          </div>
        </div>

        <!-- Bulk Action Bar -->
        <div id="bulk-bar" style="display:none;align-items:center;gap:10px;padding:10px 16px;background:linear-gradient(135deg,#7C3AED10,#2563eb10);border:1px solid #7C3AED30;border-radius:12px;margin-bottom:12px">
          <span id="bulk-count" style="font-size:13px;font-weight:700;color:#7C3AED">0 selected</span>
          <button id="bulk-ship-btn" onclick="bulkShip()" class="btn btn-sm" style="display:none;background:#7C3AED;color:#fff;font-weight:600">📦 Create Shipment</button>
          <button id="bulk-pickup-btn" onclick="bulkPickup()" class="btn btn-sm" style="display:none;background:#16a34a;color:#fff;font-weight:600">🚛 Request Pickup</button>
          <button onclick="clearSelection()" class="btn btn-sm btn-outline" style="margin-left:auto;font-size:11px">✕ Clear</button>
        </div>

        <div class="card">
          <div class="card-body table-wrap">
            <table>
              <thead><tr>
                <th style="width:36px"><input type="checkbox" id="select-all" onchange="toggleSelectAll(this.checked)" /></th>
                <th>Order #</th><th>Customer</th><th>Item</th><th>Total</th><th>Payment</th><th>Status</th><th>AWB</th><th>Date</th><th>Actions</th>
              </tr></thead>
              <tbody>
                ${orders.map(o => `
                  <tr id="row-${o._id}" ${selectedOrders.has(o._id) ? 'style="background:#7C3AED08"' : ''}>
                    <td><input type="checkbox" class="order-cb" value="${o._id}" onchange="toggleOrder('${o._id}', this.checked)" /></td>
                    <td><strong>${o.orderNumber || o._id?.slice(-6)}</strong></td>
                    <td>${o.user?.name || o.user?.phone || '-'}</td>
                    <td>
                      ${(() => {
                        const first = o.items?.[0];
                        const img = first?.product?.images?.[0] || first?.image;
                        const imgSrc = resolveImageUrl(img);
                        return `
                          <div style="display:flex;align-items:center;gap:8px;min-width:160px;max-width:220px">
                            ${imgSrc
                              ? `<img src="${imgSrc}" style="width:30px;height:30px;object-fit:cover;border-radius:6px" onerror="this.style.display='none'" />`
                              : '<div style="width:30px;height:30px;background:#f1f5f9;border-radius:6px"></div>'}
                            <span style="font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${first?.name || '-'}</span>
                          </div>`;
                      })()}
                    </td>
                    <td>${fmtCurrency(o.grandTotal, o.currency)}</td>
                    <td>${statusBadge(o.paymentStatus)}</td>
                    <td>${statusBadge(o.status)}</td>
                    <td style="font-size:11px">${o.shipping?.awb || '<span style="color:#ccc">—</span>'}</td>
                    <td>${fmtDate(o.createdAt)}</td>
                    <td style="white-space:nowrap">
                      <button class="btn btn-outline btn-sm" onclick="viewOrder('${o._id}')">View</button>
                      ${o.status==='placed' ? `<button class="btn btn-sm" style="margin-left:4px;background:#22c55e;color:#fff" onclick="updateStatus('${o._id}','confirmed')">✓ Accept</button>` : ''}
                      ${['placed','confirmed','processing','ready'].includes(o.status) ? `<button class="btn btn-sm" style="margin-left:4px;background:#ef4444;color:#fff" onclick="openRejectModal('${o._id}')">✕ Reject</button>` : ''}
                      ${['confirmed','processing','ready'].includes(o.status) && !o.shipping?.awb ? `<button class="btn btn-sm" style="margin-left:4px;background:#7C3AED;color:#fff" onclick="openShipModal('${o._id}')">📦 Ship</button>` : ''}
                      ${o.shipping?.awb ? `<button class="btn btn-sm" style="margin-left:4px;background:#2563eb;color:#fff" onclick="trackOrder('${o._id}')">🔍 Track</button>` : ''}
                    </td>
                  </tr>
                `).join("") || `<tr><td colspan="10" class="text-center text-muted">No orders</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
        <div class="pagination" id="pagination"></div>

        <!-- Order Detail Modal -->
        <div class="modal-overlay" id="order-modal">
          <div class="modal" style="max-width:640px">
            <div class="modal-header"><h3>Order Details</h3><button class="modal-close" onclick="closeModal('order-modal')">&times;</button></div>
            <div class="modal-body" id="order-detail">Loading...</div>
          </div>
        </div>

        <!-- Ship Order Modal -->
        <div class="modal-overlay" id="ship-modal">
          <div class="modal" style="max-width:640px">
            <div class="modal-header"><h3 id="ship-modal-title">📦 Create Shipment</h3><button class="modal-close" onclick="closeModal('ship-modal')">&times;</button></div>
            <div class="modal-body" id="ship-body" style="max-height:75vh;overflow-y:auto">Loading...</div>
          </div>
        </div>

        <!-- Pickup Request Modal -->
        <div class="modal-overlay" id="pickup-modal">
          <div class="modal" style="max-width:500px">
            <div class="modal-header"><h3>🚛 Request Pickup</h3><button class="modal-close" onclick="closeModal('pickup-modal')">&times;</button></div>
            <div class="modal-body" id="pickup-body">Loading...</div>
          </div>
        </div>

        <!-- Track Order Modal -->
        <div class="modal-overlay" id="track-modal">
          <div class="modal" style="max-width:560px">
            <div class="modal-header"><h3>🔍 Shipment Tracking</h3><button class="modal-close" onclick="closeModal('track-modal')">&times;</button></div>
            <div class="modal-body" id="track-body">Loading...</div>
          </div>
        </div>

        <div class="modal-overlay" id="reject-modal">
          <div class="modal" style="max-width:520px">
            <div class="modal-header"><h3>✕ Reject Order</h3><button class="modal-close" onclick="closeModal('reject-modal')">&times;</button></div>
            <div class="modal-body">
              <div class="form-group">
                <label>Reason *</label>
                <select id="rej-reason" class="form-control">
                  <option value="Out of stock">Out of stock</option>
                  <option value="Price mismatch">Price mismatch</option>
                  <option value="Service area not available">Service area not available</option>
                  <option value="Quality issue">Quality issue</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div class="form-group">
                <label>Note</label>
                <textarea id="rej-note" class="form-control" rows="3" placeholder="Add details (optional)"></textarea>
              </div>
              <div style="display:flex;gap:8px;justify-content:flex-end">
                <button class="btn btn-outline" onclick="closeModal('reject-modal')">Cancel</button>
                <button class="btn" style="background:#ef4444;color:#fff" onclick="submitRejectForm()">Confirm Reject</button>
              </div>
            </div>
          </div>
        </div>
      `;
      renderPagination("pagination", page, pages, load);
    } catch (err) { content.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`; }
  }

  window.load = load;
  window.filterOrd = (v) => { statusFilter = v; load(1); };
  window.setOrderTab = (tab) => {
    tabFilter = tab || 'all';
    statusFilter = '';
    load(1);
  };

  /* ── Selection helpers ── */
  window.toggleOrder = (id, checked) => {
    if (checked) { selectedOrders.add(id); } else { selectedOrders.delete(id); }
    const row = document.getElementById(`row-${id}`);
    if (row) row.style.background = checked ? '#7C3AED08' : '';
    updateBulkBar();
    // sync select-all checkbox
    const allCbs = document.querySelectorAll('.order-cb');
    const allEl = document.getElementById('select-all');
    if (allEl) allEl.checked = allCbs.length > 0 && [...allCbs].every(c => c.checked);
  };

  window.toggleSelectAll = (checked) => {
    document.querySelectorAll('.order-cb').forEach(cb => {
      cb.checked = checked;
      toggleOrder(cb.value, checked);
    });
  };

  window.clearSelection = () => {
    selectedOrders.clear();
    document.querySelectorAll('.order-cb').forEach(cb => { cb.checked = false; });
    const allEl = document.getElementById('select-all');
    if (allEl) allEl.checked = false;
    document.querySelectorAll('[id^="row-"]').forEach(r => r.style.background = '');
    updateBulkBar();
  };

  window.viewOrder = async (id) => {
    openModal("order-modal");
    const detail = document.getElementById("order-detail");
    detail.innerHTML = `<div class="text-center"><div class="spinner"></div></div>`;
    try {
      const data = await API.get(`/admin/orders/${id}`);
      const o = data.order;
      detail.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px">
          <div><strong>Order #:</strong> ${o.orderNumber || o._id}</div>
          <div><strong>Status:</strong> ${statusBadge(o.status)}</div>
          <div><strong>Customer:</strong> ${o.user?.name || o.user?.phone || '-'}</div>
          <div><strong>Partner:</strong> ${o.partner?.name || o.partner?.phone || '-'}</div>
          <div><strong>Payment:</strong> ${o.paymentMethod} — ${statusBadge(o.paymentStatus)}</div>
          <div><strong>Fulfillment:</strong> ${o.fulfillmentType || 'platform'}</div>
          <div><strong>Subtotal:</strong> ${fmtCurrency(o.subtotal, o.currency)}</div>
          <div><strong>Delivery Fee:</strong> ${fmtCurrency(o.deliveryFee, o.currency)}</div>
          <div><strong>Coupon Disc:</strong> ${fmtCurrency(o.couponDiscount, o.currency)}</div>
          <div><strong>Grand Total:</strong> <strong>${fmtCurrency(o.grandTotal, o.currency)}</strong></div>
        </div>
        <h4 style="margin:16px 0 8px;font-size:14px">Items</h4>
        <table>
          <thead><tr><th></th><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
          <tbody>
            ${(o.items || []).map(i => {
              const img = i.product?.images?.[0] || i.image;
              const imgSrc = resolveImageUrl(img);
              return `
              <tr>
                <td style="width:44px">${imgSrc ? `<img src="${imgSrc}" style="width:40px;height:40px;object-fit:cover;border-radius:6px" onerror="this.style.display='none'" />` : '<div style="width:40px;height:40px;background:#f1f5f9;border-radius:6px"></div>'}</td>
                <td>${i.product?.name || i.name || '-'}</td>
                <td>${i.quantity}</td>
                <td>${fmtCurrency(i.price, o.currency)}</td>
                <td>${fmtCurrency(i.price * i.quantity, o.currency)}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
        ${['placed','confirmed','processing','ready','shipped'].includes(o.status) ? `
          <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
            ${o.status==='placed' ? `<button class="btn btn-sm" style="background:#22c55e;color:#fff" onclick="updateStatus('${o._id}','confirmed');closeModal('order-modal')">✓ Accept Order</button>` : ''}
            ${['placed','confirmed','processing','ready'].includes(o.status) ? `<button class="btn btn-sm" style="background:#ef4444;color:#fff" onclick="openRejectModal('${o._id}');closeModal('order-modal')">✕ Reject Order</button>` : ''}
            ${o.status==='confirmed' ? `<button class="btn btn-sm" style="background:#f97316;color:#fff" onclick="updateStatus('${o._id}','processing');closeModal('order-modal')">🔄 Start Preparing</button>` : ''}
            ${o.status==='processing' ? `<button class="btn btn-sm" style="background:#06b6d4;color:#fff" onclick="updateStatus('${o._id}','ready');closeModal('order-modal')">📦 Mark Ready</button>` : ''}
            ${o.status==='shipped' ? `<button class="btn btn-sm" style="background:#8b5cf6;color:#fff" onclick="updateStatus('${o._id}','out_for_delivery');closeModal('order-modal')">🚀 Out for Delivery</button>` : ''}
            ${['shipped','out_for_delivery'].includes(o.status) ? `<button class="btn btn-sm" style="background:#22c55e;color:#fff" onclick="updateStatus('${o._id}','delivered');closeModal('order-modal')">✅ Delivered</button>` : ''}
          </div>
        ` : ''}
        ${o.deliveryAddress ? `<p class="text-muted text-sm mt-2"><strong>Delivery:</strong> ${o.deliveryAddress.address || ''}, ${o.deliveryAddress.city || ''} - ${o.deliveryAddress.pincode || ''}</p>` : ''}
        ${o.deliveryBoy ? `<p class="text-muted text-sm mt-2"><strong>Delivery Boy:</strong> ${o.deliveryBoy.name || o.deliveryBoy.phone || o.deliveryBoy._id}</p>` : ''}
        ${o.shipping?.awb ? `
          <h4 style="margin:16px 0 8px;font-size:14px">📦 Shipping Info</h4>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;background:#f8fafc;padding:12px;border-radius:8px">
            <div><strong>Provider:</strong> ${o.shipping.provider || '-'}</div>
            <div><strong>AWB:</strong> ${o.shipping.awb || '-'}</div>
            <div><strong>Courier:</strong> ${o.shipping.courierName || '-'}</div>
            <div><strong>Status:</strong> ${statusBadge(o.shipping.status || 'pending')}</div>
            ${o.shipping.trackingUrl ? `<div style="grid-column:span 2"><a href="${o.shipping.trackingUrl}" target="_blank" class="btn btn-outline btn-sm">🔗 Track on Courier Site</a></div>` : ''}
            ${o.shipping.label ? `<div style="grid-column:span 2"><a href="${o.shipping.label}" target="_blank" class="btn btn-outline btn-sm">🏷️ Download Label</a></div>` : ''}
          </div>
          ${(o.shipping.events || []).length ? `
            <h4 style="margin:12px 0 8px;font-size:13px">Tracking Events</h4>
            <div style="font-size:12px;max-height:200px;overflow-y:auto">
              ${o.shipping.events.slice().reverse().map(e => `
                <div style="padding:6px 0;border-bottom:1px solid #f1f5f9">
                  <strong>${e.status || ''}</strong> ${e.location ? '— ' + e.location : ''}
                  <div class="text-muted">${e.description || ''} <span style="float:right">${e.timestamp ? fmtDate(e.timestamp) : ''}</span></div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        ` : ''}
      `;
    } catch (err) { detail.innerHTML = `<p class="text-muted">${err.message}</p>`; }
  };

  /* ── assign delivery boy ── */
  window.openAssign = (id) => {
    const dbId = prompt('Enter Delivery Boy ID:');
    if(!dbId || !dbId.trim()) return;
    assignDelivery(id, dbId.trim());
  };

  async function assignDelivery(orderId, deliveryBoyId){
    try{
      await API.put(`/admin/orders/${orderId}/assign-delivery`, { deliveryBoyId });
      showToast('Delivery boy assigned','success');
      load(page);
    }catch(err){ showToast(err.message,'error'); }
  }

  /* ── Ship via courier — Delhivery flow (shipment only, no auto-pickup) ── */
  let shipOrderData = null;
  let shipCostData = null;
  let shipBulkOrders = []; // for bulk shipment

  window.openShipModal = async (id) => {
    shipBulkOrders = [id];
    openModal('ship-modal');
    const body = document.getElementById('ship-body');
    body.innerHTML = '<div class="text-center" style="padding:40px"><div class="spinner"></div><p style="margin-top:12px;color:#999;font-size:13px">Loading order details...</p></div>';
    shipCostData = null;

    try {
      const data = await API.get(`/admin/orders/${id}`);
      shipOrderData = data.order;
      renderShipModal([shipOrderData]);
    } catch (err) {
      body.innerHTML = `<div style="padding:20px;text-align:center;color:#dc2626">${err.message}</div>`;
    }
  };

  /* Bulk ship: opens ship modal for multiple orders */
  window.bulkShip = async () => {
    const selected = allOrdersData.filter(o => selectedOrders.has(o._id) && ['confirmed','processing','ready'].includes(o.status) && !o.shipping?.awb);
    if (!selected.length) { showToast('No shippable orders selected', 'error'); return; }
    shipBulkOrders = selected.map(o => o._id);
    openModal('ship-modal');
    const body = document.getElementById('ship-body');
    document.getElementById('ship-modal-title').textContent = `📦 Create Shipment (${selected.length} orders)`;

    // Load full order details for all selected
    body.innerHTML = '<div class="text-center" style="padding:40px"><div class="spinner"></div><p style="margin-top:12px;color:#999;font-size:13px">Loading orders...</p></div>';
    try {
      const fullOrders = await Promise.all(selected.map(o => API.get(`/admin/orders/${o._id}`).then(r => r.order)));
      renderShipModal(fullOrders);
    } catch (err) {
      body.innerHTML = `<div style="padding:20px;text-align:center;color:#dc2626">${err.message}</div>`;
    }
  };

  function renderShipModal(orders) {
    const body = document.getElementById('ship-body');
    const isBulk = orders.length > 1;
    if (!isBulk) {
      document.getElementById('ship-modal-title').textContent = `📦 Ship — #${orders[0].orderNumber || orders[0]._id?.slice(-6)}`;
    }

    body.innerHTML = `
      <div style="margin-bottom:16px">
        <label style="font-size:11px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:0.5px">Shipping Method</label>
        <div style="display:flex;gap:8px;margin-top:6px">
          <button id="mDelhivery" onclick="selectShipMethod('delhivery')" style="flex:1;padding:12px;border-radius:10px;border:2px solid #7C3AED;background:#7C3AED08;cursor:pointer;text-align:center">
            <div style="font-size:14px;font-weight:700;color:#7C3AED">🚀 Delhivery</div>
            <div style="font-size:10px;color:#999;margin-top:2px">Auto create shipment</div>
          </button>
          ${!isBulk ? `<button id="mSelf" onclick="selectShipMethod('self')" style="flex:1;padding:12px;border-radius:10px;border:2px solid #e5e7eb;background:#fff;cursor:pointer;text-align:center">
            <div style="font-size:14px;font-weight:700;color:#666">📝 Self Ship</div>
            <div style="font-size:10px;color:#999;margin-top:2px">Manual tracking</div>
          </button>` : ''}
        </div>
      </div>

      <!-- Delhivery Flow -->
      <div id="delhivery-flow">
        <!-- Orders Summary -->
        <div style="background:#f8fafc;border-radius:12px;padding:14px;margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <div style="width:24px;height:24px;border-radius:50%;background:#7C3AED;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">📋</div>
            <span style="font-size:13px;font-weight:700;color:#333">${isBulk ? `${orders.length} Orders` : 'Order Details'}</span>
          </div>
          <div style="max-height:150px;overflow-y:auto">
            ${orders.map(o => {
              const a = o.deliveryAddress || {};
              return `<div style="padding:8px;background:#fff;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:6px;font-size:12px;display:flex;justify-content:space-between;align-items:center">
                <div>
                  <strong>#${o.orderNumber || o._id?.slice(-6)}</strong> — ${a.name || o.user?.name || 'Customer'}
                  <div style="color:#999">${a.city || ''}, ${a.state || ''} — ${a.pincode || ''}</div>
                </div>
                <div style="text-align:right">
                  <strong>${fmtCurrency(o.grandTotal, o.currency)}</strong>
                  <div style="color:#999;font-size:10px">${o.paymentMethod || 'prepaid'}</div>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>

        <!-- Package Details (shared for all) -->
        <div style="background:#faf5ff;border-radius:12px;padding:14px;margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <div style="width:24px;height:24px;border-radius:50%;background:#7C3AED;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">📐</div>
            <span style="font-size:13px;font-weight:700;color:#333">Package Details</span>
            <span style="font-size:10px;color:#999;margin-left:auto">Applied to all orders</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div><label style="font-size:10px;font-weight:600;color:#666">Weight (g)</label><input class="form-control" id="s-weight" type="number" value="500" min="1" style="font-size:13px"></div>
            <div><label style="font-size:10px;font-weight:600;color:#666">Length (cm)</label><input class="form-control" id="s-length" type="number" value="10" min="1" style="font-size:13px"></div>
            <div><label style="font-size:10px;font-weight:600;color:#666">Width (cm)</label><input class="form-control" id="s-width" type="number" value="10" min="1" style="font-size:13px"></div>
            <div><label style="font-size:10px;font-weight:600;color:#666">Height (cm)</label><input class="form-control" id="s-height" type="number" value="10" min="1" style="font-size:13px"></div>
          </div>
        </div>

        ${!isBulk ? `
        <!-- Cost Estimate (single order only) -->
        <div style="background:#f0fdf4;border-radius:12px;padding:14px;margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <div style="width:24px;height:24px;border-radius:50%;background:#16a34a;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">💰</div>
            <span style="font-size:13px;font-weight:700;color:#333">Shipping Cost</span>
            <button onclick="recalcCost()" style="margin-left:auto;background:none;border:1px solid #16a34a;color:#16a34a;border-radius:6px;padding:3px 10px;font-size:10px;cursor:pointer;font-weight:600">🔄 Refresh</button>
          </div>
          <div id="cost-box" style="padding:10px;background:#fff;border-radius:8px;border:1px solid #e5e7eb;font-size:12px;color:#666;text-align:center">
            ⏳ Calculating...
          </div>
        </div>
        ` : ''}

        <!-- Create Shipment Button -->
        <div style="display:flex;gap:10px">
          <button id="ship-confirm-btn" onclick="confirmCreateShipment()" class="btn" style="flex:1;padding:14px;font-size:14px;font-weight:700;background:#7C3AED;color:#fff;border:none;border-radius:10px;cursor:pointer">
            📦 Create Shipment${isBulk ? ` (${orders.length})` : ''}
          </button>
        </div>
        <p style="margin-top:8px;font-size:11px;color:#999;text-align:center">After creating shipments, select shipped orders → Request Pickup separately</p>
      </div>

      <!-- Self Ship Flow (single order only) -->
      ${!isBulk ? `
      <div id="self-flow" style="display:none">
        <div class="form-group"><label>Courier Name *</label><input class="form-control" id="sf-courier" placeholder="e.g. DTDC, India Post, BlueDart" /></div>
        <div class="form-group"><label>Tracking ID / AWB *</label><input class="form-control" id="sf-tracking" placeholder="Tracking number" /></div>
        <div class="form-group"><label>Tracking URL (optional)</label><input class="form-control" id="sf-url" placeholder="https://..." /></div>
        <button onclick="confirmSelfShip()" class="btn btn-primary w-full" style="padding:12px;font-size:14px;font-weight:700">📝 Mark as Shipped</button>
      </div>
      ` : ''}
    `;

    // Store orders for later use
    shipOrderData = orders[0];
    shipBulkOrders = orders.map(o => o._id);

    // Auto-calculate cost for single order
    if (!isBulk) setTimeout(recalcCost, 400);
  }

  window.recalcCost = async function() {
    const o = shipOrderData;
    if (!o) return;
    const addr = o.deliveryAddress || {};
    const costBox = document.getElementById('cost-box');
    if (!costBox) return;

    costBox.innerHTML = '<div style="color:#999;padding:8px">⏳ Calculating shipping cost...</div>';

    try {
      const settings = await API.get('/admin/settings');
      const s = {};
      (settings.settings || []).forEach(d => s[d.key] = d.value);
      const originPin = s.shipping_pickup_pincode || '';

      const res = await API.post('/admin/shipping/calculate-cost', {
        originPin,
        destinationPin: addr.pincode || '',
        weight: parseInt(document.getElementById('s-weight')?.value) || 500,
        paymentMode: o.paymentMethod === 'cod' ? 'COD' : 'Pre-paid',
        codAmount: o.paymentMethod === 'cod' ? Math.round(o.grandTotal) : 0,
      });
      shipCostData = res;
      costBox.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center">
          <div><div style="font-size:10px;color:#999">Freight</div><div style="font-size:16px;font-weight:700;color:#334155">₹${res.freightCharge || 0}</div></div>
          <div><div style="font-size:10px;color:#999">COD Fee</div><div style="font-size:16px;font-weight:700;color:#334155">₹${res.codCharge || 0}</div></div>
          <div><div style="font-size:10px;color:#999">GST</div><div style="font-size:16px;font-weight:700;color:#334155">₹${res.gstCharge || 0}</div></div>
        </div>
        <div style="margin-top:10px;padding:10px;background:#f0fdf4;border-radius:8px;text-align:center">
          <span style="font-size:11px;color:#666">Total Shipping Cost</span>
          <div style="font-size:22px;font-weight:800;color:#16a34a">₹${res.totalCharge || 0}</div>
          ${res.zone ? `<div style="font-size:11px;color:#999;margin-top:2px">Zone: ${res.zone} · Weight: ${res.chargeableWeight || 500}g</div>` : ''}
        </div>
      `;
    } catch (err) {
      costBox.innerHTML = `<div style="color:#f97316;padding:8px">⚠️ ${err.message || 'Could not estimate cost'}</div>`;
    }
  };

  window.selectShipMethod = function(method) {
    const dFlow = document.getElementById('delhivery-flow');
    const sFlow = document.getElementById('self-flow');
    const mD = document.getElementById('mDelhivery');
    const mS = document.getElementById('mSelf');
    if (method === 'delhivery') {
      dFlow.style.display = '';
      if (sFlow) sFlow.style.display = 'none';
      mD.style.borderColor = '#7C3AED'; mD.style.background = '#7C3AED08';
      if (mS) { mS.style.borderColor = '#e5e7eb'; mS.style.background = '#fff'; }
    } else {
      dFlow.style.display = 'none';
      if (sFlow) sFlow.style.display = '';
      if (mS) { mS.style.borderColor = '#7C3AED'; mS.style.background = '#7C3AED08'; }
      mD.style.borderColor = '#e5e7eb'; mD.style.background = '#fff';
    }
  };

  /* Create shipment (single or bulk) — NO pickup */
  window.confirmCreateShipment = async function() {
    const btn = document.getElementById('ship-confirm-btn');
    const orderIds = shipBulkOrders;
    if (!orderIds.length) return;

    btn.disabled = true;
    const total = orderIds.length;
    let success = 0, failed = 0;

    const payload = {
      provider: 'delhivery',
      weight: parseInt(document.getElementById('s-weight')?.value) || 500,
      length: parseInt(document.getElementById('s-length')?.value) || 10,
      width: parseInt(document.getElementById('s-width')?.value) || 10,
      height: parseInt(document.getElementById('s-height')?.value) || 10,
    };

    for (let i = 0; i < orderIds.length; i++) {
      btn.innerHTML = `⏳ Creating ${i+1}/${total}...`;
      try {
        await API.post(`/admin/orders/${orderIds[i]}/ship`, payload);
        success++;
      } catch (err) {
        failed++;
        console.error(`Ship failed for ${orderIds[i]}:`, err.message);
      }
    }

    if (success > 0) showToast(`${success} shipment(s) created!${failed ? ` (${failed} failed)` : ''}`, success && !failed ? 'success' : 'warning');
    if (success === 0) showToast(`All ${failed} shipments failed`, 'error');

    closeModal('ship-modal');
    clearSelection();
    load(page);
  };

  window.confirmSelfShip = async function() {
    const o = shipOrderData;
    if (!o) return;
    const courierName = document.getElementById('sf-courier')?.value?.trim();
    const trackingId = document.getElementById('sf-tracking')?.value?.trim();
    const trackingUrl = document.getElementById('sf-url')?.value?.trim();
    if (!courierName || !trackingId) { showToast('Courier name and tracking ID required', 'error'); return; }

    try {
      await API.put(`/admin/orders/${o._id}/self-ship`, { courierName, trackingId, trackingUrl });
      showToast('Marked as shipped!', 'success');
      closeModal('ship-modal');
      load(page);
    } catch (err) { showToast(err.message, 'error'); }
  };

  /* ── Pickup Request (separate action) ── */
  window.bulkPickup = async () => {
    const selected = allOrdersData.filter(o => selectedOrders.has(o._id) && o.shipping?.awb);
    if (!selected.length) { showToast('No shipped orders with AWB selected', 'error'); return; }

    openModal('pickup-modal');
    const body = document.getElementById('pickup-body');
    body.innerHTML = `
      <div style="margin-bottom:16px">
        <div style="background:#f0fdf4;border-radius:12px;padding:14px;margin-bottom:12px">
          <div style="font-size:13px;font-weight:700;color:#333;margin-bottom:8px">📦 ${selected.length} package(s) for pickup</div>
          <div style="max-height:150px;overflow-y:auto">
            ${selected.map(o => `
              <div style="padding:6px 8px;background:#fff;border-radius:6px;border:1px solid #e5e7eb;margin-bottom:4px;font-size:12px;display:flex;justify-content:space-between">
                <span><strong>#${o.orderNumber || o._id?.slice(-6)}</strong></span>
                <span style="color:#2563eb;font-weight:600">AWB: ${o.shipping?.awb || '—'}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <div>
            <label style="font-size:11px;font-weight:600;color:#666">Pickup Date</label>
            <input class="form-control" id="pk-date" type="date" value="${new Date().toISOString().split('T')[0]}" style="font-size:13px">
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:#666">Pickup Time</label>
            <input class="form-control" id="pk-time" type="time" value="12:00" style="font-size:13px">
          </div>
        </div>

        <button id="pk-btn" onclick="confirmPickup(${selected.length})" class="btn w-full" style="padding:14px;font-size:14px;font-weight:700;background:#16a34a;color:#fff;border:none;border-radius:10px;cursor:pointer">
          🚛 Request Pickup (${selected.length} packages)
        </button>
      </div>
    `;
  };

  window.confirmPickup = async (count) => {
    const btn = document.getElementById('pk-btn');
    btn.disabled = true;
    btn.innerHTML = '⏳ Requesting pickup...';

    try {
      const pickupDate = document.getElementById('pk-date')?.value || new Date().toISOString().split('T')[0];
      const pickupTime = (document.getElementById('pk-time')?.value || '12:00') + ':00';

      await API.post('/admin/shipping/pickup-request', {
        pickupDate,
        pickupTime,
        expectedPackages: count,
      });
      showToast(`Pickup requested for ${count} package(s)!`, 'success');
      closeModal('pickup-modal');
      clearSelection();
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.innerHTML = `🚛 Request Pickup (${count} packages)`;
    }
  };

  /* ── Update order status ── */
  window.updateStatus = async (id, status) => {
    try {
      await API.put(`/admin/orders/${id}/status`, { status });
      showToast(`Order ${status}`, 'success');
      load(page);
    } catch (err) { showToast(err.message, 'error'); }
  };

  window.openRejectModal = (id) => {
    rejectOrderId = id;
    const reasonEl = document.getElementById('rej-reason');
    const noteEl = document.getElementById('rej-note');
    if (reasonEl) reasonEl.value = 'Out of stock';
    if (noteEl) noteEl.value = '';
    openModal('reject-modal');
  };

  window.submitRejectForm = async () => {
    if (!rejectOrderId) return;
    const reasonBase = document.getElementById('rej-reason')?.value || 'Other';
    const note = (document.getElementById('rej-note')?.value || '').trim();
    const reason = note ? `${reasonBase}: ${note}` : reasonBase;

    try {
      await API.put(`/admin/orders/${rejectOrderId}/reject`, { reason });
      showToast('Order rejected', 'success');
      closeModal('reject-modal');
      rejectOrderId = null;
      load(page);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  /* ── Track shipment ── */
  window.trackOrder = async (id) => {
    openModal('track-modal');
    const body = document.getElementById('track-body');
    body.innerHTML = '<div class="text-center"><div class="spinner"></div></div>';
    try {
      const data = await API.get(`/admin/orders/${id}/track`);
      const t = data.tracking || {};
      const o = data.order || {};
      body.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px;margin-bottom:16px">
          <div><strong>AWB:</strong> ${o.shipping?.awb || '-'}</div>
          <div><strong>Provider:</strong> ${o.shipping?.provider || '-'}</div>
          <div><strong>Courier:</strong> ${o.shipping?.courierName || '-'}</div>
          <div><strong>Status:</strong> ${statusBadge(t.status || o.shipping?.status || '-')}</div>
          ${t.estimatedDelivery ? `<div style="grid-column:span 2"><strong>ETA:</strong> ${fmtDate(t.estimatedDelivery)}</div>` : ''}
          ${o.shipping?.trackingUrl ? `<div style="grid-column:span 2"><a href="${o.shipping.trackingUrl}" target="_blank" class="btn btn-outline btn-sm">🔗 Track on Courier Site</a></div>` : ''}
        </div>
        <h4 style="font-size:14px;margin-bottom:8px">Timeline</h4>
        <div style="max-height:300px;overflow-y:auto;font-size:12px">
          ${(t.events || []).slice().reverse().map(e => `
            <div style="padding:8px 0;border-bottom:1px solid #f1f5f9;display:flex;gap:8px">
              <div style="min-width:12px;padding-top:4px"><div style="width:10px;height:10px;border-radius:50%;background:#2563eb"></div></div>
              <div>
                <strong>${e.status || ''}</strong> ${e.location ? '<span class="text-muted">— ' + e.location + '</span>' : ''}
                <div class="text-muted">${e.description || ''}</div>
                <div class="text-muted" style="font-size:11px">${e.timestamp ? fmtDate(e.timestamp) : ''}</div>
              </div>
            </div>
          `).join('') || '<p class="text-muted">No tracking events yet</p>'}
        </div>
        <div style="margin-top:12px;display:flex;gap:8px">
          ${o.shipping?.label ? `<a href="${o.shipping.label}" target="_blank" class="btn btn-outline btn-sm">🏷️ Label</a>` : ''}
          ${o.status !== 'delivered' && o.status !== 'cancelled' && o.shipping?.awb ? `<button class="btn btn-sm" style="background:#ef4444;color:#fff" onclick="cancelShipment('${id}')">❌ Cancel Shipment</button>` : ''}
        </div>
      `;
    } catch (err) { body.innerHTML = `<p class="text-muted">${err.message}</p>`; }
  };

  /* ── Cancel shipment ── */
  window.cancelShipment = async (id) => {
    if (!confirm('Cancel this shipment? This cannot be undone.')) return;
    try {
      await API.post(`/admin/orders/${id}/cancel-shipment`, {});
      showToast('Shipment cancelled', 'success');
      closeModal('track-modal');
      load(page);
    } catch (err) { showToast(err.message, 'error'); }
  };

  load();
})();
