const Joi = require("joi");

const UNITS = ["piece", "kg", "g", "litre", "ml", "metre", "cm", "pack", "box", "dozen", "bottle", "packet", "pair", "set"];

const createProductSchema = Joi.object({
  name: Joi.string().trim().min(2).max(200).required(),
  description: Joi.string().max(2000).allow("").optional(),
  sku: Joi.string().max(50).allow(null, "").optional(),
  category: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required(),
  subCategory: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .allow(null, "")
    .optional(),
  costPrice: Joi.number().min(0).required(),
  sellingPrice: Joi.number().min(0).required(),
  mrp: Joi.number().min(0).required(),
  gstPercent: Joi.number().valid(0, 5, 12, 18, 28).required(),
  gstInclusive: Joi.boolean().default(true),
  hsnCode: Joi.string().max(20).allow(null, "").optional(),
  unit: Joi.string()
    .valid(...UNITS)
    .default("piece"),
  stock: Joi.number().integer().min(0).default(0),
  lowStockThreshold: Joi.number().integer().min(0).default(5),
  barcode: Joi.string().max(50).allow(null, "").optional(),
  weight: Joi.number().min(0).allow(null).optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(20).optional(),
});

const updateProductSchema = createProductSchema.fork(
  ["name", "category", "costPrice", "sellingPrice", "mrp", "gstPercent"],
  (schema) => schema.optional()
);

const stockUpdateSchema = Joi.object({
  type: Joi.string().valid("add", "remove", "adjustment").required(),
  quantity: Joi.number().integer().min(1).required(),
  note: Joi.string().max(500).allow("").optional(),
});

module.exports = { createProductSchema, updateProductSchema, stockUpdateSchema };
