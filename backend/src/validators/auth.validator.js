const Joi = require("joi");

const phoneSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^\+[1-9]\d{6,14}$/)
    .required()
    .messages({
      "string.pattern.base": "Phone must be in E.164 format (e.g. +919876543210)",
    }),
});

const verifyOtpSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^\+[1-9]\d{6,14}$/)
    .required(),
  otp: Joi.string().length(6).pattern(/^\d+$/).required(),
});

const completeProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().email().required(),
});

const adminLoginSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^\+[1-9]\d{6,14}$/)
    .required(),
  password: Joi.string().min(8).required(),
});

module.exports = {
  phoneSchema,
  verifyOtpSchema,
  completeProfileSchema,
  adminLoginSchema,
};
