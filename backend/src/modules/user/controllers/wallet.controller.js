const walletService = require("../../../services/wallet.service");
const WalletTransaction = require("../../../models/WalletTransaction");

// GET /user/wallet
async function getWallet(req, res) {
  const wallet = await walletService.getOrCreateWallet(req.user.userId);
  return res.json({ success: true, balance: wallet.balance });
}

// GET /user/wallet/transactions
async function getTransactions(req, res) {
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const [txns, total] = await Promise.all([
    WalletTransaction.find({ user: req.user.userId })
      .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)),
    WalletTransaction.countDocuments({ user: req.user.userId }),
  ]);

  const wallet = await walletService.getOrCreateWallet(req.user.userId);

  return res.json({
    success: true, balance: wallet.balance, transactions: txns,
    pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total, pages: Math.ceil(total / parseInt(limit, 10)) },
  });
}

module.exports = { getWallet, getTransactions };
