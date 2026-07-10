const express = require('express');
const paymentController = require('../controllers/payment.controller');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate');
const { requireAuth } = require('../middlewares/auth');
const {
  initiatePaymentSchema,
  stripeConfirmSchema,
  bkashExecuteSchema
} = require('../utils/validators/payment.validators');

const router = express.Router();

// this router is mounted AFTER the global express.json(), these routes are
// normal authenticated json endpoints, unlike the webhook routes.
router.use(requireAuth);

router.post('/:orderId/initiate', validate(initiatePaymentSchema), asyncHandler(paymentController.initiate));
router.post('/stripe/confirm', validate(stripeConfirmSchema), asyncHandler(paymentController.stripeConfirm));
router.post('/bkash/execute', validate(bkashExecuteSchema), asyncHandler(paymentController.bkashExecute));
router.get('/bkash/query/:paymentID', asyncHandler(paymentController.bkashQuery));
router.get('/order/:orderId', asyncHandler(paymentController.listForOrder));

module.exports = router;
