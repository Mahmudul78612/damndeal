const Offer = require("../../../models/Offer");

// POST /admin/offers
async function createOffer(req, res) {
  const offer = await Offer.create({ ...req.body, createdBy: req.user.userId });
  return res.status(201).json({ success: true, offer });
}

// GET /admin/offers
async function listOffers(req, res) {
  const { page = 1, limit = 20, type, active } = req.query;
  const filter = {};
  if (type) filter.type = type;
  if (active !== undefined) filter.isActive = active === "true";

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [offers, total] = await Promise.all([
    Offer.find(filter).populate("products", "name images sellingPrice")
      .sort({ sortOrder: 1, createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)),
    Offer.countDocuments(filter),
  ]);

  return res.json({
    success: true, offers,
    pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total, pages: Math.ceil(total / parseInt(limit, 10)) },
  });
}

// PUT /admin/offers/:id
async function updateOffer(req, res) {
  const offer = await Offer.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!offer) return res.status(404).json({ success: false, message: "Offer not found" });
  return res.json({ success: true, offer });
}

// DELETE /admin/offers/:id
async function deleteOffer(req, res) {
  await Offer.findByIdAndDelete(req.params.id);
  return res.json({ success: true, message: "Offer deleted" });
}

module.exports = { createOffer, listOffers, updateOffer, deleteOffer };
