const Part = require("../../models/Part");
const { paginate } = require("../../utils/paginate");
const { ApiError } = require("../../middleware/error.middleware");

// GET /api/erp/parts?search=&category=&lowStock=true
async function list(req, res) {
  const filter = {};
  if (req.query.category) filter.category = req.query.category;
  if (req.query.active) filter.isActive = req.query.active === "true";
  if (req.query.search) {
    const rx = new RegExp(req.query.search.trim(), "i");
    filter.$or = [{ name: rx }, { partNumber: rx }, { brand: rx }, { barcode: rx }];
  }
  if (req.query.lowStock === "true") {
    filter.$expr = { $lte: ["$quantityInStock", "$reorderLevel"] };
  }
  const result = await paginate(Part, filter, { ...req.query, sort: { name: 1 }, populate: { path: "supplier", select: "name" } });
  res.json({ success: true, ...result });
}

async function create(req, res) {
  if (!req.body.name) throw new ApiError(400, "name is required");
  const part = await Part.create(req.body);
  res.status(201).json({ success: true, data: part });
}

async function getOne(req, res) {
  const part = await Part.findById(req.params.id).populate("supplier", "name phone");
  if (!part) throw new ApiError(404, "Part not found");
  res.json({ success: true, data: part });
}

async function update(req, res) {
  const updates = { ...req.body };
  delete updates.quantityInStock; // stock only changes via adjust / PO / work order
  const part = await Part.findByIdAndUpdate(req.params.id, updates, { new: true });
  if (!part) throw new ApiError(404, "Part not found");
  res.json({ success: true, data: part });
}

// PATCH /api/erp/parts/:id/adjust  { delta, reason }  manual stock correction
async function adjust(req, res) {
  const delta = Number(req.body.delta);
  if (!delta || Number.isNaN(delta)) throw new ApiError(400, "delta (number) is required");
  const part = await Part.findById(req.params.id);
  if (!part) throw new ApiError(404, "Part not found");
  part.quantityInStock = Math.max(0, part.quantityInStock + delta);
  await part.save();
  res.json({ success: true, data: part, message: `Stock adjusted by ${delta} (${req.body.reason || "manual"})` });
}

// GET /api/erp/parts/low-stock
async function lowStock(_req, res) {
  const parts = await Part.find({ isActive: true, $expr: { $lte: ["$quantityInStock", "$reorderLevel"] } })
    .populate("supplier", "name")
    .sort({ quantityInStock: 1 });
  res.json({ success: true, items: parts, total: parts.length });
}

async function remove(req, res) {
  const part = await Part.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!part) throw new ApiError(404, "Part not found");
  res.json({ success: true, message: "Part archived" });
}

module.exports = { list, create, getOne, update, adjust, lowStock, remove };
