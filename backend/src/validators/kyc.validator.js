const Joi = require("joi");

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const kycSubmitSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().email().required(),
  organizationName: Joi.string().trim().min(2).max(200).required(),
  gstNumber: Joi.string()
    .uppercase()
    .pattern(GST_REGEX)
    .required()
    .messages({ "string.pattern.base": "Invalid GST number format" }),
  panNumber: Joi.string()
    .uppercase()
    .pattern(PAN_REGEX)
    .required()
    .messages({ "string.pattern.base": "Invalid PAN number format" }),
  category: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({ "string.pattern.base": "Invalid category ID" }),
});

const kycReviewSchema = Joi.object({
  status: Joi.string().valid("approved", "rejected").required(),
  rejectionReason: Joi.when("status", {
    is: "rejected",
    then: Joi.string().trim().min(5).required(),
    otherwise: Joi.string().allow(null, "").optional(),
  }),
});

module.exports = { kycSubmitSchema, kycReviewSchema };
