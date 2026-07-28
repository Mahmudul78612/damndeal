const MagicPool = require("../../../models/MagicPool");
const poolService = require("../../../services/magicpool.service");

// GET /admin/magic-pools
async function listPools(req, res) {
  const { status, platform, page = 1, limit = 50 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (platform) filter.platform = platform;

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [pools, total] = await Promise.all([
    MagicPool.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)).lean({ virtuals: true }),
    MagicPool.countDocuments(filter),
  ]);

  // Strip seed from public list (still visible in detail)
  pools.forEach((p) => { if (p.winner) delete p.winner.seed; });

  return res.json({
    success: true,
    pools,
    pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total, pages: Math.ceil(total / parseInt(limit, 10)) },
  });
}

// GET /admin/magic-pools/:id  (full detail incl participants)
async function getPool(req, res) {
  const pool = await MagicPool.findById(req.params.id)
    .populate("participants.user", "name phone")
    .populate("participants.order", "orderNumber grandTotal")
    .populate("winner.user", "name phone")
    .lean({ virtuals: true });
  if (!pool) return res.status(404).json({ success: false, message: "Pool not found" });
  return res.json({ success: true, pool });
}

// POST /admin/magic-pools
async function createPool(req, res) {
  const { name, description, prizeDescription, prizePoints, imageUrl, images, capacity, platform, theme, tagline } = req.body;
  if (!name || !capacity) {
    return res.status(400).json({ success: false, message: "name and capacity are required" });
  }
  if (Number(capacity) < 2) {
    return res.status(400).json({ success: false, message: "capacity must be at least 2" });
  }
  const pool = await MagicPool.create({
    name, description, prizeDescription, tagline,
    prizePoints: Number(prizePoints) || 0,
    imageUrl,
    images: Array.isArray(images) ? images : [],
    theme: theme || "fuchsia",
    capacity: Number(capacity),
    platform: platform || "any",
    createdBy: req.user.userId,
  });
  return res.status(201).json({ success: true, pool });
}

// PUT /admin/magic-pools/:id
async function updatePool(req, res) {
  const pool = await MagicPool.findById(req.params.id);
  if (!pool) return res.status(404).json({ success: false, message: "Pool not found" });

  const editable = ["name", "description", "prizeDescription", "prizePoints", "imageUrl", "images", "tagline", "theme", "platform", "isActive"];
  editable.forEach((k) => { if (k in req.body) pool[k] = req.body[k]; });

  // Capacity may only be changed if no one has joined yet (and pool is open).
  if ("capacity" in req.body) {
    if (pool.participants.length > 0) {
      return res.status(400).json({ success: false, message: "Cannot change capacity once participants have joined" });
    }
    if (Number(req.body.capacity) < 2) {
      return res.status(400).json({ success: false, message: "capacity must be at least 2" });
    }
    pool.capacity = Number(req.body.capacity);
  }

  await pool.save();
  return res.json({ success: true, pool });
}

// DELETE /admin/magic-pools/:id  (soft delete via isActive=false; hard delete only if empty)
async function deletePool(req, res) {
  const pool = await MagicPool.findById(req.params.id);
  if (!pool) return res.status(404).json({ success: false, message: "Pool not found" });
  if (pool.participants.length > 0) {
    pool.isActive = false;
    pool.status = pool.status === "drawn" ? "drawn" : "cancelled";
    await pool.save();
    return res.json({ success: true, soft: true, pool });
  }
  await pool.deleteOne();
  return res.json({ success: true, deleted: true });
}

// POST /admin/magic-pools/:id/draw  (force draw)
async function drawPool(req, res) {
  try {
    const result = await poolService.forceDraw(req.params.id);
    return res.json({ success: true, pool: result });
  } catch (e) {
    return res.status(e.status || 500).json({ success: false, message: e.message });
  }
}

// POST /admin/magic-pools/upload-images  (multipart, field "images")
async function uploadImages(req, res) {
  if (!req.files || !req.files.length) {
    return res.status(400).json({ success: false, message: "No files uploaded" });
  }
  const urls = req.files.map((f) => `/uploads/magic-pools/${f.filename}`);
  return res.json({ success: true, urls });
}

module.exports = { listPools, getPool, createPool, updatePool, deletePool, drawPool, uploadImages };
