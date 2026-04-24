(function(){
  requireAuth();
  document.body.innerHTML = pageShell('Analytics');
  buildLayout('analytics');

  var main = document.getElementById('page-content');

  async function load(){
    main.innerHTML = '<div class="text-center" style="padding:60px"><div class="spinner"></div></div>';
    try {
      var r = await API.get('/admin/analytics');
      if (!r.success) throw new Error(r.message||'Failed');
      render(r.analytics);
    } catch(e) {
      main.innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><p>'+esc(e.message)+'</p></div>';
      showToast(e.message,'error');
    }
  }

  function render(d){
    var o = d.overview;
    var t = d.today;
    var tm = d.thisMonth;
    var lm = d.lastMonth;
    var u = d.users;
    var del = d.delivery;
    var rc = d.returnCancel;

    var html = '<div style="max-width:1200px;margin:0 auto">';

    // ═══ Header ═══
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">'
      + '<div><h2 style="margin:0;font-size:1.4rem">📊 Analytics Dashboard</h2>'
      + '<p style="color:var(--text-light);font-size:13px;margin:4px 0 0">Marketing & decision-making insights</p></div>'
      + '<button class="btn btn-sm" onclick="location.reload()">🔄 Refresh</button></div>';

    // ═══ Quick Jump ═══
    var sections = ['Revenue','Today','Users','Top Products','Top Partners','Top Customers','Orders','Payments','Categories','Delivery','Coupons','Growth','Alerts'];
    html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px">';
    sections.forEach(function(s){ html += '<a href="#sec-'+s.toLowerCase().replace(/ /g,'-')+'" style="font-size:11px;padding:3px 10px;background:var(--bg);border:1px solid var(--border);border-radius:20px;text-decoration:none;color:var(--text)">'+s+'</a>'; });
    html += '</div>';

    // ═══ 1. Revenue Overview Cards ═══
    html += '<div id="sec-revenue" style="margin-bottom:24px"><h3 style="font-size:1rem;margin:0 0 12px">💰 Revenue Overview</h3>';
    html += '<div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">';
    html += statCard('Total Revenue', fc(o.totalRevenue), '📈', 'All orders received');
    html += statCard('Realized Revenue', fc(o.deliveredRevenue), '✅', 'After delivery');
    html += statCard('Pending Revenue', fc(o.pendingRevenue), '⏳', 'Not yet delivered');
    html += statCard('Total Orders', fmt(o.totalOrders), '🛒', 'Delivered: '+fmt(o.deliveredOrders));
    html += statCard('Avg Order Value', fc(o.avgOrderValue), '🎯', 'All time');
    html += statCard('Total Profit', fc(o.totalProfit), '💎', 'After delivery only');
    html += statCard('Platform Fees', fc(o.totalPlatformFee), '💳', 'Earned');
    html += statCard('Delivery Fees', fc(o.totalDeliveryFee), '🚚', 'Collected');
    html += statCard('Discounts Given', fc(o.totalDiscount + o.totalCouponDiscount), '🏷️', 'Total');
    html += '</div></div>';

    // ═══ 2. Today vs Yesterday ═══
    html += '<div id="sec-today" style="margin-bottom:24px"><h3 style="font-size:1rem;margin:0 0 12px">📅 Today vs Yesterday</h3>';
    html += '<div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">';
    html += statCard("Today's Revenue", fc(t.revenue), '💵', growthBadge(t.growthPercent));
    html += statCard("Today's Orders", fmt(t.orders), '📦', '');
    html += statCard("Today's AOV", fc(t.aov), '🎯', '');
    html += '</div></div>';

    // ═══ 3. Month Comparison ═══
    html += '<div style="margin-bottom:24px"><h3 style="font-size:1rem;margin:0 0 12px">📆 This Month vs Last Month</h3>';
    html += '<div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">';
    html += statCard('This Month Revenue', fc(tm.revenue), '📈', growthBadge(tm.revenueGrowth));
    html += statCard('This Month Orders', fmt(tm.orders), '🛒', growthBadge(tm.ordersGrowth));
    html += statCard('Last Month Revenue', fc(lm.revenue), '📉', '');
    html += statCard('This Month Profit', fc(tm.profit), '💎', '');
    html += '</div></div>';

    // ═══ 4. User Stats ═══
    html += '<div id="sec-users" style="margin-bottom:24px"><h3 style="font-size:1rem;margin:0 0 12px">👥 User Stats</h3>';
    html += '<div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">';
    html += statCard('Total Users', fmt(u.total), '👤', 'Active: '+fmt(u.active));
    html += statCard('Partners', fmt(u.partners), '🏪', 'Active: '+fmt(u.activePartners));
    html += statCard('Delivery Boys', fmt(u.deliveryBoys), '🚴', '');
    html += statCard('Repeat Rate', d.repeatCustomerRate+'%', '🔁', 'Repeat customers');
    html += statCard('Avg Rating', d.rating.avg+' ⭐', '⭐', fmt(d.rating.totalReviews)+' reviews');
    html += '</div></div>';

    // ═══ 5. Revenue Chart (last 30 days) ═══
    html += '<div class="card" style="margin-bottom:24px"><div class="card-header"><h3 style="margin:0;font-size:1rem">📈 Revenue Trend (Last 30 Days)</h3></div>'
      + '<div class="card-body" style="overflow-x:auto"><div id="revenueChart" style="height:200px;display:flex;align-items:flex-end;gap:3px;padding:12px 0"></div></div></div>';

    // ═══ 6. Top Products by Revenue ═══
    html += '<div id="sec-top-products" class="card" style="margin-bottom:24px"><div class="card-header"><h3 style="margin:0;font-size:1rem">🏆 Top 10 Products (by Revenue)</h3></div>'
      + '<div class="card-body table-wrap"><table class="table"><thead><tr><th>#</th><th>Product</th><th style="text-align:right">Revenue</th><th style="text-align:right">Qty Sold</th><th style="text-align:right">Orders</th></tr></thead><tbody>';
    (d.topProducts||[]).forEach(function(p,i){
      html += '<tr><td>'+(i+1)+'</td><td>'+esc(p.name||'Unknown')+'</td><td style="text-align:right;font-weight:600">'+fc(p.revenue)+'</td><td style="text-align:right">'+fmt(p.qty)+'</td><td style="text-align:right">'+fmt(p.orders)+'</td></tr>';
    });
    html += '</tbody></table></div></div>';

    // ═══ 7. Top Products by Quantity ═══
    html += '<div class="card" style="margin-bottom:24px"><div class="card-header"><h3 style="margin:0;font-size:1rem">📦 Top 10 Products (by Quantity)</h3></div>'
      + '<div class="card-body table-wrap"><table class="table"><thead><tr><th>#</th><th>Product</th><th style="text-align:right">Qty Sold</th><th style="text-align:right">Revenue</th></tr></thead><tbody>';
    (d.topProductsByQty||[]).forEach(function(p,i){
      html += '<tr><td>'+(i+1)+'</td><td>'+esc(p.name||'Unknown')+'</td><td style="text-align:right;font-weight:600">'+fmt(p.qty)+'</td><td style="text-align:right">'+fc(p.revenue)+'</td></tr>';
    });
    html += '</tbody></table></div></div>';

    // ═══ 8. Top Partners ═══
    html += '<div id="sec-top-partners" class="card" style="margin-bottom:24px"><div class="card-header"><h3 style="margin:0;font-size:1rem">🏪 Top 10 Partners (by Revenue)</h3></div>'
      + '<div class="card-body table-wrap"><table class="table"><thead><tr><th>#</th><th>Partner</th><th>Phone</th><th style="text-align:right">Revenue</th><th style="text-align:right">Orders</th><th style="text-align:right">Avg Order</th></tr></thead><tbody>';
    (d.topPartners||[]).forEach(function(p,i){
      html += '<tr><td>'+(i+1)+'</td><td>'+esc(p.name||'N/A')+'</td><td>'+esc(p.phone||'-')+'</td><td style="text-align:right;font-weight:600">'+fc(p.revenue)+'</td><td style="text-align:right">'+fmt(p.orders)+'</td><td style="text-align:right">'+fc(Math.round(p.avgOrder||0))+'</td></tr>';
    });
    html += '</tbody></table></div></div>';

    // ═══ 9. Top Customers ═══
    html += '<div id="sec-top-customers" class="card" style="margin-bottom:24px"><div class="card-header"><h3 style="margin:0;font-size:1rem">👑 Top 10 Customers (by Spend)</h3></div>'
      + '<div class="card-body table-wrap"><table class="table"><thead><tr><th>#</th><th>Customer</th><th>Phone</th><th style="text-align:right">Total Spent</th><th style="text-align:right">Orders</th><th style="text-align:right">Avg Order</th></tr></thead><tbody>';
    (d.topCustomers||[]).forEach(function(c,i){
      html += '<tr><td>'+(i+1)+'</td><td>'+esc(c.name||'N/A')+'</td><td>'+esc(c.phone||'-')+'</td><td style="text-align:right;font-weight:600">'+fc(c.spent)+'</td><td style="text-align:right">'+fmt(c.orders)+'</td><td style="text-align:right">'+fc(Math.round(c.avgOrder||0))+'</td></tr>';
    });
    html += '</tbody></table></div></div>';

    // ═══ 10. Order Status Distribution ═══
    html += '<div id="sec-orders" style="margin-bottom:24px"><h3 style="font-size:1rem;margin:0 0 12px">📋 Order Status Distribution</h3>';
    html += '<div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">';
    (d.orderStatusDist||[]).forEach(function(s){
      html += statCard(ucfirst(s._id||'Unknown'), fmt(s.count), statusIcon(s._id), fc(s.revenue));
    });
    html += '</div></div>';

    // ═══ 11. Payment Methods ═══
    html += '<div id="sec-payments" style="margin-bottom:24px"><h3 style="font-size:1rem;margin:0 0 12px">💳 Payment Methods</h3>';
    html += '<div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">';
    (d.paymentMethods||[]).forEach(function(p){
      html += statCard(ucfirst(p._id||'Unknown'), fc(p.revenue), payIcon(p._id), fmt(p.count)+' orders');
    });
    html += '</div></div>';

    // ═══ 12. Order Sources ═══
    html += '<div style="margin-bottom:24px"><h3 style="font-size:1rem;margin:0 0 12px">📱 Order Sources</h3>';
    html += '<div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">';
    (d.orderSources||[]).forEach(function(s){
      html += statCard(ucfirst(s._id||'Unknown'), fc(s.revenue), sourceIcon(s._id), fmt(s.count)+' orders');
    });
    html += '</div></div>';

    // ═══ 13. Category-wise Revenue ═══
    html += '<div id="sec-categories" class="card" style="margin-bottom:24px"><div class="card-header"><h3 style="margin:0;font-size:1rem">📁 Category-wise Revenue</h3></div>'
      + '<div class="card-body table-wrap"><table class="table"><thead><tr><th>#</th><th>Category</th><th style="text-align:right">Revenue</th><th style="text-align:right">Qty Sold</th><th>Share</th></tr></thead><tbody>';
    var catTotal = (d.categoryRevenue||[]).reduce(function(s,c){ return s+c.revenue; },0);
    (d.categoryRevenue||[]).forEach(function(c,i){
      var pct = catTotal ? ((c.revenue/catTotal)*100).toFixed(1) : 0;
      html += '<tr><td>'+(i+1)+'</td><td>'+esc(c._id||'Unknown')+'</td><td style="text-align:right;font-weight:600">'+fc(c.revenue)+'</td><td style="text-align:right">'+fmt(c.qty)+'</td>'
        + '<td><div style="display:flex;align-items:center;gap:6px"><div style="width:80px;height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden"><div style="width:'+pct+'%;height:100%;background:var(--primary);border-radius:4px"></div></div><span style="font-size:11px">'+pct+'%</span></div></td></tr>';
    });
    html += '</tbody></table></div></div>';

    // ═══ 14. Delivery Metrics ═══
    html += '<div id="sec-delivery" style="margin-bottom:24px"><h3 style="font-size:1rem;margin:0 0 12px">🚚 Delivery Performance</h3>';
    html += '<div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">';
    html += statCard('Avg Delivery Time', del.avgMinutes+' min', '⏱️', '');
    html += statCard('Avg Distance', del.avgDistanceKm+' km', '📍', '');
    html += statCard('Total Delivered', fmt(del.totalDelivered), '✅', '');
    html += statCard('Cancel Rate', rc.cancelRate+'%', '❌', fmt(rc.cancelled)+' cancelled');
    html += statCard('Return Rate', rc.returnRate+'%', '↩️', fmt(rc.returned)+' returned');
    html += '</div></div>';

    // ═══ 15. Coupon Stats ═══
    html += '<div id="sec-coupons" style="margin-bottom:24px"><h3 style="font-size:1rem;margin:0 0 12px">🎟️ Coupon Performance</h3>';
    html += '<div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">';
    html += statCard('Coupon Uses', fmt(d.coupon.totalUsages), '🎟️', '');
    html += statCard('Discount Given', fc(d.coupon.totalDiscount), '💸', 'Via coupons');
    html += '</div></div>';

    // ═══ 16. Peak Hours ═══
    html += '<div style="margin-bottom:24px"><h3 style="font-size:1rem;margin:0 0 12px">🕐 Peak Order Hours (Last 30 Days)</h3>';
    html += '<div class="card"><div class="card-body" style="overflow-x:auto"><div id="hourChart" style="height:160px;display:flex;align-items:flex-end;gap:4px;padding:12px 0"></div></div></div></div>';

    // ═══ 17. User & Partner Growth ═══
    html += '<div id="sec-growth" style="margin-bottom:24px"><h3 style="font-size:1rem;margin:0 0 12px">📈 Growth (Last 30 Days)</h3>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">';
    html += '<div class="card"><div class="card-header"><h4 style="margin:0;font-size:13px">👤 New Users/Day</h4></div><div class="card-body" style="overflow-x:auto"><div id="userGrowthChart" style="height:140px;display:flex;align-items:flex-end;gap:2px;padding:8px 0"></div></div></div>';
    html += '<div class="card"><div class="card-header"><h4 style="margin:0;font-size:13px">🏪 New Partners/Day</h4></div><div class="card-body" style="overflow-x:auto"><div id="partnerGrowthChart" style="height:140px;display:flex;align-items:flex-end;gap:2px;padding:8px 0"></div></div></div>';
    html += '</div></div>';

    // ═══ 18. AOV Trend ═══
    html += '<div class="card" style="margin-bottom:24px"><div class="card-header"><h3 style="margin:0;font-size:1rem">🎯 Avg Order Value Trend (Last 30 Days)</h3></div>'
      + '<div class="card-body" style="overflow-x:auto"><div id="aovChart" style="height:160px;display:flex;align-items:flex-end;gap:3px;padding:12px 0"></div></div></div>';

    // ═══ 19. Low Stock Alerts ═══
    html += '<div id="sec-alerts" class="card" style="margin-bottom:24px"><div class="card-header" style="background:#FEF2F2"><h3 style="margin:0;font-size:1rem;color:#DC2626">⚠️ Low Stock Alerts</h3></div>'
      + '<div class="card-body table-wrap"><table class="table"><thead><tr><th>Product</th><th>Partner</th><th style="text-align:right">Stock</th><th style="text-align:right">Threshold</th></tr></thead><tbody>';
    if ((d.lowStockProducts||[]).length===0) html += '<tr><td colspan="4" class="text-center" style="color:var(--text-light)">All products well stocked! 🎉</td></tr>';
    else (d.lowStockProducts||[]).forEach(function(p){
      var danger = p.stock === 0 ? 'color:#DC2626;font-weight:700' : p.stock <= 3 ? 'color:#F59E0B;font-weight:600' : '';
      html += '<tr><td>'+esc(p.name)+'</td><td>'+esc(p.partner?.name||'-')+'</td><td style="text-align:right;'+danger+'">'+p.stock+'</td><td style="text-align:right">'+p.lowStockThreshold+'</td></tr>';
    });
    html += '</tbody></table></div></div>';

    html += '</div>';
    main.innerHTML = html;

    // ═══ Draw Charts ═══
    drawBarChart('revenueChart', d.revenueByDay, '_id', 'revenue', '#4F46E5', true);
    drawBarChart('hourChart', d.revenueByHour, '_id', 'orders', '#10B981', false, function(v){ return v+'h'; });
    drawBarChart('userGrowthChart', d.userGrowth, '_id', 'count', '#6366F1', false);
    drawBarChart('partnerGrowthChart', d.partnerGrowth, '_id', 'count', '#F59E0B', false);
    drawBarChart('aovChart', d.aovTrend, '_id', 'aov', '#EC4899', true);
  }

  // ═══ Helpers ═══
  function fc(n){ return fmtCurrency(n); }
  function fmt(n){ return n!=null ? Number(n).toLocaleString('en-IN') : '0'; }

  function statCard(label, value, icon, sub){
    return '<div class="stat-card" style="padding:16px;position:relative">'
      + '<div style="position:absolute;top:12px;right:14px;font-size:1.6rem;opacity:.3">'+icon+'</div>'
      + '<div class="label" style="font-size:11px;color:var(--text-light);margin-bottom:4px">'+esc(label)+'</div>'
      + '<div class="value" style="font-size:1.3rem;font-weight:700">'+value+'</div>'
      + (sub ? '<div style="font-size:11px;color:var(--text-light);margin-top:4px">'+sub+'</div>' : '')
      + '</div>';
  }

  function growthBadge(pct){
    if (pct==null||pct===0) return '<span style="font-size:11px;color:#888">—</span>';
    var up = pct > 0;
    return '<span style="font-size:11px;font-weight:600;color:'+(up?'#10B981':'#EF4444')+'">'+(up?'▲':'▼')+' '+Math.abs(pct)+'%</span>';
  }

  function ucfirst(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1) : ''; }
  function statusIcon(s){
    var m = {placed:'📝',confirmed:'✅',processing:'⚙️',ready:'📦',shipped:'🚚',delivered:'✅',cancelled:'❌',returned:'↩️'};
    return m[s]||'📋';
  }
  function payIcon(s){
    var m = {cash:'💵',upi:'📲',card:'💳',online:'🌐',cod:'💰',credit:'🏦'};
    return m[s]||'💳';
  }
  function sourceIcon(s){
    var m = {app:'📱',pos:'🖥️',web:'🌐'};
    return m[s]||'📱';
  }

  function drawBarChart(containerId, data, labelKey, valKey, color, isDate, labelFn){
    var el = document.getElementById(containerId);
    if (!el || !data || !data.length) return;
    var max = Math.max.apply(null, data.map(function(d){ return d[valKey]||0; }));
    if (max === 0) max = 1;
    var html = '';
    data.forEach(function(item){
      var v = item[valKey] || 0;
      var h = Math.max(4, (v/max)*100);
      var label = labelFn ? labelFn(item[labelKey]) : item[labelKey];
      if (isDate && typeof label === 'string' && label.length > 5) label = label.substring(5);
      var valStr = v >= 1000 ? (v/1000).toFixed(v>=10000?0:1)+'k' : Math.round(v);
      html += '<div style="flex:1;min-width:16px;max-width:36px;display:flex;flex-direction:column;align-items:center;gap:2px">'
        + '<span style="font-size:9px;color:var(--text-light)">'+valStr+'</span>'
        + '<div style="width:100%;height:'+h+'%;background:'+color+';border-radius:3px 3px 0 0;min-height:4px" title="'+esc(String(item[labelKey]))+': '+v+'"></div>'
        + '<span style="font-size:8px;color:var(--text-light);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">'+esc(String(label||''))+'</span>'
        + '</div>';
    });
    el.innerHTML = html;
  }

  load();
})();
