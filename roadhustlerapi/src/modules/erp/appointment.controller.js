const Appointment = require("../../models/Appointment");
const WorkOrder = require("../../models/WorkOrder");
const Settings = require("../../models/Settings");
const { nextSeq, formatNumber } = require("../../models/Counter");
const { paginate } = require("../../utils/paginate");
const { ApiError } = require("../../middleware/error.middleware");

// GET /api/erp/appointments?date=&status=&tech=
async function list(req, res) {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.tech) filter.assignedTo = req.query.tech;
  if (req.query.date) {
    const d = new Date(req.query.date);
    const start = new Date(d.setHours(0, 0, 0, 0));
    const end = new Date(d.setHours(23, 59, 59, 999));
    filter.preferredDate = { $gte: start, $lte: end };
  }
  if (req.query.from && req.query.to) {
    filter.preferredDate = { $gte: new Date(req.query.from), $lte: new Date(req.query.to) };
  }
  const result = await paginate(Appointment, filter, {
    ...req.query,
    sort: { preferredDate: 1 },
    populate: [
      { path: "customer", select: "name phone" },
      { path: "assignedTo", select: "name" },
      { path: "vehicle", select: "year make model" },
    ],
  });
  res.json({ success: true, ...result });
}

async function createAppointment(body) {
  const s = await Settings.get();
  const seq = await nextSeq("appointment", 1001);
  return Appointment.create({ ...body, apptNumber: formatNumber(s.apptPrefix, seq) });
}

// POST /api/erp/appointments
async function create(req, res) {
  const appt = await createAppointment(req.body);
  res.status(201).json({ success: true, data: appt });
}

// GET /api/erp/appointments/:id
async function getOne(req, res) {
  const appt = await Appointment.findById(req.params.id)
    .populate("customer", "name phone email")
    .populate("vehicle")
    .populate("assignedTo", "name");
  if (!appt) throw new ApiError(404, "Appointment not found");
  res.json({ success: true, data: appt });
}

// PATCH /api/erp/appointments/:id  (confirm/assign/reschedule/status)
async function update(req, res) {
  const appt = await Appointment.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!appt) throw new ApiError(404, "Appointment not found");
  res.json({ success: true, data: appt });
}

// POST /api/erp/appointments/:id/start-work  → opens a Work Order from the appointment
async function startWork(req, res) {
  const appt = await Appointment.findById(req.params.id);
  if (!appt) throw new ApiError(404, "Appointment not found");
  if (appt.workOrder) throw new ApiError(409, "Work order already started for this appointment");
  if (!appt.customer) throw new ApiError(400, "Attach/convert a customer to this appointment first");

  const vehicle = req.body.vehicle || appt.vehicle;
  if (!vehicle) throw new ApiError(400, "vehicle is required (none on appointment)");

  const s = await Settings.get();
  const seq = await nextSeq("workOrder", s.woStartNumber || 2001);
  const wo = await WorkOrder.create({
    orderNumber: formatNumber(s.woPrefix, seq),
    customer: appt.customer,
    vehicle,
    complaint: (appt.serviceRequested || []).join(", ") || appt.notes || "",
    taxRate: s.taxRate,
    appointment: appt._id,
    assignedTechs: appt.assignedTo ? [appt.assignedTo] : [],
    bay: appt.bay,
    createdBy: req.auth.id,
  });

  appt.workOrder = wo._id;
  appt.status = "in_progress";
  await appt.save();

  res.status(201).json({ success: true, data: wo, message: "Work order created from appointment" });
}

module.exports = { list, create, getOne, update, startWork, createAppointment };
