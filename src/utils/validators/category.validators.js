const Joi = require('joi');

// validation rules for creating a category.
const createCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  parent_id: Joi.number().integer().positive().allow(null).optional()
});

// validation rules for updating a category, everything optional here.
const updateCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  parent_id: Joi.number().integer().positive().allow(null)
}).min(1); // at least one field must be provided

module.exports = { createCategorySchema, updateCategorySchema };
