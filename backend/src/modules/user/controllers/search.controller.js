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
  const { page = 1, limit = 20, category, subCategory, sortBy, _id, platform, lat, lng } = req.query;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  // Cap page size — stops one-request catalog dumps by scrapers
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
  const skip = (pageNum - 1) * limitNum;

  const filter = { isActive: true, approvalStatus: "approved", stock: { $gt: 0 }, ...regionFilter(req) };
  if (_id) filter._id = _id;
  if (category) filter.category = category;
  if (subCategory) filter.subCategory = subCategory;

  // Storefronts are separate catalogues. Without this, DDGo grocery items and
  // damndeal items shared one listing — the caller has always sent ?platform=,
  // it was simply never read.
  if (platform === "ddgo" || platform === "damndeal") filter.platform = platform;

  /* Quick commerce is delivered by a rider from one shop, so what a customer
     may browse depends on where they are standing. Given a location, this
     narrows the listing to the shops that actually reach them; without one it
     stays open, because the storefront asks for location before it lists
     anything and an early call should not look like an empty catalogue. */
  let shelf = null;          // store's own stock/price, applied after the query
  if (platform === "ddgo" && lat && lng) {
    const { storesCovering } = require("../../../services/serviceability.service");
    const stores = await storesCovering({
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      region: req.region === "US" ? "US" : "IN",
    });
    if (!stores.length) {
      return res.json({
        success: true, products: [], serviceable: false,
        pagination: { page: pageNum, limit: limitNum, total: 0, pages: 0 },
      });
    }

    const partnerIds = stores.filter((s) => s.type === "partner").map((s) => s.partner);
    const darkStore = stores.find((s) => s.type === "darkstore");

    const or = [];
    if (partnerIds.length) or.push({ partner: { $in: partnerIds } });

    if (darkStore) {
      /* A dark store sells exactly what is on its shelf. A product with no row
         is not carried here — that is the default, so a new store starts empty
         and is stocked deliberately instead of silently claiming the whole
         catalogue. */
      const StoreInventory = require("../../../models/StoreInventory");
      const rows = await StoreInventory.find({
        store: darkStore.id, isActive: true, stock: { $gt: 0 },
      }).select("product stock sellingPrice mrp").lean();

      if (rows.length) {
        shelf = Object.fromEntries(rows.map((r) => [String(r.product), r]));
        or.push({ _id: { $in: rows.map((r) => r.product) } });
      }
    }

    if (!or.length) {
      // Covered, but nothing is actually stocked for this address.
      return res.json({
        success: true, products: [], serviceable: true,
        pagination: { page: pageNum, limit: limitNum, total: 0, pages: 0 },
      });
    }
    filter.$or = or;
    /* The product-level stock check would hide an item the store has in the
       aisle but head office marked as zero. On this path the shelf is the
       authority, so drop it and let the inventory rows decide. */
    if (shelf) delete filter.stock;
  }

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

    /* What this store charges and holds wins over the catalogue defaults.
       A zero override means "no override", so a catalogue-wide price change
       still reaches every store that has not set its own. */
    const row = shelf ? shelf[String(p._id)] : null;
    if (row) {
      obj.stock = row.stock;
      if (row.sellingPrice > 0) obj.sellingPrice = row.sellingPrice;
      if (row.mrp > 0) obj.mrp = row.mrp;
      obj.fromStore = true;
    }
    return obj;
  });

  return res.json({
    success: true, products: enriched,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  });
}
