const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const { sequelize, User: UserModel } = require('../../models');

// api tests for the auth routes, these hit the real test database.
describe('Auth API', () => {
  // use a unique email each run so re-running tests never collides.
  const testEmail = `test.user.${Date.now()}@example.com`;
  const testPassword = 'password123';
  let authToken;

  // clean up the test user after all tests run.
  afterAll(async () => {
    await UserModel.destroy({ where: { email: testEmail } });
    await sequelize.close();
  });

  it('registers a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: testEmail, password: testPassword });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testEmail);
    // password hash should never be returned to the client.
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.body.data.token).toBeDefined();
  });

  it('rejects registering the same email twice', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: testEmail, password: testPassword });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('rejects invalid input on register', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'A', email: 'not-an-email', password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it('logs the user in with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    authToken = res.body.data.token;
  });

  it('rejects login with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  it('returns the logged in user on /me with a valid token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(testEmail);
  });

  it('rejects /me without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects login for an email that was never registered', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: `nobody.${Date.now()}@example.com`, password: 'whatever123' });

    expect(res.status).toBe(401);
  });

  it('rejects a malformed (garbage) token on /me', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('rejects a token signed with the wrong secret (forged) on /me', async () => {
    const forgedToken = jwt.sign({ id: 1, role: 'admin' }, 'a-completely-wrong-secret', { expiresIn: '1h' });

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${forgedToken}`);
    expect(res.status).toBe(401);
  });

  it('rejects an expired token on /me', async () => {
    // signed with the real secret, but already expired.
    const expiredToken = jwt.sign({ id: 1, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '-10s' });

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
  });
});
