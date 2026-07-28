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
