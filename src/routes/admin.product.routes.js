const express = require('express');
const productController = require('../controllers/product.controller');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate');
const { requireAuth, requireAdmin } = require('../middlewares/auth');
const {
  createProductSchema,
  updateProductSchema,
  listProductsQuerySchema
} = require('../utils/validators/product.validators');

const router = express.Router();

// every route here needs a logged in admin.
router.use(requireAuth, requireAdmin);

router.get('/', validate(listProductsQuerySchema, 'query'), asyncHandler(productController.adminList));
router.post('/', validate(createProductSchema), asyncHandler(productController.create));
router.put('/:id', validate(updateProductSchema), asyncHandler(productController.update));
router.delete('/:id', asyncHandler(productController.remove));

module.exports = router;
