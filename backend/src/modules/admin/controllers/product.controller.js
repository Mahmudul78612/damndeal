const Product = require("../../../models/Product");
const InventoryLog = require("../../../models/InventoryLog");

// POST /admin/products — admin creates product for DD Go or DamnDeal
async function createProduct(req, res) {
  try {
    const images = (req.files || []).map((f) => `/uploads/products/${f.filename}`);
    const body = { ...req.body, images };

    // Parse JSON fields
    if (typeof body.tags === "string") body.tags = body.tags.split(",").map((t) => t.trim()).filter(Boolean);
    if (typeof body.highlights === "string") body.highlights = body.highlights.split(",").map((t) => t.trim()).filter(Boolean);
    if (typeof body.specifications === "string") try { body.specifications = JSON.parse(body.specifications); } catch (_) { body.specifications = []; }
    if (typeof body.variants === "string") try { body.variants = JSON.parse(body.variants); } catch (_) { body.variants = []; }

    // Phase 2: regions + per-region prices
    if (typeof body.regions === "string") {
      try { body.regions = JSON.parse(body.regions); }
      catch (_) { body.regions = body.regions.split(",").map((r) => r.trim()).filter(Boolean); }
    }
    if (!Array.isArray(body.regions) || body.regions.length === 0) body.regions = ["IN"];
    body.regions = body.regions.filter((r) => r === "IN" || r === "US");
    if (body.regions.length === 0) body.regions = ["IN"];
    if (typeof body.prices === "string") {
      try { body.prices = JSON.parse(body.prices); } catch (_) { delete body.prices; }
    }

    // deliveryFee: empty string → null (use global rule). Otherwise coerce to number.
    if (body.deliveryFee === "" || body.deliveryFee === undefined) body.deliveryFee = null;
    else if (body.deliveryFee !== null) body.deliveryFee = Number(body.deliveryFee);

    // Auto-calculate stock from variants
    if (body.hasVariants === 'true' || body.hasVariants === true) {
      body.hasVariants = true;
      if (Array.isArray(body.variants) && body.variants.length > 0) {
        body.stock = body.variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
        // Use first variant pricing as base if not set
        if (!body.sellingPrice || body.sellingPrice == 0) body.sellingPrice = body.variants[0].sellingPrice;
        if (!body.mrp || body.mrp == 0) body.mrp = body.variants[0].mrp;
        if (!body.costPrice || body.costPrice == 0) body.costPrice = body.variants[0].costPrice;
      }
    }

    // Admin-created products are auto-approved
    body.approvalStatus = "approved";
    body.approvedBy = req.user.userId;
    body.approvedAt = new Date();

    // partner is required — admin sets it or uses own userId
    if (!body.partner) body.partner = req.user.userId;

    const product = await Product.create(body);

    if (product.stock > 0) {
      await InventoryLog.create({
        partner: product.partner,
        product: product._id,
        type: "add",
        quantity: product.stock,
        stockAfter: product.stock,
        note: "Initial stock (admin)",
      });
    }

    return res.status(201).json({ success: true, product });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

// GET /admin/products — list with platform filter
async function listProducts(req, res) {
  try {
    const { page = 1, limit = 20, approvalStatus, partner, category, platform, region, search } = req.query;
    const filter = {};
    if (approvalStatus) filter.approvalStatus = approvalStatus;
    if (partner) filter.partner = partner;
    if (category) filter.category = category;
    if (platform) filter.platform = platform;
    // Phase 2: region filter. 'all' = no filter; otherwise match the array field.
    const regionParam = (region || req.region || "IN").toString();
    if (regionParam !== "all") filter.regions = regionParam;
    if (search) filter.$text = { $search: search };

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("partner", "name phone")
        .populate("category", "name")
        .populate("subCategory", "name")
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
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /admin/products/:id
async function getProduct(req, res) {
  try {
    const product = await Product.findById(req.params.id)
      .populate("partner", "name phone")
      .populate("category", "name")
      .populate("subCategory", "name");
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    return res.json({ success: true, product });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /admin/products/:id
async function updateProduct(req, res) {
  try {
    const updates = { ...req.body };
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map((f) => `/uploads/products/${f.filename}`);
      const existing = await Product.findById(req.params.id).select("images");
      updates.images = [...(existing?.images || []), ...newImages];
    }

    // Handle image removal
    if (updates.removeImages) {
      try {
        const toRemove = typeof updates.removeImages === 'string' ? JSON.parse(updates.removeImages) : updates.removeImages;
        if (Array.isArray(toRemove) && toRemove.length > 0) {
          if (!updates.images) {
            const existing = await Product.findById(req.params.id).select("images");
            updates.images = [...(existing?.images || [])];
          }
          updates.images = updates.images.filter(img => !toRemove.includes(img));
        }
      } catch (_) {}
      delete updates.removeImages;
    }

    if (typeof updates.tags === "string") updates.tags = updates.tags.split(",").map((t) => t.trim()).filter(Boolean);
    if (typeof updates.highlights === "string") updates.highlights = updates.highlights.split(",").map((t) => t.trim()).filter(Boolean);
    if (typeof updates.specifications === "string") try { updates.specifications = JSON.parse(updates.specifications); } catch (_) { updates.specifications = []; }
    if (typeof updates.variants === "string") try { updates.variants = JSON.parse(updates.variants); } catch (_) { updates.variants = []; }

    // Phase 2: regions + per-region prices on update
    if (typeof updates.regions === "string") {
      try { updates.regions = JSON.parse(updates.regions); }
      catch (_) { updates.regions = updates.regions.split(",").map((r) => r.trim()).filter(Boolean); }
    }
    if (Array.isArray(updates.regions)) {
      updates.regions = updates.regions.filter((r) => r === "IN" || r === "US");
      if (updates.regions.length === 0) updates.regions = ["IN"];
    }
    if (typeof updates.prices === "string") {
      try { updates.prices = JSON.parse(updates.prices); } catch (_) { delete updates.prices; }
    }

    // deliveryFee: empty string → null (use global rule). Otherwise coerce to number.
    if (updates.deliveryFee === "" || updates.deliveryFee === undefined) {
      // Only set null if explicitly cleared (key present but empty)
      if (Object.prototype.hasOwnProperty.call(updates, "deliveryFee")) updates.deliveryFee = null;
    } else if (updates.deliveryFee !== null) {
      updates.deliveryFee = Number(updates.deliveryFee);
    }

    // Auto-calculate stock from variants
    if (updates.hasVariants === 'true' || updates.hasVariants === true) {
      updates.hasVariants = true;
      if (Array.isArray(updates.variants) && updates.variants.length > 0) {
        updates.stock = updates.variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
      }
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    return res.json({ success: true, product });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

// DELETE /admin/products/:id
async function deleteProduct(req, res) {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    return res.json({ success: true, message: "Product deleted" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /admin/products/:id/review
async function reviewProduct(req, res) {
  try {
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
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { createProduct, listProducts, getProduct, updateProduct, deleteProduct, reviewProduct };
