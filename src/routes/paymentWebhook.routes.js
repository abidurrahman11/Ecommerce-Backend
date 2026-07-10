const express = require('express');
const paymentController = require('../controllers/payment.controller');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// this router is mounted in app.js BEFORE the global express.json(), on
// purpose. stripe needs the exact raw request bytes to verify its webhook
// signature, if the body had already been parsed to json by then, the
// signature check would always fail.
router.post('/stripe/webhook', express.raw({ type: 'application/json' }), paymentController.stripeWebhook);

// bkash doesn't sign its callback, plain json is fine, applied locally here
// since the global json parser hasn't run yet for this router.
router.post('/bkash/webhook', express.json(), asyncHandler(paymentController.bkashWebhook));

module.exports = router;
