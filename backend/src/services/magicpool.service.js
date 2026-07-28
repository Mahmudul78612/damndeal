/**
 * Magic Pool service — raffle / wheel-of-fortune over Magic Clubs.
 *
 * Flow:
 *   1) Order is delivered → user gets a Magic Club.
 *   2) User picks an open pool and joins (one entry per orderId).
 *   3) When pool fills (participants.length === capacity), `_drawWinner`
 *      is invoked atomically: status flips "open"→"drawing", a CSPRNG
 *      seed is generated, the winner is selected, status becomes "drawn".
 *   4) Winner is notified via WhatsApp (best-effort).
 */
const crypto = require("crypto");
const mongoose = require("mongoose");
const MagicPool = require("../models/MagicPool");
const Order = require("../models/Order");
const User = require("../models/User");

/**
 * List open, active pools (optionally filtered by platform).
 */
async function listOpenPools({ platform } = {}) {
  const filter = { isActive: true, status: "open" };
  if (platform && platform !== "any") {
    filter.platform = { $in: [platform, "any"] };
  }
  const pools = await MagicPool.find(filter).sort({ createdAt: -1 }).lean({ virtuals: true });
  return pools;
}

/**
 * Public-safe pool view (hides participant user details from non-owners).
 */
function publicView(pool, viewerUserId = null) {
  if (!pool) return null;
  const obj = typeof pool.toObject === "function" ? pool.toObject({ virtuals: true }) : { ...pool };
  obj.participantsCount = (obj.participants || []).length;
  obj.seatsLeft = Math.max(0, obj.capacity - obj.participantsCount);
  obj.isFull = obj.participantsCount >= obj.capacity;
  // Hide raw participant list from non-admin viewers; only flag if viewer joined.
  if (viewerUserId) {
    obj.joined = (obj.participants || []).some((p) => String(p.user) === String(viewerUserId));
  }
  delete obj.participants;
  // Hide the random seed from public view
  if (obj.winner) delete obj.winner.seed;
  return obj;
}

/**
 * Add a participant to a pool. Atomic — uses `findOneAndUpdate` so two
 * concurrent joins can't exceed capacity.
 *
 * One entry per (pool, order) combo.
 */
async function joinPool({ poolId, userId, orderId, clubId }) {
  if (!poolId || !userId) throw _err(400, "poolId and userId are required");

  // Validate the order: must belong to user, must be delivered, must not have
  // already been used to join *this* pool.
  let orderDoc = null;
  if (orderId) {
    orderDoc = await Order.findOne({ _id: orderId, user: userId }).lean();
    if (!orderDoc) throw _err(404, "Order not found");
    if (orderDoc.status !== "delivered") {
      throw _err(400, "Only delivered orders can join a pool");
    }
  }

  // Atomically push only if pool is open AND not yet full AND this order
  // hasn't already been used for this pool.
  const updated = await MagicPool.findOneAndUpdate(
    {
      _id: poolId,
      isActive: true,
      status: "open",
      $expr: { $lt: [{ $size: "$participants" }, "$capacity"] },
      ...(orderId ? { "participants.order": { $ne: new mongoose.Types.ObjectId(orderId) } } : {}),
    },
    {
      $push: {
        participants: {
          user: userId,
          order: orderId || null,
          clubId: clubId || null,
          joinedAt: new Date(),
        },
      },
    },
    { new: true }
  );

  if (!updated) {
    // Figure out *why* the update was rejected for a better error.
    const fresh = await MagicPool.findById(poolId);
    if (!fresh) throw _err(404, "Pool not found");
    if (!fresh.isActive) throw _err(400, "Pool is inactive");
    if (fresh.status !== "open") throw _err(400, `Pool is already ${fresh.status}`);
    if (fresh.participants.length >= fresh.capacity) throw _err(409, "Pool is full");
    if (orderId && fresh.participants.some((p) => String(p.order) === String(orderId))) {
      throw _err(409, "This order has already joined this pool");
    }
    throw _err(500, "Could not join pool");
  }

  // If we just hit capacity, kick off the draw asynchronously.
  if (updated.participants.length >= updated.capacity && updated.status === "open") {
    setImmediate(() => _drawWinner(updated._id).catch((e) => {
      console.error(`[MAGICPOOL] Auto-draw failed for ${updated._id}:`, e.message);
    }));
  }

  return updated;
}

