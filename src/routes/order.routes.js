const express = require('express');
const orderController = require('../controllers/order.controller');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate');
const { requireAuth } = require('../middlewares/auth');
const { createOrderSchema, listOrdersQuerySchema } = require('../utils/validators/order.validators');

const router = express.Router();

// every order route needs a logged in user, orders always belong to someone.
router.use(requireAuth);

router.post('/', validate(createOrderSchema), asyncHandler(orderController.create));
router.get('/', validate(listOrdersQuerySchema, 'query'), asyncHandler(orderController.list));
router.get('/:id', asyncHandler(orderController.detail));

module.exports = router;
