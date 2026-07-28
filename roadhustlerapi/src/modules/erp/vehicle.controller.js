const Vehicle = require("../../models/Vehicle");
const WorkOrder = require("../../models/WorkOrder");
const Customer = require("../../models/Customer");
const { paginate } = require("../../utils/paginate");
const { ApiError } = require("../../middleware/error.middleware");

// GET /api/erp/vehicles?customer=&search=
async function list(req, res) {
  const filter = { isActive: true };
  if (req.query.customer) filter.customer = req.query.customer;
  if (req.query.search) {
    const rx = new RegExp(req.query.search.trim(), "i");
    filter.$or = [{ make: rx }, { model: rx }, { vin: rx }, { licensePlate: rx }];
  }
  const result = await paginate(Vehicle, filter, { ...req.query, populate: { path: "customer", select: "name phone" } });
  res.json({ success: true, ...result });
}

// POST /api/erp/vehicles
async function create(req, res) {
  if (!req.body.customer) throw new ApiError(400, "customer is required");
  const customer = await Customer.findById(req.body.customer);
  if (!customer) throw new ApiError(404, "Customer not found");
  const vehicle = await Vehicle.create(req.body);
  res.status(201).json({ success: true, data: vehicle });
}

// GET /api/erp/vehicles/:id
async function getOne(req, res) {
  const vehicle = await Vehicle.findById(req.params.id).populate("customer", "name phone email");
  if (!vehicle) throw new ApiError(404, "Vehicle not found");
  res.json({ success: true, data: vehicle });
}

// PUT /api/erp/vehicles/:id
async function update(req, res) {
  const vehicle = await Vehicle.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!vehicle) throw new ApiError(404, "Vehicle not found");
  res.json({ success: true, data: vehicle });
}

// GET /api/erp/vehicles/:id/history  (all work orders for this vehicle)
async function history(req, res) {
  const orders = await WorkOrder.find({ vehicle: req.params.id })
    .sort({ createdAt: -1 })
    .select("orderNumber status total mileageIn complaint diagnosis createdAt completedAt")
    .lean();
  res.json({ success: true, items: orders, total: orders.length });
}

// DELETE /api/erp/vehicles/:id  (soft)
async function remove(req, res) {
  const vehicle = await Vehicle.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!vehicle) throw new ApiError(404, "Vehicle not found");
  res.json({ success: true, message: "Vehicle archived" });
}

module.exports = { list, create, getOne, update, history, remove };
