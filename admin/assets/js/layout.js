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
      { id: "dashboard", label: "Dashboard", icon: "📊", href: basePath + "/pages/dashboard/dashboard.html", perm: "view_dashboard" },
      { id: "analytics", label: "Analytics", icon: "📉", href: basePath + "/pages/analytics/analytics.html", perm: "view_analytics" },
    ]},
    { group: "Catalog", items: [
      { id: "categories", label: "Categories", icon: "📁", href: basePath + "/pages/categories/categories.html", perm: "manage_categories" },
      { id: "products", label: "Products", icon: "📦", href: basePath + "/pages/products/products.html", perm: "manage_products" },
      { id: "reviews", label: "Reviews", icon: "⭐", href: basePath + "/pages/reviews/reviews.html", perm: "manage_reviews" },
      { id: "cj-products", label: "CJ Dropshipping", icon: "🌐", href: basePath + "/pages/cj-products/cj-products.html", perm: "manage_cj" },
      { id: "offers", label: "Offers", icon: "🏷️", href: basePath + "/pages/offers/offers.html", perm: "manage_offers" },
      { id: "coupons", label: "Coupons", icon: "🎟️", href: basePath + "/pages/coupons/coupons.html", perm: "manage_coupons" },
      { id: "coupon-market", label: "Coupon Marketplace", icon: "🎫", href: basePath + "/pages/coupon-market/coupon-market.html", perm: "manage_coupon_market" },
      { id: "banners", label: "Banners", icon: "🖼️", href: basePath + "/pages/banners/banners.html", perm: "manage_banners" },
    ]},
    { group: "Business", items: [
      { id: "partners", label: "Partners", icon: "🏪", href: basePath + "/pages/partners/partners.html", perm: "manage_partners" },
      { id: "kyc", label: "KYC Requests", icon: "📋", href: basePath + "/pages/kyc/kyc.html", perm: "manage_kyc" },
      { id: "orders", label: "Orders", icon: "🛒", href: basePath + "/pages/orders/orders.html", perm: "manage_orders" },
      { id: "shipping", label: "Shipping", icon: "🚚", href: basePath + "/pages/shipping/shipping.html", perm: "manage_shipping" },
      { id: "returns", label: "Returns", icon: "↩️", href: basePath + "/pages/returns/returns.html", perm: "manage_returns" },
      { id: "payouts", label: "Payouts", icon: "💰", href: basePath + "/pages/payouts/payouts.html", perm: "manage_payouts" },
    ]},
    { group: "Users", items: [
      { id: "delivery-boys", label: "Delivery Boys", icon: "🚴", href: basePath + "/pages/delivery-boys/delivery-boys.html", perm: "manage_delivery" },
      { id: "staff", label: "Staff", icon: "👥", href: basePath + "/pages/staff/staff.html", perm: "manage_staff" },
      { id: "wallets", label: "Wallets", icon: "👛", href: basePath + "/pages/wallets/wallets.html", perm: "manage_wallets" },
    ]},
    { group: "Engagement", items: [
      { id: "tickets", label: "Support Tickets", icon: "🎫", href: basePath + "/pages/tickets/tickets.html", perm: "manage_tickets" },
      { id: "subscriptions", label: "Subscriptions", icon: "⭐", href: basePath + "/pages/subscriptions/subscriptions.html", perm: "manage_subscriptions" },
      { id: "notifications", label: "Notifications", icon: "🔔", href: basePath + "/pages/notifications/notifications.html", perm: "manage_notifications" },
      { id: "magic-pools", label: "Magic Pools", icon: "🎡", href: basePath + "/pages/magic-pools/magic-pools.html", perm: "manage_magic_pools" },
      { id: "investors", label: "Investors", icon: "💼", href: basePath + "/pages/investors/investors.html", perm: "manage_investors" },
    ]},
    { group: "System", items: [
      { id: "reports", label: "Reports", icon: "📈", href: basePath + "/pages/reports/reports.html", perm: "view_reports" },
      { id: "security", label: "Security", icon: "🛡️", href: basePath + "/pages/security/security.html", perm: "view_security" },
      { id: "ddgo-settings", label: "Quick Commerce Settings", icon: "🟢", href: basePath + "/pages/ddgo-settings/ddgo-settings.html", perm: "manage_settings" },
      { id: "settings", label: "Settings", icon: "⚙️", href: basePath + "/pages/settings/settings.html", perm: "manage_settings" },
      { id: "home-sections", label: "Home Layouts", icon: "🏠", href: basePath + "/pages/home-sections/home-sections.html", perm: "manage_homepage" },
      { id: "app-customization", label: "App Customization", icon: "🎨", href: basePath + "/pages/app-customization/app-customization.html", perm: "manage_homepage" },
    ]},
  ];

  // Staff only see the sections they hold a permission for (admins see all).
  const me = getMe();
  const canSee = (item) => {
    if (!me || me.isAdmin !== false) return true;
    if (!item.perm) return true;
    return (me.permissions || []).includes(item.perm);
  };

  let navHTML = "";
  for (const group of navItems) {
    const visible = group.items.filter(canSee);
    if (!visible.length) continue;
    navHTML += `<div class="nav-group"><div class="nav-group-label">${group.group}</div>`;
    for (const item of visible) {
      const active = item.id === activePageId ? " active" : "";
      navHTML += `<a class="nav-item${active}" href="${item.href}"><span class="icon">${item.icon}</span>${item.label}</a>`;
    }
    navHTML += `</div>`;
  }

  // Staff deep-linking into a page they cannot open → bounce to their first
  // allowed section (the API rejects them anyway; this avoids a broken screen).
  const currentNav = navItems.flatMap((g) => g.items).find((i) => i.id === activePageId);
  if (currentNav && !canSee(currentNav)) {
    const fallback = navItems.flatMap((g) => g.items).find(canSee);
    showToast("You do not have permission to open that section", "error");
    if (fallback) {
      window.location.replace(fallback.href);
    } else {
      document.body.innerHTML =
        `<div style="padding:60px;text-align:center;font-family:Inter,sans-serif">
           <div style="font-size:42px">🔒</div>
           <h2>No sections assigned</h2>
           <p style="color:#6b7280">Your account has no permissions yet. Please contact your administrator.</p>
         </div>`;
    }
    return;
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

  // Region switcher (IN / US storefront) — staff only get their allowed stores
  const regionSel = document.getElementById("region-switcher");
  if (regionSel) {
    const allowedRegions = me && me.isAdmin === false && (me.regions || []).length
      ? me.regions
      : ["IN", "US"];
    [...regionSel.options].forEach((opt) => {
      if (!allowedRegions.includes(opt.value)) opt.remove();
    });
    if (!allowedRegions.includes(getRegion())) setRegion(allowedRegions[0]);
    regionSel.value = getRegion();
    regionSel.addEventListener("change", function () {
      setRegion(this.value);
      // Reload to refresh region-scoped data on the current page
      window.location.reload();
    });
  }

  // Refresh permissions in the background so changes apply on the next page load
  refreshMe();

  // Apply admin sidebar branding (logo / brand name from settings)
  applyAdminBranding();
}

