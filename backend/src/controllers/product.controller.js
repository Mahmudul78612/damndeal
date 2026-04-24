const Product = require("../models/Product");
const InventoryLog = require("../models/InventoryLog");
const {
  createProductSchema,
  updateProductSchema,
  stockUpdateSchema,
} = require("../validators/product.validator");

// POST /partner/products
async function createProduct(req, res) {
  const { error } = createProductSchema.validate(req.body);
  if (error) return res.status(400).json({ success: false, message: error.details[0].message });

  const images = (req.files || []).map((f) => `/uploads/products/${f.filename}`);

  const product = await Product.create({
    ...req.body,
    partner: req.user.userId,
    images,
  });

  // Log initial stock
  if (product.stock > 0) {
    await InventoryLog.create({
      partner: req.user.userId,
      product: product._id,
      type: "add",
      quantity: product.stock,
      stockAfter: product.stock,
      note: "Initial stock",
    });
  }

  return res.status(201).json({ success: true, product });
}

// GET /partner/products
async function getProducts(req, res) {
  const {
    page = 1,
    limit = 20,
    category,
    subCategory,
    search,
    active,
    lowStock,
  } = req.query;

  const filter = { partner: req.user.userId };
  if (category) filter.category = category;
  if (subCategory) filter.subCategory = subCategory;
  if (active !== undefined) filter.isActive = active === "true";
  if (lowStock === "true") {
    filter.$expr = { $lte: ["$stock", "$lowStockThreshold"] };
  }
  if (search) {
    filter.$text = { $search: search };
  }

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate("category", "name slug")
      .populate("subCategory", "name slug")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10)),
    Product.countDocuments(filter),
  ]);

  return res.json({
    success: true,
    products,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total,
      pages: Math.ceil(total / parseInt(limit, 10)),
    },
  });
}

// GET /partner/products/:id
async function getProduct(req, res) {
  const product = await Product.findOne({
    _id: req.params.id,
    partner: req.user.userId,
  })
    .populate("category", "name slug")
    .populate("subCategory", "name slug");

  if (!product) return res.status(404).json({ success: false, message: "Product not found" });

  return res.json({ success: true, product });
}

// PUT /partner/products/:id
async function updateProduct(req, res) {
  const { error } = updateProductSchema.validate(req.body);
  if (error) return res.status(400).json({ success: false, message: error.details[0].message });

  const updates = { ...req.body };

  // Append new images if uploaded
  if (req.files && req.files.length > 0) {
    const newImages = req.files.map((f) => `/uploads/products/${f.filename}`);
    const existing = await Product.findById(req.params.id).select("images");
    updates.images = [...(existing?.images || []), ...newImages];
  }

  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, partner: req.user.userId },
    updates,
    { new: true }
  );

  if (!product) return res.status(404).json({ success: false, message: "Product not found" });

  return res.json({ success: true, product });
}

// DELETE /partner/products/:id
async function deleteProduct(req, res) {
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, partner: req.user.userId },
    { isActive: false },
    { new: true }
  );

  if (!product) return res.status(404).json({ success: false, message: "Product not found" });

  return res.json({ success: true, message: "Product deactivated" });
}

// PUT /partner/products/:id/stock
async function updateStock(req, res) {
  const { error } = stockUpdateSchema.validate(req.body);
  if (error) return res.status(400).json({ success: false, message: error.details[0].message });

  const { type, quantity, note } = req.body;
  const product = await Product.findOne({
    _id: req.params.id,
    partner: req.user.userId,
  });

  if (!product) return res.status(404).json({ success: false, message: "Product not found" });

  let newStock;
  if (type === "add") {
    newStock = product.stock + quantity;
  } else if (type === "remove") {
    newStock = product.stock - quantity;
    if (newStock < 0) {
      return res.status(400).json({ success: false, message: "Insufficient stock" });
    }
  } else {
    // adjustment — set to exact quantity
    newStock = quantity;
  }

  product.stock = newStock;
  await product.save();

  await InventoryLog.create({
    partner: req.user.userId,
    product: product._id,
    type,
    quantity: type === "remove" ? -quantity : quantity,
    stockAfter: newStock,
    note: note || "",
  });

  return res.json({ success: true, product });
}

