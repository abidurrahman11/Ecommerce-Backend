const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User: UserModel, Category: CategoryModel, Product: ProductModel } = require('../../models');
const User = require('../../src/classes/User');
const { signToken } = require('../../src/utils/jwt');
const productService = require('../../src/services/productService');
const { invalidateCategoryCache } = require('../../src/utils/categoryDFS');

describe('Product API', () => {
  let adminToken;
  const adminEmail = `admin.prod.${Date.now()}@example.com`;
  let category;
  let productA;
  let productB;

  beforeAll(async () => {
    const hashedPassword = await User.hashPassword('password123');
    const adminRow = await UserModel.create({ name: 'Admin', email: adminEmail, password: hashedPassword, role: 'admin' });
    adminToken = signToken({ id: adminRow.id, role: adminRow.role });

    category = await CategoryModel.create({ name: `Test Cat ${Date.now()}`, parent_id: null });
    // this test creates categories directly, so clear the cache to make sure
    // dfs/related-products tests below see the fresh category.
    await invalidateCategoryCache();
  });

  afterAll(async () => {
    await ProductModel.destroy({ where: { category_id: category.id } });
    await CategoryModel.destroy({ where: { id: category.id } });
    await UserModel.destroy({ where: { email: adminEmail } });
    await sequelize.close();
  });

  it('rejects product creation from a non admin / unauthenticated request', async () => {
    const res = await request(app).post('/api/admin/products').send({ name: 'X', sku: 'X-1', price: 10 });
    expect(res.status).toBe(401);
  });

  it('lets an admin create a product', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Product A', sku: `SKU-A-${Date.now()}`, price: 25.5, stock: 10, category_id: category.id });

    expect(res.status).toBe(201);
    productA = res.body.data;
  });

  it('rejects a duplicate sku', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Duplicate', sku: productA.sku, price: 5, stock: 1 });

    expect(res.status).toBe(409);
  });

  it('creates a second product in the same category, for the related-products test', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Product B', sku: `SKU-B-${Date.now()}`, price: 15, stock: 5, category_id: category.id });

    expect(res.status).toBe(201);
    productB = res.body.data;
  });

  it('lists products publicly', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.products)).toBe(true);
    expect(res.body.data.pagination).toBeDefined();
  });

  it('returns product detail', async () => {
    const res = await request(app).get(`/api/products/${productA.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.sku).toBe(productA.sku);
  });

  it('returns related products from the same category via dfs, excluding itself', async () => {
    const res = await request(app).get(`/api/products/${productA.id}/related`);
    expect(res.status).toBe(200);

    const relatedIds = res.body.data.map((p) => p.id);
    expect(relatedIds).toContain(productB.id);
    expect(relatedIds).not.toContain(productA.id);
  });

  it('lets an admin update a product', async () => {
    const res = await request(app)
      .put(`/api/admin/products/${productA.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 30 });

    expect(res.status).toBe(200);
    expect(Number(res.body.data.price)).toBe(30);
  });

  describe('reduceStock (transactional, deterministic)', () => {
    it('reduces stock correctly inside a transaction', async () => {
      const transaction = await sequelize.transaction();
      try {
        const newStock = await productService.reduceStock(productB.id, 2, transaction);
        expect(newStock).toBe(3); // started at 5
        await transaction.commit();
      } catch (err) {
        await transaction.rollback();
        throw err;
      }

      const refreshed = await ProductModel.findByPk(productB.id);
      expect(refreshed.stock).toBe(3);
    });

    it('throws and rolls back when stock is insufficient', async () => {
      const transaction = await sequelize.transaction();

      await expect(productService.reduceStock(productB.id, 999, transaction)).rejects.toThrow(/Insufficient stock/);

      await transaction.rollback();

      // stock should be unchanged from the previous test (3).
      const refreshed = await ProductModel.findByPk(productB.id);
      expect(refreshed.stock).toBe(3);
    });
  });

  it('lets an admin delete a product', async () => {
    const res = await request(app)
      .delete(`/api/admin/products/${productA.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    productA = null;
  });
});
