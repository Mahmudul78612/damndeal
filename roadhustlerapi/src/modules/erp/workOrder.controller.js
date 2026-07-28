const WorkOrder = require("../../models/WorkOrder");
const Customer = require("../../models/Customer");
const Vehicle = require("../../models/Vehicle");
const Part = require("../../models/Part");
const Settings = require("../../models/Settings");
const { nextSeq, formatNumber } = require("../../models/Counter");
const { recalcWorkOrder } = require("../../utils/calcWorkOrder");
const { paginate } = require("../../utils/paginate");
const { ApiError } = require("../../middleware/error.middleware");

async function loadAndRecalc(id) {
  const wo = await WorkOrder.findById(id);
  if (!wo) throw new ApiError(404, "Work order not found");
  const settings = await Settings.get();
  recalcWorkOrder(wo, settings);
  await wo.save();
  return wo;
}

// GET /api/erp/work-orders?status=&tech=&customer=&search=
async function list(req, res) {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.tech) filter.assignedTechs = req.query.tech;
  if (req.query.customer) filter.customer = req.query.customer;
  if (req.query.search) filter.orderNumber = new RegExp(req.query.search.trim(), "i");
  const result = await paginate(WorkOrder, filter, {
    ...req.query,
    populate: [
      { path: "customer", select: "name phone" },
      { path: "vehicle", select: "year make model licensePlate" },
      { path: "assignedTechs", select: "name" },
    ],
  });
  res.json({ success: true, ...result });
}

// POST /api/erp/work-orders   (walk-in friendly: just needs customer + vehicle)
async function create(req, res) {
  const { customer, vehicle } = req.body;
  if (!customer || !vehicle) throw new ApiError(400, "customer and vehicle are required");
  const [cust, veh] = await Promise.all([Customer.findById(customer), Vehicle.findById(vehicle)]);
  if (!cust) throw new ApiError(404, "Customer not found");
  if (!veh) throw new ApiError(404, "Vehicle not found");

  const s = await Settings.get();
  const seq = await nextSeq("workOrder", s.woStartNumber || 2001);
  const wo = new WorkOrder({
    ...req.body,
    orderNumber: formatNumber(s.woPrefix, seq),
    taxRate: req.body.taxRate != null ? req.body.taxRate : s.taxRate,
    createdBy: req.auth.id,
  });
  recalcWorkOrder(wo, s);
  await wo.save();
  res.status(201).json({ success: true, data: wo });
}

// GET /api/erp/work-orders/:id
async function getOne(req, res) {
  const wo = await WorkOrder.findById(req.params.id)
    .populate("customer", "name phone email address")
    .populate("vehicle")
    .populate("assignedTechs", "name")
    .populate("laborItems.tech", "name");
  if (!wo) throw new ApiError(404, "Work order not found");
  res.json({ success: true, data: wo });
}

// PATCH /api/erp/work-orders/:id  (diagnosis, status, lines, discount, etc.)
async function update(req, res) {
  const wo = await WorkOrder.findById(req.params.id);
  if (!wo) throw new ApiError(404, "Work order not found");
  if (wo.status === "invoiced") throw new ApiError(409, "Invoiced work orders are locked");

  const editable = [
    "complaint", "diagnosis", "recommendation", "priority", "bay", "mileageIn",
    "assignedTechs", "status", "discount", "discountType", "taxRate",
    "laborItems", "partItems",
  ];
  editable.forEach((k) => { if (k in req.body) wo[k] = req.body[k]; });
  if (req.body.status === "completed" && !wo.completedAt) wo.completedAt = new Date();

  const s = await Settings.get();
  recalcWorkOrder(wo, s);
  await wo.save();
  res.json({ success: true, data: wo });
}

// POST /api/erp/work-orders/:id/labor   add one labor line
async function addLabor(req, res) {
  const wo = await WorkOrder.findById(req.params.id);
  if (!wo) throw new ApiError(404, "Work order not found");
  if (!req.body.description) throw new ApiError(400, "description is required");
  wo.laborItems.push(req.body);
  const s = await Settings.get();
  recalcWorkOrder(wo, s);
  await wo.save();
  res.status(201).json({ success: true, data: wo });
}

// POST /api/erp/work-orders/:id/parts   add one part line (checks stock availability)
async function addPart(req, res) {
  const wo = await WorkOrder.findById(req.params.id);
  if (!wo) throw new ApiError(404, "Work order not found");

  const body = { ...req.body };
  if (body.part) {
    const part = await Part.findById(body.part);
    if (!part) throw new ApiError(404, "Part not found");
    body.partNumber = body.partNumber || part.partNumber;
    body.description = body.description || part.name;
    body.costPrice = body.costPrice ?? part.costPrice;
    body.sellPrice = body.sellPrice ?? part.sellPrice;
    body.taxable = body.taxable ?? part.taxable;
    if (part.quantityInStock < (body.quantity || 1)) {
      // soft warning, allow it but flag
      body._lowStock = true;
    }
  }
  if (!body.description) throw new ApiError(400, "description is required");
  wo.partItems.push(body);
  const s = await Settings.get();
  recalcWorkOrder(wo, s);
  await wo.save();
  res.status(201).json({ success: true, data: wo });
}

// DELETE /api/erp/work-orders/:id/line/:lineId?type=labor|part
async function removeLine(req, res) {
  const wo = await WorkOrder.findById(req.params.id);
  if (!wo) throw new ApiError(404, "Work order not found");
  const type = req.query.type === "part" ? "partItems" : "laborItems";
  wo[type] = wo[type].filter((l) => String(l._id) !== req.params.lineId);
  const s = await Settings.get();
  recalcWorkOrder(wo, s);
  await wo.save();
  res.json({ success: true, data: wo });
}

// POST /api/erp/work-orders/:id/approve   record estimate approval
async function approve(req, res) {
  const wo = await WorkOrder.findById(req.params.id);
  if (!wo) throw new ApiError(404, "Work order not found");
  wo.estimateApproved = true;
  wo.approvedAt = new Date();
  wo.approvalMethod = req.body.method || "in_person";
  if (wo.status === "estimate") wo.status = "approved";
  await wo.save();
  res.json({ success: true, data: wo, message: "Estimate approved" });
}

// POST /api/erp/work-orders/:id/clock-in   { techId }
async function clockIn(req, res) {
  const wo = await WorkOrder.findById(req.params.id);
  if (!wo) throw new ApiError(404, "Work order not found");
  const techId = req.body.techId || req.auth.id;
  wo.timeLog.push({ tech: techId, startedAt: new Date() });
  if (wo.status === "approved") wo.status = "in_progress";
  await wo.save();
  res.json({ success: true, data: wo });
}

// POST /api/erp/work-orders/:id/clock-out   { techId }
async function clockOut(req, res) {
  const wo = await WorkOrder.findById(req.params.id);
  if (!wo) throw new ApiError(404, "Work order not found");
  const techId = String(req.body.techId || req.auth.id);
  // close the latest open log for this tech
  const open = [...wo.timeLog].reverse().find((t) => String(t.tech) === techId && !t.stoppedAt);
  if (!open) throw new ApiError(400, "No open time log for this technician");
  open.stoppedAt = new Date();
  open.minutes = Math.round((open.stoppedAt - open.startedAt) / 60000);
  await wo.save();
  res.json({ success: true, data: wo });
}

module.exports = {
  list, create, getOne, update, addLabor, addPart, removeLine,
  approve, clockIn, clockOut, loadAndRecalc,
};
