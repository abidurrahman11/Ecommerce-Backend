const paymentService = require('../services/paymentService');
const { sendSuccess } = require('../utils/apiResponse');
const logger = require('../utils/logger');

// start a payment for an order the logged in user owns.
async function initiate(req, res) {
  const result = await paymentService.initiatePayment(req.params.orderId, req.user.id, req.body.provider);
  return sendSuccess(res, { statusCode: 201, data: result, message: 'Payment initiated' });
}

// confirm a stripe payment intent and finalize the order if it succeeded.
async function stripeConfirm(req, res) {
  const payment = await paymentService.confirmStripePayment(req.body.payment_intent_id, req.user.id);
  return sendSuccess(res, { data: payment, message: 'Payment confirmation processed' });
}

// execute a bkash payment the user already approved, and finalize the order if it succeeded.
async function bkashExecute(req, res) {
  const payment = await paymentService.executeBkashPayment(req.body.paymentID, req.user.id);
  return sendSuccess(res, { data: payment, message: 'Payment execution processed' });
}

// check a bkash payment's current status.
async function bkashQuery(req, res) {
  const payment = await paymentService.queryBkashPayment(req.params.paymentID, req.user.id);
  return sendSuccess(res, { data: payment });
}

// list every payment attempt for an order the user owns.
async function listForOrder(req, res) {
  const payments = await paymentService.listPaymentsForOrder(req.params.orderId, req.user.id);
  return sendSuccess(res, { data: payments });
}

// stripe webhook, no auth (stripe calls this directly). signature
// verification failures need their own status code so stripe knows to flag
// it, so this isn't wrapped in the generic asyncHandler.
async function stripeWebhook(req, res) {
  const signature = req.headers['stripe-signature'];

  try {
    const result = await paymentService.handleStripeWebhook(req.body, signature);
    return res.status(200).json(result);
  } catch (err) {
    logger.warn(`Stripe webhook rejected: ${err.message}`);
    return res.status(400).json({ received: false, error: err.message });
  }
}

// bkash webhook/callback, no auth (bkash calls this directly).
async function bkashWebhook(req, res) {
  const result = await paymentService.handleBkashWebhook(req.body);
  return res.status(200).json(result);
}

module.exports = {
  initiate,
  stripeConfirm,
  bkashExecute,
  bkashQuery,
  listForOrder,
  stripeWebhook,
  bkashWebhook
};
