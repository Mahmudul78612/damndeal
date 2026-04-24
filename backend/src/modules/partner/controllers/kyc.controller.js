const PartnerKyc = require("../../../models/PartnerKyc");
const User = require("../../../models/User");

async function submitKyc(req, res) {
  try {
    const files = req.files || {};
    if (!files.photo || !files.photo[0]) {
      return res.status(400).json({ success: false, message: "Shop/Business photo is required" });
    }

    const existing = await PartnerKyc.findOne({ partner: req.user.userId });

    // Allow re-submit only if rejected
    if (existing && existing.status !== "rejected") {
      return res.status(409).json({ success: false, message: `KYC already submitted (status: ${existing.status})` });
    }

    // Validate GST name matches bank beneficiary name
    const gstName = (req.body.gstRegisteredName || "").trim().toUpperCase();
    const bankName = (req.body.bankBeneficiaryName || "").trim().toUpperCase();
    if (bankName && gstName && bankName !== gstName) {
      return res.status(400).json({
        success: false,
        message: "GST Registered Name must match Bank Beneficiary Name",
      });
    }

    // Parse location if sent
    let location;
    if (req.body.location) {
      try { location = JSON.parse(req.body.location); } catch (_) {}
    }

    // Parse billingAddress if sent
    let billingAddress;
    if (req.body.billingAddress) {
      try { billingAddress = JSON.parse(req.body.billingAddress); } catch (_) {}
    }

    const data = {
      partner: req.user.userId,
      name: req.body.name,
      email: req.body.email,
      organizationName: req.body.organizationName,
      gstNumber: req.body.gstNumber,
      gstRegisteredName: req.body.gstRegisteredName,
      panNumber: req.body.panNumber,
      bankAccountNumber: req.body.bankAccountNumber,
      bankIfscCode: req.body.bankIfscCode,
      bankBeneficiaryName: req.body.bankBeneficiaryName,
      bankName: req.body.bankName,
      shopAddress: req.body.shopAddress,
      city: req.body.city,
      state: req.body.state,
      pincode: req.body.pincode,
      billingAddressSameAsShop: req.body.billingAddressSameAsShop === "true",
      selfDeliveryEnabled: req.body.selfDeliveryEnabled === "true",
      freeDeliveryAbove: Number(req.body.freeDeliveryAbove) || 0,
      status: "pending",
      rejectionReason: null,
      // Files
      photo: `/uploads/kyc/${files.photo[0].filename}`,
    };

    if (files.passbookImage && files.passbookImage[0]) {
      data.passbookImage = `/uploads/kyc/${files.passbookImage[0].filename}`;
    }
    if (files.gstCertificateImage && files.gstCertificateImage[0]) {
      data.gstCertificateImage = `/uploads/kyc/${files.gstCertificateImage[0].filename}`;
    }
    if (location) data.location = location;
    if (billingAddress) data.billingAddress = billingAddress;

    let kyc;
    if (existing) {
      // Re-submit on rejection — update existing
      Object.assign(existing, data);
      kyc = await existing.save();
    } else {
      kyc = await PartnerKyc.create(data);
    }

    await User.findByIdAndUpdate(req.user.userId, {
      name: req.body.name,
      email: req.body.email,
      isProfileComplete: true,
    });

    return res.status(201).json({ success: true, kyc });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getMyKyc(req, res) {
  const kyc = await PartnerKyc.findOne({ partner: req.user.userId });
  if (!kyc) return res.status(404).json({ success: false, message: "KYC not submitted yet" });
  return res.json({ success: true, kyc });
}

module.exports = { submitKyc, getMyKyc };
