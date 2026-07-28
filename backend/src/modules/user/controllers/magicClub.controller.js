const magicClub = require("../../../services/magicclub.service");

// GET /user/magic-club — list user's clubs (active reward memberships)
async function getClubs(req, res) {
  try {
    const userId = req.user.userId;
    const r = await magicClub.getUserClubs(userId);
    if (r.skipped) return res.json({ success: true, enabled: false, clubs: [] });
    if (!r.ok) return res.status(r.status || 502).json({ success: false, message: r.msg || "Failed to fetch clubs" });
    return res.json({ success: true, enabled: true, clubs: r.data || [] });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
}

// GET /user/magic-club/wallet — points balance + redeemable rupees
async function getWallet(req, res) {
  try {
    const userId = req.user.userId;
    const r = await magicClub.getWallet(userId);
    if (r.skipped) return res.json({ success: true, enabled: false, balance: 0, redeemable: 0 });
    if (!r.ok) return res.status(r.status || 502).json({ success: false, message: r.msg || "Failed to fetch wallet" });
    const data = r.data || {};
    const balance = Number(data.totalAmount ?? data.balance ?? data.points ?? 0);
    const redeemable = await magicClub.pointsToRupees(balance);
    return res.json({
      success: true,
      enabled: true,
      balance,
      redeemable: Math.round(redeemable * 100) / 100,
      wallet: r.data || null,
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
}

// POST /user/magic-club/redeem/initiate { points, purpose } → returns { token, expiresAt, transactionId }
async function initiateRedeem(req, res) {
  try {
    const userId = req.user.userId;
    const points = Math.floor(Number(req.body?.points));
    if (!points || points <= 0) return res.status(400).json({ success: false, message: "points must be a positive integer" });
    const r = await magicClub.initiateDebit({ userId, points, purpose: req.body?.purpose || "Order redemption" });
    if (r.skipped) return res.status(400).json({ success: false, message: "Magic Club is disabled" });
    if (!r.ok) return res.status(r.status || 502).json({ success: false, message: r.msg || "Failed to initiate redemption" });
    const amount = await magicClub.pointsToRupees(points);
    return res.json({ success: true, points, amount: Math.round(amount * 100) / 100, ...r.data });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
}

module.exports = { getClubs, getWallet, initiateRedeem };
