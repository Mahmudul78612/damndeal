const HomeSection = require("../../../models/HomeSection");

// GET /admin/home-sections
async function listSections(_req, res) {
  const sections = await HomeSection.find().sort({ sortOrder: 1 });
  return res.json({ success: true, sections });
}

// POST /admin/home-sections
async function createSection(req, res) {
  const { title, type, data, sortOrder, platform } = req.body;
  if (!title || !type) return res.status(400).json({ success: false, message: "title and type required" });

  const section = await HomeSection.create({
    title, type, data: data || {}, sortOrder: sortOrder || 0, platform: platform || "ddgo",
  });
  return res.status(201).json({ success: true, section });
}

// PUT /admin/home-sections/:id
async function updateSection(req, res) {
  const section = await HomeSection.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!section) return res.status(404).json({ success: false, message: "Section not found" });
  return res.json({ success: true, section });
}

// PUT /admin/home-sections/reorder — bulk reorder
async function reorderSections(req, res) {
  const { order } = req.body; // [{ id, sortOrder }]
  if (!Array.isArray(order)) return res.status(400).json({ success: false, message: "order array required" });

  const ops = order.map((item) => ({
    updateOne: { filter: { _id: item.id }, update: { sortOrder: item.sortOrder } },
  }));
  await HomeSection.bulkWrite(ops);

  return res.json({ success: true, message: "Reordered" });
}

// DELETE /admin/home-sections/:id
async function deleteSection(req, res) {
  await HomeSection.findByIdAndDelete(req.params.id);
  return res.json({ success: true, message: "Section deleted" });
}

// POST /admin/home-sections/promo — create/update promo section with images
async function savePromoSection(req, res) {
  try {
    const { title, platform, sortOrder, isActive, editId, cards: cardsJson, bgColor, cardPosition } = req.body;
    if (!title) return res.status(400).json({ success: false, message: "title required" });

    // Parse cards array from JSON string
    let cards = [];
    try { cards = JSON.parse(cardsJson || "[]"); } catch (_) { cards = []; }

    // Background image
    let bgImage = req.body.existingBgImage || null;
    if (req.files?.bgImage?.[0]) {
      bgImage = `/uploads/promo/${req.files.bgImage[0].filename}`;
    }

    // Card images — match by index
    const cardImageFiles = req.files?.cardImages || [];
    let fileIdx = 0;
    cards = cards.map((card) => {
      if (card._newImage) {
        // This card needs a new image from the upload
        if (fileIdx < cardImageFiles.length) {
          card.image = `/uploads/promo/${cardImageFiles[fileIdx].filename}`;
          fileIdx++;
        }
        delete card._newImage;
      }
      return card;
    });

    const data = { bgImage, bgColor: bgColor || null, cards, cardPosition: cardPosition || "bottom" };
    const payload = {
      title, type: "promo_section", data,
      platform: platform || "damndeal",
      sortOrder: parseInt(sortOrder) || 0,
      isActive: isActive === "true" || isActive === true,
    };

    let section;
    if (editId) {
      section = await HomeSection.findByIdAndUpdate(editId, payload, { new: true });
    } else {
      section = await HomeSection.create(payload);
    }

    return res.json({ success: true, section });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// POST /admin/home-sections/banner — create/update banner sections with direct image upload
async function saveBannerSection(req, res) {
  try {
    const { title, type, platform, sortOrder, isActive, editId, sourceMode, placement, banners: bannersJson } = req.body;
    if (!title || !type) {
      return res.status(400).json({ success: false, message: "title and type required" });
    }

    if (!["banner_carousel", "custom_banner"].includes(type)) {
      return res.status(400).json({ success: false, message: "Only banner section types supported" });
    }

    let banners = [];
    try {
      banners = JSON.parse(bannersJson || "[]");
      if (!Array.isArray(banners)) banners = [];
    } catch (_) {
      banners = [];
    }

    const imageFiles = req.files || [];
    let fileIdx = 0;
    banners = banners.map((item) => {
      const next = { ...item };
      if (next._newImage && fileIdx < imageFiles.length) {
        next.image = `/uploads/banners/${imageFiles[fileIdx].filename}`;
        fileIdx += 1;
      }
      delete next._newImage;
      return next;
    }).filter((item) => item.image);

    const mode = sourceMode === "placement" ? "placement" : "custom";
    const data = {
      sourceMode: mode,
      placement: placement || "home_top",
      banners: mode === "custom" ? banners : [],
    };

    if (type === "custom_banner" && data.banners.length) {
      const first = data.banners[0];
      data.image = first.image;
      data.linkType = first.linkType || "url";
      data.linkValue = first.linkValue || "";
      data.link = first.link || "";
      data.title = first.title || title;
    }

    const payload = {
      title,
      type,
      data,
      platform: platform || "damndeal",
      sortOrder: parseInt(sortOrder, 10) || 0,
      isActive: isActive === "true" || isActive === true,
    };

    let section;
    if (editId) {
      section = await HomeSection.findByIdAndUpdate(editId, payload, { new: true });
    } else {
      section = await HomeSection.create(payload);
    }

    return res.json({ success: true, section });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { listSections, createSection, updateSection, reorderSections, deleteSection, savePromoSection, saveBannerSection };
