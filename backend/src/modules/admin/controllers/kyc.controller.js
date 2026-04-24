const PartnerKyc = require("../../../models/PartnerKyc");

// GET /admin/kyc
async function listKyc(req, res) {
  const { status, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const [kycs, total] = await Promise.all([
    PartnerKyc.find(filter).populate("partner", "phone name").populate("category", "name")
      .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)),
    PartnerKyc.countDocuments(filter),
  ]);

  return res.json({
    success: true, kycs,
    pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total, pages: Math.ceil(total / parseInt(limit, 10)) },
  });
}

// PUT /admin/kyc/:id/review
async function reviewKyc(req, res) {
  const { status, rejectionReason } = req.body;
  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ success: false, message: "Status must be approved or rejected" });
  }

  const kyc = await PartnerKyc.findById(req.params.id);
  if (!kyc) return res.status(404).json({ success: false, message: "KYC not found" });

  kyc.status = status;
  kyc.rejectionReason = status === "rejected" ? rejectionReason : null;
  kyc.reviewedBy = req.user.userId;
  kyc.reviewedAt = new Date();
  await kyc.save();

  return res.json({ success: true, kyc });
}

module.exports = { listKyc, reviewKyc };
