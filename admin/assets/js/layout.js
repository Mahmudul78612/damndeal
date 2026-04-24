// ========== DAMNDEAL ADMIN — LAYOUT BUILDER ==========

// Toast notifications
function showToast(message, type = "success") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.remove(); }, 3500);
}

// Generic modal
function showModal(html) {
  let overlay = document.getElementById("_generic-modal");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "_generic-modal";
    overlay.className = "modal-overlay";
    overlay.innerHTML = `<div class="modal" id="_generic-modal-inner" style="max-width:600px;max-height:90vh;overflow-y:auto"><div class="modal-body" id="_generic-modal-body"></div></div>`;
    overlay.addEventListener("click", function(e) { if (e.target === overlay) closeModal("_generic-modal"); });
    document.body.appendChild(overlay);
  }
  document.getElementById("_generic-modal-body").innerHTML = html;
  overlay.classList.add("show");
}

// Build sidebar
function buildLayout(activePageId) {
  if (!requireAuth()) return;

  // Compute base path relative to current page
  const basePath = (function() {
    const p = window.location.pathname;
    const idx = p.lastIndexOf("/pages/");
    if (idx >= 0) return p.substring(0, idx);
    // index.html at root
    const last = p.lastIndexOf("/");
    return p.substring(0, last);
  })();

  const user = getUser();
  const sidebar = document.getElementById("sidebar");
  const topbarTitle = document.getElementById("topbar-title");
  const adminName = document.getElementById("admin-name");

  if (adminName) adminName.textContent = user?.name || "Admin";

  const navItems = [
    { group: "Main", items: [
      { id: "dashboard", label: "Dashboard", icon: "📊", href: basePath + "/pages/dashboard/dashboard.html" },
      { id: "analytics", label: "Analytics", icon: "📉", href: basePath + "/pages/analytics/analytics.html" },
    ]},
    { group: "Catalog", items: [
      { id: "categories", label: "Categories", icon: "📁", href: basePath + "/pages/categories/categories.html" },
      { id: "products", label: "Products", icon: "📦", href: basePath + "/pages/products/products.html" },
      { id: "reviews", label: "Reviews", icon: "⭐", href: basePath + "/pages/reviews/reviews.html" },
      { id: "cj-products", label: "CJ Dropshipping", icon: "🌐", href: basePath + "/pages/cj-products/cj-products.html" },
      { id: "offers", label: "Offers", icon: "🏷️", href: basePath + "/pages/offers/offers.html" },
      { id: "coupons", label: "Coupons", icon: "🎟️", href: basePath + "/pages/coupons/coupons.html" },
      { id: "banners", label: "Banners", icon: "🖼️", href: basePath + "/pages/banners/banners.html" },
    ]},
    { group: "Business", items: [
      { id: "partners", label: "Partners", icon: "🏪", href: basePath + "/pages/partners/partners.html" },
      { id: "kyc", label: "KYC Requests", icon: "📋", href: basePath + "/pages/kyc/kyc.html" },
      { id: "orders", label: "Orders", icon: "🛒", href: basePath + "/pages/orders/orders.html" },
      { id: "shipping", label: "Shipping", icon: "🚚", href: basePath + "/pages/shipping/shipping.html" },
      { id: "returns", label: "Returns", icon: "↩️", href: basePath + "/pages/returns/returns.html" },
      { id: "payouts", label: "Payouts", icon: "💰", href: basePath + "/pages/payouts/payouts.html" },
    ]},
    { group: "Users", items: [
      { id: "delivery-boys", label: "Delivery Boys", icon: "🚴", href: basePath + "/pages/delivery-boys/delivery-boys.html" },
      { id: "staff", label: "Staff", icon: "👥", href: basePath + "/pages/staff/staff.html" },
      { id: "wallets", label: "Wallets", icon: "👛", href: basePath + "/pages/wallets/wallets.html" },
    ]},
    { group: "Engagement", items: [
      { id: "tickets", label: "Support Tickets", icon: "🎫", href: basePath + "/pages/tickets/tickets.html" },
      { id: "subscriptions", label: "Subscriptions", icon: "⭐", href: basePath + "/pages/subscriptions/subscriptions.html" },
      { id: "notifications", label: "Notifications", icon: "🔔", href: basePath + "/pages/notifications/notifications.html" },
    ]},
    { group: "System", items: [
      { id: "reports", label: "Reports", icon: "📈", href: basePath + "/pages/reports/reports.html" },
      { id: "ddgo-settings", label: "Quick Commerce Settings", icon: "🟢", href: basePath + "/pages/ddgo-settings/ddgo-settings.html" },
      { id: "settings", label: "Settings", icon: "⚙️", href: basePath + "/pages/settings/settings.html" },
      { id: "home-sections", label: "Home Sections", icon: "🏠", href: basePath + "/pages/home-sections/home-sections.html" },
      { id: "desktop-home", label: "Desktop Home", icon: "🖥️", href: basePath + "/pages/desktop-home/desktop-home.html" },
      { id: "app-customization", label: "App Customization", icon: "🎨", href: basePath + "/pages/app-customization/app-customization.html" },
    ]},
  ];

  let navHTML = "";
  for (const group of navItems) {
    navHTML += `<div class="nav-group"><div class="nav-group-label">${group.group}</div>`;
    for (const item of group.items) {
      const active = item.id === activePageId ? " active" : "";
      navHTML += `<a class="nav-item${active}" href="${item.href}"><span class="icon">${item.icon}</span>${item.label}</a>`;
    }
    navHTML += `</div>`;
  }

  if (sidebar) {
    sidebar.querySelector(".sidebar-nav").innerHTML = navHTML;
  }

  // Set page title
  const currentItem = navItems.flatMap(g => g.items).find(i => i.id === activePageId);
  if (topbarTitle && currentItem) topbarTitle.textContent = currentItem.label;

  // Mobile menu toggle
  const menuBtn = document.getElementById("btn-menu");
  if (menuBtn) {
    menuBtn.addEventListener("click", () => sidebar.classList.toggle("open"));
  }

  // Logout
  const logoutBtn = document.getElementById("btn-logout");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  // Apply admin sidebar branding (logo / brand name from settings)
  applyAdminBranding();
}

