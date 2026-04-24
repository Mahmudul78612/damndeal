(function(){
  requireAuth();
  document.body.innerHTML = pageShell('Platform Settings');
  buildLayout('settings');

  var main = document.getElementById('page-content');

  /* ══════════════════════════════════════════════
     SETTINGS SCHEMA — grouped, typed, with icons
     ══════════════════════════════════════════════ */
  var GROUPS = [
    {
      group: '🛡️ App Control',
      desc: 'Force update, maintenance mode, app version management',
      fields: [
        { key: 'app_maintenance',         label: 'Maintenance Mode',               type: 'toggle', icon: '🔧', desc: 'Enable to show "Under maintenance" screen in app' },
        { key: 'maintenance_message',     label: 'Maintenance Message',            type: 'text',   icon: '💬', desc: 'Message shown when maintenance mode is on' },
        { key: 'force_update_enabled',    label: 'Force Update',                   type: 'toggle', icon: '🔄', desc: 'Force users to update the app to latest version' },
        { key: 'app_min_version_android', label: 'Min App Version (Android)',      type: 'text',   icon: '🤖', desc: 'Minimum Android version allowed (e.g. 1.2.0)' },
        { key: 'app_min_version_ios',     label: 'Min App Version (iOS)',          type: 'text',   icon: '🍎', desc: 'Minimum iOS version allowed (e.g. 1.2.0)' },
        { key: 'app_store_url',           label: 'App Store URL',                  type: 'text',   icon: '📱', desc: 'Apple App Store link for force update' },
        { key: 'play_store_url',          label: 'Play Store URL',                 type: 'text',   icon: '▶️', desc: 'Google Play Store link for force update' },
      ]
    },
    {
      group: '🎨 Branding & Appearance',
      desc: 'App bar colors, dark mode, brand colors',
      fields: [
        { key: 'brand_primary_color',     label: 'Primary Brand Color',            type: 'color',  icon: '🎨', desc: 'Main brand color (AppBar, buttons etc.)' },
        { key: 'brand_accent_color',      label: 'Accent Color',                   type: 'color',  icon: '✨', desc: 'Secondary color for highlights' },
        { key: 'ddgo_brand_color',        label: 'Quick Commerce Brand Color',     type: 'color',  icon: '🟢', desc: 'Quick Commerce section color (default: #0D7A30)' },
        { key: 'app_bar_color_light',     label: 'AppBar Color (Light Mode)',      type: 'color',  icon: '☀️', desc: 'App bar background for light theme' },
        { key: 'app_bar_color_dark',      label: 'AppBar Color (Dark Mode)',       type: 'color',  icon: '🌙', desc: 'App bar background for dark theme' },
        { key: 'app_bar_bg_image',        label: 'AppBar Background Image',        type: 'image',  icon: '🖼️', desc: 'Upload image for app header area (fades at bottom). Leave empty to use color gradient.' },
        { key: 'category_heading_color',  label: 'Category Heading Color',         type: 'color',  icon: '🏷️', desc: 'Color for "Shop by Category" heading text' },
        { key: 'category_text_color',     label: 'Category Text Color',            type: 'color',  icon: '🔤', desc: 'Color for category name labels below icons' },
        { key: 'category_bg_color',       label: 'Category Tile Background',       type: 'color',  icon: '🟪', desc: 'Background color for category icon tiles' },
        { key: 'dark_mode_enabled',       label: 'Dark Mode Support',              type: 'toggle', icon: '🌓', desc: 'Allow users to switch to dark mode' },
      ]
    },
    {
      group: '🚚 Delivery & Fees',
      desc: 'Delivery charges, radius, platform fees',
      fields: [
        { key: 'delivery_fee',            label: 'Delivery Fee Below Threshold (₹)', type: 'number', icon: '🚚', desc: 'Charge if order is BELOW the free-delivery amount. Set 0 to make all orders free.' },
        { key: 'delivery_fee_per_km',     label: 'Per KM Fee (₹)',                type: 'number', icon: '📏', desc: 'Extra charge per kilometer (only used when distance is known). Set 0 for flat rate.' },
        { key: 'free_delivery_above',     label: 'Free Delivery Above (₹)',       type: 'number', icon: '🎁', desc: 'Orders ABOVE this amount get free delivery. Below it, the fee above applies. 0 = always charge.' },
        { key: 'max_delivery_radius_km',  label: 'Max Delivery Radius (KM)',      type: 'number', icon: '📍', desc: 'Reject orders beyond this distance' },
        { key: 'delivery_radius_km',      label: 'Shop Discovery Radius (KM)',    type: 'number', icon: '🔍', desc: 'Users see shops within this radius' },
        { key: 'platform_fee',            label: 'Platform Fee (₹)',              type: 'number', icon: '💳', desc: 'Service charge added per order' },
        { key: 'min_order_amount',        label: 'Min Order Amount (₹)',          type: 'number', icon: '🛒', desc: 'Minimum order value to place order. 0=disabled' },
        { key: 'same_day_delivery_cutoff_hour', label: 'Same-Day Cutoff Hour',    type: 'number', icon: '⏰', desc: '24h format (e.g. 20 = 8 PM)' },
      ]
    },
    {
      group: '💰 Business & Commission',
      desc: 'Commission rates, payouts, taxes',
      fields: [
        { key: 'commission_percent',      label: 'Platform Commission (%)',        type: 'number', icon: '📊', desc: 'Commission on each partner order' },
        { key: 'payout_schedule',         label: 'Payout Schedule',                type: 'select', icon: '🏦', desc: 'How often partners get paid', options: ['daily','weekly','biweekly','monthly'] },
        { key: 'payout_min_amount',       label: 'Min Payout Amount (₹)',         type: 'number', icon: '💸', desc: 'Minimum balance required for payout' },
        { key: 'gst_enabled',             label: 'GST Enabled',                    type: 'toggle', icon: '🧾', desc: 'Show GST breakdown on invoices' },
        { key: 'default_gst_percent',     label: 'Default GST (%)',               type: 'number', icon: '📋', desc: 'Default GST rate for new products' },
      ]
    },
    {
      group: '👤 Users & Auth',
      desc: 'Signup, referrals, wallet, OTP',
      fields: [
        { key: 'new_user_signup_enabled', label: 'New Signups Enabled',            type: 'toggle', icon: '✅', desc: 'Allow new user registrations' },
        { key: 'referral_enabled',        label: 'Referral System',                type: 'toggle', icon: '🤝', desc: 'Enable refer & earn' },
        { key: 'referral_bonus',          label: 'Referral Bonus (₹)',            type: 'number', icon: '🎉', desc: 'Amount credited to referrer wallet' },
        { key: 'referral_signup_bonus',   label: 'Signup Bonus (₹)',              type: 'number', icon: '🎊', desc: 'Amount credited to new user on signup' },
        { key: 'wallet_enabled',          label: 'Wallet Enabled',                 type: 'toggle', icon: '👛', desc: 'Allow users to use wallet balance' },
        { key: 'max_wallet_usage_percent',label: 'Max Wallet Usage (%)',           type: 'number', icon: '💰', desc: 'Max % of order payable via wallet' },
        { key: 'otp_expiry_minutes',      label: 'OTP Expiry (minutes)',           type: 'number', icon: '⏱️', desc: 'OTP validity duration' },
      ]
    },
    {
      group: '🛒 Orders & Cart',
      desc: 'Cart limits, cancellation, COD settings',
      fields: [
        { key: 'max_cart_items',          label: 'Max Cart Items',                 type: 'number', icon: '🛍️', desc: 'Maximum number of items allowed in cart' },
        { key: 'max_item_quantity',       label: 'Max Item Quantity',              type: 'number', icon: '📦', desc: 'Max quantity for single item in cart' },
        { key: 'cod_enabled',             label: 'Cash on Delivery',               type: 'toggle', icon: '💵', desc: 'Allow COD payment method' },
        { key: 'cod_max_amount',          label: 'COD Max Amount (₹)',            type: 'number', icon: '💰', desc: 'Max order amount for COD. 0=no limit' },
        { key: 'cod_fee',                 label: 'COD Extra Fee (₹)',             type: 'number', icon: '💸', desc: 'Extra fee added when customer pays Cash on Delivery. 0 = no extra fee' },
        { key: 'cancel_window_minutes',   label: 'Cancel Window (minutes)',        type: 'number', icon: '❌', desc: 'Time window for user to cancel after placing order' },
        { key: 'auto_confirm_orders',     label: 'Auto Confirm Orders',            type: 'toggle', icon: '⚡', desc: 'Auto-confirm orders instead of waiting for partner' },
        { key: 'order_rating_enabled',    label: 'Order Ratings',                  type: 'toggle', icon: '⭐', desc: 'Allow users to rate orders' },
      ]
    },
    {
      group: '💳 Razorpay Payment Gateway',
      desc: 'Online payment via Razorpay (Cards / UPI / Netbanking / Wallets)',
      fields: [
        { key: 'razorpay_enabled',        label: 'Razorpay Enabled',               type: 'toggle', icon: '💳', desc: 'Show Razorpay as a payment option at checkout' },
        { key: 'razorpay_key_id',         label: 'Razorpay Key ID',                type: 'text',   icon: '🔑', desc: 'From Razorpay Dashboard → Settings → API Keys (e.g. rzp_test_xxx or rzp_live_xxx)' },
        { key: 'razorpay_key_secret',     label: 'Razorpay Key Secret',            type: 'text',   icon: '🔐', desc: 'Keep this private. Used to verify payments server-side.' },
      ]
    },
    {
      group: '📢 Notifications & Support',
      desc: 'Contact info, social links, legal pages',
      fields: [
        { key: 'support_phone',           label: 'Support Phone',                  type: 'text',   icon: '📞', desc: 'Customer support phone number' },
        { key: 'support_email',           label: 'Support Email',                  type: 'text',   icon: '📧', desc: 'Customer support email address' },
        { key: 'support_whatsapp',        label: 'WhatsApp Number',                type: 'text',   icon: '💚', desc: 'WhatsApp chat support number' },
        { key: 'about_us_url',            label: 'About Us URL',                   type: 'text',   icon: '🌐', desc: 'About us web page link' },
        { key: 'privacy_policy_url',      label: 'Privacy Policy URL',             type: 'text',   icon: '🔒', desc: 'Privacy policy page link' },
        { key: 'terms_url',              label: 'Terms & Conditions URL',          type: 'text',   icon: '📄', desc: 'Terms of service page link' },
        { key: 'instagram_url',           label: 'Instagram URL',                  type: 'text',   icon: '📸', desc: 'Brand Instagram page link' },
        { key: 'fcm_enabled',             label: 'Push Notifications',             type: 'toggle', icon: '🔔', desc: 'Send FCM push notifications to users' },
      ]
    },
    {      group: '🖼️ Logo & Brand Identity',
      desc: 'Header/footer logo, favicon, brand & company name shown across web/app',
      fields: [
        { key: 'brand_name',          label: 'Brand Name',              type: 'text',  icon: '🏷️', desc: 'Display name (used in nav, emails, page titles)' },
        { key: 'brand_logo_url',      label: 'Logo (Light Background)', type: 'image', icon: '🖼️', desc: 'Used on white headers, login screen. Recommended: PNG/SVG with transparent bg, ~400x120px' },
        { key: 'brand_logo_dark_url', label: 'Logo (Dark Background)',  type: 'image', icon: '🌙', desc: 'Used on coloured headers / footer. Should be white/light coloured. Falls back to light logo if empty.' },
        { key: 'brand_favicon_url',   label: 'Favicon',                 type: 'image', icon: '🔖', desc: 'Browser tab icon. 32x32 or 64x64 PNG.' },
        { key: 'admin_brand_name',    label: 'Admin Sidebar Text',      type: 'text',  icon: '📝', desc: 'Text shown in admin panel sidebar (top-left) when no admin logo is uploaded. Default: "Admin Panel"' },
        { key: 'admin_logo_url',      label: 'Admin Sidebar Logo',      type: 'image', icon: '🛡️', desc: 'Logo for admin panel sidebar (top-left). Sidebar has DARK background — upload a WHITE/light PNG with transparent bg. Recommended ~200x60px.' },
        { key: 'company_name',        label: 'Legal Company Name',      type: 'text',  icon: '🏢', desc: 'Full registered company name (footer, invoices, legal pages)' },
        { key: 'company_address',     label: 'Company Address',         type: 'text',  icon: '📍', desc: 'Registered office address shown in footer / invoices' },
        { key: 'support_phone_alt',   label: 'Alternate Support Phone', type: 'text',  icon: '☎️', desc: 'Secondary contact number (optional)' },
      ]
    },
    {
      group: '📜 Legal Pages (Custom HTML)',
      desc: 'Override the default Privacy / Terms / Refund / Vendor pages with your own HTML. Leave empty to use built-in defaults. Contact email/phone always uses the values from "Contact & Support" group.',
      fields: [
        { key: 'legal_privacy_html', label: 'Privacy Policy',     type: 'html', icon: '🔒', desc: 'Full HTML for /legal/privacy. Leave empty to use default content.', placeholder: '<h2>Privacy Policy</h2>\n<p>Your custom privacy policy here...</p>' },
        { key: 'legal_terms_html',   label: 'Terms of Service',   type: 'html', icon: '📄', desc: 'Full HTML for /legal/terms. Leave empty to use default content.', placeholder: '<h2>Terms of Service</h2>\n<p>...</p>' },
        { key: 'legal_refund_html',  label: 'Refund / Return Policy', type: 'html', icon: '↩️', desc: 'Full HTML for /legal/refund. Leave empty to use default content.', placeholder: '<h2>Refund Policy</h2>\n<p>...</p>' },
        { key: 'legal_vendor_html',  label: 'Vendor / Seller Terms',  type: 'html', icon: '🤝', desc: 'Full HTML for /legal/vendor. Leave empty to use default content.', placeholder: '<h2>Vendor Terms</h2>\n<p>...</p>' },
      ]
    },
    {      group: '� WhatsApp / Fast2SMS',
      desc: 'WhatsApp transactional notifications. ⬇️ Scroll down to the green "Template Setup Guide" card — copy the message text from there into Fast2SMS, then paste the resulting Message ID back here.',
      fields: [
        { key: 'fast2sms_enabled',            label: 'Fast2SMS Enabled',            type: 'toggle', icon: '🔔', desc: 'Master switch. Turn off to instantly silence all WhatsApp messages.' },
        { key: 'fast2sms_api_key',            label: 'Fast2SMS API Key',            type: 'text',   icon: '🔑', desc: 'Fast2SMS Dashboard → Dev API → API Key (long alphanumeric).' },
        { key: 'fast2sms_phone_number_id',    label: 'Phone Number ID',             type: 'text',   icon: '📱', desc: 'Fast2SMS WhatsApp → your verified business number → Phone Number ID.' },
        { key: 'fast2sms_tpl_order_confirm',  label: 'Message ID: Order Placed',    type: 'text',   icon: '✅', desc: 'Paste Message ID for "Order Placed" template (see green guide card below).' },
        { key: 'fast2sms_tpl_on_the_way',     label: 'Message ID: Order Shipped',   type: 'text',   icon: '🚚', desc: 'Paste Message ID for "Order Shipped" template (see green guide card below).' },
        { key: 'fast2sms_tpl_order_cancel',   label: 'Message ID: Order Cancelled', type: 'text',   icon: '❌', desc: 'Paste Message ID for "Order Cancelled" template (see green guide card below).' },
      ]
    },
    {
      group: '�📦 Shipping & Courier',
      desc: 'Delhivery, FShip API credentials & settings',
      fields: [
        { key: 'shipping_default_provider', label: 'Default Shipping Provider',      type: 'select', icon: '🚛', desc: 'Which courier to use by default', options: ['none', 'delhivery', 'fship'] },
        { key: 'shipping_pickup_name',      label: 'Pickup Contact Name',            type: 'text',   icon: '👤', desc: 'Name for pickup address' },
        { key: 'shipping_pickup_phone',     label: 'Pickup Phone',                   type: 'text',   icon: '📞', desc: 'Phone number for pickup' },
        { key: 'shipping_pickup_address',   label: 'Pickup Address',                 type: 'text',   icon: '📍', desc: 'Full pickup/warehouse address' },
        { key: 'shipping_pickup_city',      label: 'Pickup City',                    type: 'text',   icon: '🏙️', desc: 'City of pickup location' },
        { key: 'shipping_pickup_state',     label: 'Pickup State',                   type: 'text',   icon: '🗺️', desc: 'State of pickup location' },
        { key: 'shipping_pickup_pincode',   label: 'Pickup Pincode',                 type: 'text',   icon: '📮', desc: 'Pincode of pickup location' },
        { key: 'delhivery_api_token',       label: 'Delhivery API Token',            type: 'text',   icon: '🔑', desc: 'API token from Delhivery dashboard' },
        { key: 'delhivery_api_mode',        label: 'Delhivery Mode',                 type: 'select', icon: '⚙️', desc: 'Staging for testing, Production for live', options: ['staging', 'production'] },
        { key: 'delhivery_client_name',     label: 'Delhivery Client Name',          type: 'text',   icon: '🏢', desc: 'Your client/warehouse name in Delhivery' },
        { key: 'fship_api_key',             label: 'FShip API Key',                  type: 'text',   icon: '🔑', desc: 'API key from FShip dashboard' },
        { key: 'fship_api_secret',          label: 'FShip API Secret',               type: 'text',   icon: '🔐', desc: 'API secret from FShip dashboard' },
        { key: 'fship_api_mode',            label: 'FShip Mode',                     type: 'select', icon: '⚙️', desc: 'Sandbox for testing, Production for live', options: ['sandbox', 'production'] },
      ]
    },
  ];

  var settings = {};

  /* ── Load ── */
  async function load(){
    main.innerHTML = '<div class="text-center" style="padding:60px"><div class="spinner"></div></div>';
    try {
      var r = await API.get('/admin/settings');
      var arr = r.settings || r.data || r || [];
      settings = {};
      if (Array.isArray(arr)) arr.forEach(function(s){ settings[s.key] = s.value; });
    } catch(e) { showToast(e.message, 'error'); settings = {}; }
    render();
  }

  /* ── Render ── */
  function render(){
    var html = '<div style="max-width:860px;margin:0 auto">';

    // Header
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">'
      + '<div>'
      + '<h2 style="margin:0;font-size:1.4rem">⚙️ Platform Settings</h2>'
      + '<p style="color:var(--text-light);font-size:13px;margin:4px 0 0">Manage your entire platform from one place</p>'
      + '</div>'
      + '<div style="display:flex;gap:8px">'
      + '<button class="btn btn-sm" id="btnSeed">🌱 Seed Defaults</button>'
      + '<button class="btn btn-sm" id="btnRaw">📝 Raw Editor</button>'
      + '<button class="btn btn-primary" id="btnSave">💾 Save Changes</button>'
      + '</div></div>';

    // Quick jump tabs
    html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px">';
    GROUPS.forEach(function(g, gi){
      html += '<a href="#grp'+gi+'" style="font-size:12px;padding:4px 10px;background:var(--bg);border:1px solid var(--border);border-radius:20px;text-decoration:none;color:var(--text)">'+g.group+'</a>';
    });
    html += '</div>';

    // Groups
    GROUPS.forEach(function(g, gi){
      html += '<div id="grp'+gi+'" class="card" style="margin-bottom:20px">'
        + '<div class="card-header" style="padding:16px 20px"><div style="display:flex;align-items:center;gap:8px">'
        + '<span style="font-size:1.4rem">'+g.group.split(' ')[0]+'</span>'
        + '<div><h3 style="margin:0;font-size:1rem">'+esc(g.group.substring(g.group.indexOf(' ')+1))+'</h3>'
        + '<p style="margin:2px 0 0;font-size:12px;color:var(--text-light)">'+esc(g.desc)+'</p></div>'
        + '</div></div><div class="card-body" style="padding:0">';

      g.fields.forEach(function(f, fi){
        var val = settings[f.key];
        var bdr = fi < g.fields.length - 1 ? 'border-bottom:1px solid var(--border)' : '';

        // Full-width row for long content (textarea / html)
        if (f.type === 'textarea' || f.type === 'html') {
          var rows = f.type === 'html' ? 12 : 5;
          html += '<div style="padding:14px 20px;'+bdr+'">'
            + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">'
            + '<div style="font-size:1.25rem;width:28px;text-align:center;flex-shrink:0">'+f.icon+'</div>'
            + '<div style="flex:1;min-width:0"><div style="font-weight:600;font-size:13px">'+esc(f.label)+'</div>'
            + '<div style="font-size:11px;color:var(--text-light)">'+esc(f.desc)+'</div></div>'
            + '</div>'
            + '<textarea class="form-control" data-key="'+f.key+'" data-type="textarea" rows="'+rows+'" placeholder="'+esc(f.placeholder||'')+'" '
            + 'style="width:100%;font-family:'+ (f.type==='html'?"'JetBrains Mono','Fira Code',monospace":'inherit') +';font-size:12px;line-height:1.55;padding:10px 12px;resize:vertical">'
            + esc(val!=null?String(val):'') + '</textarea>'
            + '</div>';
          return;
        }

        html += '<div style="display:flex;align-items:center;gap:16px;padding:14px 20px;'+bdr+'">'
          + '<div style="font-size:1.5rem;width:36px;text-align:center;flex-shrink:0">'+f.icon+'</div>'
          + '<div style="flex:1;min-width:0"><div style="font-weight:600;font-size:13px">'+esc(f.label)+'</div>'
          + '<div style="font-size:11px;color:var(--text-light)">'+esc(f.desc)+'</div></div>'
          + '<div style="flex-shrink:0;width:200px">';

        if (f.type === 'toggle') {
          var chk = val === true || val === 'true';
          html += '<label class="toggle-sw"><input type="checkbox" data-key="'+f.key+'" data-type="toggle" '+(chk?'checked':'')+'>'
            + '<span class="tsl"></span><span class="tslbl">'+(chk?'Enabled':'Disabled')+'</span></label>';
        } else if (f.type === 'color') {
          var cv = val || '#4F46E5';
          html += '<div style="display:flex;align-items:center;gap:8px">'
            + '<input type="color" data-key="'+f.key+'" data-type="color" value="'+esc(String(cv))+'" style="width:40px;height:36px;border:1px solid var(--border);border-radius:6px;cursor:pointer;padding:2px">'
            + '<input type="text" class="form-control" data-key="'+f.key+'" data-type="color-text" value="'+esc(String(cv))+'" style="font-size:12px;font-family:monospace;padding:6px 8px;width:100px">'
            + '</div>';
        } else if (f.type === 'select') {
          html += '<select class="form-control" data-key="'+f.key+'" data-type="select" style="font-size:13px;padding:8px">';
          (f.options||[]).forEach(function(o){ html += '<option value="'+o+'" '+(val===o?'selected':'')+'>'+o.charAt(0).toUpperCase()+o.slice(1)+'</option>'; });
          html += '</select>';
        } else if (f.type === 'number') {
          html += '<input type="number" class="form-control" data-key="'+f.key+'" data-type="number" value="'+esc(val!=null?String(val):'')+'" min="0" step="any" style="text-align:right;font-size:14px;font-weight:600;padding:8px 12px">';
        } else if (f.type === 'image') {
          var imgUrl = val ? (String(val).startsWith('http') ? val : CONFIG.API_BASE.replace('/api','') + val) : '';
          html += '<div data-key="'+f.key+'" data-type="image" style="display:flex;flex-direction:column;gap:6px">'
            + (imgUrl ? '<div style="position:relative;width:200px;height:60px;border-radius:8px;overflow:hidden;border:1px solid var(--border)"><img src="'+esc(imgUrl)+'" style="width:100%;height:100%;object-fit:cover"><button onclick="clearSettingImage(\''+f.key+'\')" style="position:absolute;top:2px;right:2px;background:#ef4444;color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;line-height:18px" title="Remove">&times;</button></div>' : '')
            + '<input type="file" accept="image/*" data-key="'+f.key+'" data-type="image-file" onchange="uploadSettingImage(\''+f.key+'\',this)" style="font-size:11px;width:200px">'
            + '</div>';
        } else {
          // Detect masked secret values (server returns "••••XXXX" for sensitive fields)
          var raw = val!=null?String(val):'';
          var isSecret = raw.startsWith('••••');
          var lockHint = isSecret
            ? ' onfocus="this.dataset.touched=\'1\'" placeholder="Click to replace (current: '+esc(raw)+')" '
            : '';
          var lockBadge = isSecret
            ? '<span style="position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:10px;color:#15803d;background:#dcfce7;padding:2px 6px;border-radius:4px;font-weight:600;pointer-events:none">🔒 Encrypted</span>'
            : '';
          html += '<div style="position:relative">'
            + '<input type="text" class="form-control" data-key="'+f.key+'" data-type="text"'+(isSecret?' data-secret="1"':'')+' value="'+esc(raw)+'"'+lockHint+' style="font-size:13px;padding:8px 100px 8px 10px'+(isSecret?';color:#6b7280;font-family:monospace':'')+'" '
            + (isSecret ? 'onfocus="if(!this.dataset.cleared){this.value=\'\';this.dataset.cleared=\'1\';this.style.color=\'\';this.style.fontFamily=\'\'}"' : '')
            + '>'
            + lockBadge + '</div>';
        }
        html += '</div></div>';
      });
      html += '</div></div>';
    });

    // Fast2SMS template setup guide (shown above test card)
    var TPL_GUIDE = [
      {
        title: 'Template 1 — Order Placed',
        key: 'fast2sms_tpl_order_confirm',
        emoji: '✅',
        text: 'Hi {{1}},\nYour order #{{2}} has been placed successfully.\n\n🛍️ Item: {{3}}\n💰 Amount: ₹{{4}}\n📍 Address: {{5}}\n\nWe\u2019ll notify you once it\u2019s shipped 🚚',
        vars: [
          ['{{1}}', 'Customer Name'],
          ['{{2}}', 'Order Number'],
          ['{{3}}', 'Item / Product Name'],
          ['{{4}}', 'Total Amount (₹)'],
          ['{{5}}', 'Delivery Address'],
        ],
        category: 'UTILITY'
      },
      {
        title: 'Template 2 — Order Shipped / On the Way',
        key: 'fast2sms_tpl_on_the_way',
        emoji: '🚚',
        text: 'Hi {{1}},\nGood news! Your order #{{2}} is on the way 🚚\n\n📦 Tracking ID: {{3}}\n🛣️ Courier: {{4}}\n⏰ Expected: {{5}}\n\nThank you for shopping with us!',
        vars: [
          ['{{1}}', 'Customer Name'],
          ['{{2}}', 'Order Number'],
          ['{{3}}', 'Tracking ID / AWB'],
          ['{{4}}', 'Courier Name'],
          ['{{5}}', 'Expected Delivery Date'],
        ],
        category: 'UTILITY'
      },
      {
        title: 'Template 3 — Order Cancelled',
        key: 'fast2sms_tpl_order_cancel',
        emoji: '❌',
        text: 'Hi {{1}},\nYour order #{{2}} has been cancelled.\n\n💸 Refund (if any) will be credited within {{3}} business days.\n\nNeed help? Reply to this message and we\u2019ll assist you.',
        vars: [
          ['{{1}}', 'Customer Name'],
          ['{{2}}', 'Order Number'],
          ['{{3}}', 'Refund Days (e.g. 5-7)'],
        ],
        category: 'UTILITY'
      }
    ];

    html += '<div class="card" style="margin-bottom:20px;border:2px solid #25D366">'
      + '<div class="card-header" style="padding:14px 20px;background:#dcfce7">'
      + '<h3 style="margin:0;font-size:1rem;color:#15803d">💚 WhatsApp Template Setup Guide</h3>'
      + '<p style="margin:4px 0 0;font-size:12px;color:#166534;line-height:1.5">'
      + '<b>Confused?</b> Here\u2019s exactly what to do:<br>'
      + '<b>Step 1:</b> Login to <a href="https://www.fast2sms.com/dashboard/whatsapp" target="_blank" style="color:#15803d;text-decoration:underline">Fast2SMS WhatsApp Dashboard</a> → Click <b>Create Template</b><br>'
      + '<b>Step 2:</b> Choose category <b>UTILITY</b>, language <b>English</b>, then copy the message text below and paste into Fast2SMS\u2019s <i>Body</i> field.<br>'
      + '<b>Step 3:</b> Submit & wait for <b>Approved</b> status (usually 5–30 min). Fast2SMS will give you a <b>Message ID</b> (long number like 18692).<br>'
      + '<b>Step 4:</b> Paste that <b>Message ID</b> into the matching field above (Order Placed / Shipped / Cancelled) and hit <b>Save Changes</b>.<br>'
      + '<b>Step 5:</b> Use the <b>Send Test</b> box below to verify on your phone. Done! 🎉'
      + '</p>'
      + '<div style="margin-top:10px;padding:10px 12px;background:#fff7ed;border:1px solid #fdba74;border-radius:8px;font-size:11.5px;color:#7c2d12;line-height:1.55">'
      + '<b>⚠️ Important — sirf <u>Message ID</u> paste karna hai.</b> Fast2SMS approval ke baad aapko 5 cheezein dikhayega:<br>'
      + '<span style="color:#dc2626">❌ Template Name (e.g. <code>orderconfirm</code>)</span> — ignore<br>'
      + '<span style="color:#dc2626">❌ Template ID (e.g. <code>2081830795716851</code>) — Meta ka internal ID, ignore</span><br>'
      + '<span style="color:#dc2626">❌ Language / Category</span> — ignore<br>'
      + '<span style="color:#15803d;font-weight:700">✅ Message ID (chhota number, e.g. <code>18692</code>) — <u>YEHI</u> paste karna hai upar wale field me</span>'
      + '</div>'
      + '</div>';

    TPL_GUIDE.forEach(function(t, idx){
      var currentId = settings[t.key] || '';
      var statusBadge = currentId
        ? '<span style="background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600">✓ Configured (ID: '+esc(currentId)+')</span>'
        : '<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600">⚠ Not configured</span>';
      var bdr = idx < TPL_GUIDE.length - 1 ? 'border-bottom:1px solid var(--border)' : '';
      var tplId = 'tpl-text-' + idx;

      html += '<div style="padding:16px 20px;'+bdr+'">'
        + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">'
        + '<div style="font-size:1.25rem">'+t.emoji+'</div>'
        + '<div style="font-weight:700;font-size:13px;flex:1;min-width:200px">'+esc(t.title)+'</div>'
        + statusBadge
        + '</div>'
        // The actual template text (the "preview box" admin can copy)
        + '<div style="background:#f9fafb;border:1px dashed #d1d5db;border-radius:8px;padding:12px;position:relative">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
        + '<span style="font-size:10px;font-weight:700;color:#6b7280;letter-spacing:.05em">📝 MESSAGE TEXT (copy this into Fast2SMS)</span>'
        + '<button class="btn btn-sm" data-copy-tpl="'+tplId+'" style="font-size:11px;padding:4px 10px;background:#25D366;color:white;border:none;border-radius:6px;cursor:pointer">📋 Copy</button>'
        + '</div>'
        + '<pre id="'+tplId+'" style="margin:0;font-family:\'Segoe UI\',sans-serif;font-size:13px;line-height:1.55;color:#111827;white-space:pre-wrap;word-break:break-word">'+esc(t.text)+'</pre>'
        + '</div>'
        // Variable mapping
        + '<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">'
        + '<span style="font-size:11px;color:#6b7280;font-weight:600;align-self:center">Variables order:</span>';
      t.vars.forEach(function(v){
        html += '<span style="background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;padding:3px 8px;border-radius:6px;font-size:11px;font-family:monospace">'
          + '<b>'+v[0]+'</b> = '+esc(v[1])+'</span>';
      });
      html += '<span style="background:#fef3c7;color:#92400e;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600">Category: '+t.category+'</span>'
        + '</div></div>';
    });

    html += '</div>';

    // Fast2SMS test sender (after groups)
    html += '<div class="card" style="margin-bottom:20px">'
      + '<div class="card-header" style="padding:14px 20px"><h3 style="margin:0;font-size:1rem">🧪 Test WhatsApp Notification</h3>'
      + '<p style="margin:2px 0 0;font-size:12px;color:var(--text-light)">Save your settings first, then send a sample "Order Placed" template to your phone to verify Fast2SMS is working.</p></div>'
      + '<div class="card-body" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
      + '<input type="text" id="f2sTestPhone" class="form-control" placeholder="10-digit phone (no +91)" style="max-width:240px;font-size:13px">'
      + '<button class="btn btn-primary btn-sm" id="btnTestF2s">📤 Send Test</button>'
      + '<span id="f2sTestResult" style="font-size:12px;color:var(--text-light)"></span>'
      + '</div></div>';

    // Raw editor modal
    html += '<div class="modal-overlay" id="modal"><div class="modal" style="width:500px">'
      + '<h3 id="modalTitle">Add Setting</h3>'
      + '<div class="form-group"><label>Key</label><input class="form-control" id="fKey" placeholder="custom_key"></div>'
      + '<div class="form-group"><label>Value <small style="color:var(--text-light)">(JSON or plain)</small></label>'
      + '<textarea class="form-control" id="fValue" rows="4"></textarea></div>'
      + '<div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:1rem">'
      + '<button class="btn" id="btnModalCancel">Cancel</button>'
      + '<button class="btn btn-primary" id="btnModalSave">Save</button>'
      + '</div></div></div>';

    html += '</div>';
    main.innerHTML = html;
    addToggleCSS();

    // Wire events
    document.getElementById('btnSave').addEventListener('click', saveAll);
    document.getElementById('btnSeed').addEventListener('click', seedDef);
    document.getElementById('btnRaw').addEventListener('click', openRaw);
    document.getElementById('btnModalCancel').addEventListener('click', function(){ closeModal('modal'); });
    document.getElementById('btnModalSave').addEventListener('click', saveRaw);

    // Fast2SMS test send
    var btnT = document.getElementById('btnTestF2s');
    if (btnT) btnT.addEventListener('click', async function(){
      var ph = (document.getElementById('f2sTestPhone').value || '').trim();
      var out = document.getElementById('f2sTestResult');
      if (!/^\d{10}$/.test(ph)) { out.textContent = 'Enter a valid 10-digit phone'; out.style.color='#ef4444'; return; }
      out.textContent = 'Sending...'; out.style.color = 'var(--text-light)';
      btnT.disabled = true;
      try {
        var r = await API.post('/admin/settings/test-fast2sms', { phone: ph });
        if (r && r.success) { out.textContent = '✅ Sent successfully'; out.style.color = '#10b981'; }
        else { out.textContent = '❌ ' + (r && (r.message || (r.result && (r.result.error || r.result.reason)))) || 'Failed'; out.style.color = '#ef4444'; }
      } catch (e) { out.textContent = '❌ ' + (e.message || 'Failed'); out.style.color = '#ef4444'; }
      finally { btnT.disabled = false; }
    });

    // Template "Copy" buttons
    main.querySelectorAll('button[data-copy-tpl]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var pre = document.getElementById(btn.getAttribute('data-copy-tpl'));
        if (!pre) return;
        var text = pre.textContent || pre.innerText || '';
        var done = function(){
          var orig = btn.innerHTML;
          btn.innerHTML = '✓ Copied';
          btn.style.background = '#15803d';
          setTimeout(function(){ btn.innerHTML = orig; btn.style.background = '#25D366'; }, 1500);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function(){
            // Fallback
            var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); done(); } catch(_){}
            document.body.removeChild(ta);
          });
        } else {
          var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); done(); } catch(_){}
          document.body.removeChild(ta);
        }
      });
    });

    // Toggle label sync
    main.querySelectorAll('input[data-type="toggle"]').forEach(function(el){
      el.addEventListener('change', function(){ var l=el.parentElement.querySelector('.tslbl'); if(l) l.textContent=el.checked?'Enabled':'Disabled'; });
    });
    // Color sync
    main.querySelectorAll('input[data-type="color"]').forEach(function(el){
      el.addEventListener('input', function(){ var t=main.querySelector('input[data-type="color-text"][data-key="'+el.dataset.key+'"]'); if(t) t.value=el.value; });
    });
    main.querySelectorAll('input[data-type="color-text"]').forEach(function(el){
      el.addEventListener('input', function(){ var c=main.querySelector('input[data-type="color"][data-key="'+el.dataset.key+'"]'); if(c&&/^#[0-9a-fA-F]{6}$/.test(el.value)) c.value=el.value; });
    });
  }

  /* ── Image setting upload ── */
  window.uploadSettingImage = async function(key, input){
    if(!input.files[0]) return;
    var fd = new FormData();
    fd.append('image', input.files[0]);
    try{
      await API.upload('/admin/settings/upload/' + encodeURIComponent(key), fd);
      showToast('Image uploaded', 'success');
      load();
    }catch(e){ showToast(e.message, 'error'); }
  };

  window.clearSettingImage = async function(key){
    try{
      await API.put('/admin/settings/' + encodeURIComponent(key), { value: '' });
      showToast('Image removed', 'success');
      load();
    }catch(e){ showToast(e.message, 'error'); }
  };

  /* ── Save All ── */
  async function saveAll(){
    var all = {};
    main.querySelectorAll('[data-key]').forEach(function(el){
      var k = el.dataset.key;
      if (all[k] !== undefined) return;
      if (el.dataset.type === 'toggle') all[k] = el.checked;
      else if (el.dataset.type === 'color-text') return;
      else if (el.dataset.type === 'image') return;
      else if (el.dataset.type === 'image-file') return;
      else if (el.dataset.type === 'color') all[k] = el.value;
      else if (el.dataset.type === 'number') { if (el.value.trim()!=='') all[k] = parseFloat(el.value); }
      else if (el.dataset.type === 'select') all[k] = el.value;
      else if (el.dataset.type === 'textarea') all[k] = el.value;
      else if (el.dataset.secret === '1') {
        // Masked secret field — only send if admin actually changed it (cleared on focus)
        if (el.dataset.cleared === '1' && el.value.trim() !== '') all[k] = el.value.trim();
        // else: leave untouched, server keeps existing encrypted value
      }
      else { if (el.value.trim()!=='') all[k] = el.value.trim(); }
    });

    var btn = document.getElementById('btnSave');
    btn.disabled = true; btn.textContent = 'Saving...';
    var ok = 0, fail = 0;
    var keys = Object.keys(all);
    for (var i = 0; i < keys.length; i++) {
      if (JSON.stringify(settings[keys[i]]) === JSON.stringify(all[keys[i]])) continue;
      try { await API.put('/admin/settings/'+encodeURIComponent(keys[i]), { value: all[keys[i]] }); ok++; }
      catch(e) { fail++; }
    }
    btn.disabled = false; btn.textContent = '💾 Save Changes';
    if (fail===0) showToast(ok>0 ? ok+' settings saved!' : 'No changes', ok>0?'success':'info');
    else showToast(ok+' saved, '+fail+' failed', 'error');
    // Invalidate admin sidebar branding cache so logo/name update instantly
    try { localStorage.removeItem('dd_admin_branding'); } catch {}
    load();
    // Re-apply branding without full reload (updates current page sidebar)
    if (typeof applyAdminBranding === 'function') applyAdminBranding();
  }

  /* ── Seed ── */
  async function seedDef(){
    if (!confirm('Seed default settings? Existing values will NOT be overwritten.')) return;
    try { await API.post('/admin/settings/seed'); showToast('Defaults seeded!','success'); load(); }
    catch(e){ showToast(e.message,'error'); }
  }

  /* ── Raw Editor ── */
  function openRaw(){
    document.getElementById('fKey').value = '';
    document.getElementById('fKey').disabled = false;
    document.getElementById('fValue').value = '';
    document.getElementById('modalTitle').textContent = 'Add Custom Setting';
    openModal('modal');
  }
  async function saveRaw(){
    var key = document.getElementById('fKey').value.trim();
    var val = document.getElementById('fValue').value.trim();
    if (!key) { showToast('Key required','error'); return; }
    try { val = JSON.parse(val); } catch(_){}
    try { await API.put('/admin/settings/'+encodeURIComponent(key), { value: val }); showToast('Saved','success'); closeModal('modal'); load(); }
    catch(e){ showToast(e.message,'error'); }
  }

  /* ── Toggle CSS ── */
  function addToggleCSS(){
    if (document.getElementById('tCSS')) return;
    var s = document.createElement('style'); s.id = 'tCSS';
    s.textContent = '.toggle-sw{display:inline-flex;align-items:center;cursor:pointer;user-select:none}'
      + '.toggle-sw input{display:none}'
      + '.tsl{width:44px;height:24px;background:#ccc;border-radius:12px;position:relative;transition:.3s}'
      + '.tsl::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;background:#fff;border-radius:50%;transition:.3s}'
      + '.toggle-sw input:checked+.tsl{background:var(--primary)}'
      + '.toggle-sw input:checked+.tsl::after{transform:translateX(20px)}'
      + '.tslbl{font-size:12px;margin-left:8px}';
    document.head.appendChild(s);
  }

  function esc(s){ var d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

  load();
})();
