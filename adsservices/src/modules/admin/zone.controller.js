const Zone = require("../../models/Zone");
const { paginate } = require("../../utils/paginate");
const { ApiError } = require("../../middleware/error.middleware");

// GET /api/admin/zones?app=&type=
async function list(req, res) {
  const filter = {};
  if (req.query.app) filter.app = req.query.app;
  if (req.query.type) filter.type = req.query.type;
  if (req.query.publisher) filter.publisher = req.query.publisher;
  if (req.query.search) filter.name = new RegExp(req.query.search.trim(), "i");
  const result = await paginate(Zone, filter, { ...req.query, sort: { createdAt: -1 }, populate: { path: "publisher", select: "name appId" } });
  res.json({ success: true, ...result });
}

// POST /api/admin/zones  { name, app, type, size }
async function create(req, res) {
  if (!req.body.name) throw new ApiError(400, "name is required");
  const zone = await Zone.create(req.body);
  res.status(201).json({ success: true, data: zone });
}

async function update(req, res) {
  const zone = await Zone.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!zone) throw new ApiError(404, "Zone not found");
  res.json({ success: true, data: zone });
}

async function remove(req, res) {
  const zone = await Zone.findByIdAndDelete(req.params.id);
  if (!zone) throw new ApiError(404, "Zone not found");
  res.json({ success: true, message: "Zone deleted" });
}

module.exports = { list, create, update, remove };
