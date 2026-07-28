(function(){
  requireAuth();
  document.body.innerHTML = pageShell('KYC Verification');
  buildLayout('kyc');
  const content = document.getElementById('page-content');
  const BASE = CONFIG.API_BASE.replace('/api','');


  // ── inline styles ──
  const style = document.createElement('style');
  style.textContent = `
    .kyc-wizard { max-width: 720px; margin: 0 auto; }
    .steps-bar { display: flex; gap: 0; margin-bottom: 24px; position: relative; }
    .step-item { flex: 1; text-align: center; position: relative; cursor: pointer; }
    .step-circle {
      width: 36px; height: 36px; border-radius: 50%; margin: 0 auto 6px;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 700; border: 2px solid var(--border);
      background: var(--white); color: var(--text-light); transition: all .3s;
    }
    .step-item.active .step-circle { border-color: var(--primary); background: var(--primary); color: #fff; }
    .step-item.done .step-circle { border-color: var(--success); background: var(--success); color: #fff; }
    .step-label { font-size: 11px; color: var(--text-light); font-weight: 500; }
    .step-item.active .step-label { color: var(--primary); font-weight: 600; }
    .step-item.done .step-label { color: var(--success); }
    .step-line {
      position: absolute; top: 18px; left: 50%; width: 100%; height: 2px;
      background: var(--border); z-index: -1;
    }
    .step-item:last-child .step-line { display: none; }
    .step-item.done .step-line { background: var(--success); }
    .step-panel { display: none; }
    .step-panel.active { display: block; }
    .wizard-footer { display: flex; justify-content: space-between; margin-top: 20px; }
    .upload-box {
      border: 2px dashed var(--border); border-radius: 8px; padding: 20px; text-align: center;
      cursor: pointer; transition: border-color .2s; position: relative; min-height: 100px;
    }
    .upload-box:hover { border-color: var(--primary); }
    .upload-box input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
    .upload-box .preview { max-width: 160px; max-height: 120px; border-radius: 6px; margin-top: 8px; }
    .upload-box .label { font-size: 13px; color: var(--text-light); }
    .upload-box .label .icon { font-size: 24px; display: block; margin-bottom: 4px; }
    .name-match { font-size: 11px; margin-top: 4px; padding: 4px 8px; border-radius: 4px; }
    .name-match.ok { background: #D1FAE5; color: #065F46; }
    .name-match.err { background: #FEE2E2; color: #991B1B; }
    .section-title { font-size: 13px; font-weight: 600; color: var(--primary); margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 6px; }
    .kyc-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; font-size: 13px; }
    .kyc-detail-grid .lbl { color: var(--text-light); font-weight: 500; }
    .kyc-detail-grid .val { font-weight: 600; word-break: break-word; }
    .doc-preview { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px; }
    .doc-preview img { width: 120px; height: 90px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border); cursor: pointer; }
    .doc-preview img:hover { border-color: var(--primary); box-shadow: 0 2px 8px rgba(0,0,0,.15); }
  `;
  document.head.appendChild(style);

  const STEPS = [
    { id: 'business', label: 'Business', icon: '1' },
    { id: 'gst', label: 'GST & Tax', icon: '2' },
    { id: 'bank', label: 'Bank', icon: '3' },
    { id: 'address', label: 'Address', icon: '4' },
    { id: 'review', label: 'Review', icon: '5' },
  ];
  let currentStep = 0;

  // ── Load ──
  async function load(){
    content.innerHTML = '<div class="text-center" style="padding:40px"><div class="spinner"></div></div>';
    try {
      const data = await API.get('/partner/kyc');
      if (data.kyc) { renderStatus(data.kyc); return; }
    } catch(e) {
      if (!e.message.includes('404') && !e.message.includes('not found') && !e.message.includes('not submitted')) {
        content.innerHTML = '<div class="empty-state"><p>'+esc(e.message)+'</p></div>';
        return;
      }
    }
    renderWizard();
  }

  // ── Status View ──
  function renderStatus(k){
    const icons = { pending:'⏳', approved:'✅', rejected:'❌' };
    const img = (path) => path ? '<img src="'+BASE+path+'" style="width:120px;height:90px;object-fit:cover;border-radius:6px;border:1px solid var(--border)">' : '-';

    content.innerHTML = '<div class="kyc-wizard">'
      + '<div class="card"><div class="kyc-status">'
      + '<div class="icon">'+( icons[k.status]||'📋')+'</div>'
      + '<h3>KYC Status: '+statusBadge(k.status)+'</h3>'
      + (k.status==='rejected' ? '<p style="color:var(--danger);margin-top:8px"><strong>Reason:</strong> '+esc(k.rejectionReason||'Not specified')+'</p>' : '')
      + (k.status==='pending' ? '<p>Your KYC is under review. We\'ll notify you once verified.</p>' : '')
      + (k.status==='approved' ? '<p>Your KYC is verified. You can start selling!</p>' : '')
      + '</div></div>'

      + '<div class="card mt-2"><div class="card-header"><h3>Business Details</h3></div><div class="card-body">'
      + '<div class="kyc-detail-grid">'
      + '<div class="lbl">Organization</div><div class="val">'+esc(k.organizationName)+'</div>'
      + '<div class="lbl">Contact Name</div><div class="val">'+esc(k.name)+'</div>'
      + '<div class="lbl">Email</div><div class="val">'+esc(k.email)+'</div>'
      + '</div><div class="doc-preview">'+img(k.photo)+'</div></div></div>'

      + '<div class="card mt-2"><div class="card-header"><h3>GST & Tax</h3></div><div class="card-body">'
      + '<div class="kyc-detail-grid">'
      + '<div class="lbl">GST Number</div><div class="val">'+esc(k.gstNumber)+'</div>'
      + '<div class="lbl">GST Registered Name</div><div class="val">'+esc(k.gstRegisteredName||'-')+'</div>'
      + '<div class="lbl">PAN Number</div><div class="val">'+esc(k.panNumber)+'</div>'
      + '</div>'
      + (k.gstCertificateImage ? '<div class="mt-1"><strong style="font-size:12px;color:var(--text-light)">GST Certificate:</strong><div class="doc-preview">'+img(k.gstCertificateImage)+'</div></div>' : '')
      + '</div></div>'

      + '<div class="card mt-2"><div class="card-header"><h3>Bank Details</h3></div><div class="card-body">'
      + '<div class="kyc-detail-grid">'
      + '<div class="lbl">Bank Name</div><div class="val">'+esc(k.bankName||'-')+'</div>'
      + '<div class="lbl">Account Number</div><div class="val">'+esc(k.bankAccountNumber||'-')+'</div>'
      + '<div class="lbl">IFSC Code</div><div class="val">'+esc(k.bankIfscCode||'-')+'</div>'
      + '<div class="lbl">Beneficiary Name</div><div class="val">'+esc(k.bankBeneficiaryName||'-')+'</div>'
      + '</div>'
      + (k.passbookImage ? '<div class="mt-1"><strong style="font-size:12px;color:var(--text-light)">Passbook/Cheque:</strong><div class="doc-preview">'+img(k.passbookImage)+'</div></div>' : '')
      + '</div></div>'

      + '<div class="card mt-2"><div class="card-header"><h3>Addresses</h3></div><div class="card-body">'
      + '<div class="section-title">📍 Pickup / Shop Address</div>'
      + '<div class="kyc-detail-grid">'
      + '<div class="lbl">Address</div><div class="val">'+esc(k.shopAddress||'-')+'</div>'
      + '<div class="lbl">City</div><div class="val">'+esc(k.city||'-')+'</div>'
      + '<div class="lbl">State</div><div class="val">'+esc(k.state||'-')+'</div>'
      + '<div class="lbl">Pincode</div><div class="val">'+esc(k.pincode||'-')+'</div>'
      + '</div>'
      + (k.billingAddressSameAsShop ? '<p class="mt-1" style="font-size:12px;color:var(--text-light)">Billing address same as pickup</p>' :
        '<div class="section-title mt-2">🧾 Billing Address</div>'
        + '<div class="kyc-detail-grid">'
        + '<div class="lbl">Address</div><div class="val">'+esc(k.billingAddress?.address||'-')+'</div>'
        + '<div class="lbl">City</div><div class="val">'+esc(k.billingAddress?.city||'-')+'</div>'
        + '<div class="lbl">State</div><div class="val">'+esc(k.billingAddress?.state||'-')+'</div>'
        + '<div class="lbl">Pincode</div><div class="val">'+esc(k.billingAddress?.pincode||'-')+'</div>'
        + '</div>')
      + '<div class="kyc-detail-grid mt-2">'
      + '<div class="lbl">Self Delivery</div><div class="val">'+(k.selfDeliveryEnabled?'Yes':'No')+'</div>'
      + '<div class="lbl">Free Delivery Above</div><div class="val">'+(k.freeDeliveryAbove ? fmtCurrency(k.freeDeliveryAbove) : '-')+'</div>'
      + '</div></div></div>'

      + (k.status==='rejected' ? '<div class="mt-2 text-center"><button class="btn btn-primary" id="btnResubmit">Re-submit KYC</button></div>' : '')
      + '</div>';

    var btn = document.getElementById('btnResubmit');
    if (btn) btn.addEventListener('click', function(){ renderWizard(k); });
  }

  // ── Wizard Form ──
  function renderWizard(prefill){
    var p = prefill || {};
    currentStep = 0;

    content.innerHTML = '<div class="kyc-wizard">'
      + '<div class="steps-bar" id="stepsBar">'
      + STEPS.map(function(s,i){
          return '<div class="step-item '+(i===0?'active':'')+'" data-step="'+i+'">'
            + '<div class="step-line"></div>'
            + '<div class="step-circle">'+s.icon+'</div>'
            + '<div class="step-label">'+s.label+'</div></div>';
        }).join('')
      + '</div>'

      + '<form id="kycForm" enctype="multipart/form-data">'

      // Step 1: Business
      + '<div class="step-panel active" data-panel="0"><div class="card">'
      + '<div class="card-header"><h3>🏢 Business Details</h3></div><div class="card-body">'
      + '<div class="form-row">'
      + '<div class="form-group"><label>Full Name *</label><input class="form-control" id="fName" value="'+esc(p.name||'')+'" required></div>'
      + '<div class="form-group"><label>Email *</label><input class="form-control" id="fEmail" type="email" value="'+esc(p.email||'')+'" required></div>'
      + '</div>'
      + '<div class="form-group"><label>Organization / Shop Name *</label><input class="form-control" id="fOrg" value="'+esc(p.organizationName||'')+'" required></div>'
      + '<div class="form-group"><label>Shop / Business Photo *</label>'
      + '<div class="upload-box" id="boxPhoto"><input type="file" accept="image/*" id="fPhoto" '+(prefill?'':'required')+'>'
      + '<div class="label"><span class="icon">📸</span>Click to upload shop photo</div></div></div>'
      + '</div></div></div>'

      // Step 2: GST
      + '<div class="step-panel" data-panel="1"><div class="card">'
      + '<div class="card-header"><h3>📄 GST & Tax Details</h3></div><div class="card-body">'
      + '<div class="form-group"><label>GST Number *</label><input class="form-control" id="fGst" value="'+esc(p.gstNumber||'')+'" required placeholder="22AAAAA0000A1Z5" style="text-transform:uppercase"></div>'
      + '<div class="form-group"><label>GST Registered Name * <small style="color:var(--text-light)">(Must match bank beneficiary name)</small></label><input class="form-control" id="fGstName" value="'+esc(p.gstRegisteredName||'')+'" required></div>'
      + '<div class="form-group"><label>PAN Number *</label><input class="form-control" id="fPan" value="'+esc(p.panNumber||'')+'" required placeholder="ABCDE1234F" style="text-transform:uppercase"></div>'
      + '<div class="form-group"><label>GST Certificate (Upload)</label>'
      + '<div class="upload-box" id="boxGst"><input type="file" accept="image/*" id="fGstCert">'
      + '<div class="label"><span class="icon">📋</span>Upload GST certificate image</div></div></div>'
      + '</div></div></div>'

      // Step 3: Bank
      + '<div class="step-panel" data-panel="2"><div class="card">'
      + '<div class="card-header"><h3>🏦 Bank Details</h3></div><div class="card-body">'
      + '<div class="form-group"><label>Bank Name *</label><input class="form-control" id="fBankName" value="'+esc(p.bankName||'')+'" required></div>'
      + '<div class="form-row">'
      + '<div class="form-group"><label>Account Number *</label><input class="form-control" id="fAccNo" value="'+esc(p.bankAccountNumber||'')+'" required></div>'
      + '<div class="form-group"><label>IFSC Code *</label><input class="form-control" id="fIfsc" value="'+esc(p.bankIfscCode||'')+'" required placeholder="SBIN0000001" style="text-transform:uppercase"></div>'
      + '</div>'
      + '<div class="form-group"><label>Beneficiary Name * <small style="color:var(--text-light)">(Must match GST registered name)</small></label>'
      + '<input class="form-control" id="fBeneName" value="'+esc(p.bankBeneficiaryName||'')+'" required>'
      + '<div id="nameMatchHint"></div></div>'
      + '<div class="form-group"><label>Passbook / Cancelled Cheque (Upload)</label>'
      + '<div class="upload-box" id="boxPassbook"><input type="file" accept="image/*" id="fPassbook">'
      + '<div class="label"><span class="icon">📕</span>Upload passbook or cancelled cheque</div></div></div>'
      + '</div></div></div>'

      // Step 4: Address
      + '<div class="step-panel" data-panel="3"><div class="card">'
      + '<div class="card-header"><h3>📍 Addresses</h3></div><div class="card-body">'
      + '<div class="section-title">Pickup / Shop Address</div>'
      + '<div class="form-group"><label>Shop Address *</label><input class="form-control" id="fAddr" value="'+esc(p.shopAddress||'')+'" required></div>'
      + '<div class="form-row-3">'
      + '<div class="form-group"><label>City *</label><input class="form-control" id="fCity" value="'+esc(p.city||'')+'" required></div>'
      + '<div class="form-group"><label>State *</label><input class="form-control" id="fState" value="'+esc(p.state||'')+'" required></div>'
      + '<div class="form-group"><label>Pincode *</label><input class="form-control" id="fPin" value="'+esc(p.pincode||'')+'" required></div>'
      + '</div>'
      + '<div class="form-group"><button type="button" class="btn btn-outline btn-sm" id="btnGetLoc">📍 Get My Location</button>'
      + '<span id="locStatus" style="font-size:12px;color:var(--text-light);margin-left:8px"></span></div>'

      + '<div class="section-title mt-2">🧾 Billing Address</div>'
      + '<div class="form-group"><label><input type="checkbox" id="fSameAddr" '+(p.billingAddressSameAsShop?'checked':'')+'> Same as pickup address</label></div>'
      + '<div id="billingFields" '+(p.billingAddressSameAsShop?'style="display:none"':'')+'>'
      + '<div class="form-group"><label>Billing Address</label><input class="form-control" id="fBillAddr" value="'+esc((p.billingAddress&&p.billingAddress.address)||'')+'"></div>'
      + '<div class="form-row-3">'
      + '<div class="form-group"><label>City</label><input class="form-control" id="fBillCity" value="'+esc((p.billingAddress&&p.billingAddress.city)||'')+'"></div>'
      + '<div class="form-group"><label>State</label><input class="form-control" id="fBillState" value="'+esc((p.billingAddress&&p.billingAddress.state)||'')+'"></div>'
      + '<div class="form-group"><label>Pincode</label><input class="form-control" id="fBillPin" value="'+esc((p.billingAddress&&p.billingAddress.pincode)||'')+'"></div>'
      + '</div></div>'

      + '<div class="section-title mt-2">🚚 Delivery Settings</div>'
      + '<div class="form-row">'
      + '<div class="form-group"><label><input type="checkbox" id="fSelfDel" '+(p.selfDeliveryEnabled?'checked':'')+'> Self Delivery Enabled</label></div>'
      + '<div class="form-group"><label>Free Delivery Above (₹)</label><input class="form-control" id="fFreeDel" type="number" min="0" value="'+(p.freeDeliveryAbove||'')+'"></div>'
      + '</div></div></div></div>'

      // Step 5: Review
      + '<div class="step-panel" data-panel="4"><div class="card">'
      + '<div class="card-header"><h3>✅ Review & Submit</h3></div>'
      + '<div class="card-body" id="reviewSummary"></div></div></div>'

      + '<div class="wizard-footer">'
      + '<button type="button" class="btn btn-outline" id="btnPrev" style="visibility:hidden">← Previous</button>'
      + '<button type="button" class="btn btn-primary" id="btnNext">Next →</button>'
      + '<button type="submit" class="btn btn-success" id="btnSubmit" style="display:none">🚀 Submit KYC</button>'
      + '</div></form></div>';

    // Wire events
    setupUploadPreview('fPhoto', 'boxPhoto');
    setupUploadPreview('fGstCert', 'boxGst');
    setupUploadPreview('fPassbook', 'boxPassbook');

    document.getElementById('fSameAddr').addEventListener('change', function(){
      document.getElementById('billingFields').style.display = this.checked ? 'none' : '';
    });

    document.getElementById('btnGetLoc').addEventListener('click', getLocation);

    // Name match
    var gstNameEl = document.getElementById('fGstName');
    var beneNameEl = document.getElementById('fBeneName');
    var hint = document.getElementById('nameMatchHint');
    function checkNameMatch(){
      var g = (gstNameEl.value||'').trim().toUpperCase();
      var b = (beneNameEl.value||'').trim().toUpperCase();
      if (!g || !b) { hint.innerHTML = ''; return; }
      if (g === b) {
        hint.innerHTML = '<div class="name-match ok">✅ Name matches GST registered name</div>';
      } else {
        hint.innerHTML = '<div class="name-match err">❌ Does not match GST registered name ("'+esc(gstNameEl.value)+'")</div>';
      }
    }
    beneNameEl.addEventListener('input', checkNameMatch);
    gstNameEl.addEventListener('input', checkNameMatch);

    document.getElementById('btnPrev').addEventListener('click', function(){ goStep(currentStep - 1); });
    document.getElementById('btnNext').addEventListener('click', function(){ goStep(currentStep + 1); });
    document.getElementById('kycForm').addEventListener('submit', submitKyc);

    document.querySelectorAll('.step-item').forEach(function(el){
      el.addEventListener('click', function(){
        var target = parseInt(el.dataset.step);
        if (target < currentStep) goStep(target);
      });
    });
  }

  var geoCoords = null;

  function getLocation(){
    var stat = document.getElementById('locStatus');
    if (!navigator.geolocation) { stat.textContent = 'Geolocation not supported'; return; }
    stat.textContent = 'Getting location...';
    navigator.geolocation.getCurrentPosition(
      function(pos){ geoCoords = [pos.coords.longitude, pos.coords.latitude]; stat.textContent = '✅ Location captured'; },
      function(err){ stat.textContent = '❌ ' + err.message; },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  function setupUploadPreview(inputId, boxId){
    var input = document.getElementById(inputId);
    var box = document.getElementById(boxId);
    if (!input || !box) return;
    input.addEventListener('change', function(){
      var file = this.files[0];
      if (!file) return;
      var existing = box.querySelector('.preview');
      if (existing) existing.remove();
      var img = document.createElement('img');
      img.className = 'preview';
      img.src = URL.createObjectURL(file);
      box.appendChild(img);
      box.querySelector('.label').innerHTML = '<span class="icon">✅</span>' + esc(file.name);
    });
  }

  function validateStep(step){
    var panels = document.querySelectorAll('.step-panel');
    var panel = panels[step];
    var inputs = panel.querySelectorAll('[required]');
    for (var i = 0; i < inputs.length; i++) {
      if (!inputs[i].value.trim()) {
        inputs[i].focus();
        inputs[i].style.borderColor = 'var(--danger)';
        setTimeout(function(el){ el.style.borderColor = ''; }.bind(null, inputs[i]), 2000);
        showToast('Please fill all required fields', 'error');
        return false;
      }
    }

    if (step === 0) {
      var photo = document.getElementById('fPhoto');
      if (photo.hasAttribute('required') && !photo.files[0]) {
        showToast('Please upload shop photo', 'error');
        return false;
      }
    }

    if (step === 1) {
      var gst = document.getElementById('fGst').value.trim().toUpperCase();
      var gstRe = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstRe.test(gst)) { showToast('Invalid GST number format', 'error'); return false; }
      var pan = document.getElementById('fPan').value.trim().toUpperCase();
      var panRe = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRe.test(pan)) { showToast('Invalid PAN number format', 'error'); return false; }
    }

    if (step === 2) {
      var g = (document.getElementById('fGstName').value||'').trim().toUpperCase();
      var b = (document.getElementById('fBeneName').value||'').trim().toUpperCase();
      if (g && b && g !== b) {
        showToast('Beneficiary name must match GST registered name', 'error');
        return false;
      }
    }

    return true;
  }

  function goStep(target){
    if (target < 0 || target >= STEPS.length) return;
    if (target > currentStep && !validateStep(currentStep)) return;
    if (target === 4) buildReview();

    currentStep = target;
    document.querySelectorAll('.step-panel').forEach(function(p,i){ p.classList.toggle('active', i===target); });
    document.querySelectorAll('.step-item').forEach(function(s,i){
      s.classList.toggle('active', i===target);
      s.classList.toggle('done', i<target);
    });
    document.getElementById('btnPrev').style.visibility = target > 0 ? 'visible' : 'hidden';
    document.getElementById('btnNext').style.display = target < 4 ? '' : 'none';
    document.getElementById('btnSubmit').style.display = target === 4 ? '' : 'none';
  }

  function buildReview(){
    var v = function(id){ return (document.getElementById(id)?.value||'').trim(); };
    var same = document.getElementById('fSameAddr').checked;

    document.getElementById('reviewSummary').innerHTML =
      '<div class="section-title">🏢 Business</div>'
      + '<div class="kyc-detail-grid mb-2">'
      + '<div class="lbl">Name</div><div class="val">'+esc(v('fName'))+'</div>'
      + '<div class="lbl">Email</div><div class="val">'+esc(v('fEmail'))+'</div>'
      + '<div class="lbl">Organization</div><div class="val">'+esc(v('fOrg'))+'</div>'
      + '</div>'
      + '<div class="section-title">📄 GST & Tax</div>'
      + '<div class="kyc-detail-grid mb-2">'
      + '<div class="lbl">GST Number</div><div class="val">'+esc(v('fGst'))+'</div>'
      + '<div class="lbl">GST Name</div><div class="val">'+esc(v('fGstName'))+'</div>'
      + '<div class="lbl">PAN Number</div><div class="val">'+esc(v('fPan'))+'</div>'
      + '</div>'
      + '<div class="section-title">🏦 Bank</div>'
      + '<div class="kyc-detail-grid mb-2">'
      + '<div class="lbl">Bank</div><div class="val">'+esc(v('fBankName'))+'</div>'
      + '<div class="lbl">Account No.</div><div class="val">'+esc(v('fAccNo'))+'</div>'
      + '<div class="lbl">IFSC</div><div class="val">'+esc(v('fIfsc'))+'</div>'
      + '<div class="lbl">Beneficiary</div><div class="val">'+esc(v('fBeneName'))+'</div>'
      + '</div>'
      + '<div class="section-title">📍 Addresses</div>'
      + '<div class="kyc-detail-grid mb-2">'
      + '<div class="lbl">Pickup</div><div class="val">'+esc(v('fAddr')+', '+v('fCity')+', '+v('fState')+' - '+v('fPin'))+'</div>'
      + '<div class="lbl">Billing</div><div class="val">'+(same ? 'Same as pickup' : esc(v('fBillAddr')+', '+v('fBillCity')+', '+v('fBillState')+' - '+v('fBillPin')))+'</div>'
      + '<div class="lbl">Location</div><div class="val">'+(geoCoords ? '✅ Captured' : '❌ Not captured')+'</div>'
      + '<div class="lbl">Self Delivery</div><div class="val">'+(document.getElementById('fSelfDel').checked?'Yes':'No')+'</div>'
      + '</div>'
      + '<p style="text-align:center;color:var(--text-light);font-size:12px;margin-top:16px">Please review all details. Once submitted, your KYC will be reviewed by our team.</p>';
  }

  async function submitKyc(e){
    e.preventDefault();
    var btn = document.getElementById('btnSubmit');
    btn.disabled = true;
    btn.textContent = 'Submitting...';

    var fd = new FormData();
    fd.append('name', document.getElementById('fName').value.trim());
    fd.append('email', document.getElementById('fEmail').value.trim());
    fd.append('organizationName', document.getElementById('fOrg').value.trim());
    fd.append('gstNumber', document.getElementById('fGst').value.trim().toUpperCase());
    fd.append('gstRegisteredName', document.getElementById('fGstName').value.trim());
    fd.append('panNumber', document.getElementById('fPan').value.trim().toUpperCase());
    fd.append('bankName', document.getElementById('fBankName').value.trim());
    fd.append('bankAccountNumber', document.getElementById('fAccNo').value.trim());
    fd.append('bankIfscCode', document.getElementById('fIfsc').value.trim().toUpperCase());
    fd.append('bankBeneficiaryName', document.getElementById('fBeneName').value.trim());
    fd.append('shopAddress', document.getElementById('fAddr').value.trim());
    fd.append('city', document.getElementById('fCity').value.trim());
    fd.append('state', document.getElementById('fState').value.trim());
    fd.append('pincode', document.getElementById('fPin').value.trim());
    fd.append('selfDeliveryEnabled', document.getElementById('fSelfDel').checked);
    fd.append('billingAddressSameAsShop', document.getElementById('fSameAddr').checked);

    var freeDel = document.getElementById('fFreeDel').value;
    if (freeDel) fd.append('freeDeliveryAbove', freeDel);

    if (!document.getElementById('fSameAddr').checked) {
      fd.append('billingAddress', JSON.stringify({
        address: document.getElementById('fBillAddr').value.trim(),
        city: document.getElementById('fBillCity').value.trim(),
        state: document.getElementById('fBillState').value.trim(),
        pincode: document.getElementById('fBillPin').value.trim(),
      }));
    }

    if (geoCoords) {
      fd.append('location', JSON.stringify({ type: 'Point', coordinates: geoCoords }));
    }

    var photo = document.getElementById('fPhoto').files[0];
    if (photo) fd.append('photo', photo);
    var gstCert = document.getElementById('fGstCert').files[0];
    if (gstCert) fd.append('gstCertificateImage', gstCert);
    var passbook = document.getElementById('fPassbook').files[0];
    if (passbook) fd.append('passbookImage', passbook);

    try {
      await API.upload('/partner/kyc', fd);
      showToast('KYC submitted successfully! We will review and verify.', 'success');
      load();
    } catch(err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = '🚀 Submit KYC';
    }
  }

  load();
})();
