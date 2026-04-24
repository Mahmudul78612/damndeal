const Category = require("../models/Category");
const SubCategory = require("../models/SubCategory");
const {
  categorySchema,
  subCategorySchema,
} = require("../validators/category.validator");

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ─── Categories ───

async function createCategory(req, res) {
  const { error } = categorySchema.validate(req.body);
  if (error) return res.status(400).json({ success: false, message: error.details[0].message });

  const slug = slugify(req.body.name);
  const category = await Category.create({ ...req.body, slug });
  return res.status(201).json({ success: true, category });
}

async function getCategories(_req, res) {
  const categories = await Category.find().sort({ sortOrder: 1, name: 1 });
  return res.json({ success: true, categories });
}

async function updateCategory(req, res) {
  const updates = { ...req.body };
  if (updates.name) updates.slug = slugify(updates.name);

  const category = await Category.findByIdAndUpdate(req.params.id, updates, { new: true });
  if (!category) return res.status(404).json({ success: false, message: "Category not found" });

  return res.json({ success: true, category });
}

async function deleteCategory(req, res) {
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) return res.status(404).json({ success: false, message: "Category not found" });

  // Also remove sub-categories
  await SubCategory.deleteMany({ category: req.params.id });
  return res.json({ success: true, message: "Category deleted" });
}

// ─── Sub-categories ───

async function createSubCategory(req, res) {
  const { error } = subCategorySchema.validate(req.body);
  if (error) return res.status(400).json({ success: false, message: error.details[0].message });

  const slug = slugify(req.body.name);
  const sub = await SubCategory.create({ ...req.body, slug });
  return res.status(201).json({ success: true, subCategory: sub });
}

async function getSubCategories(req, res) {
  const filter = {};
  if (req.query.category) filter.category = req.query.category;

  const subCategories = await SubCategory.find(filter)
    .populate("category", "name slug")
    .sort({ sortOrder: 1, name: 1 });

  return res.json({ success: true, subCategories });
}

async function updateSubCategory(req, res) {
  const updates = { ...req.body };
  if (updates.name) updates.slug = slugify(updates.name);

  const sub = await SubCategory.findByIdAndUpdate(req.params.id, updates, { new: true });
  if (!sub) return res.status(404).json({ success: false, message: "Sub-category not found" });

  return res.json({ success: true, subCategory: sub });
}

async function deleteSubCategory(req, res) {
  const sub = await SubCategory.findByIdAndDelete(req.params.id);
  if (!sub) return res.status(404).json({ success: false, message: "Sub-category not found" });

  return res.json({ success: true, message: "Sub-category deleted" });
}

module.exports = {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
  createSubCategory,
  getSubCategories,
  updateSubCategory,
  deleteSubCategory,
};
