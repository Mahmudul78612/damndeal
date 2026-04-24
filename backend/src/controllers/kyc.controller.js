const PartnerKyc = require("../models/PartnerKyc");
const User = require("../models/User");
const { kycSubmitSchema, kycReviewSchema } = require("../validators/kyc.validator");

// POST /partner/kyc — submit KYC (partner)
async function submitKyc(req, res) {
  const { error } = kycSubmitSchema.validate(req.body);
  if (error) return res.status(400).json({ success: false, message: error.details[0].message });

  if (!req.file) {
    return res.status(400).json({ success: false, message: "Photo is required" });
  }

  const existing = await PartnerKyc.findOne({ partner: req.user.userId });
  if (existing) {
    return res.status(409).json({
      success: false,
      message: `KYC already submitted (status: ${existing.status})`,
    });
  }

  const kyc = await PartnerKyc.create({
    partner: req.user.userId,
    ...req.body,
    photo: `/uploads/kyc/${req.file.filename}`,
  });

  // Update user profile too
  await User.findByIdAndUpdate(req.user.userId, {
    name: req.body.name,
    email: req.body.email,
    isProfileComplete: true,
  });

  return res.status(201).json({ success: true, kyc });
}

// GET /partner/kyc — get own KYC status
async function getMyKyc(req, res) {
  const kyc = await PartnerKyc.findOne({ partner: req.user.userId })
    .populate("category", "name slug");

  if (!kyc) {
    return res.status(404).json({ success: false, message: "KYC not submitted yet" });
  }

  return res.json({ success: true, kyc });
}

// GET /admin/kyc — list all KYCs (admin)
async function listKyc(req, res) {
  const { status, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const [kycs, total] = await Promise.all([
    PartnerKyc.find(filter)
      .populate("partner", "phone")
      .populate("category", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10)),
    PartnerKyc.countDocuments(filter),
  ]);

  return res.json({
    success: true,
    kycs,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total,
      pages: Math.ceil(total / parseInt(limit, 10)),
    },
  });
}

// PUT /admin/kyc/:id/review — approve / reject (admin)
async function reviewKyc(req, res) {
  const { error } = kycReviewSchema.validate(req.body);
  if (error) return res.status(400).json({ success: false, message: error.details[0].message });

  const kyc = await PartnerKyc.findById(req.params.id);
  if (!kyc) return res.status(404).json({ success: false, message: "KYC not found" });

  kyc.status = req.body.status;
  kyc.rejectionReason = req.body.rejectionReason || null;
  kyc.reviewedBy = req.user.userId;
  kyc.reviewedAt = new Date();
  await kyc.save();

  return res.json({ success: true, kyc });
}

module.exports = { submitKyc, getMyKyc, listKyc, reviewKyc };
