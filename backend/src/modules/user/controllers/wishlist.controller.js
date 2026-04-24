const Wishlist = require("../../../models/Wishlist");

// POST /user/wishlist/product/:productId
async function addProduct(req, res) {
  const existing = await Wishlist.findOne({ user: req.user.userId, product: req.params.productId });
  if (existing) return res.json({ success: true, message: "Already in wishlist" });

  await Wishlist.create({ user: req.user.userId, product: req.params.productId });
  return res.status(201).json({ success: true, message: "Added to wishlist" });
}

// DELETE /user/wishlist/product/:productId
async function removeProduct(req, res) {
  await Wishlist.findOneAndDelete({ user: req.user.userId, product: req.params.productId });
  return res.json({ success: true, message: "Removed from wishlist" });
}

// POST /user/wishlist/shop/:partnerId
async function saveShop(req, res) {
  const existing = await Wishlist.findOne({ user: req.user.userId, partner: req.params.partnerId });
  if (existing) return res.json({ success: true, message: "Already saved" });

  await Wishlist.create({ user: req.user.userId, partner: req.params.partnerId });
  return res.status(201).json({ success: true, message: "Shop saved" });
}

// DELETE /user/wishlist/shop/:partnerId
async function unsaveShop(req, res) {
  await Wishlist.findOneAndDelete({ user: req.user.userId, partner: req.params.partnerId });
  return res.json({ success: true, message: "Shop unsaved" });
}

// GET /user/wishlist/products
async function getWishlistProducts(req, res) {
  const items = await Wishlist.find({ user: req.user.userId, product: { $ne: null } })
    .populate({
      path: "product",
      select: "name images sellingPrice stock isActive partner",
      populate: { path: "partner", select: "name" },
    })
    .sort({ createdAt: -1 });

  const products = items.filter((i) => i.product).map((i) => i.product);
  return res.json({ success: true, products });
}

// GET /user/wishlist/shops
async function getSavedShops(req, res) {
  const PartnerKyc = require("../../../models/PartnerKyc");
  const items = await Wishlist.find({ user: req.user.userId, partner: { $ne: null } })
    .sort({ createdAt: -1 });

  const partnerIds = items.map((i) => i.partner);
  const kycs = await PartnerKyc.find({ partner: { $in: partnerIds }, status: "approved" })
    .populate("partner", "name phone avatar")
    .populate("category", "name slug icon");

  const shops = kycs.map((k) => ({
    id: k.partner._id,
    name: k.organizationName,
    photo: k.photo,
    category: k.category,
    city: k.city,
  }));

  return res.json({ success: true, shops });
}

module.exports = { addProduct, removeProduct, saveShop, unsaveShop, getWishlistProducts, getSavedShops };
