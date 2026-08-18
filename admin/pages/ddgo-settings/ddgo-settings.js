(function(){
  requireAuth();
  document.body.innerHTML = pageShell('Quick Commerce Settings');
  buildLayout('ddgo-settings');

  const main = document.getElementById('page-content');

  /* ── DDGO-specific settings keys ── */
  const DDGO_KEYS = [
    { key: 'ddgo_enabled',             label: 'Show the DDGo tab',                desc: 'Type true to show the DamnDeal / DDGo tabs on the site. Keep it off until stores are stocked.', type: 'text', icon: '🟢' },
    { key: 'ddgo_min_order_amount',    label: 'Minimum Order Value (₹)',          desc: 'Orders below this amount will be blocked',       type: 'number', icon: '🛒' },
    { key: 'ddgo_delivery_fee',        label: 'Base Delivery Fee (₹)',            desc: 'Fixed delivery charge added to each order',       type: 'number', icon: '🚚' },
    { key: 'ddgo_delivery_fee_per_km', label: 'Delivery Fee Per KM (₹)',          desc: 'Extra charge per kilometer distance',             type: 'number', icon: '📏' },
    { key: 'ddgo_free_delivery_above', label: 'Free Delivery Above (₹)',          desc: 'Delivery is free for orders above this amount',   type: 'number', icon: '🎁' },
    { key: 'ddgo_platform_fee',        label: 'Platform Fee (₹)',                 desc: 'Platform service charge per order',               type: 'number', icon: '💳' },
    { key: 'ddgo_max_delivery_radius', label: 'Max Delivery Radius (KM)',         desc: 'Orders beyond this radius will be rejected',      type: 'number', icon: '📍' },
  ];

  let settings = {};

  /* ── Load all settings from backend ── */
  async function load(){
    main.innerHTML = '<div class="text-center" style="padding:60px"><div class="spinner"></div></div>';
    try {
      const r = await API.get('/admin/settings');
      const arr = r.data || r.settings || r || [];
      settings = {};
      if (Array.isArray(arr)) {
        arr.forEach(function(s){ settings[s.key] = s.value; });
      }
    } catch(e) {
      showToast(e.message, 'error');
      settings = {};
    }
    render();
  }

  /* ── Render ── */
  function render(){
    main.innerHTML =
      '<div style="max-width:780px;margin:0 auto">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">'
      + '<div>'
      + '<h2 style="margin:0;font-size:1.3rem;display:flex;align-items:center;gap:8px"><span style="font-size:1.6rem">🟢</span> Quick Commerce Settings</h2>'
      + '<p style="color:var(--text-light);font-size:13px;margin:4px 0 0">Configure delivery charges, minimum order value, and platform fees for Quick Commerce</p>'
      + '</div>'
      + '<button class="btn btn-primary" id="btnSave">💾 Save All</button>'
      + '</div>'

      // Settings cards
      + DDGO_KEYS.map(function(cfg){
          var val = settings[cfg.key];
          if (val === undefined || val === null) val = '';
          return '<div class="card" style="margin-bottom:16px">'
            + '<div class="card-body" style="display:flex;align-items:center;gap:16px">'
            + '<div style="font-size:2rem;width:48px;text-align:center">'+cfg.icon+'</div>'
            + '<div style="flex:1">'
            + '<div style="font-weight:600;font-size:14px;margin-bottom:2px">'+esc(cfg.label)+'</div>'
            + '<div style="font-size:12px;color:var(--text-light)">'+esc(cfg.desc)+'</div>'
            + '<div style="font-size:11px;color:var(--text-light);margin-top:2px"><code>'+esc(cfg.key)+'</code></div>'
            + '</div>'
            + '<div style="width:150px">'
            + '<input class="form-control" id="f_'+cfg.key+'" type="'+cfg.type+'" value="'+esc(String(val))+'" '
            + 'style="text-align:right;font-size:16px;font-weight:600;padding:10px 14px" min="0" step="any">'
            + '</div>'
            + '</div></div>';
        }).join('')

      // Info card
      + '<div class="card" style="background:#F0FDF4;border-color:#BBF7D0">'
      + '<div class="card-body" style="font-size:13px;color:#166534">'
      + '<strong>ℹ️ How it works:</strong><br>'
      + '• <strong>Minimum Order Value</strong> — Users cannot place a DDGO order below this amount.<br>'
      + '• <strong>Base Delivery Fee</strong> — Flat charge for every delivery. Per KM charge is added on top.<br>'
      + '• <strong>Free Delivery Above</strong> — If order total exceeds this, delivery fee = ₹0. Set 0 to disable.<br>'
      + '• <strong>Platform Fee</strong> — Service fee charged per order (shown in checkout).<br>'
      + '• <strong>Max Delivery Radius</strong> — Orders from addresses beyond this distance will be rejected.'
      + '</div></div>'

      + '</div>';

    document.getElementById('btnSave').addEventListener('click', saveAll);
  }

  /* ── Save all settings ── */
  async function saveAll(){
    var btn = document.getElementById('btnSave');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    var success = 0;
    var fail = 0;

    for (var i = 0; i < DDGO_KEYS.length; i++) {
      var cfg = DDGO_KEYS[i];
      var input = document.getElementById('f_'+cfg.key);
      var val = input.value.trim();
      if (val === '') continue;

      // Not every setting on this page is a number any more — the DDGo
      // on/off switch is a plain value, and forcing it through parseFloat
      // would reject it as invalid.
      var outVal = val;
      if (cfg.type === 'number') {
        var numVal = parseFloat(val);
        if (isNaN(numVal) || numVal < 0) {
          showToast(cfg.label + ' must be a valid positive number', 'error');
          input.focus();
          btn.disabled = false;
          btn.textContent = '💾 Save All';
          return;
        }
        outVal = numVal;
      }

      try {
        await API.put('/admin/settings/' + encodeURIComponent(cfg.key), { value: outVal });
        success++;
      } catch(e) {
        fail++;
        showToast('Failed to save ' + cfg.label + ': ' + e.message, 'error');
      }
    }

    btn.disabled = false;
    btn.textContent = '💾 Save All';

    if (fail === 0) {
      showToast('All DDGO settings saved successfully!', 'success');
    } else {
      showToast(success + ' saved, ' + fail + ' failed', 'error');
    }
    load();
  }

  function esc(s){ var d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

  load();
})();
