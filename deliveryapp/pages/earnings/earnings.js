(function(){
  if(!requireAuth()) return;

  document.body.innerHTML = appShell('earnings');
  const $page = document.getElementById('pageContent');

  loadOnlineStatus();

  let period = 'week'; // week | month | all

  async function load(){
    $page.innerHTML = '<div class="text-center mt-2"><span class="spinner"></span></div>';
    try{
      let qs = '';
      if(period==='week'){
        const d = new Date(); d.setDate(d.getDate()-7);
        qs = '?from='+d.toISOString().slice(0,10);
      } else if(period==='month'){
        const d = new Date(); d.setDate(d.getDate()-30);
        qs = '?from='+d.toISOString().slice(0,10);
      }
      const data = await API.get('/delivery/earnings'+qs);
      render(data);
    }catch(e){
      $page.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>${esc(e.message)}</p></div>`;
    }
  }

  function render(d){
    const rating = d.rating ? d.rating.toFixed(1) : '—';
    const stars = d.rating ? '⭐'.repeat(Math.round(d.rating)) : '';

    $page.innerHTML = `
      <!-- Period Tabs -->
      <div style="display:flex;gap:6px;margin-bottom:14px">
        <button class="btn btn-sm ${period==='week'?'btn-primary':'btn-outline'}" onclick="setPeriod('week')">This Week</button>
        <button class="btn btn-sm ${period==='month'?'btn-primary':'btn-outline'}" onclick="setPeriod('month')">This Month</button>
        <button class="btn btn-sm ${period==='all'?'btn-primary':'btn-outline'}" onclick="setPeriod('all')">All Time</button>
      </div>

      <!-- Total Earnings Card -->
      <div class="card" style="background:linear-gradient(135deg,var(--primary-dark),var(--primary));color:#fff;border:none">
        <div class="card-body text-center" style="padding:20px">
          <div style="font-size:11px;opacity:.7;margin-bottom:2px">Total Earnings</div>
          <div style="font-size:32px;font-weight:800">${fmtCurrency(d.totalEarnings||0)}</div>
          <div style="font-size:13px;margin-top:6px;opacity:.8">${d.totalDeliveries||0} Total Deliveries</div>
        </div>
      </div>

      <!-- Stats Row -->
      <div class="stat-row-3">
        <div class="stat-card">
          <div class="label">Deliveries</div>
          <div class="value">${d.period?.deliveries??d.totalDeliveries??0}</div>
        </div>
        <div class="stat-card">
          <div class="label">COD Collected</div>
          <div class="value" style="font-size:16px">${fmtCurrency(d.period?.codCollected||0)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Rating</div>
          <div class="value" style="font-size:16px">${rating} ${stars?'<span style="font-size:12px">'+stars+'</span>':''}</div>
          <div class="sub">${d.ratingCount||0} reviews</div>
        </div>
      </div>

      <!-- Daily Breakdown -->
      <div class="card">
        <div class="card-header"><h3>Daily Breakdown</h3></div>
        <div class="card-body" style="padding:8px 14px" id="dailyList">
          ${renderDaily(d.daily||[])}
        </div>
      </div>
    `;
  }

  function renderDaily(daily){
    if(!daily.length) return '<div class="empty-state" style="padding:20px"><div class="icon">📊</div><p>No data yet</p></div>';
    return daily.map(day=>{
      const dateStr = day._id || day.date || '';
      const dt = dateStr ? new Date(dateStr) : null;
      const formatted = dt ? dt.toLocaleDateString('en-IN',{weekday:'short',day:'2-digit',month:'short'}) : dateStr;
      return `<div class="earning-day">
        <span class="date">${esc(formatted)}</span>
        <span>
          <span class="text-sm text-muted">${day.deliveries||0} deliveries</span>
          ${day.earnings ? ` · <span class="amt">${fmtCurrency(day.earnings)}</span>` : ''}
        </span>
      </div>`;
    }).join('');
  }

  window.setPeriod = function(p){ period=p; load(); };

  load();
})();