// Fetch admin branding (admin_logo_url, admin_brand_name) once per session
// and render into .sidebar-brand. Cached in localStorage for 5 minutes.
async function applyAdminBranding() {
  const brandEl = document.querySelector(".sidebar-brand");
  if (!brandEl) return;

  const CACHE_KEY = "dd_admin_branding";
  const TTL_MS = 5 * 60 * 1000;

  // Try cache first for instant render
  let cached = null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && (Date.now() - (obj.t || 0)) < TTL_MS) cached = obj;
    }
  } catch {}

  if (cached) renderAdminBrand(brandEl, cached.logo, cached.name);

  // Always refresh in background
  try {
    const r = await api("/admin/settings");
    const arr = r.settings || r.data || r || [];
    const map = {};
    if (Array.isArray(arr)) arr.forEach(s => { map[s.key] = s.value; });
    const logo = map.admin_logo_url || "";
    const name = map.admin_brand_name || "";
    localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), logo, name }));
    renderAdminBrand(brandEl, logo, name);
  } catch {
    if (!cached) renderAdminBrand(brandEl, "", "");
  }
}

function renderAdminBrand(el, logoUrl, brandName) {
  if (logoUrl) {
    const src = /^https?:|^data:/.test(logoUrl) ? logoUrl : (CONFIG.UPLOADS_BASE + logoUrl);
    el.innerHTML = `<img src="${src}" alt="${(brandName || "Admin").replace(/"/g,"&quot;")}" />`;
  } else if (brandName) {
    el.textContent = brandName;
  } else {
    el.innerHTML = 'Admin <span>Panel</span>';
  }
}

// Pagination helper
window.__pagCbs = window.__pagCbs || {};
function renderPagination(containerId, currentPage, totalPages, onPageChange) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Register callback under the container id so onclick can reach it reliably
  window.__pagCbs[containerId] = onPageChange;
  const cbRef = `window.__pagCbs['${containerId}']`;

  let html = `<span>Page ${currentPage} of ${totalPages}</span><div class="pagination-btns">`;
  html += `<button ${currentPage <= 1 ? "disabled" : ""} onclick="${cbRef}(${currentPage - 1})">Prev</button>`;

  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  for (let i = start; i <= end; i++) {
    html += `<button class="${i === currentPage ? 'active' : ''}" onclick="${cbRef}(${i})">${i}</button>`;
  }
  html += `<button ${currentPage >= totalPages ? "disabled" : ""} onclick="${cbRef}(${currentPage + 1})">Next</button>`;
  html += `</div>`;
  container.innerHTML = html;
}

// Format date
function fmtDate(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Currency format
function fmtCurrency(n) {
  if (n == null) return "₹0";
  return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

// Status badge
function statusBadge(status) {
  const map = {
    approved: "success", active: "success", paid: "success", delivered: "success", completed: "success", resolved: "success",
    pending: "warning", placed: "warning", processing: "warning", open: "warning", requested: "warning",
    rejected: "danger", cancelled: "danger", failed: "danger", closed: "danger", expired: "danger",
    confirmed: "info", shipped: "info", assigned: "info", ready: "info",
  };
  const cls = map[(status || "").toLowerCase()] || "gray";
  return `<span class="badge badge-${cls}">${status || "N/A"}</span>`;
}

// HTML-escape strings (XSS protection)
function esc(s){ const d=document.createElement('div'); d.textContent=String(s||''); return d.innerHTML; }

// Open / close modal
function openModal(id) { document.getElementById(id)?.classList.add("show"); }
function closeModal(id) { document.getElementById(id)?.classList.remove("show"); }

// Page layout HTML template (used by each page)
function pageShell(pageId) {
  return `
  <div class="layout">
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-brand">Admin <span>Panel</span></div>
      <nav class="sidebar-nav"></nav>
      <div class="sidebar-footer">Admin Panel v1.0</div>
    </aside>
    <div class="main">
      <header class="topbar">
        <div class="topbar-left">
          <button class="btn-menu" id="btn-menu">☰</button>
          <span class="topbar-title" id="topbar-title">${pageId}</span>
        </div>
        <div class="topbar-right">
          <span class="admin-badge" id="admin-name">Admin</span>
          <button class="btn-logout" id="btn-logout">Logout</button>
        </div>
      </header>
      <div class="content" id="page-content"></div>
    </div>
  </div>`;
}
