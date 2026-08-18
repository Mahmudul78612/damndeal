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


/* ── DDGo storefront: the shops around you ──────────────────────────────────
   Quick commerce is browsed shop-first, the way Zomato is: you pick who is
   delivering before you pick what. A flat product list cannot express that one
   shop is open and four minutes away while another is shut, and it hides which
   basket a price belongs to. */

/** Public-safe view of a store, with how many things it can actually sell. */
async function decorateStores(stores) {
  const StoreInventory = require("../../../models/StoreInventory");
  const DarkStore = require("../../../models/DarkStore");

  return Promise.all(stores.map(async (st) => {
    let itemCount = 0;
    let logo = "";

    if (st.type === "darkstore") {
      itemCount = await StoreInventory.countDocuments({
        store: st.id, isActive: true, stock: { $gt: 0 },
      });
      const d = await DarkStore.findById(st.id).select("address image logo coverImage").lean();
      st.address = d?.address || st.address;
      logo = d?.logo || d?.image || "";
      st.coverImage = d?.coverImage || "";
    } else {
      itemCount = await Product.countDocuments({
        partner: st.partner, platform: "ddgo",
        isActive: true, approvalStatus: "approved", stock: { $gt: 0 },
      });
      const kyc = await PartnerKyc.findOne({ partner: st.partner }).select("photo").lean();
      logo = kyc?.photo || "";
      st.coverImage = "";
    }

    return {
      id: st.id,
      type: st.type,
      name: st.name,
      logo,
      city: st.city,
      address: st.address,
      coverImage: st.coverImage || "",
      distanceKm: st.distanceKm,
      etaMins: st.etaMins,
      isOpen: st.isOpen,
      itemCount,
      minOrderAmount: st.minOrderAmount,
      deliveryFee: st.deliveryFee,
      freeDeliveryAbove: st.freeDeliveryAbove,
    };
  }));
}

/* GET /api/user/ddgo/stores?lat=&lng=
   Every shop that can reach this address, nearest first. Closed shops are
   included and flagged rather than hidden: "opens at 8" is useful, silently
   vanishing is not. Shops with nothing on the shelf are dropped, because a
   customer cannot do anything with an empty one. */
async function ddgoStores(req, res) {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ success: false, message: "lat and lng are required" });
  }
  const region = String(req.headers["x-region"] || "IN").toUpperCase() === "US" ? "US" : "IN";
  const { storesCovering } = require("../../../services/serviceability.service");

  const raw = await storesCovering({ lat, lng, region, includeClosed: true });
  const decorated = (await decorateStores(raw)).filter((s) => s.itemCount > 0);

  // Open shops first, then by distance — a shut shop two streets away is worth
  // less right now than an open one a kilometre off.
  decorated.sort((a, b) => (a.isOpen === b.isOpen ? a.distanceKm - b.distanceKm : a.isOpen ? -1 : 1));

  return res.json({
    success: true,
    serviceable: decorated.some((s) => s.isOpen),
    stores: decorated,
  });
}

/* GET /api/user/ddgo/stores/:id?lat=&lng=&category=&page=&limit=
   One shop and what it is selling right now.

   The location is re-checked here rather than trusted from the listing: a
   customer can arrive on this page from a link, a bookmark or a stale tab, and
   a shop they cannot be delivered from must not look orderable. */
