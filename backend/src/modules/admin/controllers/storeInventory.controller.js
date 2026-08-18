/**
 * A dark store's shelf.
 *
 * Stocking is the daily job in quick commerce — far more frequent than editing
 * the catalogue — so these endpoints are built around "set the number for this
 * product at this store" rather than around creating and deleting records.
 * Upserts everywhere: an operator counting crates should not have to know
 * whether a row already exists.
 */
const StoreInventory = require("../../../models/StoreInventory");
const DarkStore = require("../../../models/DarkStore");
const Product = require("../../../models/Product");

/* GET /admin/dark-stores/:id/inventory?q=&low=true */
async function list(req, res) {
  const store = await DarkStore.findById(req.params.id).select("name code").lean();
  if (!store) return res.status(404).json({ success: false, message: "Store not found" });

  const rows = await StoreInventory.find({ store: store._id })
    .populate("product", "name images sellingPrice mrp unit platform isActive")
    .sort({ updatedAt: -1 })
    .lean();

  let items = rows
    // A row whose product was deleted is noise on a stocking screen.
    .filter((r) => r.product)
    .map((r) => ({
      _id: r._id,
      product: r.product._id,
      name: r.product.name,
      image: (r.product.images || [])[0] || "",
      unit: r.product.unit || "",
      stock: r.stock,
      // Shown resolved, so the operator sees the price a customer would pay
      // rather than having to work out what a 0 override means.
      sellingPrice: r.sellingPrice > 0 ? r.sellingPrice : r.product.sellingPrice,
      mrp: r.mrp > 0 ? r.mrp : r.product.mrp,
      hasPriceOverride: r.sellingPrice > 0,
      isActive: r.isActive,
      lowStockAt: r.lowStockAt,
      isLow: r.stock <= r.lowStockAt,
      productActive: r.product.isActive,
      lastRestockedAt: r.lastRestockedAt,
    }));

  const q = String(req.query.q || "").trim().toLowerCase();
  if (q) items = items.filter((i) => i.name.toLowerCase().includes(q));
  if (req.query.low === "true") items = items.filter((i) => i.isLow);

  return res.json({
    success: true,
    store,
    items,
    summary: {
      total: rows.length,
      inStock: items.filter((i) => i.stock > 0 && i.isActive).length,
      low: items.filter((i) => i.isLow).length,
      out: items.filter((i) => i.stock === 0).length,
    },
  });
}

/* PUT /admin/dark-stores/:id/inventory  { product, stock?, sellingPrice?, mrp?, isActive?, lowStockAt? }
   Upsert one shelf line. */
async function upsert(req, res) {
  const store = await DarkStore.findById(req.params.id).select("_id").lean();
  if (!store) return res.status(404).json({ success: false, message: "Store not found" });

  const productId = req.body.product;
  const product = await Product.findById(productId).select("_id platform").lean();
  if (!product) return res.status(404).json({ success: false, message: "Product not found" });
  if (product.platform !== "ddgo") {
    return res.status(400).json({
      success: false,
      message: "Only DDGo products can be stocked in a dark store. Change the product's platform first.",
    });
  }

  const set = {};
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : null; };

  if (req.body.stock !== undefined) {
    const n = num(req.body.stock);
    if (n === null) return res.status(400).json({ success: false, message: "Stock must be 0 or more" });
    set.stock = Math.round(n);
    set.lastRestockedAt = new Date();
  }
  if (req.body.sellingPrice !== undefined) {
    const n = num(req.body.sellingPrice);
    if (n === null) return res.status(400).json({ success: false, message: "Price must be 0 or more" });
    set.sellingPrice = n;      // 0 hands the decision back to the catalogue
  }
  if (req.body.mrp !== undefined) {
    const n = num(req.body.mrp);
    if (n === null) return res.status(400).json({ success: false, message: "MRP must be 0 or more" });
    set.mrp = n;
  }
  if (req.body.lowStockAt !== undefined) {
    const n = num(req.body.lowStockAt);
    if (n !== null) set.lowStockAt = Math.round(n);
  }
  if (req.body.isActive !== undefined) set.isActive = !!req.body.isActive;

  if (set.sellingPrice > 0 && set.mrp > 0 && set.sellingPrice > set.mrp) {
    return res.status(400).json({ success: false, message: "Selling price cannot be above MRP" });
  }

  const row = await StoreInventory.findOneAndUpdate(
    { store: store._id, product: product._id },
    { $set: set, $setOnInsert: { store: store._id, product: product._id } },
    { new: true, upsert: true }
  );
  return res.json({ success: true, item: row });
}

/* POST /admin/dark-stores/:id/inventory/bulk  { items: [{ product, stock, sellingPrice? }] }
   Stocking a new store one product at a time is not a real workflow. */
async function bulk(req, res) {
  const store = await DarkStore.findById(req.params.id).select("_id").lean();
  if (!store) return res.status(404).json({ success: false, message: "Store not found" });

  const items = Array.isArray(req.body.items) ? req.body.items.slice(0, 500) : [];
  if (!items.length) return res.status(400).json({ success: false, message: "No items sent" });

  const ids = items.map((i) => i.product).filter(Boolean);
  const valid = await Product.find({ _id: { $in: ids }, platform: "ddgo" }).select("_id").lean();
  const validIds = new Set(valid.map((p) => String(p._id)));

  const ops = [];
  const skipped = [];
  for (const i of items) {
    if (!validIds.has(String(i.product))) { skipped.push(i.product); continue; }
    const set = {};
    const n = parseFloat(i.stock);
    if (Number.isFinite(n) && n >= 0) { set.stock = Math.round(n); set.lastRestockedAt = new Date(); }
    const sp = parseFloat(i.sellingPrice);
    if (Number.isFinite(sp) && sp >= 0) set.sellingPrice = sp;
    ops.push({
      updateOne: {
        filter: { store: store._id, product: i.product },
        update: { $set: set, $setOnInsert: { store: store._id, product: i.product } },
        upsert: true,
      },
    });
  }
  if (!ops.length) {
    return res.status(400).json({ success: false, message: "None of those products are DDGo products" });
  }

  const out = await StoreInventory.bulkWrite(ops, { ordered: false });
  return res.json({
    success: true,
    added: out.upsertedCount || 0,
    updated: out.modifiedCount || 0,
    // Reported rather than swallowed, so a half-applied import is visible.
    skipped: skipped.length,
  });
}

/* DELETE /admin/dark-stores/:id/inventory/:productId — stop carrying it here */
async function remove(req, res) {
  const out = await StoreInventory.deleteOne({
    store: req.params.id, product: req.params.productId,
  });
  if (!out.deletedCount) return res.status(404).json({ success: false, message: "Not on this shelf" });
  return res.json({ success: true, message: "Removed from this store" });
}

/* GET /admin/dark-stores/:id/stockable?q=
   DDGo products this store does NOT carry yet — the picker for adding. */
async function stockable(req, res) {
  const carried = await StoreInventory.find({ store: req.params.id }).select("product").lean();
  const have = carried.map((r) => r.product);

  const filter = { platform: "ddgo", _id: { $nin: have } };
  const q = String(req.query.q || "").trim();
  if (q) filter.name = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

  const products = await Product.find(filter)
    .select("name images sellingPrice mrp unit isActive")
    .sort({ name: 1 })
    .limit(50)
    .lean();

  return res.json({ success: true, products });
}

module.exports = { list, upsert, bulk, remove, stockable };
