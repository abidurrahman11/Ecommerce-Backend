const Joi = require('joi');

// validation rules for creating a product.
const createProductSchema = Joi.object({
  name: Joi.string().trim().min(2).max(255).required(),
  sku: Joi.string().trim().min(2).max(100).required(),
  description: Joi.string().trim().allow('', null),
  price: Joi.number().positive().precision(2).required(),
  stock: Joi.number().integer().min(0).default(0),
  status: Joi.string().valid('active', 'inactive').default('active'),
  category_id: Joi.number().integer().positive().allow(null)
});

// validation rules for updating a product, everything optional here.
const updateProductSchema = Joi.object({
  name: Joi.string().trim().min(2).max(255),
  sku: Joi.string().trim().min(2).max(100),
  description: Joi.string().trim().allow('', null),
  price: Joi.number().positive().precision(2),
  stock: Joi.number().integer().min(0),
  status: Joi.string().valid('active', 'inactive'),
  category_id: Joi.number().integer().positive().allow(null)
}).min(1);

// query params for listing products.
const listProductsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  category_id: Joi.number().integer().positive(),
  status: Joi.string().valid('active', 'inactive')
});

module.exports = { createProductSchema, updateProductSchema, listProductsQuerySchema };
