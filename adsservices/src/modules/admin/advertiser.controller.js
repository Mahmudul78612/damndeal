const crypto = require("crypto");
const Advertiser = require("../../models/Advertiser");
const Ad = require("../../models/Ad");
const { paginate } = require("../../utils/paginate");
const { ApiError } = require("../../middleware/error.middleware");

// GET /api/admin/advertisers?search=
async function list(req, res) {
  const filter = {};
  if (req.query.search) {
    const rx = new RegExp(req.query.search.trim(), "i");
    filter.$or = [{ name: rx }, { email: rx }, { company: rx }];
  }
  const result = await paginate(Advertiser, filter, req.query);
  res.json({ success: true, ...result });
}

// POST /api/admin/advertisers  { name, email, password, company, phone }
async function create(req, res) {
  const { name, email, password } = req.body;
  if (!name || !email || !password) throw new ApiError(400, "name, email and password are required");
  const exists = await Advertiser.findOne({ email: email.toLowerCase() });
  if (exists) throw new ApiError(409, "An advertiser with this email already exists");
  const adv = new Advertiser({
    name, email: email.toLowerCase(), company: req.body.company, phone: req.body.phone, createdBy: req.auth.id,
  });
  await adv.setPassword(password);
  await adv.save();
  res.status(201).json({ success: true, data: adv });
}

// GET /api/admin/advertisers/:id  (+ their ads count + totals)
async function getOne(req, res) {
  const adv = await Advertiser.findById(req.params.id);
  if (!adv) throw new ApiError(404, "Advertiser not found");
  const ads = await Ad.find({ advertiser: adv._id }).select("title type status impressions clicks");
  const totals = ads.reduce((a, x) => ({ impressions: a.impressions + x.impressions, clicks: a.clicks + x.clicks }), { impressions: 0, clicks: 0 });
  res.json({ success: true, data: { advertiser: adv, ads, totals } });
}

// PUT /api/admin/advertisers/:id   (set password to reset)
async function update(req, res) {
  const adv = await Advertiser.findById(req.params.id);
  if (!adv) throw new ApiError(404, "Advertiser not found");
  const { name, company, phone, isActive, password } = req.body;
  if (name !== undefined) adv.name = name;
  if (company !== undefined) adv.company = company;
  if (phone !== undefined) adv.phone = phone;
  if (isActive !== undefined) adv.isActive = isActive;
  if (password) await adv.setPassword(password);
  await adv.save();
  res.json({ success: true, data: adv });
}

// POST /api/admin/advertisers/:id/regenerate-key  — rotate the Conversion API key
async function regenerateKey(req, res) {
  const adv = await Advertiser.findById(req.params.id);
  if (!adv) throw new ApiError(404, "Advertiser not found");
  adv.apiKey = "ddc_" + crypto.randomBytes(16).toString("hex");
  await adv.save();
  res.json({ success: true, data: adv, message: "API key regenerated" });
}

// DELETE /api/admin/advertisers/:id  (admin)
async function remove(req, res) {
  const adv = await Advertiser.findByIdAndDelete(req.params.id);
  if (!adv) throw new ApiError(404, "Advertiser not found");
  await Ad.updateMany({ advertiser: adv._id }, { status: "paused" });
  res.json({ success: true, message: "Advertiser deleted, their ads paused" });
}

module.exports = { list, create, getOne, update, regenerateKey, remove };
