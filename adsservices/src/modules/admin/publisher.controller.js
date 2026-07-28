const crypto = require("crypto");
const Publisher = require("../../models/Publisher");
const Zone = require("../../models/Zone");
const Impression = require("../../models/Impression");
const Click = require("../../models/Click");
const { paginate } = require("../../utils/paginate");
const { ApiError } = require("../../middleware/error.middleware");

// GET /api/admin/publishers
async function list(req, res) {
  const filter = {};
  if (req.query.search) {
    const rx = new RegExp(req.query.search.trim(), "i");
    filter.$or = [{ name: rx }, { email: rx }, { appId: rx }];
  }
  const result = await paginate(Publisher, filter, req.query);
  res.json({ success: true, ...result });
}

// POST /api/admin/publishers  { name, appId, email, password, contactEmail }
async function create(req, res) {
  const { name, email, password } = req.body;
  if (!name || !email || !password) throw new ApiError(400, "name, email and password are required");
  const exists = await Publisher.findOne({ email: email.toLowerCase() });
  if (exists) throw new ApiError(409, "A publisher with this email already exists");
  const pub = new Publisher({
    name, appId: req.body.appId || "", email: email.toLowerCase(),
    contactEmail: req.body.contactEmail || "", createdBy: req.auth.id,
  });
  await pub.setPassword(password);
  await pub.save();
  res.status(201).json({ success: true, data: pub });
}

// GET /api/admin/publishers/:id  (+ zones + totals)
async function getOne(req, res) {
  const pub = await Publisher.findById(req.params.id);
  if (!pub) throw new ApiError(404, "Publisher not found");
  const [zones, impressions, clicks] = await Promise.all([
    Zone.find({ publisher: pub._id }),
    Impression.countDocuments({ publisher: pub._id }),
    Click.countDocuments({ publisher: pub._id }),
  ]);
  res.json({ success: true, data: { publisher: pub, zones, totals: { impressions, clicks, zones: zones.length } } });
}

// PUT /api/admin/publishers/:id   (password resets if provided)
async function update(req, res) {
  const pub = await Publisher.findById(req.params.id);
  if (!pub) throw new ApiError(404, "Publisher not found");
  const { name, appId, contactEmail, isActive, password } = req.body;
  if (name !== undefined) pub.name = name;
  if (appId !== undefined) pub.appId = appId;
  if (contactEmail !== undefined) pub.contactEmail = contactEmail;
  if (isActive !== undefined) pub.isActive = isActive;
  if (password) await pub.setPassword(password);
  await pub.save();
  res.json({ success: true, data: pub });
}

// POST /api/admin/publishers/:id/regenerate-key
async function regenerateKey(req, res) {
  const pub = await Publisher.findById(req.params.id);
  if (!pub) throw new ApiError(404, "Publisher not found");
  pub.apiKey = "ddp_" + crypto.randomBytes(16).toString("hex");
  await pub.save();
  res.json({ success: true, data: pub, message: "Publisher key regenerated" });
}

// DELETE /api/admin/publishers/:id
async function remove(req, res) {
  const pub = await Publisher.findByIdAndDelete(req.params.id);
  if (!pub) throw new ApiError(404, "Publisher not found");
  await Zone.updateMany({ publisher: pub._id }, { publisher: null });
  res.json({ success: true, message: "Publisher deleted, its zones unlinked" });
}

module.exports = { list, create, getOne, update, regenerateKey, remove };