// GET /partner/products/:id/inventory-log
async function getInventoryLog(req, res) {
  const { page = 1, limit = 50 } = req.query;
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const [logs, total] = await Promise.all([
    InventoryLog.find({
      product: req.params.id,
      partner: req.user.userId,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10)),
    InventoryLog.countDocuments({
      product: req.params.id,
      partner: req.user.userId,
    }),
  ]);

  return res.json({
    success: true,
    logs,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total,
      pages: Math.ceil(total / parseInt(limit, 10)),
    },
  });
}

// ── Admin Product Functions (no partner filter) ──

// GET /admin/products
async function adminGetProducts(req, res) {
  const { page = 1, limit = 20, platform, category, approvalStatus, search } = req.query;

  const filter = {};
  if (platform) filter.platform = platform;
  if (category) filter.category = category;
  if (approvalStatus) filter.approvalStatus = approvalStatus;
  if (search) filter.$text = { $search: search };

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate("category", "name slug")
      .populate("subCategory", "name slug")
      .populate("partner", "name phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10)),
    Product.countDocuments(filter),
  ]);

  return res.json({
    success: true,
    products,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total,
      pages: Math.ceil(total / parseInt(limit, 10)),
    },
  });
}

// GET /admin/products/:id
async function adminGetProduct(req, res) {
  const product = await Product.findById(req.params.id)
    .populate("category", "name slug")
    .populate("subCategory", "name slug")
    .populate("partner", "name phone");

  if (!product) return res.status(404).json({ success: false, message: "Product not found" });
  return res.json({ success: true, product });
}

// POST /admin/products
async function adminCreateProduct(req, res) {
  const { error } = createProductSchema.validate(req.body);
  if (error) return res.status(400).json({ success: false, message: error.details[0].message });

  const images = (req.files || []).map((f) => `/uploads/products/${f.filename}`);
  const partner = req.body.partner || req.user.userId;

  const product = await Product.create({
    ...req.body,
    partner,
    images,
    approvalStatus: "approved",
    approvedBy: req.user.userId,
    approvedAt: new Date(),
  });

  if (product.stock > 0) {
    await InventoryLog.create({
      partner,
      product: product._id,
      type: "add",
      quantity: product.stock,
      stockAfter: product.stock,
      note: "Initial stock (admin)",
    });
  }

  return res.status(201).json({ success: true, product });
}

// PUT /admin/products/:id
async function adminUpdateProduct(req, res) {
  const { error } = updateProductSchema.validate(req.body);
  if (error) return res.status(400).json({ success: false, message: error.details[0].message });

  const updates = { ...req.body };

  if (req.files && req.files.length > 0) {
    const newImages = req.files.map((f) => `/uploads/products/${f.filename}`);
    const existing = await Product.findById(req.params.id).select("images");
    updates.images = [...(existing?.images || []), ...newImages];
  }

  const product = await Product.findByIdAndUpdate(req.params.id, updates, { new: true });
  if (!product) return res.status(404).json({ success: false, message: "Product not found" });
  return res.json({ success: true, product });
}

// DELETE /admin/products/:id
async function adminDeleteProduct(req, res) {
  const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!product) return res.status(404).json({ success: false, message: "Product not found" });
  return res.json({ success: true, message: "Product deactivated" });
}

// PUT /admin/products/:id/review
async function adminReviewProduct(req, res) {
  const { status, note } = req.body;
  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ success: false, message: "Status must be approved or rejected" });
  }

  const product = await Product.findByIdAndUpdate(
    req.params.id,
    {
      approvalStatus: status,
      approvalNote: note || null,
      approvedBy: req.user.userId,
      approvedAt: new Date(),
    },
    { new: true }
  );

  if (!product) return res.status(404).json({ success: false, message: "Product not found" });
  return res.json({ success: true, product });
}

module.exports = {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  updateStock,
  getInventoryLog,
  // Admin functions
  adminGetProducts,
  adminGetProduct,
  adminCreateProduct,
  adminUpdateProduct,
  adminDeleteProduct,
  adminReviewProduct,
};
