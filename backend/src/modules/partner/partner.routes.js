const express = require("express");
const { authenticate, authorize } = require("../../middleware/auth.middleware");
const { uploadKycPhoto, uploadKycDocuments, uploadProductImages, uploadDeliveryPhoto } = require("../../middleware/upload.middleware");

const kyc = require("./controllers/kyc.controller");
const product = require("./controllers/product.controller");
const order = require("./controllers/order.controller");
const customer = require("./controllers/customer.controller");
const dashboard = require("./controllers/dashboard.controller");
const payout = require("./controllers/payout.controller");
const deliveryBoy = require("./controllers/deliveryBoy.controller");
const returnCtrl = require("./controllers/return.controller");
const offer = require("./controllers/offer.controller");
const subscription = require("./controllers/subscription.controller");
const ticket = require("./controllers/ticket.controller");
const invoiceService = require("../../services/invoice.service");

const router = express.Router();
router.use(authenticate, authorize("partner"));

// Dashboard
router.get("/dashboard", dashboard.getDashboard);

// KYC
router.post("/kyc", uploadKycDocuments, kyc.submitKyc);
router.get("/kyc", kyc.getMyKyc);
router.put("/delivery-settings", kyc.updateDeliverySettings);

// Products
router.post("/products", uploadProductImages, product.createProduct);
router.get("/products", product.getProducts);
router.get("/products/:id", product.getProduct);
router.put("/products/:id", uploadProductImages, product.updateProduct);
router.delete("/products/:id", product.deleteProduct);
router.put("/products/:id/stock", product.updateStock);
router.get("/products/:id/inventory-log", product.getInventoryLog);

// Orders (POS + app orders + self-ship)
router.post("/orders", order.createOrder);
router.get("/orders", order.getOrders);
router.get("/orders/:id", order.getOrder);
router.put("/orders/:id/status", order.updateOrderStatus);
router.put("/orders/:id/accept", order.acceptOrder);
router.put("/orders/:id/reject", order.rejectOrder);
router.put("/orders/:id/ready", order.markReady);
router.put("/orders/:id/assign-delivery", order.assignDeliveryBoy);
router.put("/orders/:id/delivery-status", order.updateDeliveryStatus);
router.put("/orders/:id/mark-delivered", order.markSelfDelivered);

// Delivery Boys (partner's own fleet)
router.post("/delivery-boys", uploadDeliveryPhoto, deliveryBoy.addDeliveryBoy);
router.get("/delivery-boys", deliveryBoy.getDeliveryBoys);
router.get("/delivery-boys/:id", deliveryBoy.getDeliveryBoy);
router.put("/delivery-boys/:id", uploadDeliveryPhoto, deliveryBoy.updateDeliveryBoy);
router.delete("/delivery-boys/:id", deliveryBoy.removeDeliveryBoy);
router.put("/delivery-boys/:id/toggle", deliveryBoy.toggleDeliveryBoy);

// Customers
router.get("/customers", customer.getCustomers);
router.get("/customers/:id", customer.getCustomer);

// Payouts
router.get("/payouts", payout.getMyPayouts);

// Returns (view only)
router.get("/returns", returnCtrl.listReturns);
router.get("/returns/:id", returnCtrl.getReturn);

// Offers
router.post("/offers", offer.createOffer);
router.get("/offers", offer.listOffers);
router.put("/offers/:id", offer.updateOffer);
router.delete("/offers/:id", offer.deleteOffer);

// Subscription
router.get("/subscription/plans", subscription.listPlans);
router.post("/subscription/subscribe", subscription.subscribe);
router.get("/subscription", subscription.getMySubscription);
router.get("/subscription/history", subscription.subscriptionHistory);

// Support Tickets
router.post("/tickets", ticket.createTicket);
router.get("/tickets", ticket.getMyTickets);
router.get("/tickets/:id", ticket.getTicket);
router.post("/tickets/:id/reply", ticket.replyTicket);

// Invoice download for own orders
router.get("/orders/:id/invoice", async (req, res) => {
  try {
    const pdfDoc = await invoiceService.generateInvoice(req.params.id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=invoice-${req.params.id}.pdf`);
    pdfDoc.pipe(res);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