async function ddgoStoreDetail(req, res) {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ success: false, message: "lat and lng are required" });
  }
  const region = String(req.headers["x-region"] || "IN").toUpperCase() === "US" ? "US" : "IN";
  const { storesCovering } = require("../../../services/serviceability.service");

  const covering = await storesCovering({ lat, lng, region, includeClosed: true });
  const match = covering.find((s) => String(s.id) === String(req.params.id));
  if (!match) {
    return res.status(404).json({
      success: false,
      code: "OUT_OF_RANGE",
      message: "This store does not deliver to your address.",
    });
  }

  const [store] = await decorateStores([match]);

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 24));
  const skip = (page - 1) * limit;

  let products = [];
  let total = 0;
  const allCats = new Map();

  if (match.type === "darkstore") {
    const StoreInventory = require("../../../models/StoreInventory");
    const rows = await StoreInventory.find({ store: match.id, isActive: true, stock: { $gt: 0 } })
      .populate({
        path: "product",
        select: "name images sellingPrice mrp unit description category isActive approvalStatus",
        populate: { path: "category", select: "name slug" },
      })
      .lean();

    // A shelf row whose product was disabled or unapproved must not be sold.
    let live = rows.filter((r) => r.product && r.product.isActive && r.product.approvalStatus === "approved");
    if (req.query.category) {
      live = live.filter((r) => String(r.product.category?._id || r.product.category) === String(req.query.category));
    }
    total = live.length;
    // Chips must span the whole shelf, not whichever page happens to be
    // loaded — otherwise page one hides every other aisle.
    for (const r of live) {
      const c = r.product.category;
      if (c && c._id) allCats.set(String(c._id), { _id: c._id, name: c.name });
    }
    products = live.slice(skip, skip + limit).map((r) => ({
      _id: r.product._id,
      name: r.product.name,
      images: r.product.images,
      unit: r.product.unit,
      description: r.product.description || "",
      category: r.product.category,
      // The shelf decides the price and the count; 0 means "use the catalogue".
      sellingPrice: r.sellingPrice > 0 ? r.sellingPrice : r.product.sellingPrice,
      mrp: r.mrp > 0 ? r.mrp : r.product.mrp,
      stock: r.stock,
    }));
  } else {
    const filter = {
      partner: match.partner, platform: "ddgo",
      isActive: true, approvalStatus: "approved", stock: { $gt: 0 },
    };
    if (req.query.category) filter.category = req.query.category;
    const [list, count] = await Promise.all([
      Product.find(filter)
        .select("name images sellingPrice mrp unit stock description category")
        .populate("category", "name slug")
        .sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Product.countDocuments(filter),
    ]);
    products = list;
    total = count;
    const catIds = await Product.distinct("category", filter.category ? { ...filter, category: undefined } : filter);
    const catDocs = await require("../../../models/Category").find({ _id: { $in: catIds } }).select("name").lean();
    for (const c of catDocs) allCats.set(String(c._id), { _id: c._id, name: c.name });
  }

  return res.json({
    success: true,
    store,
    products,
    // A short highlight row for the top of the store page — only meaningful on
    // page one, where the customer first lands.
    recommended: page === 1 ? products.slice(0, 8) : [],
    // Every category this shop carries, independent of the current page.
    categories: [...allCats.values()],
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

/* GET /api/user/ddgo/banners
   Promotional banners for the DDGo home. Reuses the Banner model (which already
   has a platform field), so the admin creates them on the existing Banners
   page with platform = ddgo and a link — no new admin surface needed. */
async function ddgoBanners(req, res) {
  const Banner = require("../../../models/Banner");
  const region = String(req.headers["x-region"] || "IN").toUpperCase() === "US" ? "US" : "IN";
  const now = new Date();
  const banners = await Banner.find({
    platform: "ddgo", isActive: true, regions: region,
  })
    .select("title image linkType linkValue subtitle")
    .sort({ sortOrder: 1, createdAt: -1 })
    .limit(10)
    .lean();
  void now;
  return res.json({ success: true, banners });
}

module.exports.ddgoBanners = ddgoBanners;
module.exports.ddgoStores = ddgoStores;
module.exports.ddgoStoreDetail = ddgoStoreDetail;

/* GET /api/user/ddgo/stores/:id/product/:pid?lat=&lng=
   One product as sold by one store — for the full-page product view.
   Re-checks serviceability and reads the store's own price/stock, so a
   bookmarked product link cannot show something unorderable or mispriced. */
async function ddgoProduct(req, res) {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ success: false, message: "lat and lng are required" });
  }
  const region = String(req.headers["x-region"] || "IN").toUpperCase() === "US" ? "US" : "IN";
  const { storesCovering } = require("../../../services/serviceability.service");

  const covering = await storesCovering({ lat, lng, region, includeClosed: true });
  const match = covering.find((sx) => String(sx.id) === String(req.params.id));
  if (!match) {
    return res.status(404).json({ success: false, code: "OUT_OF_RANGE", message: "This store does not deliver to your address." });
  }
  const [store] = await decorateStores([match]);

  const product = await Product.findById(req.params.pid)
    .select("name images sellingPrice mrp unit description category isActive approvalStatus platform")
    .populate("category", "name slug")
    .lean();
  if (!product || product.platform !== "ddgo" || !product.isActive || product.approvalStatus !== "approved") {
    return res.status(404).json({ success: false, message: "Product not available" });
  }

  let price = product.sellingPrice, mrp = product.mrp, stock = product.stock;
  if (match.type === "darkstore") {
    const StoreInventory = require("../../../models/StoreInventory");
    const row = await StoreInventory.findOne({ store: match.id, product: product._id, isActive: true }).lean();
    if (!row || row.stock <= 0) {
      return res.status(404).json({ success: false, message: "This store is out of stock of that item." });
    }
    price = row.sellingPrice > 0 ? row.sellingPrice : product.sellingPrice;
    mrp = row.mrp > 0 ? row.mrp : product.mrp;
    stock = row.stock;
  } else {
    const p = await Product.findOne({ _id: product._id, partner: match.partner, stock: { $gt: 0 } }).select("stock").lean();
    if (!p) return res.status(404).json({ success: false, message: "This store is out of stock of that item." });
    stock = p.stock;
  }

  return res.json({
    success: true,
    store,
    product: {
      _id: product._id, name: product.name, images: product.images || [],
      unit: product.unit, description: product.description || "",
      category: product.category, sellingPrice: price, mrp, stock,
    },
  });
}

