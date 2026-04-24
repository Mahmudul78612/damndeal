const Joi = require("joi");

const createOrderSchema = Joi.object({
  customer: Joi.object({
    name: Joi.string().trim().max(100).optional(),
    phone: Joi.string()
      .pattern(/^\+[1-9]\d{6,14}$/)
      .allow(null, "")
      .optional(),
    email: Joi.string().email().allow(null, "").optional(),
  }).optional(),
  items: Joi.array()
    .items(
      Joi.object({
        product: Joi.string()
          .pattern(/^[0-9a-fA-F]{24}$/)
          .required(),
        quantity: Joi.number().integer().min(1).required(),
      })
    )
    .min(1)
    .required(),
  discount: Joi.number().min(0).default(0),
  paymentMethod: Joi.string()
    .valid("cash", "upi", "card", "online", "credit")
    .default("cash"),
  note: Joi.string().max(500).allow("").optional(),
});

const updateOrderStatusSchema = Joi.object({
  status: Joi.string()
    .valid("confirmed", "processing", "shipped", "delivered", "cancelled", "returned")
    .required(),
});

module.exports = { createOrderSchema, updateOrderStatusSchema };
