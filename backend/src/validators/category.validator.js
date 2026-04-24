const Joi = require("joi");

const categorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  icon: Joi.string().uri().allow(null, "").optional(),
  sortOrder: Joi.number().integer().min(0).optional(),
  isActive: Joi.boolean().optional(),
});

const subCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  category: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({ "string.pattern.base": "Invalid category ID" }),
  sortOrder: Joi.number().integer().min(0).optional(),
  isActive: Joi.boolean().optional(),
});

module.exports = { categorySchema, subCategorySchema };
