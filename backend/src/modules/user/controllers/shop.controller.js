const PartnerKyc = require("../../../models/PartnerKyc");
const Product = require("../../../models/Product");
const Review = require("../../../models/Review");
const { getSetting, calcDistanceKm } = require("../../../services/fee.service");
const { regionFilter } = require("../../../utils/region");

// GET /user/shops — nearby shops within radius (default 20km)
// Query: lat, lng (required for geo), category, search, page, limit
async function getShops(req, res) {
  const { page = 1, limit = 20, category, search, lat, lng } = req.query;

  const radiusKm = await getSetting("delivery_radius_km", 20);
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  // If lat/lng provided — geo-based search
  if (lat && lng) {
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const radiusMeters = radiusKm * 1000;

    const geoMatch = {
      status: "approved",
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [userLng, userLat] },
          $maxDistance: radiusMeters,
        },
      },
    };
    if (category) geoMatch.category = category;
    if (search) {
      geoMatch.$or = [
        { organizationName: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
      ];
    }

    const [kycs, total] = await Promise.all([
      PartnerKyc.find(geoMatch)
        .populate("partner", "name phone avatar")
        .populate("category", "name slug icon")
        .skip(skip).limit(limitNum),
      PartnerKyc.countDocuments(geoMatch),
    ]);

    const shops = await Promise.all(
      kycs.map(async (kyc) => {
        const [productCount, ratingData] = await Promise.all([
          Product.countDocuments({
            partner: kyc.partner._id, isActive: true, approvalStatus: "approved",
          }),
          Review.aggregate([
            { $match: { partner: kyc.partner._id } },
            { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
          ]),
        ]);

        const [lng2, lat2] = kyc.location.coordinates;
        const distanceKm = calcDistanceKm(userLat, userLng, lat2, lng2);

        return {
          id: kyc.partner._id,
          name: kyc.organizationName,
          ownerName: kyc.name,
          phone: kyc.partner.phone,
          avatar: kyc.partner.avatar,
          photo: kyc.photo,
          category: kyc.category,
          shopAddress: kyc.shopAddress,
          city: kyc.city,
          freeDeliveryAbove: kyc.freeDeliveryAbove,
          selfDeliveryEnabled: kyc.selfDeliveryEnabled,
          location: kyc.location,
          distanceKm,
          productCount,
          rating: ratingData[0] ? Math.round(ratingData[0].avg * 10) / 10 : 0,
          ratingCount: ratingData[0]?.count || 0,
        };
      })
    );

    return res.json({
      success: true, shops, radiusKm,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  }

  // Fallback: no lat/lng — list all approved shops (no distance)
  const filter = { status: "approved" };
  if (category) filter.category = category;
  if (search) {
    filter.$or = [
      { organizationName: { $regex: search, $options: "i" } },
      { name: { $regex: search, $options: "i" } },
    ];
  }

  const [kycs, total] = await Promise.all([
    PartnerKyc.find(filter)
      .populate("partner", "name phone avatar")
      .populate("category", "name slug icon")
      .sort({ createdAt: -1 }).skip(skip).limit(limitNum),
    PartnerKyc.countDocuments(filter),
  ]);

  const shops = await Promise.all(
    kycs.map(async (kyc) => {
      const [productCount, ratingData] = await Promise.all([
        Product.countDocuments({
          partner: kyc.partner._id, isActive: true, approvalStatus: "approved",
        }),
        Review.aggregate([
          { $match: { partner: kyc.partner._id } },
          { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
        ]),
      ]);

      return {
        id: kyc.partner._id,
        name: kyc.organizationName,
        ownerName: kyc.name,
        phone: kyc.partner.phone,
        avatar: kyc.partner.avatar,
        photo: kyc.photo,
        category: kyc.category,
        shopAddress: kyc.shopAddress,
        city: kyc.city,
        freeDeliveryAbove: kyc.freeDeliveryAbove,
        selfDeliveryEnabled: kyc.selfDeliveryEnabled,
        location: kyc.location,
        productCount,
        rating: ratingData[0] ? Math.round(ratingData[0].avg * 10) / 10 : 0,
        ratingCount: ratingData[0]?.count || 0,
      };
    })
  );

  return res.json({
    success: true, shops,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  });
}

// GET /user/shops/:id — shop detail (pass ?lat=&lng= for distance)
async function getShop(req, res) {
  const kyc = await PartnerKyc.findOne({ partner: req.params.id, status: "approved" })
    .populate("partner", "name phone avatar")
    .populate("category", "name slug icon");

  if (!kyc) return res.status(404).json({ success: false, message: "Shop not found" });

  const [ratingData] = await Review.aggregate([
    { $match: { partner: kyc.partner._id } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);

  let distanceKm = null;
  if (req.query.lat && req.query.lng) {
    const [lng2, lat2] = kyc.location.coordinates;
    distanceKm = calcDistanceKm(parseFloat(req.query.lat), parseFloat(req.query.lng), lat2, lng2);
  }

  return res.json({
    success: true,
    shop: {
      id: kyc.partner._id,
      name: kyc.organizationName,
      ownerName: kyc.name,
      phone: kyc.partner.phone,
      avatar: kyc.partner.avatar,
      photo: kyc.photo,
      category: kyc.category,
      shopAddress: kyc.shopAddress,
      city: kyc.city,
      freeDeliveryAbove: kyc.freeDeliveryAbove,
      selfDeliveryEnabled: kyc.selfDeliveryEnabled,
      location: kyc.location,
      distanceKm,
      rating: ratingData ? Math.round(ratingData.avg * 10) / 10 : 0,
      ratingCount: ratingData?.count || 0,
    },
  });
}

// GET /user/shops/:id/products — products of a shop
async function getShopProducts(req, res) {
  const { page = 1, limit = 20, category, subCategory, search } = req.query;
  const filter = {
    partner: req.params.id, isActive: true, approvalStatus: "approved", stock: { $gt: 0 }, ...regionFilter(req),
  };
  if (category) filter.category = category;
  if (subCategory) filter.subCategory = subCategory;
  if (search) filter.$text = { $search: search };

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [products, total] = await Promise.all([
    Product.find(filter).populate("category", "name").populate("subCategory", "name")
      .select("-costPrice -approvalStatus -approvedBy -approvedAt -approvalNote")
      .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)),
    Product.countDocuments(filter),
  ]);

  return res.json({
    success: true, products,
    pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total, pages: Math.ceil(total / parseInt(limit, 10)) },
  });
}

module.exports = { getShops, getShop, getShopProducts };

/* GET /api/user/serviceability?lat=&lng=
   The storefront's first question on a DDGo screen: can we deliver here, and
   from where. Answered before the customer browses, not at checkout — finding
   out after filling a cart is what the old flow did wrong. */
async function getServiceability(req, res) {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ success: false, message: "lat and lng are required" });
  }
  const region = String(req.headers["x-region"] || "IN").toUpperCase() === "US" ? "US" : "IN";
  const { resolveServiceability } = require("../../../services/serviceability.service");
  const out = await resolveServiceability({ lat, lng, region });

  return res.json({
    success: true,
    serviceable: out.serviceable,
    reason: out.reason,
    message: out.message || null,
    // Only the winning store is public. The full list is an internal detail
    // and would leak our whole footprint to anyone with a map.
    store: out.store
      ? {
          id: out.store.id,
          type: out.store.type,
          name: out.store.name,
          city: out.store.city,
          distanceKm: out.store.distanceKm,
          etaMins: out.store.etaMins,
          isOpen: out.store.isOpen,
          minOrderAmount: out.store.minOrderAmount,
          deliveryFee: out.store.deliveryFee,
          freeDeliveryAbove: out.store.freeDeliveryAbove,
        }
      : null,
  });
}

