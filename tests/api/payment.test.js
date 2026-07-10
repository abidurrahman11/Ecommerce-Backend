// mock both concrete strategies so no real network calls happen. paymentService
// requires these modules internally, jest hoists these mocks above that require,
// so every `new StripeStrategy()` / `new BkashStrategy()` inside paymentService
// picks up whatever mockImplementation is set below at call time.
jest.mock('../../src/strategies/StripeStrategy');
jest.mock('../../src/strategies/BkashStrategy');

const StripeStrategy = require('../../src/strategies/StripeStrategy');
const BkashStrategy = require('../../src/strategies/BkashStrategy');

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

describe('Payment API', () => {
  let userToken;
  let otherUserToken;
  const userEmail = `pay.user.${Date.now()}@example.com`;
  const otherEmail = `pay.other.${Date.now()}@example.com`;
  let category;
  let product;
  const orderIds = [];

  // helper: create a pending order for `quantity` units of the shared test product.
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

    const userRow = await UserModel.create({ name: 'Payer', email: userEmail, password: hashedPassword, role: 'user' });
    userToken = signToken({ id: userRow.id, role: userRow.role });

    const otherRow = await UserModel.create({ name: 'Other', email: otherEmail, password: hashedPassword, role: 'user' });
    otherUserToken = signToken({ id: otherRow.id, role: otherRow.role });

    category = await CategoryModel.create({ name: `Pay Test Cat ${Date.now()}`, parent_id: null });
    product = await ProductModel.create({
      name: 'Payable Product',
      sku: `PAY-${Date.now()}`,
      price: 50,
      stock: 100,
      status: 'active',
      category_id: category.id
    });
  });

  afterAll(async () => {
    await PaymentModel.destroy({ where: { order_id: orderIds } });
    await OrderModel.destroy({ where: { id: orderIds } });
    await ProductModel.destroy({ where: { id: product.id } });
    await CategoryModel.destroy({ where: { id: category.id } });
    await UserModel.destroy({ where: { email: [userEmail, otherEmail] } });
    await sequelize.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('stripe: initiate -> confirm (success) -> idempotency', () => {
    let orderId;
    const paymentIntentId = 'pi_test_success_1';

    it('initiates a stripe payment', async () => {
      orderId = await createOrder(2); // 2 * 50 = 100

      StripeStrategy.mockImplementation(() => ({
        initiate: jest.fn().mockResolvedValue({
          transaction_id: paymentIntentId,
          raw_response: { id: paymentIntentId, status: 'requires_payment_method' },
          client_secret: 'secret_abc'
        })
      }));

      const res = await request(app)
        .post(`/api/payments/${orderId}/initiate`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ provider: 'stripe' });

      expect(res.status).toBe(201);
      expect(res.body.data.payment.status).toBe('pending');
      expect(res.body.data.payment.transaction_id).toBe(paymentIntentId);
      expect(res.body.data.client_secret).toBe('secret_abc');
    });

    it('confirms the payment, reduces stock, and marks the order paid', async () => {
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

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('success');

      const refreshedProduct = await ProductModel.findByPk(product.id);
      expect(refreshedProduct.stock).toBe(98); // 100 - 2

      const refreshedOrder = await OrderModel.findByPk(orderId);
      expect(refreshedOrder.status).toBe('paid');
    });

    it('is idempotent, confirming an already-finalized payment again does not double-reduce stock', async () => {
      const res = await request(app)
        .post('/api/payments/stripe/confirm')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ payment_intent_id: paymentIntentId });

      expect(res.status).toBe(200);

      const refreshedProduct = await ProductModel.findByPk(product.id);
      expect(refreshedProduct.stock).toBe(98); // unchanged
    });

    it('rejects initiating a new payment for an order that is already paid', async () => {
      const res = await request(app)
        .post(`/api/payments/${orderId}/initiate`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ provider: 'stripe' });

      expect(res.status).toBe(409);
    });

    it('rejects a user trying to initiate a payment for someone else\'s order', async () => {
      const res = await request(app)
        .post(`/api/payments/${orderId}/initiate`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ provider: 'stripe' });

      expect(res.status).toBe(403);
    });
  });

  describe('stripe: initiate -> confirm (failed) leaves the order pending', () => {
    let orderId;
    const paymentIntentId = 'pi_test_failed_1';

    it('confirms a failed payment without touching stock or cancelling the order', async () => {
      orderId = await createOrder(1);

      StripeStrategy.mockImplementation(() => ({
        initiate: jest.fn().mockResolvedValue({
          transaction_id: paymentIntentId,
          raw_response: { id: paymentIntentId, status: 'requires_payment_method' },
          client_secret: 'secret_xyz'
        })
      }));

      await request(app)
        .post(`/api/payments/${orderId}/initiate`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ provider: 'stripe' });

      const stockBefore = (await ProductModel.findByPk(product.id)).stock;

      StripeStrategy.mockImplementation(() => ({
        verifyAndComplete: jest.fn().mockResolvedValue({
          transaction_id: paymentIntentId,
          providerStatus: 'failed',
          raw_response: { id: paymentIntentId, status: 'canceled' }
        })
      }));

      const res = await request(app)
        .post('/api/payments/stripe/confirm')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ payment_intent_id: paymentIntentId });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('failed');

      const refreshedProduct = await ProductModel.findByPk(product.id);
      expect(refreshedProduct.stock).toBe(stockBefore); // unchanged

      const refreshedOrder = await OrderModel.findByPk(orderId);
      // deliberately still 'pending', not 'canceled', so the user can retry.
      expect(refreshedOrder.status).toBe('pending');
    });
  });

  describe('bkash: initiate -> execute (success)', () => {
    let orderId;
    const bkashPaymentId = 'bk_test_success_1';

    it('initiates a bkash payment', async () => {
      orderId = await createOrder(1);

      BkashStrategy.mockImplementation(() => ({
        initiate: jest.fn().mockResolvedValue({
          transaction_id: bkashPaymentId,
          raw_response: { paymentID: bkashPaymentId },
          bkash_url: 'https://sandbox.bka.sh/pay/xyz'
        })
      }));

      const res = await request(app)
        .post(`/api/payments/${orderId}/initiate`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ provider: 'bkash' });

      expect(res.status).toBe(201);
      expect(res.body.data.bkash_url).toBe('https://sandbox.bka.sh/pay/xyz');
    });

    it('executes the payment, reduces stock, and marks the order paid', async () => {
      const stockBefore = (await ProductModel.findByPk(product.id)).stock;

      BkashStrategy.mockImplementation(() => ({
        verifyAndComplete: jest.fn().mockResolvedValue({
          transaction_id: bkashPaymentId,
          providerStatus: 'success',
          raw_response: { paymentID: bkashPaymentId, transactionStatus: 'Completed' }
        })
      }));

      const res = await request(app)
        .post('/api/payments/bkash/execute')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ paymentID: bkashPaymentId });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('success');

      const refreshedProduct = await ProductModel.findByPk(product.id);
      expect(refreshedProduct.stock).toBe(stockBefore - 1);

      const refreshedOrder = await OrderModel.findByPk(orderId);
      expect(refreshedOrder.status).toBe('paid');
    });
  });

  describe('rejects an unsupported provider', () => {
    it('returns 400 before ever reaching a strategy', async () => {
      const orderId = await createOrder(1);

      const res = await request(app)
        .post(`/api/payments/${orderId}/initiate`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ provider: 'paypal' });

      expect(res.status).toBe(400);
    });
  });

  describe('webhooks', () => {
    it('stripe webhook finalizes the payment on payment_intent.succeeded', async () => {
      const orderId = await createOrder(1);
      const paymentIntentId = 'pi_test_webhook_1';

      StripeStrategy.mockImplementation(() => ({
        initiate: jest.fn().mockResolvedValue({
          transaction_id: paymentIntentId,
          raw_response: { id: paymentIntentId },
          client_secret: 'secret_webhook'
        })
      }));

      await request(app)
        .post(`/api/payments/${orderId}/initiate`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ provider: 'stripe' });

      StripeStrategy.mockImplementation(() => ({
        parseWebhookEvent: jest.fn().mockReturnValue({
          type: 'payment_intent.succeeded',
          data: { object: { id: paymentIntentId, status: 'succeeded' } }
        })
      }));

      const res = await request(app)
        .post('/api/payments/stripe/webhook')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', 'fake-signature-since-mocked')
        .send(JSON.stringify({ id: 'evt_test' }));

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);

      const refreshedOrder = await OrderModel.findByPk(orderId);
      expect(refreshedOrder.status).toBe('paid');
    });

    it('rejects a stripe webhook with an invalid signature', async () => {
      StripeStrategy.mockImplementation(() => ({
        parseWebhookEvent: jest.fn().mockImplementation(() => {
          throw new Error('Webhook signature verification failed');
        })
      }));

      const res = await request(app)
        .post('/api/payments/stripe/webhook')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', 'bad-signature')
        .send(JSON.stringify({ id: 'evt_bad' }));

      expect(res.status).toBe(400);
      expect(res.body.received).toBe(false);
    });

    it('bkash webhook re-queries bkash for the real status before finalizing', async () => {
      const orderId = await createOrder(1);
      const bkashPaymentId = 'bk_test_webhook_1';

      BkashStrategy.mockImplementation(() => ({
        initiate: jest.fn().mockResolvedValue({
          transaction_id: bkashPaymentId,
          raw_response: { paymentID: bkashPaymentId },
          bkash_url: 'https://sandbox.bka.sh/pay/webhook'
        })
      }));

      await request(app)
        .post(`/api/payments/${orderId}/initiate`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ provider: 'bkash' });

      // the webhook payload's own "status" field is deliberately ignored by
      // our handler, it re-queries bkash instead, this mock proves that:
      // even though we don't include a status here, it still finalizes as
      // success because .query() (used internally) says so.
      BkashStrategy.mockImplementation(() => ({
        query: jest.fn().mockResolvedValue({
          transaction_id: bkashPaymentId,
          providerStatus: 'success',
          raw_response: { paymentID: bkashPaymentId, transactionStatus: 'Completed' }
        })
      }));

      const res = await request(app).post('/api/payments/bkash/webhook').send({ paymentID: bkashPaymentId });

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);

      const refreshedOrder = await OrderModel.findByPk(orderId);
      expect(refreshedOrder.status).toBe('paid');
    });
  });

  describe('GET /api/payments/order/:orderId', () => {
    it('lists payment attempts for an order the user owns', async () => {
      const orderId = orderIds[0]; // the first successful stripe order from earlier

      const res = await request(app)
        .get(`/api/payments/order/${orderId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('rejects a user who does not own the order', async () => {
      const orderId = orderIds[0];

      const res = await request(app)
        .get(`/api/payments/order/${orderId}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(res.status).toBe(403);
    });
  });
});
