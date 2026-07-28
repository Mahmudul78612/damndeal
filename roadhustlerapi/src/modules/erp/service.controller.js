const Service = require("../../models/Service");
const { paginate } = require("../../utils/paginate");
const { ApiError } = require("../../middleware/error.middleware");

async function list(req, res) {
  const filter = {};
  if (req.query.category) filter.category = req.query.category;
  if (req.query.active) filter.isActive = req.query.active === "true";
  if (req.query.search) filter.name = new RegExp(req.query.search.trim(), "i");
  const result = await paginate(Service, filter, { ...req.query, sort: { name: 1 } });
  res.json({ success: true, ...result });
}

async function create(req, res) {
  if (!req.body.name) throw new ApiError(400, "name is required");
  const service = await Service.create(req.body);
  res.status(201).json({ success: true, data: service });
}

async function update(req, res) {
  const service = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!service) throw new ApiError(404, "Service not found");
  res.json({ success: true, data: service });
}

async function remove(req, res) {
  const service = await Service.findByIdAndDelete(req.params.id);
  if (!service) throw new ApiError(404, "Service not found");
  res.json({ success: true, message: "Service deleted" });
}

module.exports = { list, create, update, remove };
