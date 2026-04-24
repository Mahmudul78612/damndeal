const Category = require("../../../models/Category");
const SubCategory = require("../../../models/SubCategory");

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function createCategory(req, res) {
  const slug = slugify(req.body.name);
  const payload = { ...req.body, slug };
  if (!payload.platform) payload.platform = 'ddgo';
  if (req.file) payload.icon = `/uploads/categories/${req.file.filename}`;
  const category = await Category.create(payload);
  return res.status(201).json({ success: true, category });
}

async function getCategories(req, res) {
  const filter = {};
  if (req.query.platform) filter.platform = req.query.platform;
  const categories = await Category.find(filter).sort({ sortOrder: 1, name: 1 });
  return res.json({ success: true, categories });
}

async function updateCategory(req, res) {
  const updates = { ...req.body };
  if (updates.name) updates.slug = slugify(updates.name);
  if (req.file) updates.icon = `/uploads/categories/${req.file.filename}`;
  const category = await Category.findByIdAndUpdate(req.params.id, updates, { new: true });
  if (!category) return res.status(404).json({ success: false, message: "Category not found" });
  return res.json({ success: true, category });
}

async function deleteCategory(req, res) {
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) return res.status(404).json({ success: false, message: "Category not found" });
  await SubCategory.deleteMany({ category: req.params.id });
  return res.json({ success: true, message: "Category deleted" });
}

async function createSubCategory(req, res) {
  const slug = slugify(req.body.name);
  const payload = { ...req.body, slug };
  if (req.file) payload.image = `/uploads/categories/${req.file.filename}`;
  const sub = await SubCategory.create(payload);
  return res.status(201).json({ success: true, subCategory: sub });
}

async function getSubCategories(req, res) {
  const filter = {};
  if (req.query.category) filter.category = req.query.category;
  if (req.query.platform) {
    const cats = await Category.find({ platform: req.query.platform }).select('_id');
    filter.category = { $in: cats.map(c => c._id) };
  }
  const subCategories = await SubCategory.find(filter)
    .populate("category", "name slug platform").sort({ sortOrder: 1, name: 1 });
  return res.json({ success: true, subCategories });
}

async function updateSubCategory(req, res) {
  const updates = { ...req.body };
  if (updates.name) updates.slug = slugify(updates.name);
  if (req.file) updates.image = `/uploads/categories/${req.file.filename}`;
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
  createCategory, getCategories, updateCategory, deleteCategory,
  createSubCategory, getSubCategories, updateSubCategory, deleteSubCategory,
};
