const Payout = require("../../../models/Payout");

async function getMyPayouts(req, res) {
  const { page = 1, limit = 20, status } = req.query;
  const filter = { partner: req.user.userId };
  if (status) filter.status = status;

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [payouts, total] = await Promise.all([
    Payout.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)),
    Payout.countDocuments(filter),
  ]);

  return res.json({
    success: true, payouts,
    pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total, pages: Math.ceil(total / parseInt(limit, 10)) },
  });
}

module.exports = { getMyPayouts };
