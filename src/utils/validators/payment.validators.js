const Joi = require('joi');

// which provider to initiate a payment with. new providers only need a new
// value here (plus a strategy class + a case in the factory), nothing else.
const initiatePaymentSchema = Joi.object({
  provider: Joi.string().valid('stripe', 'bkash').required()
});

const stripeConfirmSchema = Joi.object({
  payment_intent_id: Joi.string().required()
});

const bkashExecuteSchema = Joi.object({
  paymentID: Joi.string().required()
});

module.exports = { initiatePaymentSchema, stripeConfirmSchema, bkashExecuteSchema };
