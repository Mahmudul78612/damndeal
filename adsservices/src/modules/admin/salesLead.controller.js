const SalesLead = require("../../models/SalesLead");
const { clientIp } = require("../../utils/geo");
const { paginate } = require("../../utils/paginate");
const { ApiError } = require("../../middleware/error.middleware");

// POST /api/sales-lead   (PUBLIC — landing "Contact Sales" form)
async function submit(req, res) {
  const { name, email, phone } = req.body;
  if (!name || (!email && !phone)) throw new ApiError(400, "Name and an email or phone are required");
  const lead = await SalesLead.create({
    name: String(name).trim(),
    company: req.body.company,
    email: req.body.email,
    phone: req.body.phone,
    message: req.body.message,
    ip: clientIp(req),
  });
  res.status(201).json({ success: true, message: "Thanks! Our sales team will reach out shortly.", id: lead._id });
}

// GET /api/admin/sales-leads?status=   (admin)
async function list(req, res) {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const result = await paginate(SalesLead, filter, req.query);
  const newCount = await SalesLead.countDocuments({ status: "new" });
  res.json({ success: true, ...result, newCount });
}

// PATCH /api/admin/sales-leads/:id   (admin) — update status
async function update(req, res) {
  const lead = await SalesLead.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
  if (!lead) throw new ApiError(404, "Lead not found");
  res.json({ success: true, data: lead });
}

module.exports = { submit, list, update };
