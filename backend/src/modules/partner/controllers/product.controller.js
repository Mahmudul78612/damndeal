const Product = require("../../../models/Product");
const InventoryLog = require("../../../models/InventoryLog");

function parseJsonFields(body) {
  const data = { ...body };
  if (typeof data.tags === 'string') data.tags = data.tags.split(',').map(t => t.trim()).filter(Boolean);
  if (typeof data.highlights === 'string') data.highlights = data.highlights.split(',').map(h => h.trim()).filter(Boolean);
  if (typeof data.specifications === 'string') try { data.specifications = JSON.parse(data.specifications); } catch(_) { delete data.specifications; }
  if (typeof data.variants === 'string') try { data.variants = JSON.parse(data.variants); } catch(_) { delete data.variants; }
  ['gstInclusive','isReturnable','isCOD','isFeatured'].forEach(k => { if (typeof data[k] === 'string') data[k] = data[k] === 'true'; });
  return data;
}

async function createProduct(req, res) {
  const images = (req.files || []).map((f) => `/uploads/products/${f.filename}`);
  const data = parseJsonFields(req.body);
  const product = await Product.create({ ...data, partner: req.user.userId, images });

  if (product.stock > 0) {
    await InventoryLog.create({
      partner: req.user.userId, product: product._id,
      type: "add", quantity: product.stock, stockAfter: product.stock, note: "Initial stock",
    });
  }
  return res.status(201).json({ success: true, product });
}

async function getProducts(req, res) {
  const { page = 1, limit = 20, category, subCategory, search, active, lowStock } = req.query;
  const filter = { partner: req.user.userId };

  if (category) filter.category = category;
  if (subCategory) filter.subCategory = subCategory;
  if (active !== undefined) filter.isActive = active === "true";
  if (lowStock === "true") filter.$expr = { $lte: ["$stock", "$lowStockThreshold"] };
  if (search) filter.$text = { $search: search };

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [products, total] = await Promise.all([
    Product.find(filter).populate("category", "name slug").populate("subCategory", "name slug")
      .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)),
    Product.countDocuments(filter),
  ]);

  return res.json({
    success: true, products,
    pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total, pages: Math.ceil(total / parseInt(limit, 10)) },
  });
}

async function getProduct(req, res) {
  const product = await Product.findOne({ _id: req.params.id, partner: req.user.userId })
    .populate("category", "name slug").populate("subCategory", "name slug");
  if (!product) return res.status(404).json({ success: false, message: "Product not found" });
  return res.json({ success: true, product });
}

async function updateProduct(req, res) {
  const updates = parseJsonFields(req.body);
  if (req.files && req.files.length > 0) {
    const newImages = req.files.map((f) => `/uploads/products/${f.filename}`);
    const existing = await Product.findById(req.params.id).select("images");
    updates.images = [...(existing?.images || []), ...newImages];
  }

  // Re-submit for approval on update
  updates.approvalStatus = "pending";
  updates.approvedBy = null;
  updates.approvedAt = null;

  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, partner: req.user.userId }, updates, { new: true }
  );
  if (!product) return res.status(404).json({ success: false, message: "Product not found" });
  return res.json({ success: true, product });
}

async function deleteProduct(req, res) {
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, partner: req.user.userId }, { isActive: false }, { new: true }
  );
  if (!product) return res.status(404).json({ success: false, message: "Product not found" });
  return res.json({ success: true, message: "Product deactivated" });
}

async function updateStock(req, res) {
  const { type, quantity, note } = req.body;
  const product = await Product.findOne({ _id: req.params.id, partner: req.user.userId });
  if (!product) return res.status(404).json({ success: false, message: "Product not found" });

  let newStock;
  if (type === "add") newStock = product.stock + quantity;
  else if (type === "remove") {
    newStock = product.stock - quantity;
    if (newStock < 0) return res.status(400).json({ success: false, message: "Insufficient stock" });
  } else {
    newStock = quantity; // adjustment
  }

  product.stock = newStock;
  await product.save();

  await InventoryLog.create({
    partner: req.user.userId, product: product._id,
    type, quantity: type === "remove" ? -quantity : quantity,
    stockAfter: newStock, note: note || "",
  });

  return res.json({ success: true, product });
}

async function getInventoryLog(req, res) {
  const { page = 1, limit = 50 } = req.query;
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const filter = { product: req.params.id, partner: req.user.userId };

  const [logs, total] = await Promise.all([
    InventoryLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)),
    InventoryLog.countDocuments(filter),
  ]);

  return res.json({
    success: true, logs,
    pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total, pages: Math.ceil(total / parseInt(limit, 10)) },
  });
}

module.exports = { createProduct, getProducts, getProduct, updateProduct, deleteProduct, updateStock, getInventoryLog };