module.exports.getServiceability = getServiceability;

/* POST /api/user/serviceability/notify  { lat, lng, address?, pincode?, phone? }
   Records an address we cannot reach yet. This is the only signal we get about
   where to open next, so it is stored even when the visitor leaves no phone
   number — the pin alone is worth keeping. */
async function requestArea(req, res) {
  const lat = parseFloat(req.body.lat);
  const lng = parseFloat(req.body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ success: false, message: "lat and lng are required" });
  }

  const AreaRequest = require("../../../models/AreaRequest");
  const region = String(req.headers["x-region"] || "IN").toUpperCase() === "US" ? "US" : "IN";
  const phone = String(req.body.phone || "").trim().slice(0, 20);

  // One row per person per spot: a visitor who reloads the page three times is
  // one request, not three, or the demand map lies.
  const near = {
    region,
    location: {
      $near: { $geometry: { type: "Point", coordinates: [lng, lat] }, $maxDistance: 500 },
    },
    ...(phone ? { phone } : req.user ? { user: req.user.userId } : {}),
  };
  const existing = await AreaRequest.findOne(near).select("_id").lean();
  if (existing) {
    return res.json({ success: true, message: "We already have your area on the list — we'll let you know." });
  }

  await AreaRequest.create({
    location: { type: "Point", coordinates: [lng, lat] },
    address: String(req.body.address || "").slice(0, 300),
    pincode: String(req.body.pincode || "").slice(0, 12),
    city: String(req.body.city || "").slice(0, 100),
    phone,
    user: req.user?.userId || null,
    region,
  });

  return res.json({ success: true, message: "Thanks — we'll tell you the moment we start delivering there." });
}

module.exports.requestArea = requestArea;
