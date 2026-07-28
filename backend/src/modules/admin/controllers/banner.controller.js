const Banner = require("../../../models/Banner");
const { parseRegionsInput, adminListRegionFilter } = require("../../../utils/region");

// POST /admin/banners
async function createBanner(req, res) {
  if (!req.file) return res.status(400).json({ success: false, message: "Banner image required" });

  const data = { ...req.body, image: `/uploads/banners/${req.file.filename}`, createdBy: req.user.userId };
  if (data.subCategories && typeof data.subCategories === 'string') {
    try { data.subCategories = JSON.parse(data.subCategories); } catch (_) { data.subCategories = []; }
  }
  if (data.productIds && typeof data.productIds === 'string') {
    try { data.productIds = JSON.parse(data.productIds); } catch (_) { data.productIds = []; }
  }
  const regions = parseRegionsInput(req.body.regions);
  data.regions = regions || [(req.region || 'IN')];
  const banner = await Banner.create(data);
  return res.status(201).json({ success: true, banner });
}

// GET /admin/banners
async function listBanners(req, res) {
  const { placement } = req.query;
  const filter = {};
  if (placement) filter.placement = placement;
  const regionF = adminListRegionFilter(req);
  if (regionF) Object.assign(filter, regionF);

  const banners = await Banner.find(filter).populate('subCategories', 'name image').sort({ sortOrder: 1, createdAt: -1 });
  return res.json({ success: true, banners });
}

// PUT /admin/banners/:id
async function updateBanner(req, res) {
  const updates = { ...req.body };
  if (req.file) updates.image = `/uploads/banners/${req.file.filename}`;
  if (typeof updates.isActive === 'string') updates.isActive = updates.isActive === 'true';
  if (updates.subCategories && typeof updates.subCategories === 'string') {
    try { updates.subCategories = JSON.parse(updates.subCategories); } catch (_) { updates.subCategories = []; }
  }
  if (updates.productIds && typeof updates.productIds === 'string') {
    try { updates.productIds = JSON.parse(updates.productIds); } catch (_) { updates.productIds = []; }
  }
  const regions = parseRegionsInput(req.body.regions);
  if (regions) updates.regions = regions; else delete updates.regions;
  const banner = await Banner.findByIdAndUpdate(req.params.id, updates, { new: true });
  if (!banner) return res.status(404).json({ success: false, message: "Banner not found" });
  return res.json({ success: true, banner });
}

// DELETE /admin/banners/:id
async function deleteBanner(req, res) {
  const banner = await Banner.findByIdAndDelete(req.params.id);
  if (!banner) return res.status(404).json({ success: false, message: "Banner not found" });
  return res.json({ success: true, message: "Banner deleted" });
}

module.exports = { createBanner, listBanners, updateBanner, deleteBanner };
