const DesktopHomeSection = require("../../../models/DesktopHomeSection");
const Banner = require("../../../models/Banner");
const Category = require("../../../models/Category");
const Product = require("../../../models/Product");
const { regionFilter } = require("../../../utils/region");

// GET /user/desktop-home — desktop home page content
async function getDesktopHome(req, res) {
  const platform = req.query.platform || "damndeal";
  const regionF = regionFilter(req);

  const sectionFilter = { isActive: true, ...regionF };
  sectionFilter.$or = [{ platform }, { platform: { $exists: false } }, { platform: null }];

  const sections = await DesktopHomeSection.find(sectionFilter).sort({ sortOrder: 1 });
  const productSelect = "-costPrice -approvalStatus -approvedBy -approvedAt -approvalNote";
  const result = [];

  for (const section of sections) {
    const out = {
      _id: section._id, title: section.title, type: section.type,
      sortOrder: section.sortOrder, data: { ...(section.data || {}) },
    };

    switch (section.type) {
      case "hero_carousel": {
        // Use uploaded banners from section data if available
        if (section.data?.banners?.length) {
          out.items = section.data.banners;
        } else {
          // Fallback to Banner model for legacy sections
          const now = new Date();
          const filter = {
            isActive: true, placement: "home_top", ...regionF,
            $and: [
              { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
              { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
            ],
          };
          if (platform) filter.platform = platform;
          out.items = await Banner.find(filter).sort({ sortOrder: 1 }).limit(10);
        }
        break;
      }

      case "banner_2col":
      case "banner_3col":
      case "banner_single": {
        // Banners stored in data.banners array with image paths
        out.items = section.data?.banners || [];
        break;
      }

      case "category_products": {
        const catId = section.data?.categoryId;
        const subCatId = section.data?.subCategoryId;
        const limit = section.data?.limit || 12;
        const cols = section.data?.columns || 5;
        if (catId || subCatId) {
          const filter = { isActive: true, approvalStatus: "approved", stock: { $gt: 0 }, ...regionF };
          if (catId) filter.category = catId;
          if (subCatId) filter.subCategory = subCatId;
          const cat = catId ? await Category.findById(catId).select("name slug icon") : null;
          out.items = await Product.find(filter).select(productSelect).populate("category", "name").populate("partner", "name")
            .sort({ [section.data?.sortBy || "createdAt"]: section.data?.sortDir === "asc" ? 1 : -1 })
            .limit(limit);
          out.data.categoryName = cat?.name || section.title;
          out.data.categoryIcon = cat?.icon || "";
          out.data.columns = cols;
        } else {
          out.items = [];
        }
        break;
      }

      case "product_grid": {
        const catId = section.data?.categoryId;
        const subCatId = section.data?.subCategoryId;
        const limit = section.data?.limit || 12;
        const filter = { isActive: true, approvalStatus: "approved", stock: { $gt: 0 }, ...regionF };
        if (catId) filter.category = catId;
        if (subCatId) filter.subCategory = subCatId;

        if (section.data?.productIds?.length) {
          const products = await Product.find({
            _id: { $in: section.data.productIds }, isActive: true, approvalStatus: "approved", ...regionF
          }).select(productSelect).populate("category", "name").populate("partner", "name");
          const map = Object.fromEntries(products.map(p => [p._id.toString(), p]));
          out.items = section.data.productIds.map(id => map[id]).filter(Boolean);
        } else {
          out.items = await Product.find(filter).select(productSelect)
            .populate("category", "name").populate("partner", "name")
            .sort({ [section.data?.sortBy || "createdAt"]: section.data?.sortDir === "asc" ? 1 : -1 })
            .limit(limit);
        }
        if (catId) {
          const cat = await Category.findById(catId).select("name");
          out.data.categoryName = cat?.name || "";
        }
        break;
      }

      case "deal_strip": {
        const filter = { isActive: true, approvalStatus: "approved", stock: { $gt: 0 }, ...regionF };
        if (section.data?.categoryId) filter.category = section.data.categoryId;
        if (section.data?.subCategoryId) filter.subCategory = section.data.subCategoryId;
        out.items = await Product.find(filter).select(productSelect)
          .populate("category", "name").populate("partner", "name")
          .sort({ sellingPrice: 1 }).limit(section.data?.limit || 10);
        break;
      }

      case "promo_full": {
        out.items = [];
        break;
      }

      case "featured_categories": {
        const catIds = section.data?.categoryIds || [];
        if (catIds.length) {
          out.items = await Category.find({ _id: { $in: catIds }, isActive: true, ...regionF })
            .select("name icon image slug");
        } else {
          out.items = await Category.find({ isActive: true, ...regionF }).sort({ sortOrder: 1 }).limit(12);
        }
        break;
      }

      default:
        out.items = [];
    }
    result.push(out);
  }

  return res.json({ success: true, sections: result });
}

module.exports = { getDesktopHome };
