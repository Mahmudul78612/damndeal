const Product = require("../../../models/Product");

// GET /admin/products — review pending products
async function listProducts(req, res) {
  const { page = 1, limit = 20, approvalStatus, partner, category } = req.query;
  const filter = {};
  if (approvalStatus) filter.approvalStatus = approvalStatus;
  if (partner) filter.partner = partner;
  if (category) filter.category = category;

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate("partner", "name phone")
      .populate("category", "name")
      .populate("subCategory", "name")
      .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)),
    Product.countDocuments(filter),
  ]);

  return res.json({
    success: true, products,
    pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total, pages: Math.ceil(total / parseInt(limit, 10)) },
  });
}

// PUT /admin/products/:id/review
async function reviewProduct(req, res) {
  const { status, note } = req.body;
  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ success: false, message: "Status must be approved or rejected" });
  }

  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ success: false, message: "Product not found" });

  product.approvalStatus = status;
  product.approvalNote = note || null;
  product.approvedBy = req.user.userId;
  product.approvedAt = new Date();
  await product.save();

  return res.json({ success: true, product });
}

module.exports = { listProducts, reviewProduct };
