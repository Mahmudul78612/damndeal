const express = require("express");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const { uploadKycPhoto, uploadProductImages } = require("../middleware/upload.middleware");
const { submitKyc, getMyKyc } = require("../controllers/kyc.controller");
const {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  updateStock,
  getInventoryLog,
} = require("../controllers/product.controller");
const {
  createOrder,
  getOrders,
  getOrder,
  updateOrderStatus,
} = require("../controllers/order.controller");
const { getCustomers, getCustomer } = require("../controllers/customer.controller");
const { getDashboard } = require("../controllers/dashboard.controller");

const router = express.Router();

// All partner routes require auth + partner role
router.use(authenticate, authorize("partner"));

// KYC
router.post("/kyc", uploadKycPhoto, submitKyc);
router.get("/kyc", getMyKyc);

// Products
router.post("/products", uploadProductImages, createProduct);
router.get("/products", getProducts);
router.get("/products/:id", getProduct);
router.put("/products/:id", uploadProductImages, updateProduct);
router.delete("/products/:id", deleteProduct);

// Inventory
router.put("/products/:id/stock", updateStock);
router.get("/products/:id/inventory-log", getInventoryLog);

// Orders
router.post("/orders", createOrder);
router.get("/orders", getOrders);
router.get("/orders/:id", getOrder);
router.put("/orders/:id/status", updateOrderStatus);

// Customers
router.get("/customers", getCustomers);
router.get("/customers/:id", getCustomer);

// Dashboard
router.get("/dashboard", getDashboard);

module.exports = router;
