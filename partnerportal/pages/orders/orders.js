(function(){
  requireAuth();
  document.body.innerHTML = pageShell('Orders');
  buildLayout('orders');
  const content = document.getElementById('page-content');

  let page = 1, statusFilter = '';

  async function load(p=1){
    page = p;
    content.innerHTML = '<div class="text-center"><div class="spinner"></div></div>';
    try {
      let ep = `/partner/orders?page=${page}&limit=20`;
      if (statusFilter) ep += '&status='+statusFilter;
      const data = await API.get(ep);
      const orders = data.orders || [];
      const pag = data.pagination || {};

      content.innerHTML = `
        <div class="toolbar">
          <div class="toolbar-left">
            <select class="form-control" style="width:160px" onchange="window._sf=this.value;loadO(1)">
              <option value="">All Status</option>
              ${['pending','placed','confirmed','processing','ready','shipped','delivered','cancelled'].map(s=>`<option value="${s}" ${statusFilter===s?'selected':''}>${s}</option>`).join('')}
            </select>
            <span class="text-muted text-sm">${pag.total||orders.length} orders</span>
          </div>
          <button class="btn btn-sm btn-primary" onclick="openPOS()">+ POS Order</button>
        </div>

        <div class="card">
          <div class="card-body table-wrap">
            <table>
              <thead><tr><th>Order #</th><th>Source</th><th>Customer</th><th>Total</th><th>Payment</th><th>Status</th><th>Fulfillment</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                ${orders.map(o=>`
                  <tr>
                    <td><strong>${o.orderNumber||o._id?.slice(-6)||'-'}</strong></td>
                    <td>${statusBadge(o.source||'app')}</td>
                    <td>${esc(o.user?.name||o.customer?.name||o.user?.phone||'-')}</td>
                    <td>${fmtCurrency(o.grandTotal)}</td>
                    <td>${statusBadge(o.paymentStatus)}</td>
                    <td>${statusBadge(o.status)}</td>
                    <td>${statusBadge(o.fulfillmentType||'platform')}</td>
                    <td>${fmtDate(o.createdAt)}</td>
                    <td>
                      <div class="d-flex gap-1" style="flex-wrap:wrap">
                        <button class="btn btn-xs" onclick="viewOrder('${o._id}')">View</button>
                        ${o.status==='placed'||o.status==='pending' ? `<button class="btn btn-xs btn-success" onclick="acceptOrder('${o._id}')">Accept</button><button class="btn btn-xs btn-danger" onclick="rejectOrder('${o._id}')">Reject</button>` : ''}
                        ${o.status==='confirmed'||o.status==='processing' ? `<button class="btn btn-xs btn-primary" onclick="markReady('${o._id}')">Ready</button>` : ''}
                        ${o.status==='ready' ? `<button class="btn btn-xs btn-info" style="background:var(--info);color:#fff" onclick="assignDB('${o._id}')">Assign DB</button>` : ''}
                        ${o.fulfillmentType==='self'&&(o.status==='shipped'||o.deliveryStatus==='on_the_way') ? `<button class="btn btn-xs btn-success" onclick="markDelivered('${o._id}')">Delivered</button>` : ''}
                        <button class="btn btn-xs btn-outline" onclick="downloadInvoice('${o._id}')">Invoice</button>
                      </div>
                    </td>
                  </tr>`).join('')||'<tr><td colspan="9" class="text-center text-muted">No orders</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
        <div class="pagination" id="pag"></div>

        <!-- Order Detail Modal -->
        <div class="modal-overlay" id="detail-modal">
          <div class="modal" style="max-width:640px">
            <div class="modal-header"><h3>Order Details</h3><button class="modal-close" onclick="closeModal('detail-modal')">&times;</button></div>
            <div class="modal-body" id="orderDetail"></div>
          </div>
        </div>

        <!-- POS Modal -->
        <div class="modal-overlay" id="pos-modal">
          <div class="modal" style="max-width:560px">
            <div class="modal-header"><h3>Create POS Order</h3><button class="modal-close" onclick="closeModal('pos-modal')">&times;</button></div>
            <div class="modal-body">
              <div class="form-row">
                <div class="form-group"><label>Customer Name</label><input class="form-control" id="posName"></div>
                <div class="form-group"><label>Customer Phone</label><input class="form-control" id="posPhone"></div>
              </div>
              <div class="form-group"><label>Payment Method</label><select class="form-control" id="posPay"><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option></select></div>
              <div class="form-group"><label>Discount (₹)</label><input class="form-control" id="posDisc" type="number" min="0" value="0"></div>
              <div class="form-group"><label>Note</label><input class="form-control" id="posNote" placeholder="Optional"></div>

              <h4 style="font-size:13px;margin:12px 0 6px">Items</h4>
              <div id="posItems"></div>
              <button class="btn btn-xs btn-outline mt-1" onclick="addPosItem()">+ Add Item</button>

              <div class="modal-footer" style="padding:0;border:none;margin-top:14px">
                <button class="btn" onclick="closeModal('pos-modal')">Cancel</button>
                <button class="btn btn-primary" onclick="createPOS()">Create Order</button>
              </div>
            </div>
          </div>
        </div>`;
      renderPagination('pag', page, pag.pages||1, loadO);
    } catch(e){ content.innerHTML = '<div class="empty-state"><p>'+esc(e.message)+'</p></div>'; }
  }

  window.loadO = function(p){ statusFilter = window._sf||statusFilter; load(p); };

  /* ── View Detail ── */
  window.viewOrder = async function(id){
    openModal('detail-modal');
    const d = document.getElementById('orderDetail');
    d.innerHTML = '<div class="spinner"></div>';
    try {
      const r = await API.get('/partner/orders/'+id);
      const o = r.order;
      d.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px">
          <div><strong>Order #:</strong> ${o.orderNumber||o._id}</div>
          <div><strong>Status:</strong> ${statusBadge(o.status)}</div>
          <div><strong>Source:</strong> ${statusBadge(o.source||'app')}</div>
          <div><strong>Payment:</strong> ${o.paymentMethod} — ${statusBadge(o.paymentStatus)}</div>
          <div><strong>Customer:</strong> ${esc(o.user?.name||o.customer?.name||'-')}</div>
          <div><strong>Fulfillment:</strong> ${statusBadge(o.fulfillmentType||'platform')}</div>
          <div><strong>Subtotal:</strong> ${fmtCurrency(o.subtotal)}</div>
          <div><strong>GST:</strong> ${fmtCurrency(o.totalGst)}</div>
          <div><strong>Discount:</strong> ${fmtCurrency(o.discount)}</div>
          <div><strong>Grand Total:</strong> <strong>${fmtCurrency(o.grandTotal)}</strong></div>
          <div><strong>Profit:</strong> <span style="color:var(--success)">${fmtCurrency(o.profit)}</span></div>
          <div><strong>Delivery Boy:</strong> ${esc(o.deliveryBoy?.name||'-')}</div>
        </div>
        <h4 style="font-size:13px;margin:14px 0 6px">Items</h4>
        <table style="font-size:12px">
          <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>GST</th><th>Total</th></tr></thead>
          <tbody>${(o.items||[]).map(i=>`<tr><td>${esc(i.name||i.product?.name||'-')}</td><td>${i.quantity}</td><td>${fmtCurrency(i.price)}</td><td>${fmtCurrency(i.gstAmount)}</td><td>${fmtCurrency(i.total)}</td></tr>`).join('')}</tbody>
        </table>
        ${o.deliveryAddress ? `<p class="text-sm text-muted mt-2"><strong>Delivery:</strong> ${esc(o.deliveryAddress.address||'')}</p>` : ''}

        ${['confirmed','processing','ready','shipped'].includes(o.status)&&o.fulfillmentType==='self' ? `
        <div class="mt-2">
          <label class="text-sm fw-600">Update Delivery Status:</label>
          <div class="d-flex gap-1 mt-1">
            <button class="btn btn-xs btn-primary" onclick="updateDelStatus('${o._id}','picked_up')">Picked Up</button>
            <button class="btn btn-xs btn-primary" onclick="updateDelStatus('${o._id}','on_the_way')">On The Way</button>
          </div>
        </div>` : ''}`;
    } catch(e){ d.innerHTML = '<p class="text-muted">'+esc(e.message)+'</p>'; }
  };

  /* ── Order workflow ── */
  window.acceptOrder = async function(id){
    try { await API.put('/partner/orders/'+id+'/accept'); showToast('Order accepted','success'); load(page); }
    catch(e){ showToast(e.message,'error'); }
  };
  window.rejectOrder = async function(id){
    const reason = prompt('Rejection reason (optional):');
    try { await API.put('/partner/orders/'+id+'/reject', { reason }); showToast('Order rejected','success'); load(page); }
    catch(e){ showToast(e.message,'error'); }
  };
  window.markReady = async function(id){
    try { await API.put('/partner/orders/'+id+'/ready'); showToast('Marked ready','success'); load(page); }
    catch(e){ showToast(e.message,'error'); }
  };
  window.assignDB = async function(id){
    const dbId = prompt('Enter Delivery Boy ID:');
    if (!dbId) return;
    try { await API.put('/partner/orders/'+id+'/assign-delivery', { deliveryBoyId: dbId.trim() }); showToast('Delivery boy assigned','success'); load(page); }
    catch(e){ showToast(e.message,'error'); }
  };
  window.markDelivered = async function(id){
    const otp = prompt('Enter delivery OTP:');
    if (!otp) return;
    try { await API.put('/partner/orders/'+id+'/mark-delivered', { otp: otp.trim() }); showToast('Order delivered','success'); load(page); }
    catch(e){ showToast(e.message,'error'); }
  };
  window.updateDelStatus = async function(id, status){
    try { await API.put('/partner/orders/'+id+'/delivery-status', { deliveryStatus: status }); showToast('Status updated','success'); closeModal('detail-modal'); load(page); }
    catch(e){ showToast(e.message,'error'); }
  };

  /* ── Invoice ── */
  window.downloadInvoice = async function(id){
    try {
      const token = getToken();
      const res = await fetch(CONFIG.API_BASE+'/partner/orders/'+id+'/invoice', { headers:{ 'Authorization':'Bearer '+token, 'x-client-type':'partner' } });
      if (!res.ok) throw new Error('Failed to download');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'invoice-'+id+'.pdf'; a.click();
      URL.revokeObjectURL(url);
    } catch(e){ showToast(e.message,'error'); }
  };

  /* ── POS Order ── */
  let posItemCount = 0;
  window.openPOS = function(){
    load(page).then(()=>{
      posItemCount = 0;
      document.getElementById('posItems').innerHTML = '';
      document.getElementById('posName').value='';
      document.getElementById('posPhone').value='';
      document.getElementById('posPay').value='cash';
      document.getElementById('posDisc').value='0';
      document.getElementById('posNote').value='';
      addPosItem();
      openModal('pos-modal');
    });
  };

  window.addPosItem = function(){
    const c = document.createElement('div');
    c.className = 'form-row mb-1';
    c.innerHTML = `<div class="form-group"><label>Product ID</label><input class="form-control pos-prod" placeholder="Product ObjectId"></div>
      <div class="form-group"><label>Qty</label><input class="form-control pos-qty" type="number" min="1" value="1"></div>`;
    document.getElementById('posItems').appendChild(c);
    posItemCount++;
  };

  window.createPOS = async function(){
    const prods = document.querySelectorAll('.pos-prod');
    const qtys = document.querySelectorAll('.pos-qty');
    const items = [];
    prods.forEach((p,i)=>{
      const pid = p.value.trim();
      const qty = parseInt(qtys[i]?.value)||1;
      if (pid) items.push({ product: pid, quantity: qty });
    });
    if (!items.length) { showToast('Add at least one item','error'); return; }

    const payload = {
      items,
      paymentMethod: document.getElementById('posPay').value,
      discount: parseInt(document.getElementById('posDisc').value)||0,
      note: document.getElementById('posNote').value.trim()
    };
    const custName = document.getElementById('posName').value.trim();
    const custPhone = document.getElementById('posPhone').value.trim();
    if (custName || custPhone) payload.customer = { name: custName, phone: custPhone };

    try {
      await API.post('/partner/orders', payload);
      showToast('POS order created','success');
      closeModal('pos-modal');
      load(page);
    } catch(e){ showToast(e.message,'error'); }
  };

  load();
})();
