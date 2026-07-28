const Supplier = require("../../models/Supplier");
const { paginate } = require("../../utils/paginate");
const { ApiError } = require("../../middleware/error.middleware");

async function list(req, res) {
  const filter = {};
  if (req.query.search) filter.name = new RegExp(req.query.search.trim(), "i");
  const result = await paginate(Supplier, filter, { ...req.query, sort: { name: 1 } });
  res.json({ success: true, ...result });
}

async function create(req, res) {
  if (!req.body.name) throw new ApiError(400, "name is required");
  const supplier = await Supplier.create(req.body);
  res.status(201).json({ success: true, data: supplier });
}

async function update(req, res) {
  const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!supplier) throw new ApiError(404, "Supplier not found");
  res.json({ success: true, data: supplier });
}

async function remove(req, res) {
  const supplier = await Supplier.findByIdAndDelete(req.params.id);
  if (!supplier) throw new ApiError(404, "Supplier not found");
  res.json({ success: true, message: "Supplier deleted" });
}

module.exports = { list, create, update, remove };
