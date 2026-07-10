const {
  sequelize,
  Payment: PaymentModel,
  Order: OrderModel,
  OrderItem: OrderItemModel
} = require('../../models');
const Payment = require('../classes/Payment');
const PaymentContext = require('../strategies/PaymentContext');
const StripeStrategy = require('../strategies/StripeStrategy');
const BkashStrategy = require('../strategies/BkashStrategy');
const orderService = require('./orderService');
const productService = require('./productService');
const { NotFoundError, ConflictError, BadRequestError } = require('../utils/AppError');
const logger = require('../utils/logger');

// the only place that knows which class implements which provider. adding a
// new provider later means one new strategy class + one new line here,
// nothing else in the order/checkout flow has to change.
function getStrategy(provider) {
  switch (provider) {
    case 'stripe':
      return new StripeStrategy();
    case 'bkash':
      return new BkashStrategy();
    default:
      throw new BadRequestError(`Unsupported payment provider "${provider}"`);
  }
}

// starts a payment for an order the user owns. the order must still be
// pending, you can't pay for an order twice.
async function initiatePayment(orderId, userId, provider) {
  const order = await orderService.getOrderById(orderId, userId); // throws 404/403 already

  if (order.status !== 'pending') {
    throw new ConflictError(`Order is already ${order.status}, cannot initiate a new payment`);
  }

  const context = new PaymentContext(getStrategy(provider));
  const result = await context.initiate(order);

  const paymentRow = await PaymentModel.create({
    order_id: order.id,
    provider,
    transaction_id: result.transaction_id,
    status: 'pending',
    raw_response: result.raw_response
  });

  const payment = new Payment(paymentRow);

  // client_secret (stripe) / bkash_url (bkash) are provider-specific extras
  // the frontend needs, only the relevant one will actually be present.
  return { payment: payment.toJSON(), client_secret: result.client_secret, bkash_url: result.bkash_url };
}

// finalizes a payment: updates its status and, if it succeeded, reduces
// stock for every item and marks the order paid. everything happens in one
// transaction, so it's all-or-nothing. idempotent, calling this again for an
// already-finalized payment is a safe no-op (a webhook and a manual confirm
// can both fire for the same payment, only the first one should do anything).
async function finalizePayment(paymentId, providerStatus, rawResponse) {
  return sequelize.transaction(async (transaction) => {
    // lock the row so a webhook and a manual confirm racing each other can't both proceed.
    const lockedPayment = await PaymentModel.findByPk(paymentId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!lockedPayment) {
      throw new NotFoundError('Payment not found');
    }

    if (lockedPayment.status !== 'pending') {
      logger.info(`Payment ${lockedPayment.id} already finalized as "${lockedPayment.status}", skipping`);
      return new Payment(lockedPayment).toJSON();
    }

    lockedPayment.status = providerStatus;
    lockedPayment.raw_response = rawResponse;
    await lockedPayment.save({ transaction });

    if (providerStatus === 'success') {
      const orderRow = await OrderModel.findByPk(lockedPayment.order_id, {
        include: [{ model: OrderItemModel, as: 'items' }],
        transaction
      });

      for (const item of orderRow.items) {
        // eslint-disable-next-line no-await-in-loop
        await productService.reduceStock(item.product_id, item.quantity, transaction);
      }

      await orderService.updateOrderStatus(lockedPayment.order_id, 'paid', transaction);
    }
    // on failure, the order deliberately stays 'pending' so the user can
    // retry (same or a different provider) instead of losing their order
    // over one failed payment attempt.

    return new Payment(lockedPayment).toJSON();
  });
}

// called by POST /payments/stripe/confirm.
async function confirmStripePayment(paymentIntentId, userId) {
  const paymentRow = await PaymentModel.findOne({ where: { transaction_id: paymentIntentId, provider: 'stripe' } });
  if (!paymentRow) {
    throw new NotFoundError('Payment not found for this payment intent');
  }

  await orderService.getOrderById(paymentRow.order_id, userId); // ownership check, throws 403/404

  const strategy = getStrategy('stripe');
  const result = await strategy.verifyAndComplete(paymentIntentId);

  return finalizePayment(paymentRow.id, result.providerStatus, result.raw_response);
}

