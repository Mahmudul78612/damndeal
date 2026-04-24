const Offer = require("../../../models/Offer");

// POST /partner/offers
async function createOffer(req, res) {
  const data = { ...req.body, partner: req.user.userId };
  const offer = await Offer.create(data);
  return res.status(201).json({ success: true, offer });
}

// GET /partner/offers
async function listOffers(req, res) {
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const [offers, total] = await Promise.all([
    Offer.find({ partner: req.user.userId })
      .populate("products", "name sellingPrice images")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Offer.countDocuments({ partner: req.user.userId }),
  ]);

  return res.json({ success: true, offers, total, page: Number(page), pages: Math.ceil(total / limit) });
}

// PUT /partner/offers/:id
async function updateOffer(req, res) {
  const offer = await Offer.findOneAndUpdate(
    { _id: req.params.id, partner: req.user.userId },
    req.body,
    { new: true, runValidators: true }
  );
  if (!offer) return res.status(404).json({ success: false, message: "Offer not found" });
  return res.json({ success: true, offer });
}

// DELETE /partner/offers/:id
async function deleteOffer(req, res) {
  const offer = await Offer.findOneAndDelete({ _id: req.params.id, partner: req.user.userId });
  if (!offer) return res.status(404).json({ success: false, message: "Offer not found" });
  return res.json({ success: true, message: "Offer deleted" });
}

module.exports = { createOffer, listOffers, updateOffer, deleteOffer };
