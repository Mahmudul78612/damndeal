(function(){
  requireAuth();
  document.body.innerHTML = pageShell('Subscription');
  buildLayout('subscription');
  const content = document.getElementById('page-content');

  async function load(){
    content.innerHTML = '<div class="text-center"><div class="spinner"></div></div>';
    try {
      const [subRes, plansRes, histRes] = await Promise.all([
        API.get('/partner/subscription').catch(()=>({})),
        API.get('/partner/subscription/plans').catch(()=>({plans:[]})),
        API.get('/partner/subscription/history').catch(()=>({subscriptions:[]}))
      ]);

      const current = subRes.subscription || null;
      const plans = plansRes.plans || [];
      const history = histRes.subscriptions || [];

      content.innerHTML = `
        <!-- Current subscription -->
        <div class="card mb-2">
          <div class="card-header"><h3>Current Subscription</h3></div>
          <div class="card-body">
            ${current ? `
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px">
                <div><strong>Plan:</strong> ${esc(current.plan?.name||'-')}</div>
                <div><strong>Status:</strong> ${statusBadge(current.status)}</div>
                <div><strong>Amount:</strong> ${fmtCurrency(current.amount||current.plan?.price)}</div>
                <div><strong>Duration:</strong> ${current.plan?.durationDays||'-'} days</div>
                <div><strong>Start:</strong> ${fmtDate(current.startDate)}</div>
                <div><strong>End:</strong> ${fmtDate(current.endDate)}</div>
              </div>
              ${current.plan?.features ? `
              <div class="mt-2" style="font-size:13px">
                <strong>Features:</strong>
                <ul style="margin:4px 0 0 16px;padding:0">
                  <li>Commission: ${current.plan.features.commissionPercent||0}%</li>
                  <li>Max Products: ${current.plan.features.maxProducts||'Unlimited'}</li>
                  <li>Featured Listing: ${current.plan.features.featuredListing?'✅':'❌'}</li>
                  <li>Priority Support: ${current.plan.features.prioritySupport?'✅':'❌'}</li>
                  <li>Analytics: ${current.plan.features.analyticsAccess?'✅':'❌'}</li>
                </ul>
              </div>` : ''}
            ` : '<p class="text-muted">No active subscription. Choose a plan below.</p>'}
          </div>
        </div>

        <!-- Available plans -->
        <div class="card mb-2">
          <div class="card-header"><h3>Available Plans</h3></div>
          <div class="card-body">
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px">
              ${plans.map(p=>`
                <div style="border:1px solid var(--border);border-radius:var(--radius);padding:16px;text-align:center${current?.plan?._id===p._id?' ;border-color:var(--primary);background:var(--primary-bg)':''}">
                  <h4 style="font-size:15px;margin-bottom:4px">${esc(p.name)}</h4>
                  <div style="font-size:22px;font-weight:700;color:var(--primary)">${fmtCurrency(p.price)}</div>
                  <div class="text-muted text-sm">${p.durationDays} days</div>
                  ${p.features ? `<ul style="text-align:left;font-size:12px;margin:10px 0 0 16px;padding:0;color:var(--text-light)">
                    <li>Commission: ${p.features.commissionPercent||0}%</li>
                    <li>Max Products: ${p.features.maxProducts||'∞'}</li>
                    ${p.features.featuredListing?'<li>✅ Featured Listing</li>':''}
                    ${p.features.prioritySupport?'<li>✅ Priority Support</li>':''}
                    ${p.features.analyticsAccess?'<li>✅ Analytics</li>':''}
                  </ul>` : ''}
                  <button class="btn btn-sm btn-primary mt-2" ${current?.plan?._id===p._id?'disabled':''}
                    onclick="subscribe('${p._id}')">${current?.plan?._id===p._id ? 'Current Plan' : 'Subscribe'}</button>
                </div>`).join('')||'<p class="text-muted">No plans available</p>'}
            </div>
          </div>
        </div>

        <!-- History -->
        <div class="card">
          <div class="card-header"><h3>Subscription History</h3></div>
          <div class="card-body table-wrap">
            <table>
              <thead><tr><th>Plan</th><th>Amount</th><th>Start</th><th>End</th><th>Status</th></tr></thead>
              <tbody>
                ${history.map(h=>`
                  <tr>
                    <td>${esc(h.plan?.name||'-')}</td>
                    <td>${fmtCurrency(h.amount||h.plan?.price)}</td>
                    <td>${fmtDate(h.startDate)}</td>
                    <td>${fmtDate(h.endDate)}</td>
                    <td>${statusBadge(h.status)}</td>
                  </tr>`).join('')||'<tr><td colspan="5" class="text-center text-muted">No history</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>`;
    } catch(e){ content.innerHTML = '<div class="empty-state"><p>'+esc(e.message)+'</p></div>'; }
  }

  window.subscribe = async function(planId){
    if (!confirm('Subscribe to this plan?')) return;
    try {
      await API.post('/partner/subscription/subscribe', { planId });
      showToast('Subscribed successfully!','success');
      load();
    } catch(e){ showToast(e.message,'error'); }
  };

  load();
})();