module.exports.ddgoProduct = ddgoProduct;

/* GET /api/user/ddgo/stores/:id/checkout-info?lat=&lng=
   The one thing the DDGo checkout page needs that the store page does not:
   which partner account the order is placed against. A partner shop IS that
   account; a dark store's catalogue is owned by the platform account that its
   shelf products belong to. Exactly one owner is required - a mixed-owner
   shelf cannot be settled as one order, so it is refused loudly rather than
   billed wrongly. */
async function ddgoCheckoutInfo(req, res) {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ success: false, message: "lat and lng are required" });
  }
  const region = String(req.headers["x-region"] || "IN").toUpperCase() === "US" ? "US" : "IN";
  const { storesCovering } = require("../../../services/serviceability.service");

  const covering = await storesCovering({ lat, lng, region, includeClosed: true });
  const match = covering.find((sx) => String(sx.id) === String(req.params.id));
  if (!match) {
    return res.status(404).json({ success: false, code: "OUT_OF_RANGE", message: "This store does not deliver to your address." });
  }
  if (!match.isOpen) {
    return res.status(409).json({ success: false, code: "CLOSED", message: "This store is closed right now. You can order when it opens." });
  }

  let partnerId;
  if (match.type === "partner") {
    partnerId = match.partner;
  } else {
    const StoreInventory = require("../../../models/StoreInventory");
    const rows = await StoreInventory.find({ store: match.id, isActive: true, stock: { $gt: 0 } })
      .select("product").lean();
    const owners = await Product.distinct("partner", { _id: { $in: rows.map((r) => r.product) } });
    if (owners.length !== 1) {
      return res.status(409).json({
        success: false,
        message: "This store cannot take orders right now. Please try another store.",
      });
    }
    partnerId = String(owners[0]);
  }

  return res.json({
    success: true,
    partnerId,
    store: {
      id: match.id, type: match.type, name: match.name,
      etaMins: match.etaMins, distanceKm: match.distanceKm,
      minOrderAmount: match.minOrderAmount, deliveryFee: match.deliveryFee,
      freeDeliveryAbove: match.freeDeliveryAbove,
    },
  });
}

module.exports.ddgoCheckoutInfo = ddgoCheckoutInfo;


