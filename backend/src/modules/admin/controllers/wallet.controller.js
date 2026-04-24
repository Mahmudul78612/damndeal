const Wallet = require("../../../models/Wallet");
const WalletTransaction = require("../../../models/WalletTransaction");
const walletService = require("../../../services/wallet.service");

// GET /admin/wallets — list all wallets
async function listWallets(req, res) {
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const [wallets, total] = await Promise.all([
    Wallet.find().populate("user", "name phone role")
      .sort({ balance: -1 }).skip(skip).limit(parseInt(limit, 10)),
    Wallet.countDocuments(),
  ]);

  return res.json({
    success: true, wallets,
    pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total, pages: Math.ceil(total / parseInt(limit, 10)) },
  });
}

// GET /admin/wallets/:userId/transactions
async function getTransactions(req, res) {
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const [txns, total] = await Promise.all([
    WalletTransaction.find({ user: req.params.userId })
      .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)),
    WalletTransaction.countDocuments({ user: req.params.userId }),
  ]);

  const wallet = await walletService.getOrCreateWallet(req.params.userId);

  return res.json({
    success: true, balance: wallet.balance, transactions: txns,
    pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total, pages: Math.ceil(total / parseInt(limit, 10)) },
  });
}

// POST /admin/wallets/:userId/credit — manual credit by admin
async function adminCredit(req, res) {
  const { amount, description } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ success: false, message: "Valid amount required" });

  const { wallet, transaction } = await walletService.credit(
    req.params.userId, amount, "admin", description || "Admin credit"
  );

  return res.json({ success: true, balance: wallet.balance, transaction });
}

module.exports = { listWallets, getTransactions, adminCredit };
