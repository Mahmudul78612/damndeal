const Ad = require("../../models/Ad");
const Advertiser = require("../../models/Advertiser");
const { paginate } = require("../../utils/paginate");
const { ApiError } = require("../../middleware/error.middleware");

function parseMaybeJSON(v, fallback) {
  if (v == null || v === "") return fallback;
  if (typeof v !== "string") return v;
  try { return JSON.parse(v); } catch { return v.split(",").map((s) => s.trim()).filter(Boolean); }
}

// Resolve/create the advertiser for this ad.
// Either advertiserId (existing) OR advertiser{name,email,password} (new login).
async function resolveAdvertiser(body, adminId) {
  if (body.advertiserId) {
    const adv = await Advertiser.findById(body.advertiserId);
    if (!adv) throw new ApiError(404, "Advertiser not found");
    return adv;
  }
  const name = body.advertiserName || body.name;
  const email = body.advertiserEmail || body.email;
  const password = body.advertiserPassword || body.password;
  if (!name || !email || !password) {
    throw new ApiError(400, "Provide advertiserId OR advertiserName + advertiserEmail + advertiserPassword");
  }
  const existing = await Advertiser.findOne({ email: String(email).toLowerCase() });
  if (existing) {
    throw new ApiError(409, "An advertiser with this email already exists — pick them from the list instead");
  }
  const adv = new Advertiser({ name, email: String(email).toLowerCase(), company: body.company, phone: body.phone, createdBy: adminId });
  await adv.setPassword(password);
  await adv.save();
  return adv;
}

// GET /api/admin/ads?advertiser=&status=&type=&search=
async function list(req, res) {
  const filter = {};
  if (req.query.advertiser) filter.advertiser = req.query.advertiser;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.type) filter.type = req.query.type;
  if (req.query.search) filter.title = new RegExp(req.query.search.trim(), "i");
  const result = await paginate(Ad, filter, { ...req.query, populate: { path: "advertiser", select: "name company" } });
  res.json({ success: true, ...result });
}

// POST /api/admin/ads   (multipart: creative file + fields)
async function create(req, res) {
  const body = req.body;
  const creative = req.files?.creative?.[0];
  if (!creative) throw new ApiError(400, "Ad creative file is required");

  const advertiser = await resolveAdvertiser(body, req.auth.id);
  const type = body.type === "video" ? "video" : "banner";

  const ad = await Ad.create({
    advertiser: advertiser._id,
    title: body.title || "Untitled Ad",
    type,
    creativeUrl: `/uploads/ads/${creative.filename}`,
    thumbnailUrl: req.files?.thumbnail?.[0] ? `/uploads/thumbs/${req.files.thumbnail[0].filename}` : "",
    width: Number(body.width) || 0,
    height: Number(body.height) || 0,
    duration: Number(body.duration) || 0,
    targetUrl: body.targetUrl || "",
    ctaText: body.ctaText || "Learn More",
    status: body.status || "active",
    startDate: body.startDate || null,
    endDate: body.endDate || null,
    targeting: {
      countries: parseMaybeJSON(body.countries, []).map((c) => String(c).toUpperCase()),
      states: parseMaybeJSON(body.states, []),
      cities: parseMaybeJSON(body.cities, []),
    },
    zones: parseMaybeJSON(body.zones, []),
    weight: Number(body.weight) || 5,
    impressionCap: Number(body.impressionCap) || 0,
    createdBy: req.auth.id,
  });

  res.status(201).json({ success: true, data: ad, advertiser });
}

// GET /api/admin/ads/:id
async function getOne(req, res) {
  const ad = await Ad.findById(req.params.id).populate("advertiser", "name email company").populate("zones", "name app");
  if (!ad) throw new ApiError(404, "Ad not found");
  res.json({ success: true, data: ad });
}

// PUT /api/admin/ads/:id   (multipart optional — replace creative)
async function update(req, res) {
  const ad = await Ad.findById(req.params.id);
  if (!ad) throw new ApiError(404, "Ad not found");
  const body = req.body;

  const fields = ["title", "type", "targetUrl", "ctaText", "status", "startDate", "endDate"];
  fields.forEach((f) => { if (f in body) ad[f] = body[f]; });
  if ("width" in body) ad.width = Number(body.width) || 0;
  if ("height" in body) ad.height = Number(body.height) || 0;
  if ("duration" in body) ad.duration = Number(body.duration) || 0;
  if ("weight" in body) ad.weight = Number(body.weight) || 5;
  if ("impressionCap" in body) ad.impressionCap = Number(body.impressionCap) || 0;
  if ("countries" in body) ad.targeting.countries = parseMaybeJSON(body.countries, []).map((c) => String(c).toUpperCase());
  if ("states" in body) ad.targeting.states = parseMaybeJSON(body.states, []);
  if ("cities" in body) ad.targeting.cities = parseMaybeJSON(body.cities, []);
  if ("zones" in body) ad.zones = parseMaybeJSON(body.zones, []);

  if (req.files?.creative?.[0]) ad.creativeUrl = `/uploads/ads/${req.files.creative[0].filename}`;
  if (req.files?.thumbnail?.[0]) ad.thumbnailUrl = `/uploads/thumbs/${req.files.thumbnail[0].filename}`;

  await ad.save();
  res.json({ success: true, data: ad });
}

// PATCH /api/admin/ads/:id/status   { status }
async function setStatus(req, res) {
  const status = req.body.status;
  if (!["pending", "active", "paused", "expired"].includes(status)) throw new ApiError(400, "Invalid status");
  const ad = await Ad.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!ad) throw new ApiError(404, "Ad not found");
  res.json({ success: true, data: ad });
}

// DELETE /api/admin/ads/:id
async function remove(req, res) {
  const ad = await Ad.findByIdAndDelete(req.params.id);
  if (!ad) throw new ApiError(404, "Ad not found");
  res.json({ success: true, message: "Ad deleted" });
}

module.exports = { list, create, getOne, update, setStatus, remove };
