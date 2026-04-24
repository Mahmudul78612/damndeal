/**
 * CJ Dropshipping — Admin Controller
 * Routes:
 *   GET  /admin/cj/products/search   — search CJ catalog
 *   GET  /admin/cj/products/:pid     — product details from CJ
 *   POST /admin/cj/products/import   — import product to DamnDeal DB
 *   GET  /admin/cj/imported          — list imported CJ products
 *   PUT  /admin/cj/imported/:id      — update pricing of imported product
 *   DELETE /admin/cj/imported/:id    — remove imported product
 *   POST /admin/cj/sync/:id          — sync stock/price from CJ
 *   GET  /admin/cj/order/:cjOrderId  — get CJ order status
 *   GET  /admin/cj/categories        — CJ category list
 */

const cjService = require("../../../services/cj.service");
const Product = require("../../../models/Product");
const AppSettings = require("../../../models/AppSettings");
const Category = require("../../../models/Category");

async function getCjUsdInrRate() {
  const rateSetting = await AppSettings.findOne({ key: "cj_usd_inr_rate" });
  const usdRate = parseFloat(rateSetting?.value || "84");
  return Number.isFinite(usdRate) && usdRate > 0 ? usdRate : 84;
}

function toInrFromUsd(usd, usdRate) {
  const usdNum = parseFloat(usd);
  if (!Number.isFinite(usdNum) || usdNum <= 0) return 0;
  return Math.round(usdNum * usdRate * 100) / 100;
}

