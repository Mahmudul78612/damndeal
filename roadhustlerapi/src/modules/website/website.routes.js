const express = require("express");
const h = require("../../utils/asyncHandler");
const { authenticate, optionalAuth, customerOnly } = require("../../middleware/auth.middleware");
const c = require("./website.controller");

const router = express.Router();

// ── Public ──
router.get("/settings", h(c.publicSettings));
router.get("/services", h(c.publicServices));
router.post("/leads", h(c.submitLead));
router.post("/appointments", optionalAuth, h(c.requestAppointment)); // guest or logged-in customer

// ── Customer portal (auth required) ──
router.use(authenticate, customerOnly);

router.get("/profile", h(c.profile));
router.put("/profile", h(c.updateProfile));

router.get("/vehicles", h(c.myVehicles));
router.post("/vehicles", h(c.addVehicle));
router.get("/vehicles/:id/history", h(c.vehicleHistory));

router.get("/work-orders", h(c.myWorkOrders));
router.get("/work-orders/:id", h(c.getMyWorkOrder));
router.post("/work-orders/:id/approve", h(c.approveEstimate));
router.post("/work-orders/:id/decline", h(c.declineEstimate));

router.get("/invoices", h(c.myInvoices));
router.get("/invoices/:id", h(c.getMyInvoice));
router.post("/invoices/:id/pay", h(c.payInvoice));

router.get("/appointments", h(c.myAppointments));
router.post("/appointments/:id/cancel", h(c.cancelAppointment));

module.exports = router;
