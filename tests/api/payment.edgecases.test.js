// covers the specific edge cases called out for this testing pass:
// duplicate transaction_id, webhook idempotency under redelivery, and a
// stock race condition discovered only at payment-confirmation time.
jest.mock('../../src/strategies/StripeStrategy');

const StripeStrategy = require('../../src/strategies/StripeStrategy');

const request = require('supertest');
const app = require('../../src/app');
const {
  sequelize,
  User: UserModel,
  Category: CategoryModel,
  Product: ProductModel,
  Order: OrderModel,
  Payment: PaymentModel
} = require('../../models');
const User = require('../../src/classes/User');
const { signToken } = require('../../src/utils/jwt');

describe('Payment edge cases', () => {
  let userToken;
  const userEmail = `pay.edge.${Date.now()}@example.com`;
  let category;
  let product;
  const orderIds = [];

  async function createOrder(quantity = 1) {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ items: [{ product_id: product.id, quantity }] });
    orderIds.push(res.body.data.id);
    return res.body.data.id;
  }

  beforeAll(async () => {
    const hashedPassword = await User.hashPassword('password123');
    const userRow = await UserModel.create({ name: 'Edge Payer', email: userEmail, password: hashedPassword, role: 'user' });
    userToken = signToken({ id: userRow.id, role: userRow.role });

    category = await CategoryModel.create({ name: `Pay Edge Cat ${Date.now()}`, parent_id: null });
    product = await ProductModel.create({
      name: 'Edge Case Product',
      sku: `PAYEDGE-${Date.now()}`,
      price: 20,
      stock: 10,
      status: 'active',
      category_id: category.id
    });
  });

  afterAll(async () => {
    await PaymentModel.destroy({ where: { order_id: orderIds } });
    await OrderModel.destroy({ where: { id: orderIds } });
    await ProductModel.destroy({ where: { id: product.id } });
    await CategoryModel.destroy({ where: { id: category.id } });
    await UserModel.destroy({ where: { email: userEmail } });
    await sequelize.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('duplicate transaction_id', () => {
    it('rejects cleanly (409) instead of a raw 500 if the provider ever returns a transaction_id we already recorded', async () => {
      const sharedTransactionId = `pi_duplicate_${Date.now()}`;

      // first order: initiate succeeds normally.
      const orderA = await createOrder(1);
      StripeStrategy.mockImplementation(() => ({
        initiate: jest.fn().mockResolvedValue({
          transaction_id: sharedTransactionId,
          raw_response: { id: sharedTransactionId },
          client_secret: 'secret_a'
        })
      }));

      const resA = await request(app)
        .post(`/api/payments/${orderA}/initiate`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ provider: 'stripe' });
      expect(resA.status).toBe(201);

      // second, different order: the (mocked) provider hands back the exact
      // same transaction_id, this should never happen with a real provider,
      // but our unique constraint + error handling must still degrade cleanly.
      const orderB = await createOrder(1);
      StripeStrategy.mockImplementation(() => ({
        initiate: jest.fn().mockResolvedValue({
          transaction_id: sharedTransactionId,
          raw_response: { id: sharedTransactionId },
          client_secret: 'secret_b'
        })
      }));

      const resB = await request(app)
        .post(`/api/payments/${orderB}/initiate`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ provider: 'stripe' });

      expect(resB.status).toBe(409);
      expect(resB.body.success).toBe(false);

      // and order B should have no dangling payment row from the failed attempt.
      const paymentsForOrderB = await PaymentModel.findAll({ where: { order_id: orderB } });
      expect(paymentsForOrderB).toHaveLength(0);
    });
  });

  describe('webhook idempotency under redelivery', () => {
    it('processes the same webhook event twice without double-reducing stock', async () => {
      const orderId = await createOrder(2);
      const paymentIntentId = `pi_redelivery_${Date.now()}`;

      StripeStrategy.mockImplementation(() => ({
        initiate: jest.fn().mockResolvedValue({
          transaction_id: paymentIntentId,
          raw_response: { id: paymentIntentId },
          client_secret: 'secret_redelivery'
        })
      }));

      await request(app)
        .post(`/api/payments/${orderId}/initiate`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ provider: 'stripe' });

      const stockBefore = (await ProductModel.findByPk(product.id)).stock;

      const succeededEvent = {
        type: 'payment_intent.succeeded',
        data: { object: { id: paymentIntentId, status: 'succeeded' } }
      };
      StripeStrategy.mockImplementation(() => ({
        parseWebhookEvent: jest.fn().mockReturnValue(succeededEvent)
      }));

      // stripe (and most providers) redeliver webhooks at-least-once, so the
      // exact same event can legitimately arrive more than once.
      const firstDelivery = await request(app)
        .post('/api/payments/stripe/webhook')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', 'fake-sig')
        .send(JSON.stringify({ id: 'evt_redelivery' }));
      expect(firstDelivery.status).toBe(200);

      const secondDelivery = await request(app)
        .post('/api/payments/stripe/webhook')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', 'fake-sig')
        .send(JSON.stringify({ id: 'evt_redelivery' }));
      expect(secondDelivery.status).toBe(200);

      const refreshedProduct = await ProductModel.findByPk(product.id);
      // stock only ever reduced once (by 2), not twice (by 4).
      expect(refreshedProduct.stock).toBe(stockBefore - 2);

      const refreshedOrder = await OrderModel.findByPk(orderId);
      expect(refreshedOrder.status).toBe('paid');
    });
  });

  describe('stock depleted between order creation and payment confirmation', () => {
    it('fails the confirmation cleanly and rolls back, leaving the payment pending', async () => {
      // order for all but 1 unit of whatever stock remains at this point.
      const stockAtOrderTime = (await ProductModel.findByPk(product.id)).stock;
      const orderId = await createOrder(stockAtOrderTime);

      const paymentIntentId = `pi_race_${Date.now()}`;
      StripeStrategy.mockImplementation(() => ({
        initiate: jest.fn().mockResolvedValue({
          transaction_id: paymentIntentId,
          raw_response: { id: paymentIntentId },
          client_secret: 'secret_race'
        })
      }));

      await request(app)
        .post(`/api/payments/${orderId}/initiate`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ provider: 'stripe' });

      // simulate the stock being depleted by something else after the order
      // was created but before this payment gets confirmed (e.g. another
      // order for the same product succeeding first).
      await ProductModel.update({ stock: 0 }, { where: { id: product.id } });

      StripeStrategy.mockImplementation(() => ({
        verifyAndComplete: jest.fn().mockResolvedValue({
          transaction_id: paymentIntentId,
          providerStatus: 'success',
          raw_response: { id: paymentIntentId, status: 'succeeded' }
        })
      }));

      const res = await request(app)
        .post('/api/payments/stripe/confirm')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ payment_intent_id: paymentIntentId });

      // the whole finalize transaction rolls back when reduceStock fails.
      expect(res.status).toBe(409);

      const paymentRow = await PaymentModel.findOne({ where: { transaction_id: paymentIntentId } });
      // still pending, the status update was rolled back along with the stock change.
      expect(paymentRow.status).toBe('pending');

      const refreshedOrder = await OrderModel.findByPk(orderId);
      expect(refreshedOrder.status).toBe('pending');

      // restore stock for any tests that might run after this one.
      await ProductModel.update({ stock: stockAtOrderTime }, { where: { id: product.id } });
    });
  });
});
