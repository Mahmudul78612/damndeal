const Investor = require("../../../models/Investor");
const InvestorPurchase = require("../../../models/InvestorPurchase");
const InvestorWithdrawal = require("../../../models/InvestorWithdrawal");
const AppSettings = require("../../../models/AppSettings");
// upload middleware used in routes, not here

// Slot price is expressed in POINTS, scoped per region.
// Admin can override via AppSettings keys investor_slot_price_IN / _US.
// Defaults: India = 5,000 points · Global = 500 points.
// Point value: 1 point = 1 cent of the investor's local currency.
const DEFAULT_SLOT_POINTS = { IN: 5000, US: 500 };

async function getSlotPrice(region) {
  const r = region === "US" ? "US" : "IN";
  const setting = await AppSettings.findOne({ key: `investor_slot_price_${r}` }).lean();
  return Number(setting?.value) || DEFAULT_SLOT_POINTS[r];
}

// GET /investor/me — dashboard data
async function getMe(req, res) {
  const investor = await Investor.findById(req.user.userId).lean();
  if (!investor) return res.status(404).json({ success: false, message: "Not found" });

  const [purchases, withdrawals] = await Promise.all([
    InvestorPurchase.find({ investor: investor._id }).sort({ createdAt: -1 }).lean(),
    InvestorWithdrawal.find({ investor: investor._id }).sort({ createdAt: -1 }).lean(),
  ]);

  const slotPrice = await getSlotPrice(investor.region);

  return res.json({
    success: true,
    investor,
    region: investor.region || "IN",
    slotPrice, // in points
    purchases,
    withdrawals,
  });
}

// PUT /investor/me — update profile / bank details
async function updateMe(req, res) {
  const { name, email, bankDetails } = req.body;
  const update = {};
  if (name) update.name = name;
  if (email) update.email = email;
  if (bankDetails) update.bankDetails = bankDetails;

  const investor = await Investor.findByIdAndUpdate(req.user.userId, update, { new: true });
  return res.json({ success: true, investor });
}

// POST /investor/kyc — upload KYC document
async function submitKyc(req, res) {
  const investor = await Investor.findById(req.user.userId);
  if (!investor) return res.status(404).json({ success: false, message: "Not found" });

  const { docType } = req.body;
  if (!docType) return res.status(400).json({ success: false, message: "docType required" });
  if (!req.file) return res.status(400).json({ success: false, message: "Document file required" });

  const url = `/uploads/${req.file.filename}`;
  investor.kycDocuments.push({ docType, url });
  investor.kycStatus = "submitted";
  await investor.save();

  return res.json({ success: true, message: "KYC submitted", investor });
}

// POST /investor/purchase — request slot purchase
async function requestPurchase(req, res) {
  const { slotsRequested, transactionRef } = req.body;
  if (!slotsRequested || Number(slotsRequested) < 100) return res.status(400).json({ success: false, message: "Minimum 100 slots required" });

  const investor = await Investor.findById(req.user.userId);
  if (!investor) return res.status(404).json({ success: false, message: "Not found" });
  if (investor.kycStatus !== "approved") return res.status(400).json({ success: false, message: "KYC approval required before purchasing slots" });

  const pricePerSlot = await getSlotPrice(investor.region); // points per slot
  const totalAmount = pricePerSlot * Number(slotsRequested);

  const receiptUrl = req.file ? `/uploads/${req.file.filename}` : null;

  const purchase = await InvestorPurchase.create({
    investor: investor._id,
    slotsRequested: Number(slotsRequested),
    pricePerSlot,
    totalAmount,
    receiptUrl,
    transactionRef,
    status: "pending",
  });

  return res.status(201).json({ success: true, purchase });
}

// POST /investor/withdraw — withdrawal request
async function requestWithdrawal(req, res) {
  const { pointsRequested } = req.body;
  if (!pointsRequested || pointsRequested < 100) return res.status(400).json({ success: false, message: "Minimum 100 points required" });

  const investor = await Investor.findById(req.user.userId);
  if (!investor) return res.status(404).json({ success: false, message: "Not found" });
  if (investor.pointsBalance < pointsRequested) return res.status(400).json({ success: false, message: "Insufficient balance" });
  if (!investor.bankDetails?.accountNumber && !investor.bankDetails?.upiId) {
    return res.status(400).json({ success: false, message: "Bank details required — update your profile first" });
  }

  // Reserve points
  investor.pointsBalance -= Number(pointsRequested);
  await investor.save();

  const withdrawal = await InvestorWithdrawal.create({
    investor: investor._id,
    pointsRequested: Number(pointsRequested),
    amountInRupees: Math.floor(Number(pointsRequested) / 100),
    bankDetails: investor.bankDetails,
    status: "pending",
  });

  return res.status(201).json({ success: true, withdrawal });
}

module.exports = { getMe, updateMe, submitKyc, requestPurchase, requestWithdrawal };
