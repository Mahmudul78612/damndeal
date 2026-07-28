const Settings = require("../../models/Settings");
const Service = require("../../models/Service");
const Customer = require("../../models/Customer");
const Vehicle = require("../../models/Vehicle");
const WorkOrder = require("../../models/WorkOrder");
const Invoice = require("../../models/Invoice");
const Appointment = require("../../models/Appointment");
const { createLead } = require("../erp/lead.controller");
const { createAppointment } = require("../erp/appointment.controller");
const { applyPayment } = require("../erp/payment.controller");
const { notify } = require("../../utils/notify");
const { ApiError } = require("../../middleware/error.middleware");

/* ───────────── PUBLIC (no auth) ───────────── */

// GET /api/website/settings  — public shop info
async function publicSettings(_req, res) {
  const s = await Settings.get();
  res.json({
    success: true,
    data: {
      shopName: s.shopName, logo: s.logo, address: s.address, phone: s.phone,
      email: s.email, website: s.website, businessHours: s.businessHours,
    },
  });
}

// GET /api/website/services  — public price list
async function publicServices(_req, res) {
  const services = await Service.find({ isActive: true }).select("name category description laborHours laborRate flatPrice").sort({ category: 1, name: 1 });
  res.json({ success: true, items: services });
}

// POST /api/website/leads  — quote/contact form
async function submitLead(req, res) {
  if (!req.body.name) throw new ApiError(400, "name is required");
  const lead = await createLead({ ...req.body, source: "website" });
  notify({ role: "manager", type: "new_lead", title: "New website lead", body: `${lead.name} — ${lead.service || "enquiry"}`, link: `/leads/${lead._id}` });
  res.status(201).json({ success: true, data: lead, message: "Thanks! We'll be in touch shortly." });
}

// POST /api/website/appointments  — request appointment (guest or customer)
async function requestAppointment(req, res) {
  const body = { ...req.body, source: "website", status: "requested" };
  if (req.auth?.role === "customer") body.customer = req.auth.id;
  const appt = await createAppointment(body);
  notify({ role: "manager", type: "appointment_requested", title: "New appointment request", body: `${appt.leadName || "Customer"} — ${(appt.serviceRequested || []).join(", ")}`, link: `/appointments/${appt._id}` });
  res.status(201).json({ success: true, data: appt, message: "Appointment requested. We'll confirm soon." });
}

/* ───────────── CUSTOMER PORTAL (auth, role=customer) ───────────── */

async function profile(req, res) {
  const customer = await Customer.findById(req.auth.id);
  res.json({ success: true, data: customer });
}

async function updateProfile(req, res) {
  const updates = (({ name, phone, address, company }) => ({ name, phone, address, company }))(req.body);
  const customer = await Customer.findByIdAndUpdate(req.auth.id, updates, { new: true });
  res.json({ success: true, data: customer });
}

async function myVehicles(req, res) {
  const vehicles = await Vehicle.find({ customer: req.auth.id, isActive: true });
  res.json({ success: true, items: vehicles });
}

async function addVehicle(req, res) {
  const vehicle = await Vehicle.create({ ...req.body, customer: req.auth.id });
  res.status(201).json({ success: true, data: vehicle });
}

async function vehicleHistory(req, res) {
  const veh = await Vehicle.findOne({ _id: req.params.id, customer: req.auth.id });
  if (!veh) throw new ApiError(404, "Vehicle not found");
  const orders = await WorkOrder.find({ vehicle: veh._id }).sort({ createdAt: -1 }).select("orderNumber status total complaint diagnosis createdAt completedAt");
  res.json({ success: true, items: orders });
}

async function myWorkOrders(req, res) {
  const orders = await WorkOrder.find({ customer: req.auth.id }).sort({ createdAt: -1 })
    .populate("vehicle", "year make model").select("orderNumber status total complaint estimateApproved createdAt vehicle");
  res.json({ success: true, items: orders });
}

async function getMyWorkOrder(req, res) {
  const wo = await WorkOrder.findOne({ _id: req.params.id, customer: req.auth.id }).populate("vehicle");
  if (!wo) throw new ApiError(404, "Work order not found");
  res.json({ success: true, data: wo });
}

async function approveEstimate(req, res) {
  const wo = await WorkOrder.findOne({ _id: req.params.id, customer: req.auth.id });
  if (!wo) throw new ApiError(404, "Work order not found");
  wo.estimateApproved = true;
  wo.approvedAt = new Date();
  wo.approvalMethod = "portal";
  if (wo.status === "estimate") wo.status = "approved";
  await wo.save();
  notify({ role: "manager", type: "estimate_approved", title: "Estimate approved", body: `${wo.orderNumber} approved by customer`, link: `/work-orders/${wo._id}` });
  res.json({ success: true, data: wo, message: "Estimate approved" });
}

async function declineEstimate(req, res) {
  const wo = await WorkOrder.findOne({ _id: req.params.id, customer: req.auth.id });
  if (!wo) throw new ApiError(404, "Work order not found");
  wo.estimateApproved = false;
  if (wo.status === "estimate") wo.status = "on_hold";
  await wo.save();
  res.json({ success: true, data: wo, message: "Estimate declined" });
}

async function myInvoices(req, res) {
  const invoices = await Invoice.find({ customer: req.auth.id }).sort({ createdAt: -1 })
    .populate("vehicle", "year make model").select("invoiceNumber total amountPaid amountDue status dueDate createdAt vehicle");
  res.json({ success: true, items: invoices });
}

async function getMyInvoice(req, res) {
  const invoice = await Invoice.findOne({ _id: req.params.id, customer: req.auth.id }).populate("vehicle").populate("payments");
  if (!invoice) throw new ApiError(404, "Invoice not found");
  res.json({ success: true, data: invoice });
}

// POST /api/website/invoices/:id/pay  — online payment (Stripe-ready; records payment)
async function payInvoice(req, res) {
  const invoice = await Invoice.findOne({ _id: req.params.id, customer: req.auth.id });
  if (!invoice) throw new ApiError(404, "Invoice not found");
  if (invoice.amountDue <= 0) throw new ApiError(400, "Invoice already paid");

  // Stripe PaymentIntent confirmation would be verified here in production.
  const payment = await applyPayment({
    invoice,
    amount: Number(req.body.amount) || invoice.amountDue,
    method: "online",
    reference: req.body.reference,
    stripePaymentIntent: req.body.paymentIntentId,
    receivedBy: null,
  });
  res.json({ success: true, data: { payment, invoice }, message: "Payment successful" });
}

async function myAppointments(req, res) {
  const appts = await Appointment.find({ customer: req.auth.id }).sort({ preferredDate: -1 });
  res.json({ success: true, items: appts });
}

async function cancelAppointment(req, res) {
  const appt = await Appointment.findOne({ _id: req.params.id, customer: req.auth.id });
  if (!appt) throw new ApiError(404, "Appointment not found");
  appt.status = "cancelled";
  await appt.save();
  res.json({ success: true, message: "Appointment cancelled" });
}

module.exports = {
  publicSettings, publicServices, submitLead, requestAppointment,
  profile, updateProfile, myVehicles, addVehicle, vehicleHistory,
  myWorkOrders, getMyWorkOrder, approveEstimate, declineEstimate,
  myInvoices, getMyInvoice, payInvoice, myAppointments, cancelAppointment,
};
