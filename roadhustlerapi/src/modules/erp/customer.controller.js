const Customer = require("../../models/Customer");
const Vehicle = require("../../models/Vehicle");
const WorkOrder = require("../../models/WorkOrder");
const Invoice = require("../../models/Invoice");
const { paginate } = require("../../utils/paginate");
const { ApiError } = require("../../middleware/error.middleware");

// GET /api/erp/customers?search=&tag=&page=&limit=
async function list(req, res) {
  const filter = {};
  if (req.query.search) {
    const rx = new RegExp(req.query.search.trim(), "i");
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }, { company: rx }];
  }
  if (req.query.tag) filter.tags = req.query.tag;
  if (req.query.active) filter.isActive = req.query.active === "true";
  const result = await paginate(Customer, filter, req.query);
  res.json({ success: true, ...result });
}

// POST /api/erp/customers  (walk-in: only name + phone required; no login needed)
async function create(req, res) {
  const { name } = req.body;
  if (!name) throw new ApiError(400, "Customer name is required");
  const payload = { ...req.body, createdBy: req.auth.id };
  if (payload.email) payload.email = String(payload.email).toLowerCase();
  if (!payload.source) payload.source = "walk-in";
  // Never accept a password through this path — portal access is granted separately.
  delete payload.passwordHash;
  delete payload.password;
  const customer = await Customer.create(payload);
  res.status(201).json({ success: true, data: customer });
}

// GET /api/erp/customers/:id  (profile + vehicles + balance + recent jobs)
async function getOne(req, res) {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw new ApiError(404, "Customer not found");
  const [vehicles, openInvoices, recentOrders] = await Promise.all([
    Vehicle.find({ customer: customer._id, isActive: true }),
    Invoice.find({ customer: customer._id, status: { $in: ["sent", "partial", "overdue"] } }).select("invoiceNumber total amountDue status dueDate"),
    WorkOrder.find({ customer: customer._id }).sort({ createdAt: -1 }).limit(10).select("orderNumber status total createdAt vehicle").populate("vehicle", "year make model"),
  ]);
  const balanceDue = openInvoices.reduce((s, i) => s + (i.amountDue || 0), 0);
  res.json({ success: true, data: { customer, vehicles, openInvoices, recentOrders, balanceDue } });
}

// PUT /api/erp/customers/:id
async function update(req, res) {
  const updates = { ...req.body };
  delete updates.passwordHash;
  delete updates.totalSpent; // computed, not editable
  if (updates.email) updates.email = String(updates.email).toLowerCase();
  const customer = await Customer.findByIdAndUpdate(req.params.id, updates, { new: true });
  if (!customer) throw new ApiError(404, "Customer not found");
  res.json({ success: true, data: customer });
}

// POST /api/erp/customers/:id/enable-portal  (invite walk-in to website)
async function enablePortal(req, res) {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, "email and password required to enable portal");
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw new ApiError(404, "Customer not found");
  customer.email = String(email).toLowerCase();
  await customer.setPassword(password);
  await customer.save();
  res.json({ success: true, data: customer, message: "Portal access enabled" });
}

// DELETE /api/erp/customers/:id (admin)
async function remove(req, res) {
  const customer = await Customer.findByIdAndDelete(req.params.id);
  if (!customer) throw new ApiError(404, "Customer not found");
  res.json({ success: true, message: "Customer deleted" });
}

module.exports = { list, create, getOne, update, enablePortal, remove };
