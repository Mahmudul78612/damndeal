const express = require("express");
const h = require("../../utils/asyncHandler");
const { authenticate, staffOnly, managerOnly, adminOnly } = require("../../middleware/auth.middleware");

const settings = require("./settings.controller");
const customer = require("./customer.controller");
const vehicle = require("./vehicle.controller");
const lead = require("./lead.controller");
const appointment = require("./appointment.controller");
const service = require("./service.controller");
const supplier = require("./supplier.controller");
const part = require("./part.controller");
const po = require("./purchaseOrder.controller");
const wo = require("./workOrder.controller");
const invoice = require("./invoice.controller");
const payment = require("./payment.controller");
const staff = require("./staff.controller");
const report = require("./report.controller");
const notif = require("./notification.controller");

const router = express.Router();

// Everything under /api/erp requires an internal staff login.
router.use(authenticate, staffOnly);

// ── Dashboard & Reports ──
router.get("/dashboard", h(report.dashboard));
router.get("/reports/revenue", managerOnly, h(report.revenue));
router.get("/reports/inventory", managerOnly, h(report.inventory));
router.get("/reports/technicians", managerOnly, h(report.technicians));
router.get("/reports/leads", managerOnly, h(report.leads));
router.get("/reports/customers", managerOnly, h(report.customers));
router.get("/reports/sales-tax", managerOnly, h(report.salesTax));

// ── Notifications ──
router.get("/notifications", h(notif.list));
router.patch("/notifications/read-all", h(notif.markAllRead));
router.patch("/notifications/:id/read", h(notif.markRead));

// ── Leads ──
router.get("/leads", managerOnly, h(lead.list));
router.post("/leads", managerOnly, h(lead.create));
router.get("/leads/:id", managerOnly, h(lead.getOne));
router.patch("/leads/:id", managerOnly, h(lead.update));
router.post("/leads/:id/convert", managerOnly, h(lead.convert));

// ── Customers ──
router.get("/customers", h(customer.list));
router.post("/customers", h(customer.create));
router.get("/customers/:id", h(customer.getOne));
router.put("/customers/:id", h(customer.update));
router.post("/customers/:id/enable-portal", managerOnly, h(customer.enablePortal));
router.delete("/customers/:id", adminOnly, h(customer.remove));

// ── Vehicles ──
router.get("/vehicles", h(vehicle.list));
router.post("/vehicles", h(vehicle.create));
router.get("/vehicles/:id", h(vehicle.getOne));
router.put("/vehicles/:id", h(vehicle.update));
router.get("/vehicles/:id/history", h(vehicle.history));
router.delete("/vehicles/:id", managerOnly, h(vehicle.remove));

// ── Appointments ──
router.get("/appointments", h(appointment.list));
router.post("/appointments", h(appointment.create));
router.get("/appointments/:id", h(appointment.getOne));
router.patch("/appointments/:id", h(appointment.update));
router.post("/appointments/:id/start-work", h(appointment.startWork));

// ── Services catalog ──
router.get("/services", h(service.list));
router.post("/services", managerOnly, h(service.create));
router.put("/services/:id", managerOnly, h(service.update));
router.delete("/services/:id", managerOnly, h(service.remove));

// ── Suppliers ──
router.get("/suppliers", h(supplier.list));
router.post("/suppliers", managerOnly, h(supplier.create));
router.put("/suppliers/:id", managerOnly, h(supplier.update));
router.delete("/suppliers/:id", adminOnly, h(supplier.remove));

// ── Parts / Inventory ──
router.get("/parts", h(part.list));
router.get("/parts/low-stock", h(part.lowStock));
router.post("/parts", managerOnly, h(part.create));
router.get("/parts/:id", h(part.getOne));
router.put("/parts/:id", managerOnly, h(part.update));
router.patch("/parts/:id/adjust", managerOnly, h(part.adjust));
router.delete("/parts/:id", managerOnly, h(part.remove));

// ── Purchase Orders ──
router.get("/purchase-orders", managerOnly, h(po.list));
router.post("/purchase-orders", managerOnly, h(po.create));
router.get("/purchase-orders/:id", managerOnly, h(po.getOne));
router.patch("/purchase-orders/:id", managerOnly, h(po.update));
router.post("/purchase-orders/:id/receive", managerOnly, h(po.receive));

// ── Work Orders (job cards) ──
router.get("/work-orders", h(wo.list));
router.post("/work-orders", h(wo.create));
router.get("/work-orders/:id", h(wo.getOne));
router.patch("/work-orders/:id", h(wo.update));
router.post("/work-orders/:id/labor", h(wo.addLabor));
router.post("/work-orders/:id/parts", h(wo.addPart));
router.delete("/work-orders/:id/line/:lineId", h(wo.removeLine));
router.post("/work-orders/:id/approve", h(wo.approve));
router.post("/work-orders/:id/clock-in", h(wo.clockIn));
router.post("/work-orders/:id/clock-out", h(wo.clockOut));
router.post("/work-orders/:id/invoice", managerOnly, h(invoice.generateFromWorkOrder));

// ── Invoices ──
router.get("/invoices", managerOnly, h(invoice.list));
router.get("/invoices/:id", h(invoice.getOne));
router.post("/invoices/:id/send", managerOnly, h(invoice.send));
router.post("/invoices/:id/payments", managerOnly, h(payment.recordPayment));
router.post("/invoices/:id/refund", managerOnly, h(payment.refundPayment));
router.post("/invoices/:id/void", adminOnly, h(invoice.voidInvoice));

// ── Payments daybook ──
router.get("/payments", managerOnly, h(payment.list));
router.post("/payments", managerOnly, h(payment.createPayment)); // alias: { invoiceId, amount, ... }

// ── Staff ──
router.get("/staff", managerOnly, h(staff.list));
router.post("/staff", managerOnly, h(staff.create));
router.put("/staff/:id", managerOnly, h(staff.update));
router.get("/staff/:id/timesheet", managerOnly, h(staff.timesheet));

// ── Settings ──
router.get("/settings", h(settings.getSettings));
router.put("/settings", adminOnly, h(settings.updateSettings));
router.patch("/settings", adminOnly, h(settings.updateSettings)); // FE uses PATCH

module.exports = router;