/**
 * Draw a winner using crypto-secure random. Idempotent — only operates
 * if status is currently "open" (CAS to "drawing"). If multiple callers
 * race, only the first one will succeed.
 */
async function _drawWinner(poolId) {
  const claim = await MagicPool.findOneAndUpdate(
    { _id: poolId, status: "open" },
    { $set: { status: "drawing" } },
    { new: true }
  );
  if (!claim) {
    // Already being drawn or already drawn.
    return null;
  }

  const total = claim.participants.length;
  if (total === 0) {
    claim.status = "open"; // nothing to draw
    await claim.save();
    return null;
  }

  const seed = crypto.randomBytes(32).toString("hex");
  // Convert first 6 bytes of seed → integer → modulo participant count
  const idx = parseInt(seed.slice(0, 12), 16) % total;
  const winnerEntry = claim.participants[idx];

  claim.winner = {
    user: winnerEntry.user,
    participantId: winnerEntry._id,
    drawnAt: new Date(),
    seed,
  };
  claim.status = "drawn";
  await claim.save();

  // Notify (best-effort, never blocks)
  setImmediate(() => _notifyWinner(claim).catch((e) => {
    console.error(`[MAGICPOOL] Notify winner failed for ${poolId}:`, e.message);
  }));

  console.log(`[MAGICPOOL] Pool ${claim.name} drawn → winner=${winnerEntry.user} idx=${idx}/${total}`);
  return claim;
}

async function _notifyWinner(pool) {
  try {
    const user = await User.findById(pool.winner.user).select("name phone").lean();
    if (!user) return;
    // Reuse Fast2SMS WhatsApp template if a "magic_pool_winner" template id is set,
    // otherwise just log. Template setup is optional.
    const AppSettings = require("../models/AppSettings");
    const tpl = await AppSettings.findOne({ key: "fast2sms_tpl_pool_winner" }).lean();
    if (!tpl?.value) {
      console.log(`[MAGICPOOL] Winner ${user.name || user.phone} for pool ${pool.name} (no notification template configured)`);
      return;
    }
    const notify = require("./notification.service");
    if (typeof notify._sendFast2SmsWhatsApp === "function") {
      await notify._sendFast2SmsWhatsApp(tpl.value, user.phone, [
        user.name || "Customer",
        pool.name,
        pool.prizeDescription || "Magic prize",
      ]);
    }
  } catch (e) {
    console.error("[MAGICPOOL] notify err:", e.message);
  }
}

/**
 * Force a draw (admin action). Useful if a pool is closed early.
 */
async function forceDraw(poolId) {
  const pool = await MagicPool.findById(poolId);
  if (!pool) throw _err(404, "Pool not found");
  if (pool.status === "drawn") throw _err(400, "Pool already drawn");
  if (pool.status === "cancelled") throw _err(400, "Pool is cancelled");
  if (!pool.participants?.length) throw _err(400, "Pool has no participants");

  // Force status to open so _drawWinner's CAS can claim it.
  pool.status = "open";
  await pool.save();
  return _drawWinner(poolId);
}

/**
 * Get pools the user has joined (with their position in the participant list).
 */
async function getUserPools(userId) {
  const pools = await MagicPool.find({ "participants.user": userId })
    .sort({ updatedAt: -1 })
    .lean({ virtuals: true });
  return pools.map((p) => {
    const entry = (p.participants || []).find((x) => String(x.user) === String(userId));
    const isWinner = p.winner && p.winner.user && String(p.winner.user) === String(userId);
    return {
      _id: p._id,
      name: p.name,
      description: p.description,
      prizeDescription: p.prizeDescription,
      prizePoints: p.prizePoints,
      imageUrl: p.imageUrl,
      images: p.images || [],
      tagline: p.tagline || "",
      theme: p.theme || "fuchsia",
      capacity: p.capacity,
      participantsCount: (p.participants || []).length,
      status: p.status,
      joinedAt: entry?.joinedAt || null,
      orderId: entry?.order || null,
      isWinner,
      winnerDrawnAt: p.winner?.drawnAt || null,
    };
  });
}

function _err(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

module.exports = {
  listOpenPools,
  joinPool,
  forceDraw,
  getUserPools,
  publicView,
  _drawWinner,
};
