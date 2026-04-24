(async function () {
  document.body.innerHTML = pageShell("KYC Requests");
  buildLayout("kyc");

  const content = document.getElementById("page-content");
  const BASE = CONFIG.API_BASE.replace('/api','');
  let statusFilter = "";

  const style = document.createElement('style');
  style.textContent = `
    .kyc-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;font-size:13px}
    .kyc-detail-grid .lbl{color:var(--text-light);font-weight:500}
    .kyc-detail-grid .val{font-weight:600;word-break:break-word}
    .kyc-section{font-size:13px;font-weight:600;color:var(--primary);margin:14px 0 8px;border-bottom:1px solid var(--border);padding-bottom:4px}
    .doc-imgs{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0}
    .doc-imgs img{width:140px;height:100px;object-fit:cover;border-radius:6px;border:1px solid var(--border);cursor:pointer}
    .doc-imgs img:hover{border-color:var(--primary);box-shadow:0 2px 8px rgba(0,0,0,.15)}
    .kyc-card{border-left:3px solid var(--border);padding-left:14px;margin-bottom:10px}
    .kyc-card.pending{border-color:var(--warning)}
    .kyc-card.approved{border-color:var(--success)}
    .kyc-card.rejected{border-color:var(--danger)}
    .name-match-badge{font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600}
    .match-ok{background:#D1FAE5;color:#065F46}
    .match-err{background:#FEE2E2;color:#991B1B}
    .review-actions{display:flex;gap:8px;margin-top:12px}
    .reject-input{width:100%;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;margin-top:8px}
  `;
  document.head.appendChild(style);

  async function load() {
    content.innerHTML = '<div class="text-center"><div class="spinner"></div></div>';
    try {
      var ep = '/admin/kyc' + (statusFilter ? '?status=' + statusFilter : '');
      var data = await API.get(ep);
      var list = data.kycList || data.kycs || [];

      content.innerHTML = '<div class="toolbar">'
        + '<div class="toolbar-left">'
        + '<select class="form-control" style="width:160px" id="statusFilterSel">'
        + '<option value="">All Status</option>'
        + '<option value="pending" '+(statusFilter==="pending"?"selected":"")+'>Pending</option>'
        + '<option value="approved" '+(statusFilter==="approved"?"selected":"")+'>Approved</option>'
        + '<option value="rejected" '+(statusFilter==="rejected"?"selected":"")+'>Rejected</option>'
        + '</select>'
        + '<span style="font-size:12px;color:var(--text-light)">'+list.length+' result(s)</span>'
        + '</div></div>'
        + '<div id="kycList"></div>';

      document.getElementById('statusFilterSel').addEventListener('change', function(){ statusFilter = this.value; load(); });

      var container = document.getElementById('kycList');
      if (list.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>No KYC requests found</p></div>';
        return;
      }

      container.innerHTML = list.map(function(k){
        var gstName = (k.gstRegisteredName||'').toUpperCase();
        var bankName = (k.bankBeneficiaryName||'').toUpperCase();
        var nameMatch = gstName && bankName ? (gstName === bankName) : null;
        var img = function(path, label){
          return path ? '<div style="margin-top:4px"><small style="color:var(--text-light)">'+label+':</small><div class="doc-imgs"><img src="'+BASE+path+'" onclick="window.open(this.src)"></div></div>' : '';
        };

        return '<div class="card mb-2"><div class="card-body kyc-card '+k.status+'">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
          + '<div><strong style="font-size:15px">'+esc(k.organizationName||k.name||'-')+'</strong>'
          + ' <span style="font-size:12px;color:var(--text-light)">'+esc(k.partner?.phone||'')+'</span></div>'
          + '<div>'+statusBadge(k.status)+' <span style="font-size:11px;color:var(--text-light);margin-left:6px">'+fmtDate(k.createdAt)+'</span></div>'
          + '</div>'

          + '<div class="kyc-section">🏢 Business</div>'
          + '<div class="kyc-detail-grid">'
          + '<div class="lbl">Name</div><div class="val">'+esc(k.name||'-')+'</div>'
          + '<div class="lbl">Email</div><div class="val">'+esc(k.email||'-')+'</div>'
          + '<div class="lbl">Organization</div><div class="val">'+esc(k.organizationName||'-')+'</div>'
          + '</div>'
          + img(k.photo, 'Shop Photo')

          + '<div class="kyc-section">📄 GST & Tax</div>'
          + '<div class="kyc-detail-grid">'
          + '<div class="lbl">GST Number</div><div class="val">'+esc(k.gstNumber||'-')+'</div>'
          + '<div class="lbl">GST Registered Name</div><div class="val">'+esc(k.gstRegisteredName||'-')+'</div>'
          + '<div class="lbl">PAN Number</div><div class="val">'+esc(k.panNumber||'-')+'</div>'
          + '</div>'
          + img(k.gstCertificateImage, 'GST Certificate')

          + '<div class="kyc-section">🏦 Bank Details</div>'
          + '<div class="kyc-detail-grid">'
          + '<div class="lbl">Bank Name</div><div class="val">'+esc(k.bankName||'-')+'</div>'
          + '<div class="lbl">Account Number</div><div class="val">'+esc(k.bankAccountNumber||'-')+'</div>'
          + '<div class="lbl">IFSC Code</div><div class="val">'+esc(k.bankIfscCode||'-')+'</div>'
          + '<div class="lbl">Beneficiary Name</div><div class="val">'+esc(k.bankBeneficiaryName||'-')
          + (nameMatch !== null ? ' <span class="name-match-badge '+(nameMatch?'match-ok':'match-err')+'">'+(nameMatch?'✅ Matches GST':'❌ Mismatch with GST')+'</span>' : '')
          + '</div>'
          + '</div>'
          + img(k.passbookImage, 'Passbook / Cheque')

          + '<div class="kyc-section">📍 Addresses</div>'
          + '<div class="kyc-detail-grid">'
          + '<div class="lbl">Pickup Address</div><div class="val">'+esc((k.shopAddress||'')+', '+(k.city||'')+', '+(k.state||'')+' - '+(k.pincode||''))+'</div>'
          + '<div class="lbl">Billing Address</div><div class="val">'
          + (k.billingAddressSameAsShop ? 'Same as pickup' : esc(((k.billingAddress&&k.billingAddress.address)||'')+', '+((k.billingAddress&&k.billingAddress.city)||'')+', '+((k.billingAddress&&k.billingAddress.state)||'')+' - '+((k.billingAddress&&k.billingAddress.pincode)||'')))
          + '</div>'
          + '<div class="lbl">Self Delivery</div><div class="val">'+(k.selfDeliveryEnabled?'Yes':'No')+'</div>'
          + '<div class="lbl">Free Delivery Above</div><div class="val">'+(k.freeDeliveryAbove?fmtCurrency(k.freeDeliveryAbove):'-')+'</div>'
          + '</div>'

          + (k.status === 'pending' ? '<div class="review-actions">'
            + '<button class="btn btn-success" onclick="approveKyc(\''+k._id+'\')">✅ Approve</button>'
            + '<button class="btn btn-danger" onclick="showRejectBox(\''+k._id+'\')">❌ Reject</button></div>'
            + '<div id="reject-'+k._id+'" style="display:none"><input class="reject-input" id="reason-'+k._id+'" placeholder="Enter rejection reason...">'
            + '<button class="btn btn-danger btn-sm mt-1" onclick="rejectKyc(\''+k._id+'\')">Confirm Reject</button></div>'
            : '')
          + (k.status === 'rejected' && k.rejectionReason ? '<div style="margin-top:8px;font-size:12px;color:var(--danger)"><strong>Rejection Reason:</strong> '+esc(k.rejectionReason)+'</div>' : '')

          + '</div></div>';
      }).join('');

    } catch (err) {
      content.innerHTML = '<div class="empty-state"><p>'+err.message+'</p></div>';
    }
  }

  window.approveKyc = async function(id) {
    try {
      await API.put('/admin/kyc/'+id+'/review', { status: 'approved' });
      showToast('KYC Approved!', 'success');
      load();
    } catch (err) { showToast(err.message, 'error'); }
  };

  window.showRejectBox = function(id) {
    var box = document.getElementById('reject-'+id);
    if (box) box.style.display = box.style.display === 'none' ? '' : 'none';
  };

  window.rejectKyc = async function(id) {
    var reason = document.getElementById('reason-'+id)?.value?.trim();
    if (!reason) { showToast('Please enter a rejection reason', 'error'); return; }
    try {
      await API.put('/admin/kyc/'+id+'/review', { status: 'rejected', rejectionReason: reason });
      showToast('KYC Rejected');
      load();
    } catch (err) { showToast(err.message, 'error'); }
  };

  load();
})();
