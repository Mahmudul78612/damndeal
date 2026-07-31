const Offer = require("../../../models/Offer");
const PartnerKyc = require("../../../models/PartnerKyc");

// GET /user/offers — list active offers (optionally near user)
async function listOffers(req, res) {
  const { lat, lng, type, page = 1, limit = 20 } = req.query;
  const now = new Date();

  const filter = {
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
  };

  if (type) filter.type = type;

  // If geo provided, limit to nearby partners
  if (lat && lng) {
    const nearbyPartners = await PartnerKyc.find({
      status: "approved",
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: 20000,
        },
      },
    }).select("partner").lean();

    const partnerIds = nearbyPartners.map((p) => p.partner);
    filter.partner = { $in: partnerIds };
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [offers, total] = await Promise.all([
    Offer.find(filter)
      .populate("partner", "name")
      .populate("products", "name images price sellingPrice")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Offer.countDocuments(filter),
  ]);

  return res.json({ success: true, offers, total, page: Number(page), pages: Math.ceil(total / limit) });
}

// GET /user/offers/:id — single offer details
async function getOffer(req, res) {
  const offer = await Offer.findById(req.params.id)
    .populate("partner", "name")
    .populate("products", "name images price sellingPrice stock unit gstPercent")
    .lean();

  if (!offer) return res.status(404).json({ success: false, message: "Offer not found" });

  return res.json({ success: true, offer });
}

module.exports = { listOffers, getOffer };
