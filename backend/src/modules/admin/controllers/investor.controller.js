const Investor = require("../../../models/Investor");
const InvestorPurchase = require("../../../models/InvestorPurchase");
const InvestorWithdrawal = require("../../../models/InvestorWithdrawal");
const AppSettings = require("../../../models/AppSettings");

// GET /admin/investors
async function listInvestors(req, res) {
  const { page = 1, limit = 20, status, kycStatus } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (kycStatus) filter.kycStatus = kycStatus;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [investors, total] = await Promise.all([
    Investor.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
    Investor.countDocuments(filter),
  ]);
  return res.json({ success: true, investors, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
}

// GET /admin/investors/:id
async function getInvestor(req, res) {
  const investor = await Investor.findById(req.params.id).lean();
  if (!investor) return res.status(404).json({ success: false, message: "Not found" });
  const [purchases, withdrawals] = await Promise.all([
    InvestorPurchase.find({ investor: investor._id }).sort({ createdAt: -1 }).lean(),
    InvestorWithdrawal.find({ investor: investor._id }).sort({ createdAt: -1 }).lean(),
  ]);
  return res.json({ success: true, investor, purchases, withdrawals });
}

// PUT /admin/investors/:id/kyc — approve or reject KYC
async function updateKyc(req, res) {
  const { kycStatus, adminNote } = req.body;
  if (!["approved", "rejected"].includes(kycStatus)) return res.status(400).json({ success: false, message: "kycStatus must be approved or rejected" });
  const investor = await Investor.findByIdAndUpdate(
    req.params.id,
    { kycStatus, ...(adminNote && { adminNote }), ...(kycStatus === "approved" && { status: "approved" }) },
    { new: true }
  );
  if (!investor) return res.status(404).json({ success: false, message: "Not found" });
  return res.json({ success: true, investor });
}

// PUT /admin/investors/purchases/:purchaseId — approve/reject purchase + assign slot IDs
async function updatePurchase(req, res) {
  const { status, slotIds, adminNote } = req.body;
  if (!["approved", "rejected"].includes(status)) return res.status(400).json({ success: false, message: "status must be approved or rejected" });

  const purchase = await InvestorPurchase.findById(req.params.purchaseId);
  if (!purchase) return res.status(404).json({ success: false, message: "Purchase not found" });

  purchase.status = status;
  if (adminNote) purchase.adminNote = adminNote;

  if (status === "approved") {
    const ids = Array.isArray(slotIds) ? slotIds : (slotIds ? String(slotIds).split(",").map(s => s.trim()).filter(Boolean) : []);
    purchase.slotIds = ids;
    purchase.slotsApproved = ids.length || purchase.slotsRequested;
    purchase.approvedAt = new Date();
    purchase.approvedBy = req.user.userId;

    // Credit investor
    await Investor.findByIdAndUpdate(purchase.investor, {
      $inc: { totalSlotsOwned: purchase.slotsApproved },
    });
  }

  await purchase.save();
  return res.json({ success: true, purchase });
}

// PUT /admin/investors/withdrawals/:withdrawalId — process withdrawal
async function updateWithdrawal(req, res) {
  const { status, utrNumber, adminNote } = req.body;
  if (!["approved", "rejected", "processed"].includes(status)) return res.status(400).json({ success: false, message: "Invalid status" });

  const withdrawal = await InvestorWithdrawal.findById(req.params.withdrawalId);
  if (!withdrawal) return res.status(404).json({ success: false, message: "Withdrawal not found" });

  const prevStatus = withdrawal.status;
  withdrawal.status = status;
  if (utrNumber) withdrawal.utrNumber = utrNumber;
  if (adminNote) withdrawal.adminNote = adminNote;
  if (status === "processed") {
    withdrawal.processedAt = new Date();
    withdrawal.processedBy = req.user.userId;
    // Update investor totals
    await Investor.findByIdAndUpdate(withdrawal.investor, {
      $inc: { totalWithdrawn: withdrawal.amountInRupees },
    });
  }

  // If rejected, refund points
  if (status === "rejected" && prevStatus === "pending") {
    await Investor.findByIdAndUpdate(withdrawal.investor, {
      $inc: { pointsBalance: withdrawal.pointsRequested },
    });
  }

  await withdrawal.save();
  return res.json({ success: true, withdrawal });
}

// POST /admin/investors/:id/credit-points — manually credit points
async function creditPoints(req, res) {
  const { points, reason } = req.body;
  if (!points || points <= 0) return res.status(400).json({ success: false, message: "Points must be > 0" });
  const investor = await Investor.findByIdAndUpdate(
    req.params.id,
    { $inc: { pointsBalance: Number(points), totalEarned: Number(points) } },
    { new: true }
  );
  if (!investor) return res.status(404).json({ success: false, message: "Not found" });
  return res.json({ success: true, investor, credited: Number(points), reason });
}

// GET /admin/investors/analytics
async function analytics(req, res) {
  const [
    totalInvestors, approvedInvestors, pendingKyc,
    totalPurchases, pendingPurchases,
    totalWithdrawals, pendingWithdrawals,
    slotPriceSetting,
  ] = await Promise.all([
    Investor.countDocuments(),
    Investor.countDocuments({ status: "approved" }),
    Investor.countDocuments({ kycStatus: "submitted" }),
    InvestorPurchase.countDocuments({ status: "approved" }),
    InvestorPurchase.countDocuments({ status: "pending" }),
    InvestorWithdrawal.countDocuments({ status: "processed" }),
    InvestorWithdrawal.countDocuments({ status: "pending" }),
    AppSettings.findOne({ key: "investor_slot_price" }).lean(),
  ]);

  const slotAgg = await InvestorPurchase.aggregate([
    { $match: { status: "approved" } },
    { $group: { _id: null, totalSlots: { $sum: "$slotsApproved" }, totalRevenue: { $sum: "$totalAmount" } } },
  ]);
  const withdrawAgg = await InvestorWithdrawal.aggregate([
    { $match: { status: "processed" } },
    { $group: { _id: null, totalPaid: { $sum: "$amountInRupees" } } },
  ]);

  return res.json({
    success: true,
    analytics: {
      totalInvestors, approvedInvestors, pendingKyc,
      totalPurchases, pendingPurchases,
      totalWithdrawals, pendingWithdrawals,
      totalSlotsSold: slotAgg[0]?.totalSlots || 0,
      totalRevenue: slotAgg[0]?.totalRevenue || 0,
      totalPayoutsDone: withdrawAgg[0]?.totalPaid || 0,
      slotPrice: Number(slotPriceSetting?.value) || 1000,
    },
  });
}

module.exports = { listInvestors, getInvestor, updateKyc, updatePurchase, updateWithdrawal, creditPoints, analytics };