// ---- Signed-in identity + permissions (staff role-based access) ----
function getMe() {
  try { return JSON.parse(localStorage.getItem("dd_me") || "null"); } catch { return null; }
}

async function refreshMe() {
  try {
    const data = await API.get("/admin/me");
    if (data && data.me) {
      const prev = getMe();
      localStorage.setItem("dd_me", JSON.stringify(data.me));
      // Permissions changed while the page was open — rebuild the menu
      if (prev && JSON.stringify(prev.permissions) !== JSON.stringify(data.me.permissions)) {
        window.location.reload();
      }
    }
  } catch {
    // Offline or token expired — keep the cached copy; API layer handles 401s
  }
}

// ---- Region helpers (Phase 2) ----
function getRegion() {
  return localStorage.getItem("dd_region") || "IN";
}
function setRegion(r) {
  if (r !== "IN" && r !== "US") r = "IN";
  localStorage.setItem("dd_region", r);
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
// Currency-aware: pass an order's currency ("USD"/"INR") to format with $ or ₹.
// Defaults to ₹ (INR) when not given, so existing callers stay unchanged.
function fmtCurrency(n, currency) {
  if (n == null) n = 0;
  if (currency === "USD") {
    return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
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
          <select id="region-switcher" class="region-switcher" title="Storefront region">
            <option value="IN">🇮🇳 India (INR)</option>
            <option value="US">🇺🇸 USA (USD)</option>
          </select>
          <span class="admin-badge" id="admin-name">Admin</span>
          <button class="btn-logout" id="btn-logout">Logout</button>
        </div>
      </header>
      <div class="content" id="page-content"></div>
    </div>
  </div>`;
}
