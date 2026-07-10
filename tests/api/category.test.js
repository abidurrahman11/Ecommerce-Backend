const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User: UserModel, Category: CategoryModel } = require('../../models');
const User = require('../../src/classes/User');
const { signToken } = require('../../src/utils/jwt');

// api tests for category routes (public + admin), hits the real test database.
describe('Category API', () => {
  let adminToken;
  let userToken;
  const adminEmail = `admin.cat.${Date.now()}@example.com`;
  const userEmail = `user.cat.${Date.now()}@example.com`;
  let createdCategoryId;

  beforeAll(async () => {
    // create an admin directly in the db, no need to go through register
    // since role isn't settable through the public register endpoint.
    const hashedPassword = await User.hashPassword('password123');
    const adminRow = await UserModel.create({ name: 'Admin', email: adminEmail, password: hashedPassword, role: 'admin' });
    adminToken = signToken({ id: adminRow.id, role: adminRow.role });

    const userRow = await UserModel.create({ name: 'User', email: userEmail, password: hashedPassword, role: 'user' });
    userToken = signToken({ id: userRow.id, role: userRow.role });
  });

  afterAll(async () => {
    if (createdCategoryId) {
      await CategoryModel.destroy({ where: { id: createdCategoryId } });
    }
    await UserModel.destroy({ where: { email: [adminEmail, userEmail] } });
    await sequelize.close();
  });

  it('rejects category creation without a token', async () => {
    const res = await request(app).post('/api/categories').send({ name: 'Books' });
    expect(res.status).toBe(401);
  });

  it('rejects category creation from a non-admin user', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Books' });
    expect(res.status).toBe(403);
  });

  it('lets an admin create a category', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test Category' });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Test Category');
    createdCategoryId = res.body.data.id;
  });

  it('lists categories publicly', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns the category tree publicly', async () => {
    const res = await request(app).get('/api/categories/tree');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('lets an admin update a category', async () => {
    const res = await request(app)
      .put(`/api/categories/${createdCategoryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Renamed Category' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Renamed Category');
  });

  it('lets an admin delete a category', async () => {
    const res = await request(app)
      .delete(`/api/categories/${createdCategoryId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    createdCategoryId = null; // already deleted, nothing to clean up
  });
});
