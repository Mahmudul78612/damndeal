const Product = require("../../../models/Product");
const PartnerKyc = require("../../../models/PartnerKyc");
const { getSetting } = require("../../../services/fee.service");
const { regionFilter } = require("../../../utils/region");

// GET /user/search?q=doodh&lat=28.6&lng=77.2
// Cross-shop search — search products across all nearby shops
async function searchProducts(req, res) {
  const { q, lat, lng, page = 1, limit = 20, category, sortBy } = req.query;

  if (!q || q.length < 2) {
    return res.status(400).json({ success: false, message: "Search query (q) must be at least 2 characters" });
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  // Cap page size — stops one-request catalog dumps by scrapers
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
  const skip = (pageNum - 1) * limitNum;

  // Step 1: If location provided, find nearby partner IDs first
  let nearbyPartnerIds = null;
  if (lat && lng) {
    const radiusKm = await getSetting("delivery_radius_km", 20);
    const nearbyKycs = await PartnerKyc.find({
      status: "approved",
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: radiusKm * 1000,
        },
      },
    }).select("partner").limit(500);

    nearbyPartnerIds = nearbyKycs.map((k) => k.partner);
  }

  // Step 2: Search products
  const filter = {
    isActive: true,
    approvalStatus: "approved",
    stock: { $gt: 0 },
    ...regionFilter(req),
    $or: [
      { name: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
      { sku: { $regex: q, $options: "i" } },
    ],
  };

  if (nearbyPartnerIds) {
    filter.partner = { $in: nearbyPartnerIds };
  }
  if (category) filter.category = category;

  let sort = { createdAt: -1 };
  if (sortBy === "price_low") sort = { sellingPrice: 1 };
  if (sortBy === "price_high") sort = { sellingPrice: -1 };
  if (sortBy === "popular") sort = { salesCount: -1 };

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate("partner", "name")
      .populate("category", "name slug")
      .select("-costPrice -approvalNote -approvedBy -approvedAt")
      .sort(sort).skip(skip).limit(limitNum),
    Product.countDocuments(filter),
  ]);

  // Enrich with shop name
  const partnerIds = [...new Set(products.map((p) => p.partner?._id?.toString()))];
  const kycs = await PartnerKyc.find({ partner: { $in: partnerIds } }).select("partner organizationName city");
  const kycMap = Object.fromEntries(kycs.map((k) => [k.partner.toString(), k]));

  const enriched = products.map((p) => {
    const obj = p.toObject();
    const kyc = kycMap[p.partner?._id?.toString()];
    obj.shopName = kyc?.organizationName || "";
    obj.shopCity = kyc?.city || "";
    return obj;
  });

  return res.json({
    success: true, products: enriched,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  });
}

module.exports = { searchProducts, browseProducts };

// GET /user/products?category=xxx&subCategory=xxx&_id=xxx&page=1&limit=20
async function browseProducts(req, res) {
  const { page = 1, limit = 20, category, subCategory, sortBy, _id } = req.query;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  // Cap page size — stops one-request catalog dumps by scrapers
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
  const skip = (pageNum - 1) * limitNum;

  const filter = { isActive: true, approvalStatus: "approved", stock: { $gt: 0 }, ...regionFilter(req) };
  if (_id) filter._id = _id;
  if (category) filter.category = category;
  if (subCategory) filter.subCategory = subCategory;

  let sort = { createdAt: -1 };
  if (sortBy === "price_low") sort = { sellingPrice: 1 };
  if (sortBy === "price_high") sort = { sellingPrice: -1 };
  if (sortBy === "popular") sort = { salesCount: -1, rating: -1, createdAt: -1 };

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate("partner", "name")
      .populate("category", "name slug")
      .populate("subCategory", "name")
      .select("-costPrice -approvalNote -approvedBy -approvedAt")
      .sort(sort).skip(skip).limit(limitNum),
    Product.countDocuments(filter),
  ]);

  const partnerIds = [...new Set(products.map(p => p.partner?._id?.toString()))];
  const kycs = await PartnerKyc.find({ partner: { $in: partnerIds } }).select("partner organizationName city");
  const kycMap = Object.fromEntries(kycs.map(k => [k.partner.toString(), k]));

  const enriched = products.map(p => {
    const obj = p.toObject();
    const kyc = kycMap[p.partner?._id?.toString()];
    obj.shopName = kyc?.organizationName || "";
    obj.shopCity = kyc?.city || "";
    return obj;
  });

  return res.json({
    success: true, products: enriched,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  });
}
