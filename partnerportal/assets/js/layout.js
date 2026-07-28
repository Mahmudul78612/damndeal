// ========== DAMNDEAL PARTNER PORTAL — LAYOUT BUILDER ==========

function showToast(message, type = 'success') {
  let c = document.querySelector('.toast-container');
  if (!c) { c = document.createElement('div'); c.className = 'toast-container'; document.body.appendChild(c); }
  const t = document.createElement('div');
  t.className = 'toast toast-' + type;
  t.textContent = message;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function buildLayout(activeId) {
  if (!requireAuth()) return;
  const user = getUser();
  const sidebar = document.getElementById('sidebar');
  const topTitle = document.getElementById('topbar-title');
  const nameEl = document.getElementById('partner-name');
  if (nameEl) nameEl.textContent = user?.name || 'Partner';

  const nav = [
    { group: 'Main', items: [
      { id: 'dashboard', label: 'Dashboard', icon: '📊', href: PP_BASE + '/pages/dashboard/dashboard.html' },
    ]},
    { group: 'Store', items: [
      { id: 'kyc', label: 'KYC', icon: '📋', href: PP_BASE + '/pages/kyc/kyc.html' },
      { id: 'products', label: 'Products', icon: '📦', href: PP_BASE + '/pages/products/products.html' },
      { id: 'orders', label: 'Orders', icon: '🛒', href: PP_BASE + '/pages/orders/orders.html' },
      { id: 'customers', label: 'Customers', icon: '👥', href: PP_BASE + '/pages/customers/customers.html' },
    ]},
    { group: 'Operations', items: [
      { id: 'delivery-boys', label: 'Delivery Boys', icon: '🚴', href: PP_BASE + '/pages/delivery-boys/delivery-boys.html' },
      { id: 'offers', label: 'Offers', icon: '🏷️', href: PP_BASE + '/pages/offers/offers.html' },
      { id: 'returns', label: 'Returns', icon: '↩️', href: PP_BASE + '/pages/returns/returns.html' },
    ]},
    { group: 'Services', items: [
      { id: 'recharges', label: 'Recharges & Bills', icon: '🔌', href: PP_BASE + '/pages/recharges/recharges.html' },
    ]},
    { group: 'Account', items: [
      { id: 'payouts', label: 'Payouts', icon: '💰', href: PP_BASE + '/pages/payouts/payouts.html' },
      { id: 'subscription', label: 'Subscription', icon: '⭐', href: PP_BASE + '/pages/subscription/subscription.html' },
      { id: 'tickets', label: 'Support', icon: '🎫', href: PP_BASE + '/pages/tickets/tickets.html' },
    ]},
  ];

  let html = '';
  for (const g of nav) {
    html += `<div class="nav-group"><div class="nav-group-label">${g.group}</div>`;
    for (const i of g.items) {
      html += `<a class="nav-item${i.id===activeId?' active':''}" href="${i.href}"><span class="icon">${i.icon}</span>${i.label}</a>`;
    }
    html += '</div>';
  }
  if (sidebar) sidebar.querySelector('.sidebar-nav').innerHTML = html;

  const cur = nav.flatMap(g => g.items).find(i => i.id === activeId);
  if (topTitle && cur) topTitle.textContent = cur.label;

  const menuBtn = document.getElementById('btn-menu');
  if (menuBtn) menuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
  const logBtn = document.getElementById('btn-logout');
  if (logBtn) logBtn.addEventListener('click', logout);
}

function renderPagination(containerId, cur, total, cb) {
  const el = document.getElementById(containerId);
  if (!el || total <= 1) { if (el) el.innerHTML = ''; return; }
  let h = `<span>Page ${cur} of ${total}</span><div class="pagination-btns">`;
  h += `<button ${cur<=1?'disabled':''} onclick="(${cb.name})(${cur-1})">Prev</button>`;
  const s = Math.max(1, cur - 2), e = Math.min(total, cur + 2);
  for (let i = s; i <= e; i++) h += `<button class="${i===cur?'active':''}" onclick="(${cb.name})(${i})">${i}</button>`;
  h += `<button ${cur>=total?'disabled':''} onclick="(${cb.name})(${cur+1})">Next</button></div>`;
  el.innerHTML = h;
}

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '-'; }
function fmtDateTime(d) { return d ? new Date(d).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '-'; }
function fmtCurrency(n) { return '₹' + (Number(n)||0).toLocaleString('en-IN',{maximumFractionDigits:0}); }

