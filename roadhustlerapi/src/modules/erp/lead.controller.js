const Lead = require("../../models/Lead");
const Customer = require("../../models/Customer");
const Vehicle = require("../../models/Vehicle");
const Settings = require("../../models/Settings");
const { nextSeq, formatNumber } = require("../../models/Counter");
const { notify } = require("../../utils/notify");
const { paginate } = require("../../utils/paginate");
const { ApiError } = require("../../middleware/error.middleware");

// GET /api/erp/leads?status=&assignedTo=&search=
async function list(req, res) {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;
  if (req.query.search) {
    const rx = new RegExp(req.query.search.trim(), "i");
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }, { service: rx }];
  }
  const result = await paginate(Lead, filter, { ...req.query, populate: { path: "assignedTo", select: "name" } });
  res.json({ success: true, ...result });
}

// Shared creator used by ERP + website intake.
async function createLead(body) {
  const s = await Settings.get();
  const seq = await nextSeq("lead", 1001);
  return Lead.create({ ...body, leadNumber: formatNumber(s.leadPrefix, seq) });
}

// POST /api/erp/leads
async function create(req, res) {
  if (!req.body.name) throw new ApiError(400, "name is required");
  const lead = await createLead(req.body);
  res.status(201).json({ success: true, data: lead });
}

// GET /api/erp/leads/:id
async function getOne(req, res) {
  const lead = await Lead.findById(req.params.id).populate("assignedTo", "name");
  if (!lead) throw new ApiError(404, "Lead not found");
  res.json({ success: true, data: lead });
}

// PATCH /api/erp/leads/:id  (status, notes, assign, followUp)
async function update(req, res) {
  const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!lead) throw new ApiError(404, "Lead not found");
  res.json({ success: true, data: lead });
}

// POST /api/erp/leads/:id/convert  → creates a Customer (+ optional Vehicle)
async function convert(req, res) {
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw new ApiError(404, "Lead not found");
  if (lead.convertedCustomer) throw new ApiError(409, "Lead already converted");

  const customer = await Customer.create({
    name: lead.name,
    email: lead.email ? lead.email.toLowerCase() : undefined,
    phone: lead.phone,
    source: lead.source === "website" ? "website" : "referral",
    createdBy: req.auth.id,
  });

  let vehicle = null;
  if (req.body.vehicle) {
    vehicle = await Vehicle.create({ customer: customer._id, ...req.body.vehicle });
  }

  lead.status = "converted";
  lead.convertedCustomer = customer._id;
  await lead.save();

  res.json({ success: true, data: { customer, vehicle, lead } });
}

module.exports = { list, create, getOne, update, convert, createLead };