// ── GET /admin/cj/products/search ─────────────────────────────────────────
async function searchCJProducts(req, res) {
  try {
    const { keyword, page = 1, size = 20, categoryId, minPrice, maxPrice } = req.query;
    const result = await cjService.searchProducts({ keyword, page: parseInt(page), size: parseInt(size), categoryId, minPrice, maxPrice });
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

// ── GET /admin/cj/products/:pid ───────────────────────────────────────────
async function getCJProductDetails(req, res) {
  try {
    const product = await cjService.getProductDetails(req.params.pid);
    return res.json({ success: true, product });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

// ── GET /admin/cj/categories ──────────────────────────────────────────────
async function getCJCategories(req, res) {
  try {
    const categories = await cjService.getCategories();
    return res.json({ success: true, categories });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

// ── POST /admin/cj/products/import ────────────────────────────────────────
async function importCJProduct(req, res) {
  try {
    const {
      cjProductId,
      cjVariantId,
      cjVariantSku,
      cjCostUsd,           // CJ cost in USD
      name,
      description,
      images,              // array of URLs
      sellingPrice,        // INR selling price set by admin
      mrp,                 // INR MRP
      categoryId,          // DamnDeal category _id
      subCategoryId,
      platform = "damndeal",
      gstPercent = 18,
      weight,
      cjVariants,          // optional: array of variant mappings
    } = req.body;

    if (!cjProductId || !name || !sellingPrice || !mrp || !categoryId) {
      return res.status(400).json({ success: false, message: "cjProductId, name, sellingPrice, mrp, categoryId required" });
    }

    const usdRate = await getCjUsdInrRate();
    const cjCostUsdNum = parseFloat(cjCostUsd);
    const costPriceInr = toInrFromUsd(cjCostUsdNum, usdRate);

    // Check if already imported
    const existing = await Product.findOne({ cjProductId });
    if (existing) {
      return res.status(409).json({ success: false, message: "This CJ product is already imported", product: existing });
    }

    let imageList = Array.isArray(images) ? images.filter(Boolean) : [];
    let descriptionText = description || '';
    
    if (!imageList.length || !descriptionText) {
      try {
        const cjProduct = await cjService.getProductDetails(cjProductId);
        if (!imageList.length) {
          const fromDetails = Array.isArray(cjProduct?.productImageSet) ? cjProduct.productImageSet : [];
          imageList = fromDetails.filter(Boolean);
        }
        if (!descriptionText) {
          descriptionText = cjProduct?.productDescription || cjProduct?.description || '';
        }
      } catch (_) {
        if (!imageList.length) imageList = [];
        if (!descriptionText) descriptionText = '';
      }
    }

    const product = await Product.create({
      source: "cj",
      cjProductId,
      cjVariantId: cjVariantId || null,
      cjVariantSku: cjVariantSku || null,
      cjCostPrice: Number.isFinite(cjCostUsdNum) ? cjCostUsdNum : null,
      cjVariants: Array.isArray(cjVariants) ? cjVariants : [],
      cjLastSyncAt: new Date(),

      platform,
      name,
      description: descriptionText,
      images: imageList,
      sellingPrice: parseFloat(sellingPrice),
      mrp: parseFloat(mrp),
      costPrice: costPriceInr,
      gstPercent: parseInt(gstPercent),
      gstInclusive: true,
      category: categoryId,
      subCategory: subCategoryId || null,
      partner: req.user.userId,
      weight: weight || null,
      stock: 999,          // CJ = virtually unlimited
      isActive: true,
      hasVariants: Array.isArray(cjVariants) && cjVariants.length > 0,
      approvalStatus: "approved",
      approvedBy: req.user.userId,
      approvedAt: new Date(),
    });

    return res.status(201).json({ success: true, product });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

// ── GET /admin/cj/imported ────────────────────────────────────────────────
async function listImportedProducts(req, res) {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const filter = { source: "cj" };
    if (search) filter.$text = { $search: search };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [products, total] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).populate("category", "name"),
      Product.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      products,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ── PUT /admin/cj/imported/:id ────────────────────────────────────────────
async function updateImportedProduct(req, res) {
  try {
    const { sellingPrice, mrp, isActive, name, description, cjVariants } = req.body;
    const update = {};
    if (sellingPrice !== undefined) update.sellingPrice = parseFloat(sellingPrice);
    if (mrp !== undefined) update.mrp = parseFloat(mrp);
    if (isActive !== undefined) update.isActive = isActive;
    if (name) update.name = name;
    if (description !== undefined) update.description = description;
    if (cjVariants) update.cjVariants = cjVariants;

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, source: "cj" },
      { $set: update },
      { new: true }
    );
    if (!product) return res.status(404).json({ success: false, message: "CJ product not found" });
    return res.json({ success: true, product });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

// ── DELETE /admin/cj/imported/:id ─────────────────────────────────────────
async function deleteImportedProduct(req, res) {
  try {
    const product = await Product.findOneAndDelete({ _id: req.params.id, source: "cj" });
    if (!product) return res.status(404).json({ success: false, message: "CJ product not found" });
    return res.json({ success: true, message: "Removed" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ── POST /admin/cj/sync/:id — re-sync price/stock from CJ ─────────────────
async function syncCJProduct(req, res) {
  try {
    const product = await Product.findOne({ _id: req.params.id, source: "cj" });
    if (!product) return res.status(404).json({ success: false, message: "CJ product not found" });

    const cjProduct = await cjService.getProductDetails(product.cjProductId);

    const update = {
      cjLastSyncAt: new Date(),
    };
    const usdRate = await getCjUsdInrRate();

    // Update CJ cost from first variant
    if (cjProduct.variants && cjProduct.variants.length > 0) {
      const firstVariant = cjProduct.variants[0];
      const cjCostUsdNum = parseFloat(firstVariant.variantSellPrice);
      if (Number.isFinite(cjCostUsdNum)) {
        update.cjCostPrice = cjCostUsdNum;
        update.costPrice = toInrFromUsd(cjCostUsdNum, usdRate);
      }
    }

    if (Array.isArray(cjProduct.productImageSet) && cjProduct.productImageSet.length > 0) {
      update.images = cjProduct.productImageSet.filter(Boolean);
    }

    await Product.updateOne({ _id: product._id }, { $set: update });
    return res.json({ success: true, message: "Synced from CJ", cjProduct });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

// ── GET /admin/cj/order/:cjOrderId ───────────────────────────────────────
async function getCJOrder(req, res) {
  try {
    const data = await cjService.getCJOrderStatus(req.params.cjOrderId);
    return res.json({ success: true, order: data });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

// ── GET /admin/cj/freight ────────────────────────────────────────────────
// Estimate cheapest CJ freight (USD + INR) for a given variant/weight/qty.
// Used by the import modal to suggest "Free Delivery" pricing.
async function getCJFreight(req, res) {
  try {
    const { vid, weight = 500, quantity = 1 } = req.query;

    let estimate = await cjService.estimateFreightSummary({
      startCountryCode: "CN",
      endCountryCode: "IN",
      quantity: parseInt(quantity) || 1,
      weight: parseFloat(weight) || 500,
      vid: vid || undefined,
    });

    // Fallback: if vid produced 0, retry without vid (weight-only)
    if ((!estimate || !estimate.feeUsd) && vid) {
      console.warn(`[CJ Freight] vid ${vid} returned 0, retrying without vid`);
      estimate = await cjService.estimateFreightSummary({
        startCountryCode: "CN",
        endCountryCode: "IN",
        quantity: parseInt(quantity) || 1,
        weight: parseFloat(weight) || 500,
      });
    }

    const rateSetting = await AppSettings.findOne({ key: "cj_usd_inr_rate" });
    const usdRate = parseFloat(rateSetting?.value || "84") || 84;
    const feeInr = Math.round((estimate.feeUsd || 0) * usdRate * 100) / 100;

    console.log(`[CJ Freight] vid=${vid || 'none'} weight=${weight}g → $${estimate.feeUsd || 0} = ₹${feeInr}`);

    return res.json({
      success: true,
      feeUsd: estimate.feeUsd || 0,
      feeInr,
      minDays: estimate.minDays,
      maxDays: estimate.maxDays,
      usdRate,
      raw: estimate.raw,
    });
  } catch (err) {
    console.error("[CJ Freight] Error:", err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
}

// ── GET /admin/cj/settings ────────────────────────────────────────────────
async function getCJSettings(req, res) {
  try {
    const [apiKeySetting] = await Promise.all([
      AppSettings.findOne({ key: "cj_api_key" }),
    ]);
    return res.json({
      success: true,
      settings: {
        cj_api_key: apiKeySetting ? "****" + (apiKeySetting.value || "").slice(-4) : null,
        configured: !!apiKeySetting?.value,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ── POST /admin/cj/settings ───────────────────────────────────────────────
async function saveCJSettings(req, res) {
  try {
    const { cj_api_key } = req.body;
    if (!cj_api_key) return res.status(400).json({ success: false, message: "cj_api_key required" });

    await AppSettings.findOneAndUpdate(
      { key: "cj_api_key" },
      { value: cj_api_key, description: "CJ Dropshipping API Key", updatedBy: req.user.userId },
      { upsert: true }
    );

    // Clear cached token so next call re-authenticates
    cjService.clearTokenCache();

    return res.json({ success: true, message: "CJ API Key saved" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  searchCJProducts,
  getCJProductDetails,
  getCJCategories,
  importCJProduct,
  listImportedProducts,
  updateImportedProduct,
  deleteImportedProduct,
  syncCJProduct,
  getCJOrder,
  getCJFreight,
  getCJSettings,
  saveCJSettings,
};
