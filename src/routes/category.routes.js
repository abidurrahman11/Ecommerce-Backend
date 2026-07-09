const express = require('express');
const categoryController = require('../controllers/category.controller');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate');
const { requireAuth, requireAdmin } = require('../middlewares/auth');
const { createCategorySchema, updateCategorySchema } = require('../utils/validators/category.validators');

const router = express.Router();

// public routes, anyone can browse categories.
router.get('/', asyncHandler(categoryController.list));
router.get('/tree', asyncHandler(categoryController.tree));

// admin only routes, need to be logged in and be an admin.
router.post(
  '/',
  requireAuth,
  requireAdmin,
  validate(createCategorySchema),
  asyncHandler(categoryController.create)
);
router.put(
  '/:id',
  requireAuth,
  requireAdmin,
  validate(updateCategorySchema),
  asyncHandler(categoryController.update)
);
router.delete('/:id', requireAuth, requireAdmin, asyncHandler(categoryController.remove));

module.exports = router;
