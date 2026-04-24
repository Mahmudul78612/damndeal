const User = require("../../../models/User");
const Referral = require("../../../models/Referral");
const walletService = require("../../../services/wallet.service");
const { getSetting } = require("../../../services/fee.service");
const crypto = require("crypto");

// GET /user/referral — get my referral code
async function getMyReferral(req, res) {
  let user = await User.findById(req.user.userId).select("referralCode phone name");
  if (!user) return res.status(404).json({ success: false, message: "User not found" });

  // Generate if not exists
  if (!user.referralCode) {
    user.referralCode = "DD" + crypto.randomBytes(4).toString("hex").toUpperCase();
    await user.save();
  }

  const referrals = await Referral.find({ referrer: req.user.userId })
    .populate("referee", "name phone")
    .sort({ createdAt: -1 })
    .lean();

  return res.json({
    success: true,
    referralCode: user.referralCode,
    totalReferrals: referrals.length,
    referrals,
  });
}

// POST /user/referral/apply — apply a referral code (only once, during early usage)
async function applyReferralCode(req, res) {
  const { code } = req.body;
  if (!code) return res.status(400).json({ success: false, message: "Referral code required" });

  const me = await User.findById(req.user.userId);
  if (!me) return res.status(404).json({ success: false, message: "User not found" });

  if (me.referredBy) {
    return res.status(400).json({ success: false, message: "You have already used a referral code" });
  }

  const referrer = await User.findOne({ referralCode: code.toUpperCase(), role: "user" });
  if (!referrer) return res.status(404).json({ success: false, message: "Invalid referral code" });

  if (referrer._id.toString() === me._id.toString()) {
    return res.status(400).json({ success: false, message: "Cannot refer yourself" });
  }

  // Check duplicate
  const existing = await Referral.findOne({ referrer: referrer._id, referee: me._id });
  if (existing) return res.status(400).json({ success: false, message: "Already applied" });

  // Get reward amounts from settings
  const referrerReward = Number(await getSetting("referral_reward_referrer")) || 50;
  const refereeReward = Number(await getSetting("referral_reward_referee")) || 25;

  // Mark referral
  me.referredBy = referrer._id;
  await me.save();

  const referral = await Referral.create({
    referrer: referrer._id,
    referee: me._id,
    referralCode: code.toUpperCase(),
    status: "completed",
    rewards: { referrerAmount: referrerReward, refereeAmount: refereeReward, credited: true },
  });

  // Credit wallets
  await walletService.credit(referrer._id, referrerReward, "referral", `Referral reward — ${me.phone}`, referral._id.toString());
  await walletService.credit(me._id, refereeReward, "referral", `Welcome referral bonus`, referral._id.toString());

  return res.json({ success: true, message: `Referral applied! ₹${refereeReward} added to your wallet.` });
}

module.exports = { getMyReferral, applyReferralCode };
