const Joi = require('joi');

// validation rules for creating an order, at least one item required.
const createOrderSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        product_id: Joi.number().integer().positive().required(),
        quantity: Joi.number().integer().positive().required()
      })
    )
    .min(1)
    .required()
});

// query params for listing a user's own orders.
const listOrdersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

module.exports = { createOrderSchema, listOrdersQuerySchema };
