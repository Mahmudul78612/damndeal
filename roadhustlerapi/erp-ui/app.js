/* Road Hustlers Garage ERP — classic desktop SPA.
   Estimate → Work Order → Invoice in one flow (Shopmonkey/Tekmetric-style),
   keyboard-first, dense tables, same-origin API. */
const App = (() => {
  /* ── helpers ── */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $m = (n) => '$' + Number(n || 0).toFixed(2);
  const dt = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—';
  const dtt = (d) => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

  let toastTimer;
  function toast(msg, type = '') {
    const t = $('#toast');
    t.textContent = msg; t.className = 'show ' + type;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.className = '', 2600);
  }
  function modal(html, width) {
    const ov = $('#modal-ov');
    ov.innerHTML = `<div class="modal" style="${width ? 'width:' + width : ''}">${html}</div>`;
    ov.classList.add('show');
    ov.onclick = (e) => { if (e.target === ov) closeModal(); };
    return ov;
  }
  const closeModal = () => $('#modal-ov').classList.remove('show');
  const mh = (t) => `<div class="modal-h">${t}<button onclick="App.closeModal()">×</button></div>`;
  const fld = (label, inner) => `<div><label>${label}</label>${inner}</div>`;

  const stBadge = (s) => `<span class="badge st-${esc(s)}">${esc(String(s || '').replace(/_/g, ' '))}</span>`;

  /* ── state ── */
  let user = null;
  let settings = {};
  let screen = 'dashboard';
  let customers = [], parts = [], services = [], staff = [];
  let wo = null;            // current work order (server doc) or null
  let woDraft = { customer: '', vehicle: '' };
  let woVehicles = [];      // vehicles of selected customer
  let woListStatus = '';
  let catTab = 'services', catCat = '', catQ = '';

  /* ── auth ── */
  async function login() {
    const email = $('#lg-email').value.trim(), password = $('#lg-pass').value;
    if (!email || !password) { $('#lg-err').textContent = 'Email and password required'; return; }
    $('#lg-btn').disabled = true; $('#lg-err').textContent = '';
    try {
      const r = await API.post('/auth/login', { email, password });
      API.setTokens(r.token || r.accessToken, r.refreshToken);
      user = r.user; localStorage.setItem('rh_user', JSON.stringify(user));
      afterLogin();
    } catch (e) { $('#lg-err').textContent = e.message; }
    $('#lg-btn').disabled = false;
  }
  function logout() { API.clear(); user = null; showLogin(); }
  function showLogin() { $('#login-ov').style.display = 'grid'; $('#btn-logout').style.display = 'none'; }
  async function afterLogin() {
    $('#login-ov').style.display = 'none';
    $('#btn-logout').style.display = '';
    $('#tb-user').textContent = (user?.name || user?.email || 'Staff') + (user?.role ? ` · ${user.role}` : '');
    try {
      const s = await API.get('/erp/settings');
      settings = s.data || s.settings || {};
      $('#tb-shop').textContent = settings.shopName || 'Road Hustlers';
    } catch {}
    refreshCaches();
    go('dashboard');
  }
  async function refreshCaches() {
    try { customers = (await API.get('/erp/customers?limit=200')).items || []; } catch {}
    try { parts = (await API.get('/erp/parts?limit=200')).items || []; } catch {}
    try { services = (await API.get('/erp/services')).items || (await API.get('/erp/services')).data || []; } catch {}
    try { staff = (await API.get('/erp/staff')).items || []; } catch {}
  }

  /* ── router ── */
  const SCREENS = {
    dashboard:   { t: 'DASHBOARD',       fn: 'Overview of today' },
    workorders:  { t: 'WORK ORDERS',     fn: '<b>F2</b> Customer  <b>F4</b> Find item  <b>F8</b> Save  <b>F9</b> → Invoice  <b>Esc</b> New' },
    appointments:{ t: 'APPOINTMENTS',    fn: 'Requests from the website land here — confirm & start work' },
    customers:   { t: 'CUSTOMERS',       fn: 'Walk-ins allowed — name + phone is enough' },
    parts:       { t: 'PARTS / INVENTORY', fn: 'Stock auto-deducts when a part is invoiced' },
    invoices:    { t: 'INVOICES',        fn: 'Record payments here — balance updates live' },
    payments:    { t: 'PAYMENTS',        fn: 'Daybook of received payments' },
    reports:     { t: 'REPORTS',         fn: 'Revenue · inventory value · technician productivity · sales tax' },
    leads:       { t: 'LEADS',           fn: 'Website repair requests — contact, quote, convert to customer' },
    po:          { t: 'PURCHASING',      fn: 'Suppliers & purchase orders — receiving adds stock automatically' },
    staff:       { t: 'STAFF',           fn: 'Technicians & advisors — roles, pay rate, timesheets' },
    services:    { t: 'SERVICE CATALOG', fn: 'Standard jobs with book hours & rates' },
    settings:    { t: 'SETTINGS',        fn: 'Rates, tax & numbering' },
  };
  function go(name) {
    screen = name;
    $$('#rail button').forEach(b => b.classList.toggle('on', b.dataset.screen === name));
    $('#hdr-title').textContent = SCREENS[name].t;
    $('#fnbar').innerHTML = SCREENS[name].fn;
    $('#hdr-hint').textContent = '';
    RENDER[name]();
  }

  /* ═══════════ DASHBOARD ═══════════ */
  async function rDashboard() {
    $('#screen').innerHTML = '<div class="empty">Loading…</div>';
    let d = {};
    try { d = (await API.get('/erp/dashboard')).data || {}; } catch (e) { $('#screen').innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    const low = parts.filter(p => p.quantityInStock <= (p.reorderLevel || 0) && p.isActive !== false);
    $('#screen').innerHTML = `
      <div class="stats">
        ${[['Open work orders', d.openWorkOrders ?? d.workOrders ?? '—'],
           ['Estimates pending', d.pendingEstimates ?? '—'],
           ['Unpaid invoices', d.unpaidInvoices ?? '—'],
           ['Revenue (month)', d.monthRevenue != null ? $m(d.monthRevenue) : '—'],
           ['Appointments today', d.todayAppointments ?? '—'],
           ['Low stock parts', low.length]]
          .map(([l, v]) => `<div class="stat"><div class="sl">${l}</div><div class="sv">${v}</div></div>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="panel">
          <div class="panel-h">⚡ Quick actions</div>
          <div style="padding:12px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-green" onclick="App.newWOFlow()">＋ New Work Order</button>
            <button class="btn btn-steel" onclick="App.go('appointments')">🗓️ Appointments</button>
            <button class="btn btn-steel" onclick="App.go('invoices')">🧾 Invoices</button>
            <button class="btn" onclick="App.custModal()">＋ New Customer</button>
          </div>
        </div>
        <div class="panel">
          <div class="panel-h">📦 Low stock ${low.length ? `<span class="badge st-on_hold">${low.length}</span>` : ''}</div>
          <div class="panel-b" style="max-height:220px">
            ${low.length ? `<table class="grid"><thead><tr><th>Part</th><th class="num">Stock</th><th class="num">Reorder at</th></tr></thead>
              <tbody>${low.slice(0, 12).map(p => `<tr><td>${esc(p.name)}</td><td class="num b" style="color:var(--red)">${p.quantityInStock}</td><td class="num">${p.reorderLevel}</td></tr>`).join('')}</tbody></table>`
            : '<div class="empty">All good — no low stock</div>'}
          </div>
        </div>
      </div>`;
  }

  /* ═══════════ WORK ORDERS (hero screen) ═══════════ */
  function newWOFlow() { wo = null; woDraft = { customer: '', vehicle: '' }; woVehicles = []; go('workorders'); }

  async function rWorkOrders() {
    $('#screen').innerHTML = `
      <div id="wo-layout">
        <div class="panel" id="wo-left">
          <div class="panel-h">RECENT ORDERS
            <span class="ph-right">
              <select id="wol-status" style="font-size:11px;padding:2px" onchange="App.wolFilter(this.value)">
                <option value="">All</option>
                ${['estimate','approved','in_progress','on_hold','completed','invoiced'].map(s => `<option ${woListStatus===s?'selected':''} value="${s}">${s.replace('_',' ')}</option>`).join('')}
              </select>
            </span>
          </div>
          <div class="panel-b" id="wo-list"><div class="empty">Loading…</div></div>
        </div>

        <div id="wo-mid">
          <div id="wo-head"></div>
          <div class="panel">
            <div class="panel-h">ORDER LINES <span class="ph-right" id="wo-lines-hint"></span></div>
            <div class="panel-b" id="wo-lines"></div>
          </div>
          <div id="wo-cat">
            <div class="panel">
              <div class="panel-h">CATALOG</div>
              <div class="panel-b" id="wo-cats"></div>
            </div>
            <div class="panel">
              <div class="panel-h">
                <span id="cat-tabs">
                  <button class="btn-xs btn ${catTab==='services'?'btn-steel':''}" onclick="App.catSwitch('services')">🧰 Services</button>
                  <button class="btn-xs btn ${catTab==='parts'?'btn-steel':''}" onclick="App.catSwitch('parts')">📦 Parts</button>
                </span>
                <span class="ph-right">
                  <input id="cat-q" placeholder="Search item… (F4)" style="width:170px;font-size:12px" oninput="App.catSearch(this.value)">
                  <button class="btn btn-xs" onclick="App.manualLine()">＋ Manual</button>
                </span>
              </div>
              <div class="panel-b" id="wo-pick"></div>
            </div>
          </div>
        </div>

        <div id="wo-right"></div>
      </div>`;
    loadWOList();
    renderWOHead();
    renderWOLines();
    renderWORight();
    renderCatalog();
  }
  async function loadWOList() {
    try {
      const q = woListStatus ? `?status=${woListStatus}&limit=40` : '?limit=40';
      const r = await API.get('/erp/work-orders' + q);
      const items = r.items || [];
      $('#wo-list').innerHTML = items.length ? `<table class="grid"><tbody>
        ${items.map(w => `<tr class="${wo && wo._id === w._id ? 'sel' : ''}" onclick="App.openWO('${w._id}')" style="cursor:pointer">
          <td><div class="b">${esc(w.orderNumber)}</div><div class="mut" style="font-size:11px">${esc(w.customer?.name || '—')} · ${dt(w.createdAt)}</div></td>
          <td class="num">${stBadge(w.status)}<div class="b" style="margin-top:2px">${$m(w.total)}</div></td>
        </tr>`).join('')}</tbody></table>` : '<div class="empty">No orders</div>';
    } catch (e) { $('#wo-list').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }
  const wolFilter = (v) => { woListStatus = v; loadWOList(); };

  async function openWO(id) {
    try {
      const r = await API.get('/erp/work-orders/' + id);
      wo = r.data;
      woDraft = { customer: wo.customer?._id || wo.customer, vehicle: wo.vehicle?._id || wo.vehicle };
      await loadVehiclesFor(woDraft.customer);
      renderWOHead(); renderWOLines(); renderWORight(); loadWOList();
    } catch (e) { toast(e.message, 'err'); }
  }
  async function loadVehiclesFor(custId) {
    woVehicles = [];
    if (!custId) return;
    try { woVehicles = (await API.get('/erp/vehicles?customer=' + custId)).items || []; } catch {}
  }

  function renderWOHead() {
    const locked = wo && ['invoiced', 'cancelled'].includes(wo.status);
    $('#wo-head').innerHTML = `
      <div class="row">
        <div style="width:230px">
          <label>Customer ${wo ? '' : '(F2)'}</label>
          <div style="display:flex;gap:4px">
            <select id="wo-cust" class="grow" ${wo ? 'disabled' : ''} onchange="App.woCustChange(this.value)">
              <option value="">— select —</option>
              ${customers.map(c => `<option value="${c._id}" ${woDraft.customer === c._id ? 'selected' : ''}>${esc(c.name)}${c.phone ? ' · ' + esc(c.phone) : ''}</option>`).join('')}
            </select>
            ${wo ? '' : `<button class="btn btn-sm" title="New customer" onclick="App.custModal(true)">＋</button>`}
          </div>
        </div>
        <div style="width:220px">
          <label>Vehicle</label>
          <div style="display:flex;gap:4px">
            <select id="wo-veh" class="grow" ${wo ? 'disabled' : ''}>
              <option value="">— select —</option>
              ${woVehicles.map(v => `<option value="${v._id}" ${woDraft.vehicle === v._id ? 'selected' : ''}>${esc([v.year, v.make, v.model].filter(Boolean).join(' '))}${v.plate ? ' · ' + esc(v.plate) : ''}</option>`).join('')}
            </select>
            ${wo ? '' : `<button class="btn btn-sm" title="New vehicle" onclick="App.vehModal()">＋</button>`}
          </div>
        </div>
        <div class="grow" style="min-width:160px">
          <label>Complaint / request</label>
          <textarea id="wo-complaint" rows="1" style="width:100%;resize:vertical;min-height:27px" placeholder="e.g. Brake noise at low speed" ${locked ? 'disabled' : ''}>${esc(wo?.complaint || '')}</textarea>
        </div>
        <div style="width:110px">
          <label>Priority</label>
          <select id="wo-priority" ${locked ? 'disabled' : ''}>
            ${['low','normal','high','urgent'].map(p => `<option ${((wo?.priority)||'normal')===p?'selected':''}>${p}</option>`).join('')}
          </select>
        </div>
        <div style="width:150px">
          <label>Technician</label>
          <select id="wo-tech" ${locked ? 'disabled' : ''}>
            <option value="">— unassigned —</option>
            ${staff.map(s => `<option value="${s._id}" ${((wo?.assignedTechs?.[0]?._id)||wo?.assignedTechs?.[0])===s._id?'selected':''}>${esc(s.name)}</option>`).join('')}
          </select>
        </div>
        <div>
          ${wo
            ? `<span style="font-size:15px" class="b">${esc(wo.orderNumber)}</span> ${stBadge(wo.status)}`
            : `<button class="btn btn-green" onclick="App.woCreate()">✔ Create (F8)</button>
               <button class="btn btn-steel" onclick="App.custWOModal()" title="New customer + vehicle + complaints + technician — all in one place">🧑 Walk-in Wizard</button>`}
        </div>
      </div>`;
  }
  async function woCustChange(v) {
    woDraft.customer = v; woDraft.vehicle = '';
    await loadVehiclesFor(v); renderWOHead();
  }
  async function woCreate() {
    const customer = $('#wo-cust').value, vehicle = $('#wo-veh').value;
    if (!customer) { toast('Select a customer', 'err'); $('#wo-cust').focus(); return; }
    if (!vehicle) { toast('Select a vehicle (＋ to add one)', 'err'); return; }
    try {
      const r = await API.post('/erp/work-orders', {
        customer, vehicle,
        complaint: $('#wo-complaint').value,
        priority: $('#wo-priority').value,
        assignedTechs: $('#wo-tech').value ? [$('#wo-tech').value] : [],
      });
      wo = r.data; toast('Work order ' + wo.orderNumber + ' created', 'ok');
      renderWOHead(); renderWOLines(); renderWORight(); loadWOList();
    } catch (e) { toast(e.message, 'err'); }
  }
  async function woSaveHead() {
    if (!wo) { woCreate(); return; }
    try {
      const r = await API.patch('/erp/work-orders/' + wo._id, {
        complaint: $('#wo-complaint').value,
        priority: $('#wo-priority').value,
        assignedTechs: $('#wo-tech').value ? [$('#wo-tech').value] : [],
      });
      wo = r.data; toast('Saved', 'ok'); renderWORight();
    } catch (e) { toast(e.message, 'err'); }
  }

  function renderWOLines() {
    const box = $('#wo-lines');
    if (!wo) {
      $('#wo-lines-hint').textContent = 'Create the order first, then add labor & parts';
      box.innerHTML = '<div class="empty">Select customer + vehicle above and press <b>Create Order</b><br><span class="mut" style="font-size:12px">Then add services & parts from the panel below — totals calculate live.</span></div>';
      return;
    }
    $('#wo-lines-hint').textContent = `${(wo.laborItems?.length || 0) + (wo.partItems?.length || 0)} lines`;
    const locked = ['invoiced', 'cancelled'].includes(wo.status);
    const rows = [
      ...(wo.laborItems || []).map(l => ({ kind: 'L', id: l._id, d: l.description, q: l.hours ? l.hours + ' hr' : '—', u: l.hours ? $m(l.rate) + '/hr' : '', tax: l.taxable, t: l.lineTotal })),
      ...(wo.partItems || []).map(p => ({ kind: 'P', id: p._id, d: p.description, q: p.quantity, u: $m(p.sellPrice), tax: p.taxable, t: p.lineTotal })),
    ];
    box.innerHTML = rows.length ? `<table class="grid">
      <thead><tr><th style="width:34px"></th><th>Description</th><th class="num">Qty/Hrs</th><th class="num">Rate</th><th>Tax</th><th class="num">Total</th><th style="width:34px"></th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td><span class="badge" style="background:${r.kind === 'L' ? '#cce5ff;color:#004085' : '#d4edda;color:#155724'}">${r.kind}</span></td>
        <td>${esc(r.d)}</td><td class="num">${r.q}</td><td class="num">${r.u}</td>
        <td>${r.tax ? '✓' : ''}</td><td class="num b">${$m(r.t)}</td>
        <td>${locked ? '' : `<button class="btn btn-xs btn-red" onclick="App.woRemoveLine('${r.id}')">✕</button>`}</td>
      </tr>`).join('')}</tbody></table>`
      : '<div class="empty">No lines yet — pick a service or part below (F4 to search)</div>';
  }
  async function woRemoveLine(lineId) {
    try {
      const r = await API.del(`/erp/work-orders/${wo._id}/line/${lineId}`);
      wo = r.data; renderWOLines(); renderWORight(); toast('Line removed', 'ok');
    } catch (e) { toast(e.message, 'err'); }
  }

  function renderWORight() {
    const box = $('#wo-right');
    if (!wo) { box.innerHTML = '<div class="panel"><div class="panel-h">TOTALS</div><div class="empty">—</div></div>'; return; }
    const locked = ['invoiced', 'cancelled'].includes(wo.status);
    const T = (l, v, cls = '') => `<div class="tot-row ${cls}"><div class="tl">${l}</div><div class="tv">${v}</div></div>`;
    box.innerHTML = `
      <div>
        ${T('Labor', $m(wo.laborSubtotal))}
        ${T('Parts', $m(wo.partsSubtotal))}
        <div class="tot-row"><div class="tl">Discount
          <select id="wo-disc-type" style="font-size:11px;padding:1px;margin-left:6px" ${locked ? 'disabled' : ''}>
            <option value="amount" ${wo.discountType !== 'percent' ? 'selected' : ''}>$</option>
            <option value="percent" ${wo.discountType === 'percent' ? 'selected' : ''}>%</option>
          </select></div>
          <input id="wo-disc" class="tv" style="width:110px" type="number" min="0" value="${wo.discount || 0}" ${locked ? 'disabled' : ''} onchange="App.woDiscount()">
        </div>
        ${T('Shop supplies', $m(wo.shopSuppliesFee))}
        ${T(`Tax (${wo.taxRate || 0}%)`, $m(wo.taxAmount))}
        ${T('GRAND TOTAL', $m(wo.total), 'tot-grand')}
      </div>

      <div class="panel">
        <div class="panel-h">STATUS FLOW</div>
        <div style="padding:10px;display:grid;gap:6px">
          ${wo.status === 'estimate' ? `<button class="btn btn-green" onclick="App.woAction('approve')">✔ Customer Approved</button>` : ''}
          ${wo.status === 'approved' ? `<button class="btn btn-blue" onclick="App.woStatus('in_progress')">▶ Start Work</button>` : ''}
          ${wo.status === 'in_progress' ? `
            <div style="display:flex;gap:6px">
              <button class="btn btn-sm grow" style="background:#e8f0fb" onclick="App.woAction('clock-in')">🕒 Clock In</button>
              <button class="btn btn-sm grow" style="background:#fbeee8" onclick="App.woAction('clock-out')">🕒 Clock Out</button>
            </div>
            <button class="btn btn-blue" onclick="App.woStatus('completed')">✔ Mark Completed</button>
            <button class="btn btn-amber" onclick="App.woStatus('on_hold')">⏸ Hold</button>` : ''}
          ${wo.status === 'on_hold' ? `<button class="btn btn-blue" onclick="App.woStatus('in_progress')">▶ Resume</button>` : ''}
          ${['approved', 'in_progress', 'completed'].includes(wo.status) ? `<button class="btn btn-green" onclick="App.woInvoice()">🧾 Generate Invoice (F9)</button>` : ''}
          ${wo.status === 'invoiced' ? `<div class="mut" style="text-align:center;font-size:12px">Invoiced ✓ — see Invoices screen</div>` : ''}
          ${!locked ? `<button class="btn" onclick="App.woSaveHead()">💾 Save changes (F8)</button>
          <button class="btn btn-red" onclick="App.woStatus('cancelled', true)">✕ Cancel order</button>` : ''}
          <button class="btn btn-steel" onclick="App.woPrint()">🖨️ Print Job Card / Bill</button>
          <button class="btn" onclick="App.newWOFlow()">＋ New order (Esc)</button>
        </div>
      </div>
      <div class="panel">
        <div class="panel-h">⏱ TIME & LABOR</div>
        <div style="padding:10px;font-size:12.5px">
          ${(() => {
            const logs = wo.timeLog || [];
            const doneMin = logs.reduce((s, l) => s + (l.minutes || 0), 0);
            const open = logs.filter(l => l.startedAt && !l.stoppedAt);
            const hrs = (doneMin / 60).toFixed(2);
            return `
              <div style="display:flex;justify-content:space-between"><span>Clocked (completed)</span><b>${hrs} hrs</b></div>
              ${open.length ? `<div style="display:flex;justify-content:space-between;color:var(--blue)"><span>On the clock now</span><b>${open.length} tech</b></div>` : ''}
              ${doneMin > 0 && !locked ? `<button class="btn btn-sm btn-steel" style="width:100%;margin-top:6px" onclick="App.woTimeToLabor(${doneMin})">➕ Add ${hrs} hrs as labor line</button>` : ''}
              ${!logs.length ? '<span class="mut">Time is tracked via Clock In / Clock Out</span>' : ''}`;
          })()}
        </div>
      </div>
      <div class="panel">
        <div class="panel-h">📝 TECH NOTES — FINAL SUMMARY</div>
        <div style="padding:8px">
          <label style="font-size:11px;font-weight:700;color:#155724">✔ Work done (diagnosis)</label>
          <textarea id="wo-diag" rows="2" style="width:100%" placeholder="e.g. Front pads replaced, rotors turned…" ${locked ? 'disabled' : ''}>${esc(wo.diagnosis || '')}</textarea>
          <label style="font-size:11px;font-weight:700;color:#b23a3a;margin-top:6px;display:block">✋ Not done / pending (recommended work)</label>
          <textarea id="wo-reco" rows="2" style="width:100%" placeholder="e.g. Rear pads not in stock — ordered, due next visit. Customer declined AC service." ${locked ? 'disabled' : ''}>${esc(wo.recommendation || '')}</textarea>
          ${locked ? '' : `<button class="btn btn-sm btn-steel" style="margin-top:6px;width:100%" onclick="App.woSaveDiag()">💾 Save summary</button>`}
          <p class="mut" style="font-size:10.5px;margin-top:4px">Both print on the job card & bill — the customer sees what was done and what is still pending.</p>
        </div>
      </div>`;
  }
  async function woDiscount() {
    try {
      const r = await API.patch('/erp/work-orders/' + wo._id, {
        discount: parseFloat($('#wo-disc').value) || 0,
        discountType: $('#wo-disc-type').value,
      });
      wo = r.data; renderWORight(); toast('Discount applied', 'ok');
    } catch (e) { toast(e.message, 'err'); }
  }
  async function woSaveDiag() {
    try {
      const r = await API.patch('/erp/work-orders/' + wo._id, {
        diagnosis: $('#wo-diag').value,
        recommendation: $('#wo-reco').value,
      });
      wo = r.data; toast('Summary saved ✓', 'ok');
    } catch (e) { toast(e.message, 'err'); }
  }
  async function woAction(a) {
    try { const r = await API.post(`/erp/work-orders/${wo._id}/${a}`); wo = r.data; renderWOHead(); renderWORight(); loadWOList(); toast('Done', 'ok'); }
    catch (e) { toast(e.message, 'err'); }
  }
  async function woStatus(status, confirmIt) {
    if (confirmIt && !confirm('Cancel this work order?')) return;
    try { const r = await API.patch('/erp/work-orders/' + wo._id, { status }); wo = r.data; renderWOHead(); renderWORight(); loadWOList(); toast('Status: ' + status.replace('_',' '), 'ok'); }
    catch (e) { toast(e.message, 'err'); }
  }
  async function woInvoice() {
    if (!confirm(`Generate invoice for ${wo.orderNumber} (${$m(wo.total)})?\nPart stock will be deducted.`)) return;
    try {
      const r = await API.post(`/erp/work-orders/${wo._id}/invoice`);
      toast('Invoice ' + (r.data?.invoiceNumber || '') + ' created', 'ok');
      openWO(wo._id);
    } catch (e) { toast(e.message, 'err'); }
  }

  /* catalog picker */
  function catSwitch(t) { catTab = t; catCat = ''; renderCatalog(); }
  function catSearch(q) { catQ = q.toLowerCase(); renderPick(); }
  function renderCatalog() {
    const cats = catTab === 'services'
      ? [...new Set(services.filter(s => s.isActive !== false).map(s => s.category || 'General'))]
      : [...new Set(parts.filter(p => p.isActive !== false).map(p => p.category || 'General'))];
    $('#wo-cats').innerHTML = `<div class="cat-item ${!catCat ? 'on' : ''}" onclick="App.catPick('')">All items</div>` +
      cats.map(c => `<div class="cat-item ${catCat === c ? 'on' : ''}" onclick="App.catPick('${esc(c)}')">${esc(c)}</div>`).join('');
    // refresh tab buttons
    $('#cat-tabs').innerHTML = `
      <button class="btn-xs btn ${catTab==='services'?'btn-steel':''}" onclick="App.catSwitch('services')">🧰 Services</button>
      <button class="btn-xs btn ${catTab==='parts'?'btn-steel':''}" onclick="App.catSwitch('parts')">📦 Parts</button>`;
    renderPick();
  }
  function catPick(c) { catCat = c; renderCatalog(); }
  function renderPick() {
    const box = $('#wo-pick'); if (!box) return;
    let items;
    if (catTab === 'services') {
      items = services.filter(s => s.isActive !== false &&
        (!catCat || (s.category || 'General') === catCat) &&
        (!catQ || s.name.toLowerCase().includes(catQ)));
      box.innerHTML = items.length ? items.map(s => {
        const rate = s.laborRate || settings.defaultLaborRate || 0;
        const price = s.flatPrice != null ? s.flatPrice : (s.laborHours || 0) * rate;
        return `<div class="pick-item" onclick='App.addService(${JSON.stringify(s._id)})'>
          <span>${esc(s.name)}<div class="pi-s">${s.laborHours || 0} hr · ${esc(s.category || 'General')}</div></span>
          <span class="pi-p">${$m(price)}</span></div>`;
      }).join('') : '<div class="empty">No services</div>';
    } else {
      items = parts.filter(p => p.isActive !== false &&
        (!catCat || (p.category || 'General') === catCat) &&
        (!catQ || (p.name + ' ' + (p.partNumber || '')).toLowerCase().includes(catQ)));
      box.innerHTML = items.length ? items.map(p => `
        <div class="pick-item" onclick='App.addPart(${JSON.stringify(p._id)})'>
          <span>${esc(p.name)}<div class="pi-s">${esc(p.partNumber || '')} · Stk ${p.quantityInStock}</div></span>
          <span class="pi-p">${$m(p.sellPrice)}</span></div>`).join('') : '<div class="empty">No parts</div>';
    }
  }
  async function addService(id) {
    if (!wo) { toast('Create the order first (select customer + vehicle → Create Order)', 'err'); return; }
    const s = services.find(x => x._id === id); if (!s) return;
    const rate = s.laborRate || settings.defaultLaborRate || 0;
    try {
      const body = s.flatPrice != null
        ? { description: s.name, hours: 0, rate: 0, lineTotal: s.flatPrice, taxable: !!s.taxable }
        : { description: s.name, hours: s.laborHours || 1, rate, taxable: !!s.taxable };
      const r = await API.post(`/erp/work-orders/${wo._id}/labor`, body);
      wo = r.data; renderWOLines(); renderWORight(); toast('Added: ' + s.name, 'ok');
    } catch (e) { toast(e.message, 'err'); }
  }
  async function addPart(id) {
    if (!wo) { toast('Create the order first', 'err'); return; }
    const p = parts.find(x => x._id === id); if (!p) return;
    try {
      const r = await API.post(`/erp/work-orders/${wo._id}/parts`, {
        part: p._id, description: p.name, quantity: 1, sellPrice: p.sellPrice, taxable: p.taxable !== false,
      });
      wo = r.data; renderWOLines(); renderWORight(); toast('Added: ' + p.name, 'ok');
    } catch (e) { toast(e.message, 'err'); }
  }
  function manualLine() {
    if (!wo) { toast('Create the order first', 'err'); return; }
    modal(`${mh('Manual line')}
      <div class="modal-b frm">
        <div class="row">
          <div><label>Type</label><select id="ml-kind"><option value="labor">Labor</option><option value="part">Part / item</option></select></div>
          <div class="grow"><label>Description *</label><input id="ml-desc" placeholder="e.g. Wheel alignment"></div>
        </div>
        <div class="row">
          <div><label>Hours / Qty</label><input id="ml-q" type="number" value="1" step="0.25" style="width:100px"></div>
          <div><label>Rate / Price ($)</label><input id="ml-p" type="number" value="${settings.defaultLaborRate || 100}" style="width:110px"></div>
          <div><label>Taxable</label><select id="ml-tax" style="width:80px"><option value="">No</option><option value="1">Yes</option></select></div>
        </div>
      </div>
      <div class="modal-f"><button class="btn" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-green" onclick="App.manualLineSave()">Add line</button></div>`);
    setTimeout(() => $('#ml-desc').focus(), 50);
  }
  async function manualLineSave() {
    const kind = $('#ml-kind').value, desc = $('#ml-desc').value.trim();
    const q = parseFloat($('#ml-q').value) || 1, p = parseFloat($('#ml-p').value) || 0, tax = !!$('#ml-tax').value;
    if (!desc) { toast('Description required', 'err'); return; }
    try {
      const r = kind === 'labor'
        ? await API.post(`/erp/work-orders/${wo._id}/labor`, { description: desc, hours: q, rate: p, taxable: tax })
        : await API.post(`/erp/work-orders/${wo._id}/parts`, { description: desc, quantity: q, sellPrice: p, taxable: tax });
      wo = r.data; closeModal(); renderWOLines(); renderWORight(); toast('Line added', 'ok');
    } catch (e) { toast(e.message, 'err'); }
  }

  /* ═══════════ CUSTOMERS ═══════════ */
  async function rCustomers() {
    $('#screen').innerHTML = `
      <div class="toolbar">
        <input id="cu-q" placeholder="Search name / phone…" style="width:240px" oninput="App.custFilter()">
        <button class="btn btn-green" onclick="App.custModal()">＋ New Customer</button>
      </div>
      <div class="panel"><div class="panel-b" id="cu-table" style="max-height:calc(100vh - 190px)"></div></div>`;
    custFilter();
  }
  function custFilter() {
    const q = ($('#cu-q')?.value || '').toLowerCase();
    const list = customers.filter(c => !q || (c.name + ' ' + (c.phone || '')).toLowerCase().includes(q));
    $('#cu-table').innerHTML = list.length ? `<table class="grid">
      <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Company</th><th>Tags</th><th style="width:200px"></th></tr></thead>
      <tbody>${list.map(c => `<tr>
        <td class="b">${esc(c.name)}</td><td>${esc(c.phone || '—')}</td><td>${esc(c.email || '—')}</td>
        <td>${esc(c.company || '—')}</td><td>${(c.tags || []).map(t => `<span class="badge st-in_progress">${esc(t)}</span>`).join(' ')}</td>
        <td>
          <button class="btn btn-xs btn-steel" onclick="App.custVehicles('${c._id}')">🚗 Vehicles</button>
          <button class="btn btn-xs" onclick="App.custModal(false,'${c._id}')">✏️</button>
          <button class="btn btn-xs btn-green" onclick="App.custWOModal('${c._id}')">＋ WO</button>
        </td></tr>`).join('')}</tbody></table>` : '<div class="empty">No customers</div>';
  }
  async function custNewWO(id) { newWOFlow(); woDraft.customer = id; await loadVehiclesFor(id); renderWOHead(); }

  /* ── Walk-in Wizard — customer + vehicle + complaints + technician, all in one place ── */
  let wiz = null;
  async function custWOModal(custId) {
    wiz = {
      customer: custId || '', newCust: false, cname: '', cphone: '',
      vehicles: [], vehicle: '', newVeh: false, vyear: '', vmake: '', vmodel: '', vplate: '', mileage: '',
      complaints: [''],
      tech: '', newTech: false, tname: '', temail: '', tpass: '', trate: '',
      priority: 'normal',
    };
    if (custId) { wiz.vehicles = await wizVehicles(custId); if (!wiz.vehicles.length) wiz.newVeh = true; wiz.vehicle = wiz.vehicles[0]?._id || ''; }
    wizDraw();
  }
  async function wizVehicles(custId) {
    try { return (await API.get('/erp/vehicles?customer=' + custId)).items || []; } catch { return []; }
  }
  function wizSync() {
    // preserve typed values before a structural re-render
    if ($('#wz-cname')) { wiz.cname = $('#wz-cname').value; wiz.cphone = $('#wz-cphone').value; }
    if ($('#wz-vyear')) { wiz.vyear = $('#wz-vyear').value; wiz.vmake = $('#wz-vmake').value; wiz.vmodel = $('#wz-vmodel').value; wiz.vplate = $('#wz-vplate').value; }
    if ($('#wz-mileage')) wiz.mileage = $('#wz-mileage').value;
    wiz.complaints = $$('.wz-comp').map(i => i.value);
    if ($('#wz-tname')) { wiz.tname = $('#wz-tname').value; wiz.temail = $('#wz-temail').value; wiz.tpass = $('#wz-tpass').value; wiz.trate = $('#wz-trate').value; }
    if ($('#wz-priority')) wiz.priority = $('#wz-priority').value;
  }
  function wizDraw() {
    const box = (title, inner) => `<div style="background:#f6f8f2;border:1px solid #dde;border-radius:4px;padding:8px;margin-bottom:8px">
      <div style="font-weight:700;font-size:12px;color:var(--steel2);margin-bottom:6px">${title}</div>${inner}</div>`;
    modal(`${mh('🛠️ New Work Order — walk-in wizard')}
      <div class="modal-b">
        ${box('1 · CUSTOMER', wiz.newCust ? `
          <div class="row">
            <div class="grow"><label>Name *</label><input id="wz-cname" value="${esc(wiz.cname)}" placeholder="Customer name"></div>
            <div><label>Phone</label><input id="wz-cphone" value="${esc(wiz.cphone)}" style="width:140px"></div>
            <button class="btn btn-xs" onclick="App.wizToggle('newCust',false)">↩ pick existing</button>
          </div>` : `
          <div class="row">
            <select id="wz-cust" class="grow" onchange="App.wizCust(this.value)">
              <option value="">— select customer —</option>
              ${customers.map(c => `<option value="${c._id}" ${wiz.customer === c._id ? 'selected' : ''}>${esc(c.name)}${c.phone ? ' · ' + esc(c.phone) : ''}</option>`).join('')}
            </select>
            <button class="btn btn-xs btn-green" onclick="App.wizToggle('newCust',true)">＋ New customer</button>
          </div>`)}
        ${box('2 · VEHICLE', (wiz.newVeh || wiz.newCust) ? `
          <div class="row">
            <div><label>Year</label><input id="wz-vyear" type="number" value="${esc(wiz.vyear)}" style="width:78px" placeholder="2019"></div>
            <div class="grow"><label>Make *</label><input id="wz-vmake" value="${esc(wiz.vmake)}" placeholder="Ford"></div>
            <div class="grow"><label>Model *</label><input id="wz-vmodel" value="${esc(wiz.vmodel)}" placeholder="F-150"></div>
            <div><label>Plate</label><input id="wz-vplate" value="${esc(wiz.vplate)}" style="width:95px"></div>
            ${!wiz.newCust && wiz.vehicles.length ? `<button class="btn btn-xs" onclick="App.wizToggle('newVeh',false)">↩ existing</button>` : ''}
          </div>` : `
          <div class="row">
            <select id="wz-veh" class="grow" onchange="App.wizSet('vehicle',this.value)">
              ${wiz.vehicles.map(v => `<option value="${v._id}" ${wiz.vehicle === v._id ? 'selected' : ''}>${esc([v.year, v.make, v.model].filter(Boolean).join(' '))}${v.plate ? ' · ' + esc(v.plate) : ''}</option>`).join('')}
            </select>
            <button class="btn btn-xs btn-green" onclick="App.wizToggle('newVeh',true)">＋ New vehicle</button>
          </div>`)}
        ${box('3 · COMPLAINTS <span style="font-weight:400;color:#888">(add as many as needed)</span>', `
          ${wiz.complaints.map((c, i) => `
            <div class="row" style="margin-bottom:5px">
              <span class="badge st-in_progress" style="align-self:center">${i + 1}</span>
              <input class="wz-comp grow" value="${esc(c)}" placeholder="${i === 0 ? 'e.g. Brake noise at low speed *' : 'Another complaint…'}">
              ${wiz.complaints.length > 1 ? `<button class="btn btn-xs btn-red" onclick="App.wizDelComplaint(${i})">✕</button>` : ''}
            </div>`).join('')}
          <button class="btn btn-xs btn-steel" onclick="App.wizAddComplaint()">＋ Add complaint</button>
          <span style="margin-left:12px"><label style="display:inline">Mileage in:</label> <input id="wz-mileage" type="number" value="${esc(wiz.mileage)}" style="width:90px" placeholder="km/mi"></span>`)}
        ${box('4 · TECHNICIAN & PRIORITY', wiz.newTech ? `
          <div class="row">
            <div class="grow"><label>Tech name *</label><input id="wz-tname" value="${esc(wiz.tname)}"></div>
            <div class="grow"><label>Email *</label><input id="wz-temail" value="${esc(wiz.temail)}" placeholder="tech@shop.com"></div>
            <div><label>Password *</label><input id="wz-tpass" type="text" value="${esc(wiz.tpass)}" style="width:110px"></div>
            <div><label>$/hr</label><input id="wz-trate" type="number" value="${esc(wiz.trate)}" style="width:70px"></div>
            <button class="btn btn-xs" onclick="App.wizToggle('newTech',false)">↩</button>
          </div>` : `
          <div class="row">
            <select id="wz-tech" class="grow" onchange="App.wizSet('tech',this.value)">
              <option value="">— technician unassigned —</option>
              ${staff.filter(s => s.isActive !== false).map(s => `<option value="${s._id}" ${wiz.tech === s._id ? 'selected' : ''}>${esc(s.name)}${s.specialties?.length ? ' · ' + esc(s.specialties[0]) : ''}</option>`).join('')}
            </select>
            <button class="btn btn-xs btn-green" onclick="App.wizToggle('newTech',true)">＋ New technician</button>
            <div><label>Priority</label><select id="wz-priority" style="width:110px">${['low','normal','high','urgent'].map(p => `<option ${wiz.priority === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
          </div>`)}
      </div>
      <div class="modal-f"><button class="btn" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-green" onclick="App.wizCreate()">✔ Create Work Order</button></div>`, '640px');
  }
  function wizToggle(k, v) { wizSync(); wiz[k] = v; wizDraw(); }
  function wizSet(k, v) { wiz[k] = v; }
  async function wizCust(v) { wizSync(); wiz.customer = v; wiz.vehicles = v ? await wizVehicles(v) : []; wiz.vehicle = wiz.vehicles[0]?._id || ''; wiz.newVeh = !wiz.vehicles.length; wizDraw(); }
  function wizAddComplaint() { wizSync(); wiz.complaints.push(''); wizDraw(); setTimeout(() => { const els = $$('.wz-comp'); els[els.length - 1]?.focus(); }, 60); }
  function wizDelComplaint(i) { wizSync(); wiz.complaints.splice(i, 1); wizDraw(); }
  async function wizCreate() {
    wizSync();
    const complaints = wiz.complaints.map(c => c.trim()).filter(Boolean);
    if (!complaints.length) { toast('Add at least one complaint', 'err'); return; }
    try {
      // 1. customer
      let custId = wiz.customer;
      if (wiz.newCust) {
        if (!wiz.cname.trim()) { toast('Customer name required', 'err'); return; }
        custId = (await API.post('/erp/customers', { name: wiz.cname.trim(), phone: wiz.cphone.trim() })).data._id;
      }
      if (!custId) { toast('Select a customer or create a new one', 'err'); return; }
      // 2. vehicle
      let vehId = wiz.vehicle;
      if (wiz.newVeh || wiz.newCust) {
        if (!wiz.vmake.trim() || !wiz.vmodel.trim()) { toast('Vehicle make + model required', 'err'); return; }
        vehId = (await API.post('/erp/vehicles', {
          customer: custId, year: parseInt(wiz.vyear) || undefined,
          make: wiz.vmake.trim(), model: wiz.vmodel.trim(), plate: wiz.vplate.trim(),
        })).data._id;
      }
      // 3. technician
      let techId = wiz.tech;
      if (wiz.newTech) {
        if (!wiz.tname.trim() || !wiz.temail.trim() || !wiz.tpass) { toast('Technician: name, email, password required', 'err'); return; }
        techId = (await API.post('/erp/staff', {
          name: wiz.tname.trim(), email: wiz.temail.trim(), password: wiz.tpass,
          role: 'staff', hourlyRate: parseFloat(wiz.trate) || 0,
        })).data._id;
        staff = (await API.get('/erp/staff')).items || [];
      }
      // 4. work order (complaints numbered, one per line)
      const r = await API.post('/erp/work-orders', {
        customer: custId, vehicle: vehId,
        complaint: complaints.map((c, i) => `${i + 1}. ${c}`).join('\n'),
        priority: wiz.priority, assignedTechs: techId ? [techId] : [],
        mileageIn: parseInt(wiz.mileage) || undefined,
      });
      closeModal();
      customers = (await API.get('/erp/customers?limit=200')).items || [];
      toast('Work order ' + r.data.orderNumber + ' created ✓', 'ok');
      go('workorders'); openWO(r.data._id);
    } catch (e) { toast(e.message, 'err'); }
  }
  function custModal(fromWO, id) {
    const c = id ? customers.find(x => x._id === id) : null;
    modal(`${mh(c ? 'Edit customer' : 'New customer')}
      <div class="modal-b frm">
        <div class="row"><div class="grow"><label>Name *</label><input id="cm-name" value="${esc(c?.name || '')}"></div>
        <div><label>Phone</label><input id="cm-phone" value="${esc(c?.phone || '')}" style="width:150px"></div></div>
        <div class="row"><div class="grow"><label>Email (optional — walk-in ok)</label><input id="cm-email" value="${esc(c?.email || '')}"></div>
        <div class="grow"><label>Company</label><input id="cm-company" value="${esc(c?.company || '')}"></div></div>
        <div><label>Notes</label><textarea id="cm-notes" rows="2">${esc(c?.notes || '')}</textarea></div>
      </div>
      <div class="modal-f"><button class="btn" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-green" onclick="App.custSave(${fromWO ? 'true' : 'false'}, '${id || ''}')">💾 Save</button></div>`);
    setTimeout(() => $('#cm-name').focus(), 50);
  }
  async function custSave(fromWO, id) {
    const body = {
      name: $('#cm-name').value.trim(), phone: $('#cm-phone').value.trim(),
      email: $('#cm-email').value.trim() || undefined, company: $('#cm-company').value.trim(),
      notes: $('#cm-notes').value,
    };
    if (!body.name) { toast('Name required', 'err'); return; }
    try {
      let saved;
      if (id) saved = (await API.put('/erp/customers/' + id, body)).data;
      else saved = (await API.post('/erp/customers', body)).data;
      closeModal(); toast('Customer saved', 'ok');
      customers = (await API.get('/erp/customers?limit=200')).items || [];
      if (fromWO) { woDraft.customer = saved._id; await loadVehiclesFor(saved._id); renderWOHead(); }
      else if (screen === 'customers') custFilter();
    } catch (e) { toast(e.message, 'err'); }
  }
  async function custVehicles(id) {
    const c = customers.find(x => x._id === id);
    let vehicles = [];
    try { vehicles = (await API.get('/erp/vehicles?customer=' + id)).items || []; } catch {}
    modal(`${mh('🚗 ' + esc(c?.name || '') + ' — vehicles')}
      <div class="modal-b">
        ${vehicles.length ? `<table class="grid"><thead><tr><th>Vehicle</th><th>Plate</th><th>VIN</th></tr></thead>
        <tbody>${vehicles.map(v => `<tr><td class="b">${esc([v.year, v.make, v.model].filter(Boolean).join(' '))}</td>
          <td>${esc(v.plate || '—')}</td><td>${esc(v.vin || '—')}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No vehicles yet</div>'}
      </div>
      <div class="modal-f"><button class="btn btn-green" onclick="App.closeModal();App.vehModal('${id}')">＋ Add vehicle</button>
      <button class="btn" onclick="App.closeModal()">Close</button></div>`);
  }
  function vehModal(custId) {
    const cid = custId || woDraft.customer;
    if (!cid) { toast('Select a customer first', 'err'); return; }
    modal(`${mh('New vehicle')}
      <div class="modal-b frm">
        <div class="row">
          <div><label>Year</label><input id="vm-year" type="number" style="width:90px" placeholder="2019"></div>
          <div class="grow"><label>Make *</label><input id="vm-make" placeholder="Ford"></div>
          <div class="grow"><label>Model *</label><input id="vm-model" placeholder="F-150"></div>
        </div>
        <div class="row">
          <div class="grow"><label>Plate</label><input id="vm-plate"></div>
          <div class="grow"><label>VIN</label><input id="vm-vin"></div>
        </div>
      </div>
      <div class="modal-f"><button class="btn" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-green" onclick="App.vehSave('${cid}')">💾 Save</button></div>`);
    setTimeout(() => $('#vm-make').focus(), 50);
  }
  async function vehSave(cid) {
    try {
      const r = await API.post('/erp/vehicles', {
        customer: cid, year: parseInt($('#vm-year').value) || undefined,
        make: $('#vm-make').value.trim(), model: $('#vm-model').value.trim(),
        plate: $('#vm-plate').value.trim(), vin: $('#vm-vin').value.trim(),
      });
      closeModal(); toast('Vehicle added', 'ok');
      if (woDraft.customer === cid) { await loadVehiclesFor(cid); woDraft.vehicle = r.data._id; renderWOHead(); }
    } catch (e) { toast(e.message, 'err'); }
  }

  /* ═══════════ PARTS ═══════════ */
  async function rParts() {
    $('#screen').innerHTML = `
      <div class="toolbar">
        <input id="pt-q" placeholder="Search part / SKU…" style="width:240px" oninput="App.partsFilter()">
        <button class="btn btn-green" onclick="App.partModal()">＋ New Part</button>
      </div>
      <div class="panel"><div class="panel-b" id="pt-table" style="max-height:calc(100vh - 190px)"></div></div>`;
    partsFilter();
  }
  function partsFilter() {
    const q = ($('#pt-q')?.value || '').toLowerCase();
    const list = parts.filter(p => !q || (p.name + ' ' + (p.partNumber || '')).toLowerCase().includes(q));
    $('#pt-table').innerHTML = list.length ? `<table class="grid">
      <thead><tr><th>Part</th><th>SKU</th><th>Category</th><th class="num">Cost</th><th class="num">Sell</th><th class="num">Stock</th><th style="width:150px"></th></tr></thead>
      <tbody>${list.map(p => `<tr>
        <td class="b">${esc(p.name)}</td><td>${esc(p.partNumber || '—')}</td><td>${esc(p.category || '—')}</td>
        <td class="num">${$m(p.costPrice)}</td><td class="num b">${$m(p.sellPrice)}</td>
        <td class="num ${p.quantityInStock <= (p.reorderLevel || 0) ? 'b' : ''}" style="${p.quantityInStock <= (p.reorderLevel || 0) ? 'color:var(--red)' : ''}">${p.quantityInStock}</td>
        <td><button class="btn btn-xs" onclick="App.partModal('${p._id}')">✏️</button>
        <button class="btn btn-xs btn-steel" onclick="App.partAdjust('${p._id}')">± Stock</button></td></tr>`).join('')}</tbody></table>`
      : '<div class="empty">No parts</div>';
  }
  function partModal(id) {
    const p = id ? parts.find(x => x._id === id) : null;
    modal(`${mh(p ? 'Edit part' : 'New part')}
      <div class="modal-b frm">
        <div class="row"><div class="grow"><label>Name *</label><input id="pm-name" value="${esc(p?.name || '')}"></div>
        <div><label>SKU / Part #</label><input id="pm-sku" value="${esc(p?.partNumber || '')}" style="width:150px"></div></div>
        <div class="row"><div class="grow"><label>Category</label><input id="pm-cat" value="${esc(p?.category || '')}" placeholder="Brakes"></div>
        <div class="grow"><label>Brand</label><input id="pm-brand" value="${esc(p?.brand || '')}"></div></div>
        <div class="row">
          <div><label>Cost $</label><input id="pm-cost" type="number" value="${p?.costPrice ?? 0}" style="width:100px"></div>
          <div><label>Sell $</label><input id="pm-sell" type="number" value="${p?.sellPrice ?? 0}" style="width:100px"></div>
          <div><label>Stock</label><input id="pm-stock" type="number" value="${p?.quantityInStock ?? 0}" style="width:90px" ${p ? 'disabled title="Use ± Stock"' : ''}></div>
          <div><label>Reorder at</label><input id="pm-reorder" type="number" value="${p?.reorderLevel ?? 2}" style="width:90px"></div>
        </div>
      </div>
      <div class="modal-f"><button class="btn" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-green" onclick="App.partSave('${id || ''}')">💾 Save</button></div>`);
  }
  async function partSave(id) {
    const body = {
      name: $('#pm-name').value.trim(), partNumber: $('#pm-sku').value.trim(),
      category: $('#pm-cat').value.trim(), brand: $('#pm-brand').value.trim(),
      costPrice: parseFloat($('#pm-cost').value) || 0, sellPrice: parseFloat($('#pm-sell').value) || 0,
      reorderLevel: parseInt($('#pm-reorder').value) || 0,
    };
    if (!id) body.quantityInStock = parseInt($('#pm-stock').value) || 0;
    if (!body.name) { toast('Name required', 'err'); return; }
    try {
      if (id) await API.put('/erp/parts/' + id, body); else await API.post('/erp/parts', body);
      closeModal(); toast('Part saved', 'ok');
      parts = (await API.get('/erp/parts?limit=200')).items || [];
      if (screen === 'parts') partsFilter();
    } catch (e) { toast(e.message, 'err'); }
  }
  function partAdjust(id) {
    const p = parts.find(x => x._id === id);
    modal(`${mh('± Stock — ' + esc(p.name))}
      <div class="modal-b frm">
        <p class="mut">Current stock: <b>${p.quantityInStock}</b></p>
        <div class="row">
          <div><label>Change (+ receive / − remove)</label><input id="pa-delta" type="number" value="1" style="width:120px"></div>
          <div class="grow"><label>Reason</label><input id="pa-reason" placeholder="Received PO / damaged / correction"></div>
        </div>
      </div>
      <div class="modal-f"><button class="btn" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-green" onclick="App.partAdjustSave('${id}')">Apply</button></div>`);
  }
  async function partAdjustSave(id) {
    try {
      await API.patch(`/erp/parts/${id}/adjust`, { delta: parseFloat($('#pa-delta').value) || 0, reason: $('#pa-reason').value });
      closeModal(); toast('Stock adjusted', 'ok');
      parts = (await API.get('/erp/parts?limit=200')).items || [];
      partsFilter();
    } catch (e) { toast(e.message, 'err'); }
  }

  /* ═══════════ INVOICES + PAYMENTS ═══════════ */
  async function rInvoices() {
    $('#screen').innerHTML = `
      <div class="toolbar">
        <select id="inv-st" onchange="App.rInvoicesLoad()">
          <option value="">All statuses</option>
          ${['draft','sent','partial','paid','overdue','void'].map(s => `<option>${s}</option>`).join('')}
        </select>
        <label style="font-size:12px"><input type="checkbox" id="inv-over" onchange="App.rInvoicesLoad()"> Overdue only</label>
      </div>
      <div class="panel"><div class="panel-b" id="inv-table" style="max-height:calc(100vh - 190px)"><div class="empty">Loading…</div></div></div>`;
    rInvoicesLoad();
  }
  async function rInvoicesLoad() {
    try {
      const st = $('#inv-st').value, over = $('#inv-over').checked;
      const r = await API.get(`/erp/invoices?limit=100${st ? '&status=' + st : ''}${over ? '&overdue=true' : ''}`);
      const items = r.items || [];
      $('#inv-table').innerHTML = items.length ? `<table class="grid">
        <thead><tr><th>Invoice</th><th>Customer</th><th>Vehicle</th><th class="num">Total</th><th class="num">Due</th><th>Status</th><th>Date</th><th></th></tr></thead>
        <tbody>${items.map(i => `<tr>
          <td class="b">${esc(i.invoiceNumber)}</td><td>${esc(i.customer?.name || '—')}</td>
          <td>${esc([i.vehicle?.year, i.vehicle?.make, i.vehicle?.model].filter(Boolean).join(' ') || '—')}</td>
          <td class="num b">${$m(i.total)}</td><td class="num" style="${i.amountDue > 0 ? 'color:var(--red);font-weight:700' : ''}">${$m(i.amountDue)}</td>
          <td>${stBadge(i.status)}</td><td>${dt(i.createdAt)}</td>
          <td><button class="btn btn-xs btn-steel" onclick="App.invOpen('${i._id}')">Open</button></td></tr>`).join('')}</tbody></table>`
        : '<div class="empty">No invoices</div>';
    } catch (e) { $('#inv-table').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }
  async function invOpen(id) {
    try {
      const inv = (await API.get('/erp/invoices/' + id)).data;
      const canPay = inv.amountDue > 0 && inv.status !== 'void';
      modal(`${mh('🧾 ' + esc(inv.invoiceNumber) + ' — ' + esc(inv.customer?.name || ''))}
        <div class="modal-b">
          <table class="grid"><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Total</th></tr></thead>
          <tbody>${(inv.lineItems || []).map(l => `<tr><td>${esc(l.description)}</td><td class="num">${l.quantity}</td><td class="num">${$m(l.lineTotal)}</td></tr>`).join('')}</tbody></table>
          <div style="margin-top:10px;display:grid;gap:2px;font-size:13px;max-width:280px;margin-left:auto">
            <div style="display:flex;justify-content:space-between"><span>Subtotal</span><b>${$m(inv.subtotal)}</b></div>
            ${inv.discount ? `<div style="display:flex;justify-content:space-between"><span>Discount</span><b>−${$m(inv.discount)}</b></div>` : ''}
            ${inv.shopSuppliesFee ? `<div style="display:flex;justify-content:space-between"><span>Shop supplies</span><b>${$m(inv.shopSuppliesFee)}</b></div>` : ''}
            <div style="display:flex;justify-content:space-between"><span>Tax (${inv.taxRate}%)</span><b>${$m(inv.taxAmount)}</b></div>
            <div style="display:flex;justify-content:space-between;font-size:15px"><span class="b">TOTAL</span><b>${$m(inv.total)}</b></div>
            <div style="display:flex;justify-content:space-between;color:var(--green)"><span>Paid</span><b>${$m(inv.amountPaid)}</b></div>
            <div style="display:flex;justify-content:space-between;color:${inv.amountDue > 0 ? 'var(--red)' : 'var(--green)'}"><span class="b">DUE</span><b>${$m(inv.amountDue)}</b></div>
          </div>
          ${canPay ? `
          <div style="margin-top:12px;background:#f1f7ed;border:1px solid #cfe3c2;border-radius:4px;padding:10px">
            <b style="font-size:12.5px">💵 Record payment</b>
            <div class="row" style="margin-top:6px">
              <div><label>Amount</label><input id="pay-amt" type="number" value="${inv.amountDue}" style="width:110px"></div>
              <div><label>Method</label><select id="pay-method" style="width:120px">
                <option>cash</option><option>card</option><option>upi</option><option>bank_transfer</option><option>cheque</option><option>online</option>
              </select></div>
              <div class="grow"><label>Reference</label><input id="pay-ref" placeholder="txn / cheque #"></div>
              <button class="btn btn-green btn-sm" onclick="App.invPay('${inv._id}')">✔ Receive</button>
            </div>
          </div>` : ''}
        </div>
        <div class="modal-f">
          <button class="btn btn-sm btn-steel" onclick="App.invPrint('${inv._id}')">🖨️ Print</button>
          ${inv.status !== 'void' ? `<button class="btn btn-sm" onclick="App.invSend('${inv._id}')">📧 Email to customer</button>` : ''}
          <button class="btn" onclick="App.closeModal()">Close</button>
        </div>`);
    } catch (e) { toast(e.message, 'err'); }
  }
  async function invPay(id) {
    try {
      await API.post(`/erp/invoices/${id}/payments`, {
        amount: parseFloat($('#pay-amt').value) || 0,
        method: $('#pay-method').value, reference: $('#pay-ref').value,
      });
      toast('Payment recorded ✔', 'ok'); closeModal(); rInvoicesLoad();
    } catch (e) { toast(e.message, 'err'); }
  }
  async function invSend(id) {
    try { const r = await API.post(`/erp/invoices/${id}/send`); toast(r.email?.success ? 'Invoice emailed ✔' : (r.email?.reason || 'Marked sent'), 'ok'); }
    catch (e) { toast(e.message, 'err'); }
  }
  async function rPayments() {
    $('#screen').innerHTML = `<div class="panel"><div class="panel-b" id="pay-table" style="max-height:calc(100vh - 150px)"><div class="empty">Loading…</div></div></div>`;
    try {
      const r = await API.get('/erp/payments?limit=100');
      const items = r.items || [];
      $('#pay-table').innerHTML = items.length ? `<table class="grid">
        <thead><tr><th>Date</th><th>Invoice</th><th>Customer</th><th>Method</th><th>Ref</th><th class="num">Amount</th></tr></thead>
        <tbody>${items.map(p => `<tr><td>${dtt(p.createdAt)}</td><td class="b">${esc(p.invoice?.invoiceNumber || '—')}</td>
          <td>${esc(p.customer?.name || p.invoice?.customer?.name || '—')}</td><td>${esc(p.method)}</td><td>${esc(p.reference || '—')}</td>
          <td class="num b" style="color:var(--green)">${$m(p.amount)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No payments yet</div>';
    } catch (e) { $('#pay-table').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }

  /* ═══════════ APPOINTMENTS ═══════════ */
  async function rAppointments() {
    $('#screen').innerHTML = `
      <div class="toolbar"><button class="btn btn-green" onclick="App.apptModal()">＋ New Appointment</button></div>
      <div class="panel"><div class="panel-b" id="ap-table" style="max-height:calc(100vh - 190px)"><div class="empty">Loading…</div></div></div>`;
    try {
      const r = await API.get('/erp/appointments?limit=100');
      const items = r.items || [];
      $('#ap-table').innerHTML = items.length ? `<table class="grid">
        <thead><tr><th>#</th><th>Customer</th><th>Vehicle</th><th>Requested</th><th>When</th><th>Status</th><th style="width:160px"></th></tr></thead>
        <tbody>${items.map(a => `<tr>
          <td class="b">${esc(a.apptNumber || '')}</td>
          <td>${esc(a.customer?.name || a.leadName || '—')}<div class="mut" style="font-size:11px">${esc(a.customer?.phone || a.leadPhone || '')}</div></td>
          <td>${esc([a.vehicle?.year, a.vehicle?.make, a.vehicle?.model].filter(Boolean).join(' ') || a.vehicleText || '—')}</td>
          <td>${esc((a.serviceRequested || []).join(', ') || '—')}</td>
          <td>${dt(a.preferredDate)} ${esc(a.timeSlot || '')}</td>
          <td>${stBadge(a.status)}</td>
          <td>
            ${a.status === 'requested' ? `<button class="btn btn-xs btn-steel" onclick="App.apptStatus('${a._id}','confirmed')">✔ Confirm</button>` : ''}
            ${['requested','confirmed'].includes(a.status) && a.customer ? `<button class="btn btn-xs btn-green" onclick="App.apptStart('${a._id}')">▶ Start Work</button>` : ''}
            ${['requested','confirmed'].includes(a.status) ? `<button class="btn btn-xs btn-red" onclick="App.apptStatus('${a._id}','cancelled')">✕</button>` : ''}
          </td></tr>`).join('')}</tbody></table>` : '<div class="empty">No appointments</div>';
    } catch (e) { $('#ap-table').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }
  async function apptStatus(id, status) {
    try { await API.patch('/erp/appointments/' + id, { status }); toast('Updated', 'ok'); rAppointments(); }
    catch (e) { toast(e.message, 'err'); }
  }
  async function apptStart(id) {
    try {
      const r = await API.post(`/erp/appointments/${id}/start-work`);
      toast('Work order created from appointment ✔', 'ok');
      go('workorders'); if (r.data?._id) openWO(r.data._id);
    } catch (e) { toast(e.message, 'err'); }
  }
  function apptModal() {
    modal(`${mh('New appointment')}
      <div class="modal-b frm">
        <div><label>Customer</label><select id="am-cust">${customers.map(c => `<option value="${c._id}">${esc(c.name)}</option>`).join('')}</select></div>
        <div class="row">
          <div class="grow"><label>Date</label><input id="am-date" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
          <div class="grow"><label>Time slot</label><input id="am-slot" placeholder="10:00-11:00"></div>
        </div>
        <div><label>Service requested</label><input id="am-svc" placeholder="Oil change, brake check"></div>
      </div>
      <div class="modal-f"><button class="btn" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-green" onclick="App.apptSave()">💾 Save</button></div>`);
  }
  async function apptSave() {
    try {
      await API.post('/erp/appointments', {
        customer: $('#am-cust').value, preferredDate: $('#am-date').value,
        timeSlot: $('#am-slot').value, serviceRequested: $('#am-svc').value.split(',').map(s => s.trim()).filter(Boolean),
        status: 'confirmed',
      });
      closeModal(); toast('Appointment saved', 'ok'); rAppointments();
    } catch (e) { toast(e.message, 'err'); }
  }

  /* ═══════════ SERVICES ═══════════ */
  async function rServices() {
    $('#screen').innerHTML = `
      <div class="toolbar"><button class="btn btn-green" onclick="App.svcModal()">＋ New Service</button>
      <span class="mut" style="font-size:12px">Standard jobs — one click adds them to a work order with book hours & rate.</span></div>
      <div class="panel"><div class="panel-b" id="sv-table" style="max-height:calc(100vh - 190px)"></div></div>`;
    svcTable();
  }
  function svcTable() {
    $('#sv-table').innerHTML = services.length ? `<table class="grid">
      <thead><tr><th>Service</th><th>Category</th><th class="num">Hours</th><th class="num">Rate</th><th class="num">Flat price</th><th>Active</th><th></th></tr></thead>
      <tbody>${services.map(s => `<tr>
        <td class="b">${esc(s.name)}</td><td>${esc(s.category || '—')}</td>
        <td class="num">${s.laborHours || 0}</td><td class="num">${s.laborRate ? $m(s.laborRate) : '<span class="mut">default</span>'}</td>
        <td class="num">${s.flatPrice != null ? $m(s.flatPrice) : '—'}</td>
        <td>${s.isActive !== false ? '✓' : '—'}</td>
        <td><button class="btn btn-xs" onclick="App.svcModal('${s._id}')">✏️</button></td></tr>`).join('')}</tbody></table>`
      : '<div class="empty">No services yet — add your standard jobs</div>';
  }
  function svcModal(id) {
    const s = id ? services.find(x => x._id === id) : null;
    modal(`${mh(s ? 'Edit service' : 'New service')}
      <div class="modal-b frm">
        <div class="row"><div class="grow"><label>Name *</label><input id="sm-name" value="${esc(s?.name || '')}" placeholder="Front brake pad replacement"></div>
        <div><label>Category</label><input id="sm-cat" value="${esc(s?.category || '')}" placeholder="Brakes" style="width:140px"></div></div>
        <div class="row">
          <div><label>Book hours</label><input id="sm-hours" type="number" step="0.25" value="${s?.laborHours ?? 1}" style="width:100px"></div>
          <div><label>Rate $/hr (0=default)</label><input id="sm-rate" type="number" value="${s?.laborRate ?? 0}" style="width:120px"></div>
          <div><label>Flat price (optional)</label><input id="sm-flat" type="number" value="${s?.flatPrice ?? ''}" style="width:120px"></div>
          <div><label>Active</label><select id="sm-active" style="width:80px"><option value="1" ${s?.isActive !== false ? 'selected' : ''}>Yes</option><option value="" ${s?.isActive === false ? 'selected' : ''}>No</option></select></div>
        </div>
      </div>
      <div class="modal-f"><button class="btn" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-green" onclick="App.svcSave('${id || ''}')">💾 Save</button></div>`);
  }
  async function svcSave(id) {
    const body = {
      name: $('#sm-name').value.trim(), category: $('#sm-cat').value.trim(),
      laborHours: parseFloat($('#sm-hours').value) || 0, laborRate: parseFloat($('#sm-rate').value) || 0,
      flatPrice: $('#sm-flat').value === '' ? null : parseFloat($('#sm-flat').value),
      isActive: !!$('#sm-active').value,
    };
    if (!body.name) { toast('Name required', 'err'); return; }
    try {
      if (id) await API.put('/erp/services/' + id, body); else await API.post('/erp/services', body);
      closeModal(); toast('Service saved', 'ok');
      const r = await API.get('/erp/services'); services = r.items || r.data || [];
      if (screen === 'services') svcTable();
    } catch (e) { toast(e.message, 'err'); }
  }

  /* ═══════════ SETTINGS ═══════════ */
  async function rSettings() {
    const s = settings;
    $('#screen').innerHTML = `
      <div class="panel" style="max-width:640px">
        <div class="panel-h">SHOP SETTINGS</div>
        <div style="padding:14px" class="frm">
          <div class="row">
            <div class="grow"><label>Shop name</label><input id="st-name" value="${esc(s.shopName || '')}"></div>
            <div class="grow"><label>Phone</label><input id="st-phone" value="${esc(s.phone || '')}"></div>
          </div>
          <div class="row">
            <div><label>Sales tax %</label><input id="st-tax" type="number" step="0.01" value="${s.taxRate ?? 8.25}" style="width:110px"></div>
            <div><label>Tax labor?</label><select id="st-taxlabor" style="width:90px"><option value="" ${!s.taxLabor ? 'selected' : ''}>No</option><option value="1" ${s.taxLabor ? 'selected' : ''}>Yes</option></select></div>
            <div><label>Labor rate $/hr</label><input id="st-rate" type="number" value="${s.defaultLaborRate ?? 120}" style="width:110px"></div>
          </div>
          <div class="row">
            <div><label>Shop supplies % of labor</label><input id="st-sup" type="number" value="${s.shopSuppliesFeePercent ?? 5}" style="width:110px"></div>
            <div><label>Supplies cap $</label><input id="st-supcap" type="number" value="${s.shopSuppliesFeeCap ?? 50}" style="width:110px"></div>
          </div>
          <div><button class="btn btn-green" onclick="App.settingsSave()">💾 Save settings</button></div>
        </div>
      </div>`;
  }
  async function settingsSave() {
    try {
      const r = await API.put('/erp/settings', {
        shopName: $('#st-name').value, phone: $('#st-phone').value,
        taxRate: parseFloat($('#st-tax').value) || 0, taxLabor: !!$('#st-taxlabor').value,
        defaultLaborRate: parseFloat($('#st-rate').value) || 0,
        shopSuppliesFeePercent: parseFloat($('#st-sup').value) || 0,
        shopSuppliesFeeCap: parseFloat($('#st-supcap').value) || 0,
      });
      settings = r.data || settings; $('#tb-shop').textContent = settings.shopName || 'Road Hustlers';
      toast('Settings saved', 'ok');
    } catch (e) { toast(e.message, 'err'); }
  }

  /* ═══════════ REPORTS ═══════════ */
  let repTab = 'revenue';
  function monthStart() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }
  async function rReports() {
    $('#screen').innerHTML = `
      <div class="toolbar">
        ${[['revenue','💵 Revenue'],['inventory','📦 Inventory'],['technicians','👷 Technicians'],['salestax','🏛️ Sales Tax'],['customers','⭐ Top Customers']]
          .map(([k, l]) => `<button class="btn btn-sm ${repTab === k ? 'btn-steel' : ''}" onclick="App.repGo('${k}')">${l}</button>`).join('')}
        <span style="margin-left:auto;display:flex;gap:6px;align-items:center;font-size:12px">
          From <input id="rep-from" type="date" value="${monthStart()}">
          To <input id="rep-to" type="date" value="${new Date().toISOString().slice(0, 10)}">
          <button class="btn btn-sm btn-green" onclick="App.repGo()">Run</button>
        </span>
      </div>
      <div id="rep-body"><div class="empty">Loading…</div></div>`;
    repLoad();
  }
  function repGo(tab) { if (tab) repTab = tab; repLoad(); }
  async function repLoad() {
    const box = $('#rep-body'); box.innerHTML = '<div class="empty">Loading…</div>';
    const range = `?from=${$('#rep-from').value}&to=${$('#rep-to').value}`;
    try {
      if (repTab === 'revenue') {
        const d = (await API.get('/erp/reports/revenue' + range + '&groupBy=day')).data;
        const max = Math.max(1, ...d.series.map(s => s.total));
        box.innerHTML = `
          <div class="stats"><div class="stat"><div class="sl">Total received</div><div class="sv">${$m(d.total)}</div></div>
          <div class="stat"><div class="sl">Payments</div><div class="sv">${d.series.reduce((s, x) => s + x.count, 0)}</div></div></div>
          <div class="panel"><div class="panel-h">DAILY REVENUE</div><div class="panel-b" style="max-height:calc(100vh - 300px)">
          ${d.series.length ? `<table class="grid"><thead><tr><th>Date</th><th class="num">Payments</th><th class="num">Amount</th><th style="width:40%"></th></tr></thead>
            <tbody>${d.series.map(s => `<tr><td>${s._id}</td><td class="num">${s.count}</td><td class="num b">${$m(s.total)}</td>
              <td><div style="background:var(--steel);height:12px;border-radius:2px;width:${Math.round((s.total / max) * 100)}%"></div></td></tr>`).join('')}</tbody></table>`
            : '<div class="empty">No payments in range</div>'}</div></div>`;
      } else if (repTab === 'inventory') {
        const d = (await API.get('/erp/reports/inventory')).data;
        box.innerHTML = `
          <div class="stats">
            <div class="stat"><div class="sl">Stock @ cost</div><div class="sv">${$m(d.costValue)}</div></div>
            <div class="stat"><div class="sl">Stock @ retail</div><div class="sv">${$m(d.retailValue)}</div></div>
            <div class="stat"><div class="sl">Distinct parts</div><div class="sv">${d.distinctItems}</div></div>
            <div class="stat"><div class="sl">Total units</div><div class="sv">${d.totalUnits}</div></div>
          </div>
          <div class="panel"><div class="panel-h">LOW STOCK (${d.lowStock.length})</div><div class="panel-b" style="max-height:calc(100vh - 320px)">
          ${d.lowStock.length ? `<table class="grid"><thead><tr><th>Part</th><th>SKU</th><th class="num">Stock</th><th class="num">Reorder at</th></tr></thead>
            <tbody>${d.lowStock.map(p => `<tr><td>${esc(p.name)}</td><td>${esc(p.partNumber || '—')}</td>
            <td class="num b" style="color:var(--red)">${p.quantityInStock}</td><td class="num">${p.reorderLevel}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Nothing low ✓</div>'}</div></div>`;
      } else if (repTab === 'technicians') {
        const d = (await API.get('/erp/reports/technicians' + range)).data;
        box.innerHTML = `<div class="panel"><div class="panel-h">TECHNICIAN PRODUCTIVITY</div><div class="panel-b">
          ${d.technicians?.length ? `<table class="grid"><thead><tr><th>Technician</th><th class="num">Orders</th><th class="num">Hours clocked</th><th class="num">Labor billed</th></tr></thead>
          <tbody>${d.technicians.map(t => `<tr><td class="b">${esc(t.name || '—')}</td><td class="num">${t.orders ?? t.workOrders ?? 0}</td>
            <td class="num">${(t.hours ?? t.hoursClocked ?? 0).toFixed ? (t.hours ?? 0).toFixed(1) : t.hours || 0}</td>
            <td class="num b">${$m(t.laborBilled ?? t.labor ?? 0)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No data in range</div>'}</div></div>`;
      } else if (repTab === 'salestax') {
        const d = (await API.get('/erp/reports/sales-tax' + range)).data;
        box.innerHTML = `<div class="stats">
          <div class="stat"><div class="sl">Tax collected</div><div class="sv">${$m(d.taxCollected)}</div></div>
          <div class="stat"><div class="sl">Taxable sales</div><div class="sv">${$m(d.taxableSales)}</div></div>
          <div class="stat"><div class="sl">Invoices</div><div class="sv">${d.invoices}</div></div></div>
          <p class="mut" style="font-size:12px">Use this for your sales-tax filing for the selected period.</p>`;
      } else {
        const d = (await API.get('/erp/reports/customers')).data;
        box.innerHTML = `<div class="panel"><div class="panel-h">TOP SPENDERS</div><div class="panel-b">
          ${d.topSpenders?.length ? `<table class="grid"><thead><tr><th>#</th><th>Customer</th><th class="num">Invoices</th><th class="num">Total spent</th></tr></thead>
          <tbody>${d.topSpenders.map((c, i) => `<tr><td>${i + 1}</td><td class="b">${esc(c.name || c.customer?.name || '—')}</td>
            <td class="num">${c.invoices ?? c.count ?? 0}</td><td class="num b">${$m(c.total ?? c.totalSpent ?? 0)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No data</div>'}</div></div>`;
      }
    } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }

  /* ═══════════ LEADS ═══════════ */
  async function rLeads() {
    $('#screen').innerHTML = `
      <div class="toolbar">
        <select id="ld-st" onchange="App.leadsLoad()">
          <option value="">All statuses</option>
          ${['new','contacted','quoted','converted','lost'].map(s => `<option>${s}</option>`).join('')}
        </select>
        <button class="btn btn-green" onclick="App.leadModal()">＋ New Lead</button>
      </div>
      <div class="panel"><div class="panel-b" id="ld-table" style="max-height:calc(100vh - 190px)"><div class="empty">Loading…</div></div></div>`;
    leadsLoad();
  }
  async function leadsLoad() {
    try {
      const st = $('#ld-st').value;
      const r = await API.get('/erp/leads?limit=100' + (st ? '&status=' + st : ''));
      const items = r.items || [];
      $('#ld-table').innerHTML = items.length ? `<table class="grid">
        <thead><tr><th>#</th><th>Name</th><th>Contact</th><th>Vehicle</th><th>Service</th><th>Source</th><th>Status</th><th style="width:220px"></th></tr></thead>
        <tbody>${items.map(l => `<tr>
          <td class="b">${esc(l.leadNumber || '')}</td><td class="b">${esc(l.name)}</td>
          <td>${esc(l.phone || '')}<div class="mut" style="font-size:11px">${esc(l.email || '')}</div></td>
          <td>${esc(l.vehicle || '—')}</td><td>${esc(l.service || '—')}</td><td>${esc(l.source || '—')}</td>
          <td>${stBadge(l.status)}</td>
          <td>${l.status !== 'converted' ? `
            <select class="btn-xs" onchange="App.leadStatus('${l._id}', this.value)" style="padding:2px">
              <option value="">— set status —</option>
              ${['contacted','quoted','lost'].map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
            <button class="btn btn-xs btn-green" onclick="App.leadConvert('${l._id}')">→ Customer</button>` : '✓ converted'}</td>
        </tr>`).join('')}</tbody></table>` : '<div class="empty">No leads</div>';
    } catch (e) { $('#ld-table').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }
  async function leadStatus(id, status) {
    if (!status) return;
    try { await API.patch('/erp/leads/' + id, { status }); toast('Updated', 'ok'); leadsLoad(); }
    catch (e) { toast(e.message, 'err'); }
  }
  async function leadConvert(id) {
    if (!confirm('Convert this lead into a customer?')) return;
    try {
      await API.post(`/erp/leads/${id}/convert`);
      toast('Converted → customer created ✓', 'ok');
      customers = (await API.get('/erp/customers?limit=200')).items || [];
      leadsLoad();
    } catch (e) { toast(e.message, 'err'); }
  }
  function leadModal() {
    modal(`${mh('New lead')}
      <div class="modal-b frm">
        <div class="row"><div class="grow"><label>Name *</label><input id="lm-name"></div>
        <div><label>Phone</label><input id="lm-phone" style="width:140px"></div></div>
        <div class="row"><div class="grow"><label>Vehicle</label><input id="lm-veh" placeholder="2018 Toyota Camry"></div>
        <div class="grow"><label>Service</label><input id="lm-svc" placeholder="Brake inspection"></div></div>
        <div><label>Source</label><select id="lm-src">${['phone','walk-in','website','google_ads','facebook','referral','other'].map(s => `<option>${s}</option>`).join('')}</select></div>
      </div>
      <div class="modal-f"><button class="btn" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-green" onclick="App.leadSave()">💾 Save</button></div>`);
  }
  async function leadSave() {
    if (!$('#lm-name').value.trim()) { toast('Name required', 'err'); return; }
    try {
      await API.post('/erp/leads', {
        name: $('#lm-name').value.trim(), phone: $('#lm-phone').value.trim(),
        vehicle: $('#lm-veh').value.trim(), service: $('#lm-svc').value.trim(), source: $('#lm-src').value,
      });
      closeModal(); toast('Lead saved', 'ok'); leadsLoad();
    } catch (e) { toast(e.message, 'err'); }
  }

  /* ═══════════ PURCHASING (Suppliers + POs) ═══════════ */
  let suppliers = [];
  async function rPO() {
    $('#screen').innerHTML = `
      <div style="display:grid;grid-template-columns:320px 1fr;gap:10px;height:calc(100vh - 160px)">
        <div class="panel">
          <div class="panel-h">SUPPLIERS <span class="ph-right"><button class="btn btn-xs" onclick="App.supModal()">＋ Add</button></span></div>
          <div class="panel-b" id="sup-list"><div class="empty">Loading…</div></div>
        </div>
        <div class="panel">
          <div class="panel-h">PURCHASE ORDERS <span class="ph-right"><button class="btn btn-xs btn-green" onclick="App.poModal()">＋ New PO</button></span></div>
          <div class="panel-b" id="po-list"><div class="empty">Loading…</div></div>
        </div>
      </div>`;
    supLoad(); poLoad();
  }
  async function supLoad() {
    try {
      suppliers = (await API.get('/erp/suppliers')).items || [];
      $('#sup-list').innerHTML = suppliers.length ? suppliers.map(s => `
        <div class="pick-item" onclick="App.supModal('${s._id}')">
          <span><b>${esc(s.name)}</b><div class="pi-s">${esc(s.contactName || '')} ${esc(s.phone || '')}</div></span>
          <span class="mut">✏️</span></div>`).join('') : '<div class="empty">No suppliers</div>';
    } catch (e) { $('#sup-list').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }
  function supModal(id) {
    const s = id ? suppliers.find(x => x._id === id) : null;
    modal(`${mh(s ? 'Edit supplier' : 'New supplier')}
      <div class="modal-b frm">
        <div class="row"><div class="grow"><label>Name *</label><input id="sp-name" value="${esc(s?.name || '')}"></div>
        <div><label>Phone</label><input id="sp-phone" value="${esc(s?.phone || '')}" style="width:140px"></div></div>
        <div class="row"><div class="grow"><label>Contact person</label><input id="sp-contact" value="${esc(s?.contactName || '')}"></div>
        <div class="grow"><label>Email</label><input id="sp-email" value="${esc(s?.email || '')}"></div></div>
        <div><label>Account #</label><input id="sp-acct" value="${esc(s?.accountNumber || '')}"></div>
      </div>
      <div class="modal-f"><button class="btn" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-green" onclick="App.supSave('${id || ''}')">💾 Save</button></div>`);
  }
  async function supSave(id) {
    const body = { name: $('#sp-name').value.trim(), phone: $('#sp-phone').value.trim(), contactName: $('#sp-contact').value.trim(), email: $('#sp-email').value.trim(), accountNumber: $('#sp-acct').value.trim() };
    if (!body.name) { toast('Name required', 'err'); return; }
    try {
      if (id) await API.put('/erp/suppliers/' + id, body); else await API.post('/erp/suppliers', body);
      closeModal(); toast('Supplier saved', 'ok'); supLoad();
    } catch (e) { toast(e.message, 'err'); }
  }
  async function poLoad() {
    try {
      const r = await API.get('/erp/purchase-orders?limit=50');
      const items = r.items || [];
      $('#po-list').innerHTML = items.length ? `<table class="grid">
        <thead><tr><th>PO #</th><th>Supplier</th><th class="num">Items</th><th class="num">Total</th><th>Status</th><th>Date</th><th style="width:170px"></th></tr></thead>
        <tbody>${items.map(p => `<tr>
          <td class="b">${esc(p.poNumber)}</td><td>${esc(p.supplier?.name || '—')}</td>
          <td class="num">${(p.items || []).length}</td><td class="num b">${$m(p.total)}</td>
          <td>${stBadge(p.status)}</td><td>${dt(p.createdAt)}</td>
          <td>
            ${p.status === 'draft' ? `<button class="btn btn-xs btn-steel" onclick="App.poStatus('${p._id}','ordered')">📤 Mark Ordered</button>` : ''}
            ${['draft','ordered'].includes(p.status) ? `<button class="btn btn-xs btn-green" onclick="App.poReceive('${p._id}')">📥 Receive</button>` : ''}
          </td></tr>`).join('')}</tbody></table>` : '<div class="empty">No purchase orders</div>';
    } catch (e) { $('#po-list').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }
  async function poStatus(id, status) {
    try { await API.patch('/erp/purchase-orders/' + id, { status }); toast('Updated', 'ok'); poLoad(); }
    catch (e) { toast(e.message, 'err'); }
  }
  async function poReceive(id) {
    if (!confirm('Receive ALL items on this PO into stock?')) return;
    try { await API.post(`/erp/purchase-orders/${id}/receive`, {}); toast('Stock received ✓', 'ok'); poLoad(); parts = (await API.get('/erp/parts?limit=200')).items || []; }
    catch (e) { toast(e.message, 'err'); }
  }
  let poItems = [];
  function poModal() {
    if (!suppliers.length) { toast('Add a supplier first', 'err'); return; }
    poItems = [];
    modal(`${mh('New purchase order')}
      <div class="modal-b frm">
        <div><label>Supplier *</label><select id="po-sup">${suppliers.map(s => `<option value="${s._id}">${esc(s.name)}</option>`).join('')}</select></div>
        <div><label>Add part</label>
          <div class="row">
            <select id="po-part" class="grow">${parts.map(p => `<option value="${p._id}">${esc(p.name)} (stk ${p.quantityInStock})</option>`).join('')}</select>
            <input id="po-qty" type="number" value="5" style="width:70px" title="Qty">
            <input id="po-cost" type="number" placeholder="cost $" style="width:90px">
            <button class="btn btn-sm" onclick="App.poAddItem()">＋</button>
          </div>
        </div>
        <div id="po-items"></div>
        <div class="row">
          <div><label>Shipping $</label><input id="po-ship" type="number" value="0" style="width:100px"></div>
          <div><label>Tax $</label><input id="po-tax" type="number" value="0" style="width:100px"></div>
        </div>
      </div>
      <div class="modal-f"><button class="btn" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-green" onclick="App.poSave()">💾 Create PO</button></div>`);
  }
  function poAddItem() {
    const p = parts.find(x => x._id === $('#po-part').value); if (!p) return;
    poItems.push({ part: p._id, partName: p.name, quantity: parseInt($('#po-qty').value) || 1, costPrice: parseFloat($('#po-cost').value) || p.costPrice || 0 });
    poDrawItems();
  }
  function poDrawItems() {
    $('#po-items').innerHTML = poItems.length ? `<table class="grid"><thead><tr><th>Part</th><th class="num">Qty</th><th class="num">Cost</th><th class="num">Total</th><th></th></tr></thead>
      <tbody>${poItems.map((it, i) => `<tr><td>${esc(it.partName)}</td><td class="num">${it.quantity}</td><td class="num">${$m(it.costPrice)}</td>
      <td class="num b">${$m(it.quantity * it.costPrice)}</td><td><button class="btn btn-xs btn-red" onclick="App.poDelItem(${i})">✕</button></td></tr>`).join('')}</tbody></table>` : '<p class="mut" style="font-size:12px">No items yet</p>';
  }
  function poDelItem(i) { poItems.splice(i, 1); poDrawItems(); }
  async function poSave() {
    if (!poItems.length) { toast('Add at least one item', 'err'); return; }
    try {
      await API.post('/erp/purchase-orders', {
        supplier: $('#po-sup').value, items: poItems,
        shipping: parseFloat($('#po-ship').value) || 0, tax: parseFloat($('#po-tax').value) || 0,
      });
      closeModal(); toast('PO created', 'ok'); poLoad();
    } catch (e) { toast(e.message, 'err'); }
  }

  /* ═══════════ STAFF ═══════════ */
  async function rStaff() {
    $('#screen').innerHTML = `
      <div class="toolbar"><button class="btn btn-green" onclick="App.staffModal()">＋ New Staff</button></div>
      <div class="panel"><div class="panel-b" id="stf-table" style="max-height:calc(100vh - 190px)"></div></div>`;
    staffTable();
  }
  async function staffTable() {
    try { staff = (await API.get('/erp/staff')).items || []; } catch {}
    $('#stf-table').innerHTML = staff.length ? `<table class="grid">
      <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th class="num">Rate $/hr</th><th>Specialties</th><th>Active</th><th style="width:150px"></th></tr></thead>
      <tbody>${staff.map(s => `<tr>
        <td class="b">${esc(s.name)}</td><td>${esc(s.email)}</td><td>${esc(s.phone || '—')}</td>
        <td><span class="badge ${s.role === 'admin' ? 'st-invoiced' : s.role === 'manager' ? 'st-in_progress' : 'st-completed'}">${esc(s.role)}</span></td>
        <td class="num">${$m(s.hourlyRate)}</td><td>${esc((s.specialties || []).join(', ') || '—')}</td>
        <td>${s.isActive !== false ? '✓' : '—'}</td>
        <td><button class="btn btn-xs" onclick="App.staffModal('${s._id}')">✏️</button>
        <button class="btn btn-xs btn-steel" onclick="App.staffTimesheet('${s._id}')">🕒 Timesheet</button></td></tr>`).join('')}</tbody></table>`
      : '<div class="empty">No staff</div>';
  }
  function staffModal(id) {
    const s = id ? staff.find(x => x._id === id) : null;
    modal(`${mh(s ? 'Edit staff' : 'New staff')}
      <div class="modal-b frm">
        <div class="row"><div class="grow"><label>Name *</label><input id="stf-name" value="${esc(s?.name || '')}"></div>
        <div><label>Role</label><select id="stf-role" style="width:120px">${['staff','manager','admin'].map(r => `<option ${s?.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div></div>
        <div class="row"><div class="grow"><label>Email *</label><input id="stf-email" value="${esc(s?.email || '')}" ${s ? 'disabled' : ''}></div>
        <div><label>Phone</label><input id="stf-phone" value="${esc(s?.phone || '')}" style="width:140px"></div></div>
        ${s ? '' : `<div><label>Password * (login ke liye)</label><input id="stf-pass" type="password"></div>`}
        <div class="row">
          <div><label>Hourly rate $</label><input id="stf-rate" type="number" value="${s?.hourlyRate ?? 0}" style="width:110px"></div>
          <div class="grow"><label>Specialties (comma)</label><input id="stf-spec" value="${esc((s?.specialties || []).join(', '))}" placeholder="brakes, engine"></div>
          ${s ? `<div><label>Active</label><select id="stf-active" style="width:80px"><option value="1" ${s.isActive !== false ? 'selected' : ''}>Yes</option><option value="" ${s.isActive === false ? 'selected' : ''}>No</option></select></div>` : ''}
        </div>
      </div>
      <div class="modal-f"><button class="btn" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-green" onclick="App.staffSave('${id || ''}')">💾 Save</button></div>`);
  }
  async function staffSave(id) {
    const body = {
      name: $('#stf-name').value.trim(), phone: $('#stf-phone').value.trim(),
      role: $('#stf-role').value, hourlyRate: parseFloat($('#stf-rate').value) || 0,
      specialties: $('#stf-spec').value.split(',').map(s => s.trim()).filter(Boolean),
    };
    if (!body.name) { toast('Name required', 'err'); return; }
    try {
      if (id) { body.isActive = !!$('#stf-active').value; await API.put('/erp/staff/' + id, body); }
      else {
        body.email = $('#stf-email').value.trim(); body.password = $('#stf-pass').value;
        if (!body.email || !body.password) { toast('Email + password required', 'err'); return; }
        await API.post('/erp/staff', body);
      }
      closeModal(); toast('Staff saved', 'ok'); staffTable();
    } catch (e) { toast(e.message, 'err'); }
  }
  async function staffTimesheet(id) {
    const s = staff.find(x => x._id === id);
    try {
      const d = (await API.get(`/erp/staff/${id}/timesheet`)).data || {};
      const logs = d.logs || d.entries || d.timesheet || [];
      modal(`${mh('🕒 ' + esc(s?.name || '') + ' — timesheet')}
        <div class="modal-b">
          ${logs.length ? `<table class="grid"><thead><tr><th>Work order</th><th>In</th><th>Out</th><th class="num">Hours</th></tr></thead>
          <tbody>${logs.map(l => `<tr><td class="b">${esc(l.orderNumber || l.workOrder?.orderNumber || '—')}</td>
            <td>${dtt(l.clockIn || l.in)}</td><td>${l.clockOut || l.out ? dtt(l.clockOut || l.out) : '<span class="badge st-in_progress">on clock</span>'}</td>
            <td class="num b">${(l.hours ?? 0).toFixed ? (l.hours ?? 0).toFixed(2) : l.hours || '—'}</td></tr>`).join('')}</tbody></table>`
          : '<div class="empty">No time entries</div>'}
          ${d.totalHours != null ? `<p style="text-align:right;margin-top:8px"><b>Total: ${(+d.totalHours).toFixed(1)} hrs</b></p>` : ''}
        </div>
        <div class="modal-f"><button class="btn" onclick="App.closeModal()">Close</button></div>`);
    } catch (e) { toast(e.message, 'err'); }
  }

  /* Clocked time → labor line (final bill mein time ka hisaab) */
  async function woTimeToLabor(minutes) {
    const hrs = Math.round((minutes / 60) * 100) / 100;
    const rate = settings.defaultLaborRate || 100;
    if (!confirm(`Add labor line: ${hrs} hrs × ${$m(rate)}/hr = ${$m(hrs * rate)}?`)) return;
    try {
      const r = await API.post(`/erp/work-orders/${wo._id}/labor`, {
        description: `Labor — clocked time (${hrs} hrs)`, hours: hrs, rate, taxable: !!settings.taxLabor,
      });
      wo = r.data; renderWOLines(); renderWORight(); toast('Labor line added from clocked time ✓', 'ok');
    } catch (e) { toast(e.message, 'err'); }
  }

  /* Job card / bill print — customer signature ke saath */
  function woPrint() {
    if (!wo) return;
    const s = settings;
    const veh = [wo.vehicle?.year, wo.vehicle?.make, wo.vehicle?.model].filter(Boolean).join(' ');
    const rows = [
      ...(wo.laborItems || []).map(l => ({ d: l.description, q: l.hours ? l.hours + ' hr' : '1', u: l.hours ? l.rate : l.lineTotal, t: l.lineTotal })),
      ...(wo.partItems || []).map(p => ({ d: p.description, q: p.quantity, u: p.sellPrice, t: p.lineTotal })),
    ];
    const w = window.open('', '_blank', 'width=800,height=900');
    w.document.write(`<!DOCTYPE html><html><head><title>${esc(wo.orderNumber)}</title><style>
      body{font:13px/1.45 Segoe UI,Arial,sans-serif;color:#111;margin:34px}
      h1{font-size:20px;margin:0} .mut{color:#666} .r{text-align:right}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th{background:#14337d;color:#fff;text-align:left;padding:6px 9px;font-size:12px}
      td{padding:6px 9px;border-bottom:1px solid #ddd}
      .hdr{display:flex;justify-content:space-between;border-bottom:3px solid #14337d;padding-bottom:10px}
      .sig{margin-top:44px;display:flex;justify-content:space-between;gap:40px}
      .sig div{flex:1;border-top:1px solid #333;padding-top:5px;text-align:center;font-size:12px;color:#555}
      @media print{.noprint{display:none}}
    </style></head><body>
      <div class="hdr">
        <div><h1>${esc(s.shopName || 'Road Hustlers')}</h1><div class="mut">${esc(s.phone || '')} · ${esc(s.email || '')}</div></div>
        <div class="r"><h1 style="color:#14337d">WORK ORDER</h1><b>${esc(wo.orderNumber)}</b>
          <div class="mut">${new Date(wo.createdAt).toLocaleString()}</div>
          <div class="mut">Status: ${esc(wo.status.replace('_',' '))} · Priority: ${esc(wo.priority)}</div></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:12px">
        <div><b>Customer</b><br>${esc(wo.customer?.name || '')}<br><span class="mut">${esc(wo.customer?.phone || '')}</span></div>
        <div class="r"><b>Vehicle</b><br>${esc(veh)}<br><span class="mut">${esc(wo.vehicle?.plate || '')} ${wo.mileageIn ? '· ' + wo.mileageIn + ' in' : ''}</span></div>
        <div class="r"><b>Technician</b><br>${esc(wo.assignedTechs?.[0]?.name || 'Unassigned')}</div>
      </div>
      ${wo.complaint ? `<div style="margin-top:12px;background:#f6f6f6;border:1px solid #ddd;border-radius:4px;padding:9px">
        <b style="font-size:12px">CUSTOMER COMPLAINTS</b><div style="white-space:pre-line;margin-top:4px">${esc(wo.complaint)}</div></div>` : ''}
      ${wo.diagnosis ? `<div style="margin-top:8px;background:#eef7ee;border:1px solid #cdc;border-radius:4px;padding:9px">
        <b style="font-size:12px;color:#155724">✔ WORK DONE / DIAGNOSIS</b><div style="white-space:pre-line;margin-top:4px">${esc(wo.diagnosis)}</div></div>` : ''}
      ${wo.recommendation ? `<div style="margin-top:8px;background:#fdf0ee;border:1px solid #e5c5c0;border-radius:4px;padding:9px">
        <b style="font-size:12px;color:#b23a3a">✋ PENDING / RECOMMENDED WORK</b><div style="white-space:pre-line;margin-top:4px">${esc(wo.recommendation)}</div></div>` : ''}
      <table><thead><tr><th>Work / Part</th><th class="r">Qty/Hrs</th><th class="r">Rate</th><th class="r">Total</th></tr></thead>
      <tbody>${rows.map(r2 => `<tr><td>${esc(r2.d)}</td><td class="r">${r2.q}</td><td class="r">$${(+r2.u).toFixed(2)}</td><td class="r">$${(+r2.t).toFixed(2)}</td></tr>`).join('') || '<tr><td colspan="4" class="mut">No lines yet</td></tr>'}</tbody></table>
      <table style="width:300px;margin-left:auto">
        <tr><td>Labor</td><td class="r">$${(+wo.laborSubtotal).toFixed(2)}</td></tr>
        <tr><td>Parts</td><td class="r">$${(+wo.partsSubtotal).toFixed(2)}</td></tr>
        ${wo.discount ? `<tr><td>Discount</td><td class="r">−${wo.discountType === 'percent' ? wo.discount + '%' : '$' + (+wo.discount).toFixed(2)}</td></tr>` : ''}
        ${wo.shopSuppliesFee ? `<tr><td>Shop supplies</td><td class="r">$${(+wo.shopSuppliesFee).toFixed(2)}</td></tr>` : ''}
        <tr><td>Tax (${wo.taxRate}%)</td><td class="r">$${(+wo.taxAmount).toFixed(2)}</td></tr>
        <tr style="font-size:16px;font-weight:800;border-top:2px solid #14337d"><td>TOTAL</td><td class="r">$${(+wo.total).toFixed(2)}</td></tr>
      </table>
      <div class="sig"><div>Customer signature (approval)</div><div>Advisor</div><div>Date</div></div>
      <div class="noprint" style="text-align:center;margin-top:16px"><button onclick="window.print()" style="padding:8px 22px;font-weight:700">🖨️ Print</button></div>
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 400);
  }

  /* ═══════════ INVOICE PRINT ═══════════ */
  async function invPrint(id) {
    try {
      const inv = (await API.get('/erp/invoices/' + id)).data;
      let woDoc = null;
      if (inv.workOrder) {
        try { woDoc = (await API.get('/erp/work-orders/' + (inv.workOrder._id || inv.workOrder))).data; } catch {}
      }
      const s = settings;
      const veh = [inv.vehicle?.year, inv.vehicle?.make, inv.vehicle?.model].filter(Boolean).join(' ');
      const w = window.open('', '_blank', 'width=800,height=900');
      w.document.write(`<!DOCTYPE html><html><head><title>${esc(inv.invoiceNumber)}</title><style>
        body{font:13px/1.45 Segoe UI,Arial,sans-serif;color:#111;margin:34px}
        h1{font-size:22px;margin:0} .mut{color:#666} .r{text-align:right}
        table{width:100%;border-collapse:collapse;margin-top:14px}
        th{background:#14337d;color:#fff;text-align:left;padding:6px 9px;font-size:12px}
        td{padding:6px 9px;border-bottom:1px solid #ddd}
        .tot td{border:none;padding:3px 9px} .grand{font-size:16px;font-weight:800;border-top:2px solid #14337d}
        .hdr{display:flex;justify-content:space-between;border-bottom:3px solid #14337d;padding-bottom:12px}
        @media print{ .noprint{display:none} }
      </style></head><body>
        <div class="hdr">
          <div><h1>${esc(s.shopName || 'Road Hustlers')}</h1>
            <div class="mut">${esc([s.address?.street, s.address?.city, s.address?.state, s.address?.zip].filter(Boolean).join(', '))}</div>
            <div class="mut">${esc(s.phone || '')} · ${esc(s.email || '')}</div></div>
          <div class="r"><h1 style="color:#14337d">INVOICE</h1><div><b>${esc(inv.invoiceNumber)}</b></div>
            <div class="mut">${new Date(inv.createdAt).toLocaleDateString()}</div>
            ${inv.dueDate ? `<div class="mut">Due: ${new Date(inv.dueDate).toLocaleDateString()}</div>` : ''}</div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:14px">
          <div><b>Bill to</b><br>${esc(inv.customer?.name || '')}<br><span class="mut">${esc(inv.customer?.phone || '')} ${esc(inv.customer?.email || '')}</span></div>
          ${veh ? `<div class="r"><b>Vehicle</b><br>${esc(veh)}<br><span class="mut">${esc(inv.vehicle?.plate || '')}</span></div>` : ''}
        </div>
        <table><thead><tr><th>Description</th><th class="r">Qty</th><th class="r">Unit</th><th class="r">Total</th></tr></thead>
        <tbody>${(inv.lineItems || []).map(l => `<tr><td>${esc(l.description)}</td><td class="r">${l.quantity}</td><td class="r">$${(+l.unitPrice).toFixed(2)}</td><td class="r">$${(+l.lineTotal).toFixed(2)}</td></tr>`).join('')}</tbody></table>
        <table style="width:300px;margin-left:auto" class="tot">
          <tr><td>Subtotal</td><td class="r">$${(+inv.subtotal).toFixed(2)}</td></tr>
          ${inv.discount ? `<tr><td>Discount</td><td class="r">−$${(+inv.discount).toFixed(2)}</td></tr>` : ''}
          ${inv.shopSuppliesFee ? `<tr><td>Shop supplies</td><td class="r">$${(+inv.shopSuppliesFee).toFixed(2)}</td></tr>` : ''}
          <tr><td>Tax (${inv.taxRate}%)</td><td class="r">$${(+inv.taxAmount).toFixed(2)}</td></tr>
          <tr class="grand"><td>TOTAL</td><td class="r">$${(+inv.total).toFixed(2)}</td></tr>
          <tr><td>Paid</td><td class="r">$${(+inv.amountPaid).toFixed(2)}</td></tr>
          <tr><td><b>Balance due</b></td><td class="r"><b>$${(+inv.amountDue).toFixed(2)}</b></td></tr>
        </table>
        ${woDoc?.diagnosis ? `<div style="margin-top:12px;background:#eef7ee;border:1px solid #cdc;border-radius:4px;padding:9px">
          <b style="font-size:12px;color:#155724">✔ WORK PERFORMED</b><div style="white-space:pre-line;margin-top:4px">${esc(woDoc.diagnosis)}</div></div>` : ''}
        ${woDoc?.recommendation ? `<div style="margin-top:8px;background:#fdf0ee;border:1px solid #e5c5c0;border-radius:4px;padding:9px">
          <b style="font-size:12px;color:#b23a3a">✋ RECOMMENDED ON NEXT VISIT</b><div style="white-space:pre-line;margin-top:4px">${esc(woDoc.recommendation)}</div></div>` : ''}
        ${inv.notes ? `<p class="mut">${esc(inv.notes)}</p>` : ''}
        <p class="mut" style="margin-top:26px;text-align:center">Thank you for your business! · ${esc(s.website || '')}</p>
        <div class="noprint" style="text-align:center;margin-top:16px"><button onclick="window.print()" style="padding:8px 22px;font-weight:700">🖨️ Print</button></div>
      </body></html>`);
      w.document.close();
      setTimeout(() => w.print(), 400);
    } catch (e) { toast(e.message, 'err'); }
  }

  const RENDER = {
    dashboard: rDashboard, workorders: rWorkOrders, appointments: rAppointments,
    customers: rCustomers, parts: rParts, invoices: rInvoices, payments: rPayments,
    reports: rReports, leads: rLeads, po: rPO, staff: rStaff,
    services: rServices, settings: rSettings,
  };

  /* ── keyboard shortcuts (WO screen) ── */
  document.addEventListener('keydown', (e) => {
    if ($('#login-ov').style.display !== 'none') { if (e.key === 'Enter') login(); return; }
    if ($('#modal-ov').classList.contains('show')) { if (e.key === 'Escape') closeModal(); return; }
    if (e.key === 'F1') { e.preventDefault(); go('dashboard'); }
    if (screen !== 'workorders') return;
    if (e.key === 'F2') { e.preventDefault(); $('#wo-cust')?.focus(); }
    if (e.key === 'F4') { e.preventDefault(); $('#cat-q')?.focus(); }
    if (e.key === 'F8') { e.preventDefault(); woSaveHead(); }
    if (e.key === 'F9') { e.preventDefault(); if (wo && ['approved','in_progress','completed'].includes(wo.status)) woInvoice(); }
    if (e.key === 'Escape') { e.preventDefault(); newWOFlow(); }
  });

  /* ── boot ── */
  $$('#rail button').forEach(b => b.onclick = () => go(b.dataset.screen));
  (function init() {
    try { user = JSON.parse(localStorage.getItem('rh_user') || 'null'); } catch {}
    if (API.hasToken() && user) afterLogin();
    else showLogin();
  })();

  return {
    login, logout, showLogin, go, closeModal,
    newWOFlow, openWO, wolFilter, woCustChange, woCreate, woSaveHead, woRemoveLine,
    woDiscount, woSaveDiag, woAction, woStatus, woInvoice,
    catSwitch, catSearch, catPick, addService, addPart, manualLine, manualLineSave,
    custFilter, custModal, custSave, custVehicles, custNewWO, custWOModal, vehModal, vehSave,
    wizToggle, wizSet, wizCust, wizAddComplaint, wizDelComplaint, wizCreate, woTimeToLabor, woPrint,
    partsFilter, partModal, partSave, partAdjust, partAdjustSave,
    rInvoicesLoad, invOpen, invPay, invSend,
    apptModal, apptSave, apptStatus, apptStart,
    repGo, leadsLoad, leadStatus, leadConvert, leadModal, leadSave,
    supModal, supSave, poModal, poAddItem, poDelItem, poSave, poStatus, poReceive,
    staffModal, staffSave, staffTimesheet, invPrint,
    svcModal, svcSave, settingsSave,
  };
})();
