const HomeSection = require("../../../models/HomeSection");
const Banner = require("../../../models/Banner");
const Category = require("../../../models/Category");
const SubCategory = require("../../../models/SubCategory");
const Product = require("../../../models/Product");

// GET /user/home — app home page content
async function getHomePage(_req, res) {
  const platform = _req.query.platform; // 'ddgo' or 'damndeal'

  // Filter sections by platform: show sections matching the requested platform, or sections without a platform set
  const sectionFilter = { isActive: true };
  if (platform) {
    sectionFilter.$or = [{ platform }, { platform: { $exists: false } }, { platform: null }];
  }
  const sections = await HomeSection.find(sectionFilter).sort({ sortOrder: 1 });

  const result = [];
  for (const section of sections) {
    const out = {
      id: section._id, title: section.title, type: section.type,
      sortOrder: section.sortOrder, platform: section.platform || null,
      data: { ...(section.data || {}) },
    };

    switch (section.type) {
      case "banner_carousel": {
        const customBanners = Array.isArray(section.data?.banners) ? section.data.banners.filter((b) => b.image) : [];
        if (customBanners.length) {
          out.items = customBanners;
        } else {
          const now = new Date();
          const filter = {
            isActive: true,
            placement: section.data?.placement || "home_top",
            $and: [
              { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
              { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
            ],
          };
          if (platform) filter.platform = platform;
          out.items = await Banner.find(filter).populate('subCategories', 'name image').sort({ sortOrder: 1 }).limit(10);
        }
        break;
      }
      case "category_grid":
        out.items = await Category.find({ isActive: true }).sort({ sortOrder: 1 });
        break;
      case "popular_products": {
        const popFilter = { isActive: true, approvalStatus: "approved", stock: { $gt: 0 } };
        if (section.data?.categoryId) popFilter.category = section.data.categoryId;
        out.items = await Product.find(popFilter)
          .select("-costPrice -approvalStatus -approvedBy -approvedAt -approvalNote")
          .populate("category", "name").populate("partner", "name")
          .sort({ [section.data?.sortBy || "createdAt"]: section.data?.sortDir === "asc" ? 1 : -1 })
          .limit(section.data?.limit || 10);
        if (section.data?.categoryId) {
          const cat = await Category.findById(section.data.categoryId).select("name slug");
          out.data.categoryName = cat?.name || section.title;
        }
        break;
      }
      case "deal_of_day": {
        const dealFilter = { isActive: true, approvalStatus: "approved", stock: { $gt: 0 } };
        if (section.data?.categoryId) dealFilter.category = section.data.categoryId;
        out.items = await Product.find(dealFilter)
          .select("-costPrice -approvalStatus -approvedBy -approvedAt -approvalNote")
          .populate("category", "name").populate("partner", "name")
          .sort({ [section.data?.sortBy || "sellingPrice"]: section.data?.sortDir === "asc" ? 1 : -1 })
          .limit(section.data?.limit || 10);
        if (section.data?.categoryId) {
          const cat = await Category.findById(section.data.categoryId).select("name slug");
          out.data.categoryName = cat?.name || section.title;
        }
        break;
      }
      case "custom_banner": {
        const customBanners = Array.isArray(section.data?.banners) ? section.data.banners.filter((b) => b.image) : [];
        if (customBanners.length) {
          out.items = customBanners;
        } else {
          out.items = await Banner.find({ isActive: true, placement: section.data?.placement || "home_middle" })
            .sort({ sortOrder: 1 });
        }
        break;
      }
      case "product_grid": {
        const ids = section.data?.productIds || [];
        if (ids.length) {
          const products = await Product.find({ _id: { $in: ids }, isActive: true, approvalStatus: "approved" })
            .select("-costPrice -approvalStatus -approvedBy -approvedAt -approvalNote")
            .populate("category", "name")
            .populate("partner", "name");
          // Preserve the order from productIds
          const map = Object.fromEntries(products.map(p => [p._id.toString(), p]));
          out.items = ids.map(id => map[id]).filter(Boolean);
        } else {
          out.items = [];
        }
        break;
      }
      case "category_section": {
        const catId = section.data?.categoryId || section.data?.linkValue;
        const limit = section.data?.limit || 10;
        if (catId) {
          const cat = await Category.findById(catId).select("name slug icon platform");
          out.items = await Product.find({ category: catId, isActive: true, approvalStatus: "approved", stock: { $gt: 0 } })
            .select("-costPrice -approvalStatus -approvedBy -approvedAt -approvalNote")
            .populate("category", "name")
            .populate("partner", "name")
            .sort({ createdAt: -1 }).limit(limit);
          out.data.categoryId = catId;
          out.data.categoryName = cat?.name || section.title;
          out.data.categorySlug = cat?.slug || "";
        } else {
          out.items = [];
        }
        break;
      }
      case "horizontal_products":
      case "grid_products": {
        const catId = section.data?.categoryId;
        const limit = section.data?.limit || 10;
        const sortBy = section.data?.sortBy || "createdAt";
        const sortDir = section.data?.sortDir === "asc" ? 1 : -1;
        const filter = { isActive: true, approvalStatus: "approved", stock: { $gt: 0 } };
        if (catId) filter.category = catId;
        out.items = await Product.find(filter)
          .select("-costPrice -approvalStatus -approvedBy -approvedAt -approvalNote")
          .populate("category", "name")
          .populate("partner", "name")
          .sort({ [sortBy]: sortDir }).limit(limit);
        if (catId) {
          const cat = await Category.findById(catId).select("name slug");
          out.data.categoryId = catId;
          out.data.categoryName = cat?.name || section.title;
        }
        break;
      }
      case "promo_section": {
        // Promo data is fully stored in section.data (bgImage, bgColor, cards, cardPosition)
        // Enrich cards with category names if categoryId is set
        const cards = section.data?.cards || [];
        for (const card of cards) {
          if (card.categoryId) {
            const cat = await Category.findById(card.categoryId).select("name slug");
            card.categoryName = cat?.name || card.title;
          }
        }
        out.data.cards = cards;
        out.items = cards; // for compatibility
        break;
      }
      default:
        out.items = [];
    }
    result.push(out);
  }

  // Auto-inject square banners if any exist for this platform
  const sqFilter = { isActive: true, placement: "home_square" };
  if (platform) sqFilter.platform = platform;
  const squareBanners = await Banner.find(sqFilter).sort({ sortOrder: 1 }).limit(10);
  if (squareBanners.length) {
    result.push({
      id: "square_banners",
      title: "Square Banners",
      type: "square_banners",
      sortOrder: 1.5,
      items: squareBanners,
    });
  }

  return res.json({ success: true, sections: result });
}

// GET /user/banners/:id/products — get products linked to a banner
async function getBannerProducts(req, res) {
  const banner = await Banner.findById(req.params.id);
  if (!banner) return res.status(404).json({ success: false, message: "Banner not found" });

  const ids = banner.productIds || [];
  if (!ids.length) return res.json({ success: true, banner: { title: banner.title, image: banner.image }, products: [] });

  const products = await Product.find({ _id: { $in: ids }, isActive: true, approvalStatus: "approved" })
    .select("-costPrice -approvalStatus -approvedBy -approvedAt -approvalNote")
    .populate("category", "name")
    .populate("partner", "name");
  // Preserve order
  const map = Object.fromEntries(products.map(p => [p._id.toString(), p]));
  const ordered = ids.map(id => map[id.toString()]).filter(Boolean);

  return res.json({ success: true, banner: { title: banner.title, image: banner.image }, products: ordered });
}

module.exports = { getHomePage, getBannerProducts };
