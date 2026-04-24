const DesktopHomeSection = require("../../../models/DesktopHomeSection");

function normalizeLinkType(value) {
  const v = String(value || "none").trim().toLowerCase();
  return ["category", "subcategory", "product", "url", "none"].includes(v) ? v : "none";
}

function normalizeLinkValue(value) {
  if (value == null) return "";
  if (typeof value === "object") {
    return String(value._id || value.id || value.value || "").trim();
  }
  return String(value).trim();
}

function normalizeBannerEntry(entry = {}) {
  return {
    ...entry,
    linkType: normalizeLinkType(entry.linkType),
    linkValue: normalizeLinkValue(entry.linkValue),
  };
}

function normalizeSectionData(type, data = {}) {
  const next = { ...(data || {}) };
  if (["hero_carousel", "banner_2col", "banner_3col"].includes(type)) {
    next.banners = Array.isArray(next.banners) ? next.banners.map(normalizeBannerEntry) : [];
  }
  if (["banner_single", "promo_full"].includes(type)) {
    next.linkType = normalizeLinkType(next.linkType);
    next.linkValue = normalizeLinkValue(next.linkValue);
  }
  return next;
}

// GET /admin/desktop-home-sections
async function listSections(req, res) {
  const filter = {};
  if (req.query.platform) filter.platform = req.query.platform;
  const sections = await DesktopHomeSection.find(filter).sort({ sortOrder: 1 });
  return res.json({ success: true, sections });
}

// POST /admin/desktop-home-sections
async function createSection(req, res) {
  const { title, type, data, sortOrder, platform, isActive } = req.body;
  if (!title || !type) return res.status(400).json({ success: false, message: "title and type required" });

  const section = await DesktopHomeSection.create({
    title, type, data: data || {}, sortOrder: sortOrder || 0,
    platform: platform || "damndeal", isActive: isActive !== false,
  });
  return res.status(201).json({ success: true, section });
}

// POST /admin/desktop-home-sections/with-images (banner types with image upload)
async function createSectionWithImages(req, res) {
  try {
    const { title, type, platform, sortOrder, isActive } = req.body;
    if (!title || !type) return res.status(400).json({ success: false, message: "title and type required" });

    let data = {};
    try { data = JSON.parse(req.body.data || "{}"); } catch (_) { data = {}; }
    data = normalizeSectionData(type, data);

    // Attach uploaded images
    const files = req.files || [];
    if (type === "banner_single" && files.length > 0) {
      data.image = `/uploads/desktop-home/${files[0].filename}`;
    } else if (["hero_carousel", "banner_2col", "banner_3col"].includes(type)) {
      const banners = data.banners || [];
      let fi = 0;
      data.banners = banners.map(b => {
        if (b._newImage && fi < files.length) {
          b.image = `/uploads/desktop-home/${files[fi].filename}`;
          fi++;
        }
        delete b._newImage;
        return b;
      });
    } else if (type === "promo_full" && files.length > 0) {
      data.image = `/uploads/desktop-home/${files[0].filename}`;
    }

    const section = await DesktopHomeSection.create({
      title, type, data, sortOrder: parseInt(sortOrder) || 0,
      platform: platform || "damndeal", isActive: isActive === "true" || isActive === true,
    });
    return res.status(201).json({ success: true, section });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /admin/desktop-home-sections/:id
async function updateSection(req, res) {
  const section = await DesktopHomeSection.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!section) return res.status(404).json({ success: false, message: "Section not found" });
  return res.json({ success: true, section });
}

// PUT /admin/desktop-home-sections/:id/with-images
async function updateSectionWithImages(req, res) {
  try {
    const { title, type, platform, sortOrder, isActive } = req.body;
    let data = {};
    try { data = JSON.parse(req.body.data || "{}"); } catch (_) { data = {}; }
    data = normalizeSectionData(type, data);

    const files = req.files || [];
    if (type === "banner_single" && files.length > 0) {
      data.image = `/uploads/desktop-home/${files[0].filename}`;
    } else if (["hero_carousel", "banner_2col", "banner_3col"].includes(type)) {
      const banners = data.banners || [];
      let fi = 0;
      data.banners = banners.map(b => {
        if (b._newImage && fi < files.length) {
          b.image = `/uploads/desktop-home/${files[fi].filename}`;
          fi++;
        }
        delete b._newImage;
        return normalizeBannerEntry(b);
      });
    } else if (type === "promo_full" && files.length > 0) {
      data.image = `/uploads/desktop-home/${files[0].filename}`;
    }

    const payload = { data };
    if (title) payload.title = title;
    if (type) payload.type = type;
    if (platform) payload.platform = platform;
    if (sortOrder !== undefined) payload.sortOrder = parseInt(sortOrder) || 0;
    if (isActive !== undefined) payload.isActive = isActive === "true" || isActive === true;

    const section = await DesktopHomeSection.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!section) return res.status(404).json({ success: false, message: "Section not found" });
    return res.json({ success: true, section });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /admin/desktop-home-sections/reorder
async function reorderSections(req, res) {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ success: false, message: "order array required" });
  const ops = order.map((item) => ({
    updateOne: { filter: { _id: item.id }, update: { sortOrder: item.sortOrder } },
  }));
  await DesktopHomeSection.bulkWrite(ops);
  return res.json({ success: true, message: "Reordered" });
}

// DELETE /admin/desktop-home-sections/:id
async function deleteSection(req, res) {
  await DesktopHomeSection.findByIdAndDelete(req.params.id);
  return res.json({ success: true, message: "Section deleted" });
}

module.exports = { listSections, createSection, createSectionWithImages, updateSection, updateSectionWithImages, reorderSections, deleteSection };
