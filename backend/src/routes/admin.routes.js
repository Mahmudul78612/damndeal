const express = require("express");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
  createSubCategory,
  getSubCategories,
  updateSubCategory,
  deleteSubCategory,
} = require("../controllers/category.controller");
const { listKyc, reviewKyc } = require("../controllers/kyc.controller");
const {
  adminGetProducts,
  adminGetProduct,
  adminCreateProduct,
  adminUpdateProduct,
  adminDeleteProduct,
  adminReviewProduct,
} = require("../controllers/product.controller");
const { uploadProductImages } = require("../middleware/upload.middleware");
const User = require("../models/User");

const router = express.Router();

// All admin routes require auth + admin role
router.use(authenticate, authorize("admin"));

// Categories
router.post("/categories", createCategory);
router.get("/categories", getCategories);
router.put("/categories/:id", updateCategory);
router.delete("/categories/:id", deleteCategory);

// Sub-categories
router.post("/subcategories", createSubCategory);
router.get("/subcategories", getSubCategories);
router.put("/subcategories/:id", updateSubCategory);
router.delete("/subcategories/:id", deleteSubCategory);

// KYC management
router.get("/kyc", listKyc);
router.put("/kyc/:id/review", reviewKyc);

// Products (admin — all products, no partner filter)
router.get("/products", adminGetProducts);
router.get("/products/:id", adminGetProduct);
router.post("/products", uploadProductImages, adminCreateProduct);
router.put("/products/:id", uploadProductImages, adminUpdateProduct);
router.delete("/products/:id", adminDeleteProduct);
router.put("/products/:id/review", adminReviewProduct);

// Partners list (for product assignment dropdown)
router.get("/partners", async (req, res) => {
  const { limit = 500, search } = req.query;
  const filter = { role: "partner" };
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
    ];
  }
  const partners = await User.find(filter)
    .select("name phone email")
    .limit(parseInt(limit, 10))
    .sort({ name: 1 });
  return res.json({ success: true, partners });
});

module.exports = router;
