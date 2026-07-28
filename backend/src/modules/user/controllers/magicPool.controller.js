const poolService = require("../../../services/magicpool.service");
const MagicPool = require("../../../models/MagicPool");

// GET /user/magic-pools  (list open pools)
async function listOpen(req, res) {
  try {
    const pools = await poolService.listOpenPools({ platform: req.query.platform });
    const view = pools.map((p) => poolService.publicView(p, req.user.userId));
    return res.json({ success: true, pools: view });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
}

// GET /user/magic-pools/mine  (pools the user has joined)
async function listMine(req, res) {
  try {
    const pools = await poolService.getUserPools(req.user.userId);
    return res.json({ success: true, pools });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
}

// GET /user/magic-pools/:id  (public detail)
async function getOne(req, res) {
  try {
    const pool = await MagicPool.findById(req.params.id).lean({ virtuals: true });
    if (!pool || !pool.isActive) {
      return res.status(404).json({ success: false, message: "Pool not found" });
    }
    return res.json({ success: true, pool: poolService.publicView(pool, req.user.userId) });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
}

// POST /user/magic-pools/:id/join  { orderId, clubId? }
async function join(req, res) {
  try {
    const { orderId, clubId } = req.body || {};
    if (!orderId) {
      return res.status(400).json({ success: false, message: "orderId is required" });
    }
    const updated = await poolService.joinPool({
      poolId: req.params.id,
      userId: req.user.userId,
      orderId,
      clubId,
    });
    return res.json({
      success: true,
      pool: poolService.publicView(updated, req.user.userId),
    });
  } catch (e) {
    return res.status(e.status || 500).json({ success: false, message: e.message });
  }
}

module.exports = { listOpen, listMine, getOne, join };
