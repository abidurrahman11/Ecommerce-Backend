const express = require('express');
const productController = require('../controllers/product.controller');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate');
const { listProductsQuerySchema } = require('../utils/validators/product.validators');

const router = express.Router();

// public: list active products, with filtering + pagination.
router.get('/', validate(listProductsQuerySchema, 'query'), asyncHandler(productController.list));

// public: related products for a given product id, uses dfs + cached category tree.
router.get('/:id/related', asyncHandler(productController.related));

// public: single product detail. kept after /:id/related so that route matches first.
router.get('/:id', asyncHandler(productController.detail));

module.exports = router;