function statusBadge(status) {
  const m = {
    approved:'success', active:'success', paid:'success', delivered:'success', completed:'success', resolved:'success', verified:'success',
    pending:'warning', placed:'warning', processing:'warning', open:'warning', requested:'warning',
    rejected:'danger', cancelled:'danger', failed:'danger', closed:'danger', expired:'danger',
    confirmed:'info', shipped:'info', assigned:'info', ready:'info',
  };
  const c = m[(status||'').toLowerCase()] || 'gray';
  return `<span class="badge badge-${c}">${status||'N/A'}</span>`;
}

function openModal(id) { document.getElementById(id)?.classList.add('show'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('show'); }

function esc(s) { const d = document.createElement('div'); d.textContent = String(s||''); return d.innerHTML; }

function pageShell(title) {
  return `
  <div class="layout">
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-brand">Damn<span>Deal</span> <small>Partner</small></div>
      <nav class="sidebar-nav"></nav>
      <div class="sidebar-footer">Partner Portal v1.0</div>
    </aside>
    <div class="main">
      <header class="topbar">
        <div class="topbar-left">
          <button class="btn-menu" id="btn-menu">☰</button>
          <span class="topbar-title" id="topbar-title">${title}</span>
        </div>
        <div class="topbar-right">
          <span class="partner-badge" id="partner-name">Partner</span>
          <button class="btn-logout" id="btn-logout">Logout</button>
        </div>
      </header>
      <div id="kyc-banner-slot"></div>
      <div class="content" id="page-content"></div>
    </div>
  </div>`;
}

// ── KYC floating banner ──
var _kycStatus = null;
async function checkKycStatus() {
  try {
    var data = await API.get('/partner/kyc');
    _kycStatus = data.kyc ? data.kyc.status : null;
  } catch(e) {
    _kycStatus = null; // not submitted
  }
  renderKycBanner();
  return _kycStatus;
}

function renderKycBanner() {
  var slot = document.getElementById('kyc-banner-slot');
  if (!slot) return;
  if (_kycStatus === 'approved') { slot.innerHTML = ''; return; }

  var msg, bg, icon;
  if (!_kycStatus) {
    icon = '⚠️'; bg = '#FEF3C7'; msg = 'Complete your KYC to start selling. <a href="'+PP_BASE+'/pages/kyc/kyc.html" style="color:#92400E;font-weight:700;text-decoration:underline">Complete KYC →</a>';
  } else if (_kycStatus === 'pending') {
    icon = '⏳'; bg = '#DBEAFE'; msg = 'Your KYC is under review. You\'ll be able to add products once verified.';
  } else if (_kycStatus === 'rejected') {
    icon = '❌'; bg = '#FEE2E2'; msg = 'Your KYC was rejected. <a href="'+PP_BASE+'/pages/kyc/kyc.html" style="color:#991B1B;font-weight:700;text-decoration:underline">Re-submit KYC →</a>';
  }

  slot.innerHTML = '<div style="background:'+bg+';padding:10px 22px;font-size:13px;display:flex;align-items:center;gap:8px;border-bottom:1px solid rgba(0,0,0,.08)">'
    + '<span style="font-size:18px">'+icon+'</span><span>'+msg+'</span></div>';
}

function isKycApproved() { return _kycStatus === 'approved'; }
