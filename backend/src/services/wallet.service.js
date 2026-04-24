const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");

/**
 * Get or create wallet for a user.
 */
async function getOrCreateWallet(userId) {
  let wallet = await Wallet.findOne({ user: userId });
  if (!wallet) {
    wallet = await Wallet.create({ user: userId, balance: 0 });
  }
  return wallet;
}

/**
 * Credit money to wallet.
 * @returns {Object} { wallet, transaction }
 */
async function credit(userId, amount, source, description = "", reference = null) {
  const wallet = await getOrCreateWallet(userId);
  wallet.balance += amount;
  await wallet.save();

  const txn = await WalletTransaction.create({
    wallet: wallet._id,
    user: userId,
    type: "credit",
    amount,
    balanceAfter: wallet.balance,
    source,
    reference,
    description,
  });

  return { wallet, transaction: txn };
}

/**
 * Debit money from wallet.
 * @returns {Object} { wallet, transaction } or throws error if insufficient
 */
async function debit(userId, amount, source, description = "", reference = null) {
  const wallet = await getOrCreateWallet(userId);
  if (wallet.balance < amount) {
    throw new Error(`Insufficient wallet balance (₹${wallet.balance} available, ₹${amount} needed)`);
  }

  wallet.balance -= amount;
  await wallet.save();

  const txn = await WalletTransaction.create({
    wallet: wallet._id,
    user: userId,
    type: "debit",
    amount,
    balanceAfter: wallet.balance,
    source,
    reference,
    description,
  });

  return { wallet, transaction: txn };
}

/**
 * Get wallet balance.
 */
async function getBalance(userId) {
  const wallet = await getOrCreateWallet(userId);
  return wallet.balance;
}

module.exports = { getOrCreateWallet, credit, debit, getBalance };
