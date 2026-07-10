const request = require('supertest');
const app = require('../../src/app');
const {
  sequelize,
  User: UserModel,
  Category: CategoryModel,
  Product: ProductModel,
  Order: OrderModel
} = require('../../models');
const User = require('../../src/classes/User');
const { signToken } = require('../../src/utils/jwt');

describe('Order API', () => {
  let userToken;
  let otherUserToken;
  const userEmail = `order.user.${Date.now()}@example.com`;
  const otherUserEmail = `order.other.${Date.now()}@example.com`;
  let category;
  let inStockProduct;
  let lowStockProduct;
  let inactiveProduct;
  let createdOrderId;

  beforeAll(async () => {
    const hashedPassword = await User.hashPassword('password123');

    const userRow = await UserModel.create({ name: 'Order User', email: userEmail, password: hashedPassword, role: 'user' });
    userToken = signToken({ id: userRow.id, role: userRow.role });

    const otherRow = await UserModel.create({ name: 'Other User', email: otherUserEmail, password: hashedPassword, role: 'user' });
    otherUserToken = signToken({ id: otherRow.id, role: otherRow.role });

    category = await CategoryModel.create({ name: `Order Test Cat ${Date.now()}`, parent_id: null });

    inStockProduct = await ProductModel.create({
      name: 'In Stock Product',
      sku: `ORD-IN-${Date.now()}`,
      price: 20,
      stock: 10,
      status: 'active',
      category_id: category.id
    });

    lowStockProduct = await ProductModel.create({
      name: 'Low Stock Product',
      sku: `ORD-LOW-${Date.now()}`,
      price: 5,
      stock: 1,
      status: 'active',
      category_id: category.id
    });

    inactiveProduct = await ProductModel.create({
      name: 'Inactive Product',
      sku: `ORD-INACT-${Date.now()}`,
      price: 15,
      stock: 10,
      status: 'inactive',
      category_id: category.id
    });
  });

  afterAll(async () => {
    if (createdOrderId) {
      await OrderModel.destroy({ where: { id: createdOrderId } }); // cascades to OrderItems
    }
    await ProductModel.destroy({ where: { category_id: category.id } });
    await CategoryModel.destroy({ where: { id: category.id } });
    await UserModel.destroy({ where: { email: [userEmail, otherUserEmail] } });
    await sequelize.close();
  });

  it('rejects order creation without a token', async () => {
    const res = await request(app).post('/api/orders').send({ items: [{ product_id: inStockProduct.id, quantity: 1 }] });
    expect(res.status).toBe(401);
  });

  it('rejects an empty items array', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ items: [] });
    expect(res.status).toBe(400);
  });

  it('creates an order and calculates totals/subtotals correctly', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ items: [{ product_id: inStockProduct.id, quantity: 3 }] });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.items).toHaveLength(1);
    expect(Number(res.body.data.items[0].subtotal)).toBe(60); // 20 * 3
    expect(Number(res.body.data.total_amount)).toBe(60);

    createdOrderId = res.body.data.id;
  });

  it('rejects an order for a product without enough stock', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ items: [{ product_id: lowStockProduct.id, quantity: 5 }] });

    expect(res.status).toBe(409);
  });

  it('rejects an order for an inactive product', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ items: [{ product_id: inactiveProduct.id, quantity: 1 }] });

    expect(res.status).toBe(400);
  });

  it('does not reduce stock at order creation time (only at payment success, step 5)', async () => {
    const refreshed = await ProductModel.findByPk(inStockProduct.id);
    expect(refreshed.stock).toBe(10); // unchanged from creation
  });

  it('lists the logged in user\'s own orders', async () => {
    const res = await request(app).get('/api/orders').set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.orders.some((o) => o.id === createdOrderId)).toBe(true);
  });

  it('returns order detail for the owner', async () => {
    const res = await request(app).get(`/api/orders/${createdOrderId}`).set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(createdOrderId);
  });

  it('rejects order detail for a user who does not own it', async () => {
    const res = await request(app)
      .get(`/api/orders/${createdOrderId}`)
      .set('Authorization', `Bearer ${otherUserToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for a non-existent order', async () => {
    const res = await request(app).get('/api/orders/999999').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(404);
  });
});
