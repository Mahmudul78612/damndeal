/* Coupon Marketplace — ERP-style admin console.
   Campaigns (moderation+feature+spin) · Categories & pack pricing · Vendors ·
   Homepage layout builder (banner uploads auto-compressed) · Spin & Win · Pack orders. */
(async function () {
  document.body.innerHTML = pageShell("Coupon Marketplace");
  buildLayout("coupon-market");
  const content = document.getElementById("page-content");

  let tab = "campaigns";
  let campaigns = [], categories = [], vendors = [], sections = [], packOrders = [], stats = {}, spin = {};
  // One marketplace-wide credit price list (not per category any more)
  let creditPacks = [];
  let campFilter = { status: "", region: "", q: "" };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const IMG = (p) => (p ? (String(p).startsWith("http") ? p : (CONFIG.UPLOADS_BASE || "") + p) : "");
  const fdate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
  const stBadge = (s) => {
    const map = {
      active: ["Active", "#DCFCE7", "#166534"], pending: ["Pending review", "#FEF3C7", "#92400E"],
      paused: ["Paused", "#F3F4F6", "#6B7280"], rejected: ["Rejected", "#FEE2E2", "#B91C1C"],
      expired: ["Expired", "#F3F4F6", "#9CA3AF"], draft: ["Draft", "#F3F4F6", "#6B7280"],
      approved: ["Approved", "#DCFCE7", "#166534"], suspended: ["Suspended", "#FEE2E2", "#B91C1C"],
      paid: ["Paid", "#DCFCE7", "#166534"],
    };
    const [t, bg, fg] = map[s] || [s, "#F3F4F6", "#6B7280"];
    return `<span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;background:${bg};color:${fg};white-space:nowrap">${t}</span>`;
  };

  /* ── modal helpers ── */
  function openM(html, width) {
    let ov = document.getElementById("cmModal");
    if (!ov) { ov = document.createElement("div"); ov.className = "modal-overlay"; ov.id = "cmModal"; document.body.appendChild(ov); }
    ov.innerHTML = `<div class="modal" style="width:${width || "560px"};max-width:95vw;max-height:88vh;overflow-y:auto">${html}</div>`;
    ov.classList.add("show");
    ov.onclick = (e) => { if (e.target === ov) closeM(); };
  }
  window.closeM = () => document.getElementById("cmModal")?.classList.remove("show");
  const mHead = (t) => `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <h3 style="margin:0;font-size:16px">${t}</h3>
      <button class="btn btn-sm" onclick="closeM()" style="font-size:18px;padding:0 8px">×</button></div>`;
  const F = (label, inner) => `<div class="form-group" style="margin-bottom:12px"><label style="font-size:12px;font-weight:600;color:#555">${label}</label>${inner}</div>`;

  /* ── data ── */
  async function loadAll() {
    try {
      const [d, camp, cat, ven, sec, pk, sp, cp] = await Promise.all([
        API.get("/coupons/admin/dashboard"), API.get("/coupons/admin/campaigns"),
        API.get("/coupons/admin/categories"), API.get("/coupons/admin/vendors"),
        API.get("/coupons/admin/sections"), API.get("/coupons/admin/pack-orders"),
        API.get("/coupons/admin/spin-settings"), API.get("/coupons/admin/credit-packs"),
      ]);
      stats = d.stats || {}; campaigns = camp.items || []; categories = cat.items || [];
      vendors = ven.items || []; sections = (sec.items || []).sort((a, b) => a.sortOrder - b.sortOrder);
      packOrders = pk.items || []; spin = sp || {}; creditPacks = cp.packs || [];
      render();
    } catch (e) { content.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>${esc(e.message)}</p></div>`; }
  }

  /* ── shell ── */
  function render() {
    const tabs = [
      ["campaigns", "🎟️ Campaigns", stats.pendingCampaigns],
      ["categories", "📁 Categories & Pricing", 0],
      ["vendors", "🏪 Vendors", 0],
      ["layout", "🎨 Homepage Layout", 0],
      ["spin", "🎡 Spin & Win", 0],
      ["packs", "💳 Pack Orders", stats.pendingPacks],
    ];
    content.innerHTML = `
      <div class="stats-grid" style="margin-bottom:16px">
        ${[["Total campaigns", stats.campaigns], ["Pending review", stats.pendingCampaigns], ["Vendors", stats.vendors],
           ["Claims", stats.claims], ["Redeemed", stats.redeemed], ["Pack orders pending", stats.pendingPacks]]
          .map(([l, v]) => `<div class="stat-card"><div class="label">${l}</div><div class="value">${(v || 0).toLocaleString()}</div></div>`).join("")}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;border-bottom:2px solid #eee;padding-bottom:10px">
        ${tabs.map(([k, l, n]) => `<button class="btn ${tab === k ? "btn-primary" : ""}" onclick="cmTab('${k}')" style="font-size:13px">
          ${l}${n ? ` <span style="background:#EF4444;color:#fff;font-size:10px;font-weight:700;border-radius:99px;padding:1px 7px;margin-left:4px">${n}</span>` : ""}</button>`).join("")}
      </div>
      <div id="cm-body"></div>`;
    const body = document.getElementById("cm-body");
    if (tab === "campaigns") body.innerHTML = vCampaigns();
    if (tab === "categories") body.innerHTML = vCategories();
    if (tab === "vendors") body.innerHTML = vVendors();
    if (tab === "layout") body.innerHTML = vLayout();
    if (tab === "spin") { body.innerHTML = vSpin(); setTimeout(() => window.cmPackDraw && window.cmPackDraw(), 0); }
    if (tab === "packs") body.innerHTML = vPacks();
  }
  window.cmTab = (k) => { tab = k; render(); };

  /* ════════ CAMPAIGNS ════════ */
  function filteredCampaigns() {
    return campaigns.filter((c) =>
      (!campFilter.status || c.status === campFilter.status) &&
      (!campFilter.region || (c.regions || []).includes(campFilter.region)) &&
      (!campFilter.q || (c.title + " " + (c.vendor?.businessName || "")).toLowerCase().includes(campFilter.q.toLowerCase()))
    );
  }
  function vCampaigns() {
    const list = filteredCampaigns();
    return `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center">
        <select class="form-control" style="width:170px" onchange="cmCF('status',this.value)">
          <option value="">All statuses</option>
          ${["pending", "active", "paused", "rejected", "expired"].map((s) => `<option value="${s}" ${campFilter.status === s ? "selected" : ""}>${s}</option>`).join("")}
        </select>
        <select class="form-control" style="width:130px" onchange="cmCF('region',this.value)">
          <option value="">All regions</option>
          <option value="IN" ${campFilter.region === "IN" ? "selected" : ""}>🇮🇳 India</option>
          <option value="US" ${campFilter.region === "US" ? "selected" : ""}>🇺🇸 USA</option>
        </select>
        <input class="form-control" style="width:240px" placeholder="Search title / vendor…" value="${esc(campFilter.q)}" oninput="cmCF('q',this.value)">
        <span style="font-size:12px;color:#888;margin-left:auto">${list.length} of ${campaigns.length}</span>
      </div>
      ${!list.length ? `<div class="empty-state"><div class="icon">🎟️</div><p>No campaigns match</p></div>` : `
      <div class="card" style="overflow:auto"><table class="table">
        <thead><tr><th>Coupon</th><th>Vendor</th><th>Category</th><th>Regions</th><th>Claims</th><th>Ends</th><th>Flags</th><th>Status</th><th></th></tr></thead>
        <tbody>${list.map((c) => `
          <tr style="cursor:pointer" onclick="cmOpenCampaign('${c._id}')">
            <td style="max-width:260px"><b style="color:#7C3AED">${esc(c.offerText)}</b><br><span style="font-size:12px">${esc(c.title)}</span></td>
            <td>${esc(c.vendor?.businessName || "—")}</td>
            <td>${esc(c.category?.name || "—")}</td>
            <td>${(c.regions || []).join(", ")}</td>
            <td>${c.claimedCount}/${c.totalQuota}</td>
            <td style="font-size:12px">${fdate(c.endAt)}</td>
            <td style="font-size:14px">${c.featured?.active ? "⭐" : ""}${c.inSpin ? "🎡" : ""}</td>
            <td>${stBadge(c.status)}</td>
            <td><button class="btn btn-sm" onclick="event.stopPropagation();cmOpenCampaign('${c._id}')" style="font-size:11px">Manage</button></td>
          </tr>`).join("")}</tbody></table></div>`}`;
  }
  window.cmCF = (k, v) => { campFilter[k] = v; const b = document.getElementById("cm-body"); if (b) b.innerHTML = vCampaigns(); };

  window.cmOpenCampaign = (id) => {
    const c = campaigns.find((x) => x._id === id); if (!c) return;
    openM(`
      ${mHead("Manage campaign")}
      ${c.bannerImage ? `<img src="${esc(IMG(c.bannerImage))}" style="width:100%;border-radius:10px;margin-bottom:12px;max-height:160px;object-fit:cover">` : ""}
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:10px">
        <span style="font-size:20px;font-weight:800;color:#7C3AED">${esc(c.offerText)}</span>
        ${stBadge(c.status)} ${c.featured?.active ? '<span style="font-size:12px">⭐ Featured</span>' : ""} ${c.inSpin ? '<span style="font-size:12px">🎡 In spin</span>' : ""}
      </div>
      <p style="margin:0 0 4px;font-weight:700">${esc(c.title)}</p>
      <p style="margin:0 0 10px;font-size:12px;color:#888">${esc(c.vendor?.businessName || "")} · ${esc(c.category?.name || "")} · ${(c.regions || []).join(", ")} · ends ${fdate(c.endAt)} · ${c.claimedCount}/${c.totalQuota} claimed · ${c.redeemedCount} redeemed · ${c.views || 0} views</p>
      ${c.description ? `<p style="font-size:13px;color:#444;background:#FAFAFA;border-radius:8px;padding:10px">${esc(c.description)}</p>` : ""}
      ${c.instructions ? `<p style="font-size:12px;color:#666;white-space:pre-line;background:#F5F3FF;border-radius:8px;padding:10px"><b>How to redeem:</b>\n${esc(c.instructions)}</p>` : ""}
      ${c.terms ? `<p style="font-size:11px;color:#888;white-space:pre-line">${esc(c.terms)}</p>` : ""}
      ${c.status === "rejected" && c.rejectReason ? `<p style="font-size:12px;color:#B91C1C">Rejected: ${esc(c.rejectReason)}</p>` : ""}
      <hr style="border:none;border-top:1px solid #eee;margin:14px 0">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${c.status === "pending" ? `
          <button class="btn btn-primary" onclick="cmModerate('${c._id}','approve')">✓ Approve & publish</button>
          <button class="btn btn-danger" onclick="cmRejectUI('${c._id}')">✗ Reject…</button>` : ""}
        ${c.status === "active" ? (c.featured?.active
          ? `<button class="btn" onclick="cmModerate('${c._id}','unfeature')">Remove ⭐ Featured</button>`
          : `<button class="btn" onclick="cmFeatureUI('${c._id}')">⭐ Feature (sponsored)…</button>`) : ""}
        ${["active", "paused"].includes(c.status) ? `
          <button class="btn ${c.inSpin ? "btn-warning" : ""}" onclick="cmSpinToggle('${c._id}',${!c.inSpin})">${c.inSpin ? "Remove from 🎡 Spin" : "Add to 🎡 Spin"}</button>
          <button class="btn btn-warning" onclick="cmModerate('${c._id}','expire')">Expire now</button>` : ""}
      </div>`);
  };
  window.cmModerate = async (id, action, extra = {}) => {
    try { await API.post(`/coupons/admin/campaigns/${id}/moderate`, { action, ...extra }); showToast("Done", "success"); closeM(); loadAll(); }
    catch (e) { showToast(e.message, "error"); }
  };
  window.cmRejectUI = (id) => {
    openM(`${mHead("Reject campaign")}
      ${F("Reason (vendor will see this)", `<textarea class="form-control" id="cmRejReason" rows="3" placeholder="e.g. Banner unclear / offer misleading"></textarea>`)}
      <button class="btn btn-danger" onclick="cmModerate('${id}','reject',{reason:document.getElementById('cmRejReason').value})">Reject campaign</button>`, "420px");
  };
  window.cmFeatureUI = (id) => {
    openM(`${mHead("⭐ Feature (sponsored slot)")}
      <p style="font-size:13px;color:#666;margin-top:0">Featured coupons appear in the homepage "Sponsored" row with a badge.</p>
      ${F("Feature for (days)", `<input class="form-control" id="cmFeatDays" type="number" value="7" min="1">`)}
      <button class="btn btn-primary" onclick="cmModerate('${id}','feature',{featuredDays:parseInt(document.getElementById('cmFeatDays').value)||7})">Feature now</button>`, "400px");
  };
  window.cmSpinToggle = async (id, inSpin) => {
    try { await API.put(`/coupons/admin/campaigns/${id}`, { inSpin }); showToast(inSpin ? "Added to spin wheel" : "Removed from spin", "success"); closeM(); loadAll(); }
    catch (e) { showToast(e.message, "error"); }
  };

  /* ════════ CATEGORIES & PRICING ════════ */
  function vCategories() {
    return `
      <div style="margin-bottom:12px"><button class="btn btn-primary" onclick="cmCatUI()">+ Add category</button></div>
      <div class="card" style="overflow:auto"><table class="table">
        <thead><tr><th></th><th>Name</th><th>Regions</th><th>Pack pricing</th><th>Status</th><th></th></tr></thead>
        <tbody>${categories.map((c) => `
          <tr>
            <td style="font-size:22px">${esc(c.icon)}</td>
            <td style="font-weight:700">${esc(c.name)}<br><span style="font-size:11px;color:#999">/${esc(c.slug)}</span></td>
            <td>${(c.regions || []).join(", ")}</td>
            <td style="font-size:12px">${(c.packs || []).map((p) => `<b>${p.claims}</b> → ₹${p.priceINR} / $${p.priceUSD}`).join("<br>") || '<span style="color:#bbb">no packs</span>'}</td>
            <td>${c.isActive ? stBadge("active") : stBadge("paused")}</td>
            <td><button class="btn btn-sm" onclick="cmCatUI('${c._id}')" style="font-size:11px">✏️ Edit</button></td>
          </tr>`).join("")}</tbody></table></div>`;
  }
  window.cmCatUI = (id) => {
    const c = id ? categories.find((x) => x._id === id) : null;
    const packs = c?.packs?.length ? c.packs : [{ claims: 100, priceINR: 999, priceUSD: 29 }, { claims: 500, priceINR: 3999, priceUSD: 119 }, { claims: 1000, priceINR: 6999, priceUSD: 199 }];
    window._cmPacks = JSON.parse(JSON.stringify(packs));
    openM(`
      ${mHead(c ? "Edit category" : "Add category")}
      <div style="display:grid;grid-template-columns:80px 1fr;gap:10px">
        ${F("Icon", `<input class="form-control" id="cmCatIcon" value="${esc(c?.icon || "🏷️")}">`)}
        ${F("Name", `<input class="form-control" id="cmCatName" value="${esc(c?.name || "")}" placeholder="e.g. Food & Drink">`)}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
        ${F("Regions", `<div style="display:flex;gap:12px;padding-top:8px">
          <label style="font-size:13px"><input type="checkbox" id="cmCatIN" ${!c || c.regions?.includes("IN") ? "checked" : ""}> 🇮🇳 IN</label>
          <label style="font-size:13px"><input type="checkbox" id="cmCatUS" ${!c || c.regions?.includes("US") ? "checked" : ""}> 🇺🇸 US</label></div>`)}
        ${F("Sort order", `<input class="form-control" id="cmCatSort" type="number" value="${c?.sortOrder ?? categories.length}">`)}
        ${F("Active", `<div style="padding-top:8px"><label style="font-size:13px"><input type="checkbox" id="cmCatActive" ${!c || c.isActive ? "checked" : ""}> Visible</label></div>`)}
      </div>
      <label style="font-size:12px;font-weight:600;color:#555">Pack pricing (coupons → price)</label>
      <div id="cmPackRows"></div>
      <button class="btn btn-sm" onclick="_cmPacks.push({claims:100,priceINR:0,priceUSD:0});cmDrawPacks()" style="font-size:11px;margin-top:6px">+ Add pack</button>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
        <button class="btn" onclick="closeM()">Cancel</button>
        <button class="btn btn-primary" onclick="cmCatSave('${id || ""}')">💾 Save</button>
      </div>`, "620px");
    window.cmDrawPacks();
  };
  window.cmDrawPacks = () => {
    document.getElementById("cmPackRows").innerHTML = window._cmPacks.map((p, i) => `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 40px;gap:8px;margin-top:6px">
        <input class="form-control" type="number" placeholder="coupons" value="${p.claims}" onchange="_cmPacks[${i}].claims=parseInt(this.value)||0">
        <input class="form-control" type="number" placeholder="₹ INR" value="${p.priceINR}" onchange="_cmPacks[${i}].priceINR=parseFloat(this.value)||0">
        <input class="form-control" type="number" placeholder="$ USD" value="${p.priceUSD}" onchange="_cmPacks[${i}].priceUSD=parseFloat(this.value)||0">
        <button class="btn btn-sm btn-danger" onclick="_cmPacks.splice(${i},1);cmDrawPacks()">×</button>
      </div>`).join("");
  };
  window.cmCatSave = async (id) => {
    const body = {
      name: document.getElementById("cmCatName").value.trim(),
      icon: document.getElementById("cmCatIcon").value.trim() || "🏷️",
      regions: [document.getElementById("cmCatIN").checked && "IN", document.getElementById("cmCatUS").checked && "US"].filter(Boolean),
      sortOrder: parseInt(document.getElementById("cmCatSort").value) || 0,
      isActive: document.getElementById("cmCatActive").checked,
      packs: window._cmPacks.filter((p) => p.claims > 0),
    };
    if (!body.name) { showToast("Name required", "error"); return; }
    try {
      if (id) await API.put(`/coupons/admin/categories/${id}`, body);
      else await API.post("/coupons/admin/categories", body);
      showToast("Saved", "success"); closeM(); loadAll();
    } catch (e) { showToast(e.message, "error"); }
  };

  /* ════════ VENDORS ════════ */
  function vVendors() {
    if (!vendors.length) return `<div class="empty-state"><div class="icon">🏪</div><p>No vendors yet</p></div>`;
    return `<div class="card" style="overflow:auto"><table class="table">
      <thead><tr><th>Business</th><th>Contact</th><th>Regions</th><th>Credits</th><th>Badge</th><th>Status</th><th></th></tr></thead>
      <tbody>${vendors.map((v) => `
        <tr>
          <td style="font-weight:700">${v.logo ? `<img src="${esc(IMG(v.logo))}" style="width:26px;height:26px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:6px">` : ""}${esc(v.businessName)}</td>
          <td style="font-size:12px">${esc(v.user?.name || "")}<br>${esc(v.user?.phone || v.user?.email || "")}</td>
          <td>${(v.regions || []).join(", ")}</td>
          <td>${(v.claimCredits || 0).toLocaleString()}</td>
          <td>${v.isVerifiedBadge ? "✔ Verified" : "—"}</td>
          <td>${stBadge(v.status)}</td>
          <td><button class="btn btn-sm" onclick="cmVendorUI('${v._id}')" style="font-size:11px">Manage</button></td>
        </tr>`).join("")}</tbody></table></div>`;
  }
  window.cmVendorUI = (id) => {
    const v = vendors.find((x) => x._id === id); if (!v) return;
    openM(`
      ${mHead("Manage vendor")}
      <p style="margin:0 0 12px;font-weight:800;font-size:16px">${esc(v.businessName)}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${F("Status", `<select class="form-control" id="cmVenStatus">
          ${["approved", "pending", "suspended"].map((s) => `<option value="${s}" ${v.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>`)}
        ${F("Claim credits", `<input class="form-control" id="cmVenCredits" type="number" value="${v.claimCredits || 0}">`)}
      </div>
      ${F("", `<label style="font-size:13px"><input type="checkbox" id="cmVenBadge" ${v.isVerifiedBadge ? "checked" : ""}> ✔ Verified badge (shows on cards)</label>`)}
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        <button class="btn" onclick="closeM()">Cancel</button>
        <button class="btn btn-primary" onclick="cmVenSave('${id}')">💾 Save</button>
      </div>`, "460px");
  };
  window.cmVenSave = async (id) => {
    try {
      await API.put(`/coupons/admin/vendors/${id}`, {
        status: document.getElementById("cmVenStatus").value,
        claimCredits: parseInt(document.getElementById("cmVenCredits").value) || 0,
        isVerifiedBadge: document.getElementById("cmVenBadge").checked,
      });
      showToast("Saved", "success"); closeM(); loadAll();
    } catch (e) { showToast(e.message, "error"); }
  };

  /* ════════ HOMEPAGE LAYOUT ════════ */
  const SEC_META = {
    top_strip: ["📢", "Announcement strip", "Thin colored bar at the very top"],
    hero_banner: ["🖼️", "Hero banners", "Big swipeable layout banners (connect any offer)"],
    banner_single: ["🖼️", "Single banner", "One full-width banner"],
    banner_grid: ["🔲", "Banner grid", "2-up / 3-up banner tiles"],
    category_rail: ["📁", "Category rail", "Auto: category pills"],
    sponsored: ["⭐", "Sponsored row", "Featured campaigns — or hand-pick them"],
    coupon_grid: ["🎟️", "Coupon grid", "Live coupons — auto query or hand-picked"],
    countdown_deal: ["⏳", "Countdown deals", "Ending-soon coupons with a timer"],
    brand_row: ["🏪", "Brands row", "Auto: vendor logos"],
  };
  const BANNER_TYPES = ["hero_banner", "banner_single", "banner_grid"];
  const COUPON_TYPES = ["sponsored", "coupon_grid", "countdown_deal"];
  const MULTI_BANNER = ["hero_banner", "banner_grid"];
  const SEC_SORTS = [["newest", "🆕 Newest first"], ["popular", "🔥 Most claimed"], ["ending", "⏳ Ending soon"], ["discount", "💰 Biggest discount"]];
  /* option sets — value → label. Values are the exact keys the API expects. */
  const OPTS = {
    cardStyle: [["ticket", "Ticket"], ["tile", "Tile 3:4"], ["list", "List rows"], ["compact", "Compact"]],
    columns: [[2, "2 across"], [3, "3 across"], [4, "4 across"], [5, "5 across"]],
    bg: [["white", "White"], ["band", "Soft band"], ["gradient", "Brand gradient"]],
    bannerStyle: [["plain", "Plain"], ["coupon", "Coupon ticket"], ["rounded", "Rounded"]],
    aspect: [["16:9", "Wide 16:9"], ["3:1", "Strip 3:1"], ["3:4", "Portrait 3:4"], ["1:1", "Square 1:1"]],
  };
  const VALS = (k) => OPTS[k].map((o) => o[0]);
  const GRAD = "linear-gradient(135deg,#EC1A74,#FF7A00)";
  const _bar = (w) => `<div style="height:3px;width:${w};background:#E9D5FF;border-radius:2px"></div>`;
  const _box = "border:1px solid #e4e4e4;border-radius:5px;background:#fff;overflow:hidden";
  function cardPreview(v) {
    if (v === "tile") return `<div style="width:30px;height:40px;${_box};display:flex;flex-direction:column">
        <div style="height:25px;background:${GRAD}"></div><div style="padding:3px;display:flex;flex-direction:column;gap:2px">${_bar("90%")}${_bar("55%")}</div></div>`;
    if (v === "list") return `<div style="width:54px;height:40px;${_box};padding:4px;display:flex;flex-direction:column;gap:5px">
        ${[0, 1].map(() => `<div style="display:flex;gap:4px;align-items:center"><div style="width:12px;height:12px;border-radius:3px;background:${GRAD}"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:2px">${_bar("100%")}${_bar("60%")}</div></div>`).join("")}</div>`;
    if (v === "compact") return `<div style="width:54px;height:40px;${_box};padding:5px;display:flex;flex-direction:column;gap:5px">${_bar("100%")}${_bar("75%")}${_bar("90%")}${_bar("50%")}</div>`;
    return `<div style="width:54px;height:40px;${_box};display:flex;flex-direction:column">
        <div style="height:17px;background:${GRAD}"></div>
        <div style="border-top:1px dashed #cbb6d8;padding:4px;display:flex;flex-direction:column;gap:3px">${_bar("85%")}${_bar("50%")}</div></div>`;
  }
  function colPreview(n) {
    return `<div style="width:54px;height:40px;${_box};padding:4px;display:flex;gap:3px;align-items:stretch">
        ${Array.from({ length: n }, () => `<div style="flex:1;background:${GRAD};opacity:.75;border-radius:2px"></div>`).join("")}</div>`;
  }
  function bgPreview(v) {
    const fill = v === "gradient" ? "linear-gradient(90deg,#EC1A74,#FF7A00,#FFB800)" : v === "band" ? "#F5F0FF" : "#fff";
    return `<div style="width:54px;height:40px;border:1px solid #e4e4e4;border-radius:5px;background:${fill};display:flex;align-items:center;justify-content:center">
        <div style="width:34px;height:20px;background:#fff;border:1px solid #e4e4e4;border-radius:4px;box-shadow:0 2px 6px rgba(0,0,0,.08)"></div></div>`;
  }
  function banPreview(v) {
    if (v === "coupon") return `<div style="position:relative;width:54px;height:40px;border:1px solid #e4e4e4;border-radius:8px;background:${GRAD};display:flex;align-items:center;justify-content:center">
        <div style="width:1px;height:70%;border-left:2px dashed #fff;opacity:.9"></div>
        <div style="position:absolute;left:-4px;top:50%;transform:translateY(-50%);width:8px;height:8px;border-radius:50%;background:#fff;border:1px solid #e4e4e4"></div>
        <div style="position:absolute;right:-4px;top:50%;transform:translateY(-50%);width:8px;height:8px;border-radius:50%;background:#fff;border:1px solid #e4e4e4"></div></div>`;
    return `<div style="width:54px;height:40px;background:${GRAD};border-radius:${v === "rounded" ? "12px" : "0"}"></div>`;
  }
  function aspPreview(v) {
    const dim = { "16:9": [52, 29], "3:1": [52, 17], "3:4": [24, 32], "1:1": [32, 32] }[v] || [52, 29];
    return `<div style="height:40px;display:flex;align-items:center;justify-content:center">
        <div style="width:${dim[0]}px;height:${dim[1]}px;background:${GRAD};border-radius:4px"></div></div>`;
  }
  const OPT_PREVIEW = { cardStyle: cardPreview, columns: colPreview, bg: bgPreview, bannerStyle: banPreview, aspect: aspPreview };
  function optBtns(k, val) {
    const prev = OPT_PREVIEW[k];
    return (OPTS[k] || []).map(([v, label]) => {
      const on = String(val) === String(v);
      const arg = typeof v === "number" ? v : `'${v}'`;
      return `<button type="button" class="btn btn-sm" title="${esc(label)}" onclick="cmSecPick('${k}',${arg})"
        style="display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px;padding:8px;min-width:74px;height:auto;
               border:2px solid ${on ? "#EC1A74" : "#e6e6e6"};background:${on ? "#FFF3F8" : "#fff"};border-radius:10px">
        ${prev ? prev(v) : ""}
        <span style="font-size:11px;font-weight:${on ? "700" : "500"};color:${on ? "#EC1A74" : "#666"}">${esc(label)}</span></button>`;
    }).join("");
  }
  const optGroup = (label, k, val) => F(label, `<div id="cmOpt_${k}" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">${optBtns(k, val)}</div>`);
  const secHead = (t) => `<div style="font-size:11px;font-weight:800;color:#aaa;letter-spacing:.08em;text-transform:uppercase;margin:14px 0 8px;border-top:1px solid #f0f0f0;padding-top:12px">${t}</div>`;
  /* normalise a stored data blob to the v2 contract (old rows have none of these keys) */
  function secNorm(t, raw) {
    const d = JSON.parse(JSON.stringify(raw || {}));
    const one = (k, dflt) => (VALS(k).includes(d[k]) ? d[k] : dflt);
    if (t === "top_strip") {
      return { text: d.text || "", link: d.link || "/coupons", bgColor: d.bgColor || "#7C3AED" };
    }
    if (BANNER_TYPES.includes(t)) {
      d.banners = Array.isArray(d.banners)
        ? d.banners.filter((b) => b && b.image).map((b) => ({ image: b.image || "", link: b.link || "", title: b.title || "", badge: b.badge || "" }))
        : [];
      if (!d.banners.length && d.image) d.banners = [{ image: d.image, link: d.link || "", title: d.title || "", badge: "" }];
      delete d.image; delete d.link; // legacy single-image keys now live inside banners[0]
      d.bannerStyle = one("bannerStyle", "rounded");
      d.aspect = one("aspect", "16:9");
      d.autoplay = MULTI_BANNER.includes(t) ? d.autoplay !== false : false;
      return d;
    }
    const lim = parseInt(d.limit, 10);
    d.limit = Number.isFinite(lim) && lim > 0 ? Math.min(30, lim) : 12;
    d.bg = one("bg", "white");
    if (!COUPON_TYPES.includes(t)) return d;
    d.source = d.source === "manual" ? "manual" : "auto";
    d.campaignIds = Array.isArray(d.campaignIds) ? d.campaignIds.map(String) : [];
    d.categoryId = d.categoryId || null;
    d.vendorId = d.vendorId || null;
    d.sort = SEC_SORTS.some((x) => x[0] === d.sort) ? d.sort : (t === "countdown_deal" ? "ending" : "newest");
    d.cardStyle = VALS("cardStyle").includes(d.cardStyle) ? d.cardStyle : (VALS("cardStyle").includes(d.style) ? d.style : "ticket");
    const col = parseInt(d.columns, 10);
    d.columns = [2, 3, 4, 5].includes(col) ? col : 3;
    return d;
  }
  const secSummary = (s) => {
    const d = s.data || {};
    if (s.type === "top_strip") return esc(d.text || "");
    if (BANNER_TYPES.includes(s.type)) {
      const n = (d.banners || []).length || (d.image ? 1 : 0);
      return `${n} banner(s) · ${esc(d.bannerStyle || "rounded")} · ${esc(d.aspect || "16:9")}`;
    }
    if (COUPON_TYPES.includes(s.type)) {
      const manual = d.source === "manual";
      const cat = categories.find((c) => c._id === d.categoryId);
      const ven = vendors.find((v) => v._id === d.vendorId);
      return [
        manual ? `✋ ${(d.campaignIds || []).length} hand-picked` : `⚙️ auto${cat ? " · " + esc(cat.name) : ""}${ven ? " · " + esc(ven.businessName) : ""} · top ${d.limit || 12}`,
        `${esc(d.cardStyle || d.style || "ticket")} · ${d.columns || 3} cols`,
      ].join(" · ");
    }
    return esc(s.title || "");
  };
  function vLayout() {
    return `
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
        ${Object.entries(SEC_META).map(([t, [ic, label]]) => `<button class="btn btn-sm" onclick="cmSecUI(null,'${t}')" style="font-size:11px">+ ${ic} ${label}</button>`).join("")}
      </div>
      ${!sections.length ? `<div class="empty-state"><div class="icon">🎨</div><p>No sections — add one above</p></div>` : `
      <div class="card">${sections.map((s, i) => {
        const [ic, label, hint] = SEC_META[s.type] || ["▫️", s.type, ""];
        const extra = secSummary(s);
        return `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid #f3f3f3">
          <div style="display:flex;flex-direction:column;gap:2px">
            <button class="btn btn-sm" style="padding:0 7px;font-size:10px" ${i === 0 ? "disabled" : ""} onclick="cmSecMove('${s._id}',-1)">▲</button>
            <button class="btn btn-sm" style="padding:0 7px;font-size:10px" ${i === sections.length - 1 ? "disabled" : ""} onclick="cmSecMove('${s._id}',1)">▼</button>
          </div>
          <span style="font-size:20px">${ic}</span>
          <div style="flex:1;min-width:0">
            <b style="font-size:13px">${label}</b> <span style="font-size:11px;color:#999">· ${(s.regions || []).join(", ")}${s.title ? " · " + esc(s.title) : ""}</span><br>
            <span style="font-size:12px;color:#888">${extra || hint}</span>
          </div>
          ${s.isActive ? stBadge("active") : stBadge("paused")}
          <button class="btn btn-sm" onclick="cmSecUI('${s._id}')" style="font-size:11px">✏️ Edit</button>
          <button class="btn btn-sm ${s.isActive ? "btn-warning" : "btn-primary"}" onclick="cmSecQuick('${s._id}',{isActive:${!s.isActive}})" style="font-size:11px">${s.isActive ? "Hide" : "Show"}</button>
          <button class="btn btn-sm btn-danger" onclick="cmSecDel('${s._id}')" style="font-size:11px">🗑️</button>
        </div>`;
      }).join("")}</div>`}`;
  }
  window.cmSecMove = async (id, dir) => {
    const idx = sections.findIndex((s) => s._id === id);
    const other = sections[idx + dir]; if (!other) return;
    try {
      await API.put(`/coupons/admin/sections/${id}`, { sortOrder: other.sortOrder });
      await API.put(`/coupons/admin/sections/${other._id}`, { sortOrder: sections[idx].sortOrder });
      loadAll();
    } catch (e) { showToast(e.message, "error"); }
  };
  window.cmSecQuick = async (id, body) => {
    try { await API.put(`/coupons/admin/sections/${id}`, body); loadAll(); } catch (e) { showToast(e.message, "error"); }
  };
  window.cmSecDel = async (id) => {
    if (!confirm("Delete this section?")) return;
    try { await API.delete(`/coupons/admin/sections/${id}`); showToast("Deleted", "success"); loadAll(); } catch (e) { showToast(e.message, "error"); }
  };

  window.cmSecUI = (id, newType) => {
    const s = id ? sections.find((x) => x._id === id) : { type: newType, title: "", data: newType === "top_strip" ? { text: "", link: "/coupons", bgColor: "#7C3AED" } : { limit: 12, banners: [] }, regions: ["IN", "US"], sortOrder: sections.length, isActive: true };
    const t = s.type;
    const [ic, label] = SEC_META[t] || ["▫️", t];
    window._cmSec = JSON.parse(JSON.stringify({ ...s, _isNew: !id }));
    let fields = "";
    if (t === "top_strip") {
      fields = F("Strip text", `<input class="form-control" id="cmSecText" value="${esc(s.data?.text || "")}" placeholder="🎉 New offers every day!">`) +
        `<div style="display:grid;grid-template-columns:1fr 120px;gap:10px">` +
        F("Link (tap goes to)", `<input class="form-control" id="cmSecLink" value="${esc(s.data?.link || "/coupons")}">`) +
        F("Color", `<input class="form-control" id="cmSecColor" type="color" value="${esc(s.data?.bgColor || "#7C3AED")}" style="height:38px;padding:2px">`) + `</div>`;
    } else if (t === "hero_banner" || t === "banner_single") {
      fields = `<label style="font-size:12px;font-weight:600;color:#555">Banners (upload an image, connect a link — coupon/brand/URL)</label><div id="cmSecBanners"></div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:8px">
          <input type="file" id="cmSecFile" accept="image/*" style="font-size:12px">
          <button class="btn btn-sm" onclick="cmSecUpload()" style="font-size:11px">⬆️ Upload & add</button>
        </div>`;
    } else {
      fields = `<div style="display:grid;grid-template-columns:1fr 120px;gap:10px">` +
        F("Section title (shown on page)", `<input class="form-control" id="cmSecTitle2" value="${esc(s.title || "")}">`) +
        F("Items limit", `<input class="form-control" id="cmSecLimit" type="number" value="${s.data?.limit || 12}">`) + `</div>`;
      if (t === "coupon_grid") {
        fields += F("Card style", `<select class="form-control" id="cmSecStyle">
          <option value="ticket" ${(s.data?.style || "ticket") === "ticket" ? "selected" : ""}>🎟️ Ticket (banner + logo)</option>
          <option value="tile" ${s.data?.style === "tile" ? "selected" : ""}>🃏 Tile (3:4 voucher grid)</option>
          <option value="list" ${s.data?.style === "list" ? "selected" : ""}>📋 Compact list rows</option>
        </select>`);
        fields += F("Only this category (optional)", `<select class="form-control" id="cmSecCat">
          <option value="">— All categories —</option>
          ${categories.map((c) => `<option value="${c._id}" ${s.data?.categoryId === c._id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>`);
      }
    }
    openM(`
      ${mHead(`${ic} ${label}`)}
      ${fields}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
        ${F("Regions", `<div style="display:flex;gap:12px;padding-top:6px">
          <label style="font-size:13px"><input type="checkbox" id="cmSecIN" ${s.regions?.includes("IN") ? "checked" : ""}> 🇮🇳 IN</label>
          <label style="font-size:13px"><input type="checkbox" id="cmSecUS" ${s.regions?.includes("US") ? "checked" : ""}> 🇺🇸 US</label></div>`)}
        ${F("Visible", `<div style="padding-top:6px"><label style="font-size:13px"><input type="checkbox" id="cmSecActive" ${s.isActive ? "checked" : ""}> Show on homepage</label></div>`)}
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        <button class="btn" onclick="closeM()">Cancel</button>
        <button class="btn btn-primary" onclick="cmSecSave('${id || ""}')">💾 Save section</button>
      </div>`, "600px");
    if (t === "hero_banner" || t === "banner_single") window.cmSecDrawBanners();
  };
  window.cmSecDrawBanners = () => {
    const box = document.getElementById("cmSecBanners"); if (!box) return;
    const banners = window._cmSec.data.banners || [];
    box.innerHTML = banners.length ? banners.map((b, i) => `
      <div style="display:flex;gap:10px;align-items:center;background:#FAFAFA;border-radius:8px;padding:8px;margin-top:6px">
        <img src="${esc(IMG(b.image))}" style="width:90px;height:38px;object-fit:cover;border-radius:6px">
        <input class="form-control" style="font-size:12px" placeholder="/c/coupon-slug or /brands/slug or https://…" value="${esc(b.link || "")}" onchange="_cmSec.data.banners[${i}].link=this.value">
        <button class="btn btn-sm btn-danger" onclick="_cmSec.data.banners.splice(${i},1);cmSecDrawBanners()">×</button>
      </div>`).join("") : `<p style="font-size:12px;color:#bbb;margin:6px 0">No banners yet</p>`;
  };
  window.cmSecUpload = async () => {
    const inp = document.getElementById("cmSecFile");
    const file = inp?.files?.[0];
    if (!file) { showToast("Choose an image first", "error"); return; }
    if (file.size > 8 * 1024 * 1024) { showToast("Image is too large — pick one under 8 MB", "error"); return; }
    try {
      const fd = new FormData(); fd.append("images", file);
      const r = await API.upload("/coupons/upload", fd);
      if (r.files?.[0]) {
        window._cmSec.data.banners = window._cmSec.data.banners || [];
        if (window._cmSec.type === "banner_single") window._cmSec.data.banners = [{ image: r.files[0], link: "" }];
        else window._cmSec.data.banners.push({ image: r.files[0], link: "" });
        inp.value = ""; window.cmSecDrawBanners();
      }
    } catch (e) { showToast(e.message, "error"); }
  };
  window.cmSecSave = async (id) => {
    const s = window._cmSec;
    const body = {
      type: s.type,
      title: document.getElementById("cmSecTitle2")?.value ?? s.title ?? "",
      regions: [document.getElementById("cmSecIN").checked && "IN", document.getElementById("cmSecUS").checked && "US"].filter(Boolean),
      isActive: document.getElementById("cmSecActive").checked,
      sortOrder: s.sortOrder,
      data: s.data || {},
    };
    if (s.type === "top_strip") {
      body.data = { text: document.getElementById("cmSecText").value, link: document.getElementById("cmSecLink").value, bgColor: document.getElementById("cmSecColor").value };
    } else if (["sponsored", "coupon_grid", "brand_row", "category_rail"].includes(s.type)) {
      body.data = { ...body.data, limit: parseInt(document.getElementById("cmSecLimit")?.value) || 12 };
      const styleSel = document.getElementById("cmSecStyle")?.value;
      if (styleSel) body.data.style = styleSel;
      const cat = document.getElementById("cmSecCat")?.value;
      if (cat !== undefined) { if (cat) body.data.categoryId = cat; else delete body.data.categoryId; }
    }
    try {
      if (id) await API.put(`/coupons/admin/sections/${id}`, body);
      else await API.post("/coupons/admin/sections", body);
      showToast("Layout saved", "success"); closeM(); loadAll();
    } catch (e) { showToast(e.message, "error"); }
  };

  /* ════════ SPIN & WIN ════════ */
  function vSpin() {
    const inSpin = campaigns.filter((c) => c.inSpin && c.status === "active");
    const eligible = campaigns.filter((c) => c.status === "active");
    return `
      <div class="card" style="padding:16px;margin-bottom:14px">
        <h3 style="margin:0 0 4px;font-size:15px">💳 Credit pricing (one list for everyone)</h3>
        <p style="margin:0 0 12px;font-size:12.5px;color:#777">
          Credits are a single product, not a per-category price. A brand buys credits and spends them
          on any coupon it runs. Edit the packs here and every vendor sees exactly these prices.
        </p>
        <div style="overflow:auto">
        <table class="table" style="margin-bottom:10px">
          <thead><tr><th>Credits</th><th>Price &#8377; (India)</th><th>Price $ (USA)</th><th>Label</th><th>Popular</th><th></th></tr></thead>
          <tbody id="cmPackRows"></tbody>
        </table>
        </div>
        <button class="btn" onclick="cmPackAdd()">+ Add pack</button>
        <button class="btn btn-primary" onclick="cmPacksSave()">&#128190; Save pricing</button>
      </div>
      <div class="card" style="padding:16px;margin-bottom:14px">
        <h3 style="margin:0 0 4px;font-size:15px">🎟️ Claim rules (whole marketplace)</h3>
        <p style="margin:0 0 12px;font-size:12.5px;color:#777">
          How many coupons ONE customer may take across every brand. This sits on top of each
          coupon's own per-user limit. Leave 0 for unlimited.
        </p>
        <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap">
          <label style="font-size:13px">Max per user / day:
            <input class="form-control" id="cmMaxDay" type="number" min="0" value="${spin.maxPerUserDay || 0}" style="width:90px;display:inline-block">
          </label>
          <label style="font-size:13px">Max unused coupons held:
            <input class="form-control" id="cmMaxActive" type="number" min="0" value="${spin.maxPerUserActive || 0}" style="width:90px;display:inline-block">
          </label>
          <button class="btn btn-primary" onclick="cmSpinSave()">💾 Save rules</button>
        </div>
        <p style="margin:10px 0 0;font-size:12px;color:#888">
          A coupon the customer already holds is never blocked by these — re-opening it always works.
        </p>
      </div>

      <div class="card" style="padding:16px;margin-bottom:14px">
        <h3 style="margin:0 0 10px;font-size:15px">🎡 Wheel settings</h3>
        <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap">
          <label style="font-size:14px;font-weight:600"><input type="checkbox" id="cmSpinOn" ${spin.enabled ? "checked" : ""}> Spin & Win enabled</label>
          <label style="font-size:13px">Cooldown: <input class="form-control" id="cmSpinCd" type="number" value="${spin.cooldownHours || 24}" style="width:80px;display:inline-block"> hours per user</label>
          <button class="btn btn-primary" onclick="cmSpinSave()">💾 Save</button>
          <span style="font-size:12px;color:#888">Wheel shows when ≥2 active campaigns are added below.</span>
        </div>
      </div>
      <div class="card" style="overflow:auto">
        <div style="padding:12px 16px;border-bottom:1px solid #f0f0f0"><b style="font-size:13px">Campaigns on the wheel (${inSpin.length})</b></div>
        <table class="table"><thead><tr><th>On wheel</th><th>Coupon</th><th>Vendor</th><th>Claims left</th></tr></thead>
        <tbody>${eligible.map((c) => `
          <tr>
            <td><input type="checkbox" ${c.inSpin ? "checked" : ""} onchange="cmSpinToggle('${c._id}',this.checked)"></td>
            <td><b style="color:#7C3AED">${esc(c.offerText)}</b> <span style="font-size:12px">${esc(c.title)}</span></td>
            <td>${esc(c.vendor?.businessName || "—")}</td>
            <td>${Math.max(0, c.totalQuota - c.claimedCount)}</td>
          </tr>`).join("") || `<tr><td colspan="4" style="text-align:center;color:#999;padding:20px">No active campaigns yet</td></tr>`}</tbody></table>
      </div>`;
  }
  /* ── Credit pricing editor (single list, no categories) ── */
  window.cmPackDraw = () => {
    const tb = document.getElementById("cmPackRows");
    if (!tb) return;
    tb.innerHTML = creditPacks.map((p, i) =>
      "<tr>" +
      "<td><input class='form-control' type='number' min='1' value='" + (p.claims || "") + "' onchange='cmPackSet(" + i + ",\"claims\",this.value)' style='width:110px'></td>" +
      "<td><input class='form-control' type='number' min='0' value='" + (p.priceINR || 0) + "' onchange='cmPackSet(" + i + ",\"priceINR\",this.value)' style='width:120px'></td>" +
      "<td><input class='form-control' type='number' min='0' value='" + (p.priceUSD || 0) + "' onchange='cmPackSet(" + i + ",\"priceUSD\",this.value)' style='width:120px'></td>" +
      "<td><input class='form-control' value='" + esc(p.label || "") + "' placeholder='Starter' onchange='cmPackSet(" + i + ",\"label\",this.value)' style='width:130px'></td>" +
      "<td style='text-align:center'><input type='checkbox' " + (p.popular ? "checked" : "") + " onchange='cmPackSet(" + i + ",\"popular\",this.checked)'></td>" +
      "<td><button class='btn btn-danger' onclick='cmPackDel(" + i + ")'>&#10005;</button></td>" +
      "</tr>"
    ).join("") || "<tr><td colspan='6' style='text-align:center;color:#999;padding:16px'>No packs yet — add one.</td></tr>";
  };
  window.cmPackSet = (i, k, v) => {
    if (!creditPacks[i]) return;
    creditPacks[i][k] = (k === "popular" || k === "label") ? v : Number(v);
  };
  window.cmPackAdd = () => {
    creditPacks.push({ claims: 100, priceINR: 999, priceUSD: 19, label: "", popular: false });
    cmPackDraw();
  };
  window.cmPackDel = (i) => { creditPacks.splice(i, 1); cmPackDraw(); };
  window.cmPacksSave = async () => {
    try {
      const r = await API.put("/coupons/admin/credit-packs", { packs: creditPacks });
      creditPacks = r.packs || creditPacks;
      showToast("Credit pricing saved", "success");
      cmPackDraw();
    } catch (e) { showToast(e.message, "error"); }
  };

  window.cmSpinSave = async () => {
    try {
      await API.put("/coupons/admin/spin-settings", {
        enabled: document.getElementById("cmSpinOn").checked,
        cooldownHours: parseInt(document.getElementById("cmSpinCd").value) || 24,
        maxPerUserDay: parseInt(document.getElementById("cmMaxDay").value) || 0,
        maxPerUserActive: parseInt(document.getElementById("cmMaxActive").value) || 0,
      });
      showToast("Settings saved", "success"); loadAll();
    } catch (e) { showToast(e.message, "error"); }
  };

  /* ════════ PACK ORDERS ════════ */
  function vPacks() {
    if (!packOrders.length) return `<div class="empty-state"><div class="icon">💳</div><p>No pack orders yet</p></div>`;
    return `<div class="card" style="overflow:auto"><table class="table">
      <thead><tr><th>Vendor</th><th>Category</th><th>Coupons</th><th>Price</th><th>Region</th><th>Date</th><th>Status</th><th></th></tr></thead>
      <tbody>${packOrders.map((o) => `
        <tr>
          <td style="font-weight:700">${esc(o.vendor?.businessName || "—")}<br><span style="font-size:11px;color:#888">${esc(o.vendor?.phone || o.vendor?.email || "")}</span></td>
          <td>${esc(o.category?.name || "—")}</td>
          <td>${o.claims.toLocaleString()}</td>
          <td><b>${o.currency === "USD" ? "$" : "₹"}${o.price.toLocaleString()}</b></td>
          <td>${o.region}</td>
          <td style="font-size:12px">${fdate(o.createdAt)}</td>
          <td>${stBadge(o.status)}</td>
          <td>${o.status === "pending" ? `<button class="btn btn-sm btn-primary" onclick="cmPackUI('${o._id}')" style="font-size:11px">Decide</button>` : (o.paymentRef ? `<span style="font-size:11px;color:#888">Ref: ${esc(o.paymentRef)}</span>` : "")}</td>
        </tr>`).join("")}</tbody></table></div>`;
  }
  window.cmPackUI = (id) => {
    const o = packOrders.find((x) => x._id === id); if (!o) return;
    openM(`
      ${mHead("Pack order")}
      <p style="font-size:14px"><b>${esc(o.vendor?.businessName)}</b> wants <b>${o.claims.toLocaleString()} coupons</b> (${esc(o.category?.name || "")}) for <b>${o.currency === "USD" ? "$" : "₹"}${o.price.toLocaleString()}</b>.</p>
      <p style="font-size:12px;color:#888">Marking paid instantly credits ${o.claims.toLocaleString()} coupon credits to the vendor.</p>
      ${F("Payment reference (UPI / txn id — optional)", `<input class="form-control" id="cmPackRef" placeholder="e.g. UPI 4123…">`)}
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-danger" onclick="cmPackDecide('${id}','reject')">✗ Reject</button>
        <button class="btn btn-primary" onclick="cmPackDecide('${id}','paid')">✓ Mark paid & credit</button>
      </div>`, "480px");
  };
  window.cmPackDecide = async (id, action) => {
    try {
      await API.post(`/coupons/admin/pack-orders/${id}/decide`, { action, paymentRef: document.getElementById("cmPackRef")?.value || "" });
      showToast("Done", "success"); closeM(); loadAll();
    } catch (e) { showToast(e.message, "error"); }
  };

  loadAll();
})();
