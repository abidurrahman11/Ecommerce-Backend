const Joi = require('joi');

// validation rules for the register endpoint.
const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().trim().email({ tlds: { allow: false } }).required(),
  // keep it simple but not trivial, at least 6 chars.
  password: Joi.string().min(6).max(128).required()
});

// validation rules for the login endpoint.
const loginSchema = Joi.object({
  email: Joi.string().trim().email({ tlds: { allow: false } }).required(),
  password: Joi.string().required()
});

module.exports = { registerSchema, loginSchema };