// called by POST /payments/bkash/execute.
async function executeBkashPayment(paymentID, userId) {
  const paymentRow = await PaymentModel.findOne({ where: { transaction_id: paymentID, provider: 'bkash' } });
  if (!paymentRow) {
    throw new NotFoundError('Payment not found for this bKash payment id');
  }

  await orderService.getOrderById(paymentRow.order_id, userId);

  const strategy = getStrategy('bkash');
  const result = await strategy.verifyAndComplete(paymentID);

  return finalizePayment(paymentRow.id, result.providerStatus, result.raw_response);
}

// called by GET /payments/bkash/query/:paymentID.
async function queryBkashPayment(paymentID, userId) {
  const paymentRow = await PaymentModel.findOne({ where: { transaction_id: paymentID, provider: 'bkash' } });
  if (!paymentRow) {
    throw new NotFoundError('Payment not found for this bKash payment id');
  }

  await orderService.getOrderById(paymentRow.order_id, userId);

  const strategy = getStrategy('bkash');
  const result = await strategy.query(paymentID);

  // defensive: if bkash says it's actually done but we never finalized it
  // locally (e.g. the execute call got missed), finalize it now.
  if (result.providerStatus !== 'pending') {
    return finalizePayment(paymentRow.id, result.providerStatus, result.raw_response);
  }

  return new Payment(paymentRow).toJSON();
}

// webhooks are public, called by the provider itself, no user/ownership to
// check here, the transaction_id is what ties the callback back to a payment.
async function handleStripeWebhook(rawBody, signature) {
  const strategy = getStrategy('stripe');
  // throws on an invalid signature, the controller turns that into a 400.
  const event = strategy.parseWebhookEvent(rawBody, signature);

  const relevantEvents = ['payment_intent.succeeded', 'payment_intent.payment_failed'];
  if (!relevantEvents.includes(event.type)) {
    return { received: true }; // acknowledge it, nothing for us to do with this event type
  }

  const intent = event.data.object;
  const providerStatus = event.type === 'payment_intent.succeeded' ? 'success' : 'failed';

  const paymentRow = await PaymentModel.findOne({ where: { transaction_id: intent.id, provider: 'stripe' } });
  if (!paymentRow) {
    logger.warn(`Stripe webhook for unknown payment intent ${intent.id}`);
    return { received: true };
  }

  await finalizePayment(paymentRow.id, providerStatus, intent);
  return { received: true };
}

async function handleBkashWebhook(payload) {
  const paymentID = payload?.paymentID;
  if (!paymentID) {
    throw new BadRequestError('Missing paymentID in bKash webhook payload');
  }

  const paymentRow = await PaymentModel.findOne({ where: { transaction_id: paymentID, provider: 'bkash' } });
  if (!paymentRow) {
    logger.warn(`bKash webhook for unknown payment id ${paymentID}`);
    return { received: true };
  }

  // bkash sandbox callbacks aren't signed, so never trust the webhook body's
  // status directly, re-query bkash itself for the authoritative status.
  const strategy = getStrategy('bkash');
  const result = await strategy.query(paymentID);

  await finalizePayment(paymentRow.id, result.providerStatus, result.raw_response);
  return { received: true };
}

// lists payment attempts for an order, only if it belongs to the requester.
async function listPaymentsForOrder(orderId, userId) {
  await orderService.getOrderById(orderId, userId); // ownership check

  const rows = await PaymentModel.findAll({ where: { order_id: orderId }, order: [['id', 'DESC']] });
  return rows.map((row) => new Payment(row).toJSON());
}

module.exports = {
  getStrategy,
  initiatePayment,
  finalizePayment,
  confirmStripePayment,
  executeBkashPayment,
  queryBkashPayment,
  handleStripeWebhook,
  handleBkashWebhook,
  listPaymentsForOrder
};
