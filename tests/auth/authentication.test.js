const path = require('path');
const fs = require('fs');
const request = require('supertest');

const schemaPath = path.join(__dirname, '../../backend/database/schema.sql');

describe('Authentication lifecycle', () => {
  let app;
  let db;
  let authService;
  let requireAuth;
  let requireRole;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.SESSION_SECRET = 'test-session-secret';
    process.env.DATABASE_PATH = ':memory:';
    process.env.SOMMOS_AUTH_TEST_BYPASS = 'false';

    jest.resetModules();

    const Database = require('../../backend/database/connection');
    Database.instance = null;
    db = Database.getInstance(':memory:');
    await db.initialize();

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await db.exec(schemaSql);

    const authMiddleware = require('../../backend/middleware/auth');
    authService = authMiddleware.authService;
    requireAuth = authMiddleware.requireAuth;
    requireRole = authMiddleware.requireRole;

    const express = require('express');
    const cookieParser = require('cookie-parser');
    const authRouter = require('../../backend/api/auth');

    app = express();
    app.use(express.json());
    app.use(cookieParser(process.env.SESSION_SECRET));
    app.use('/api/auth', authRouter);

    app.get('/protected', requireAuth(), (req, res) => {
      res.json({ success: true, user: req.user });
    });

    app.post('/admin', requireRole('admin'), (req, res) => {
      res.json({ success: true, user: req.user });
    });
  });

  beforeEach(async () => {
    await db.exec('DELETE FROM RefreshTokens; DELETE FROM Invites; DELETE FROM Users;');
  });

  afterAll(async () => {
    if (db) {
      await db.close();
    }
  });

  const parseCookieValue = (cookies, name) => {
    if (!Array.isArray(cookies)) {
      return null;
    }

    const target = cookies.find((cookie) => cookie.startsWith(`${name}=`));
    if (!target) {
      return null;
    }

    const [raw] = target.split(';');
    const [, ...valueParts] = raw.split('=');
    return valueParts.join('=');
  };

  test('POST /api/auth/login issues httpOnly cookies and updates metadata', async () => {
    const agent = request.agent(app);

    const password = 'CrewPass!234';
    const user = await authService.createUser({
      email: 'crew@example.com',
      password,
      role: 'crew',
    });

    const response = await agent
      .post('/api/auth/login')
      .send({ email: 'crew@example.com', password })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      email: 'crew@example.com',
      role: 'crew',
    });

    const cookies = response.headers['set-cookie'];
    expect(cookies).toBeDefined();

    const accessCookie = cookies.find((cookie) => cookie.startsWith('sommos_access_token='));
    const refreshCookie = cookies.find((cookie) => cookie.startsWith('sommos_refresh_token='));

    expect(accessCookie).toBeDefined();
    expect(accessCookie).toContain('HttpOnly');
    expect(accessCookie).toContain('SameSite=Lax');
    expect(accessCookie).not.toContain('Secure');

    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie).toContain('SameSite=Lax');
    expect(refreshCookie).not.toContain('Secure');

    const refreshTokenValue = parseCookieValue(cookies, 'sommos_refresh_token');
    const storedToken = await db.get('SELECT token_hash FROM RefreshTokens WHERE user_id = ?', [user.id]);
    expect(storedToken).toBeDefined();
    expect(storedToken.token_hash).toHaveLength(64);
    expect(storedToken.token_hash).not.toBe(refreshTokenValue);

    const updatedUser = await authService.getUserById(user.id);
    expect(updatedUser.last_login).not.toBeNull();
  });

  test('POST /api/auth/refresh rotates refresh tokens and reissues cookies', async () => {
    const agent = request.agent(app);
    const password = 'CrewRefresh!42';
    const user = await authService.createUser({
      email: 'rotate@example.com',
      password,
      role: 'crew',
    });

    const loginResponse = await agent
      .post('/api/auth/login')
      .send({ email: 'rotate@example.com', password })
      .expect(200);

    const loginCookies = loginResponse.headers['set-cookie'];
    const originalRefreshValue = parseCookieValue(loginCookies, 'sommos_refresh_token');
    const originalTokenRow = await db.get('SELECT token_hash FROM RefreshTokens WHERE user_id = ?', [user.id]);

    const refreshResponse = await agent.post('/api/auth/refresh').expect(200);
    const refreshCookies = refreshResponse.headers['set-cookie'];
    const rotatedRefreshValue = parseCookieValue(refreshCookies, 'sommos_refresh_token');

    expect(rotatedRefreshValue).toBeDefined();
    expect(rotatedRefreshValue).not.toBe(originalRefreshValue);

    const tokenRows = await db.all('SELECT token_hash FROM RefreshTokens WHERE user_id = ?', [user.id]);
    expect(tokenRows).toHaveLength(1);
    expect(tokenRows[0].token_hash).not.toBe(originalTokenRow.token_hash);
  });

  test('POST /api/auth/refresh rejects invalid refresh tokens and clears cookies', async () => {
    const response = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', 'sommos_refresh_token=invalid-token')
      .expect(401);

    expect(response.body.success).toBe(false);

    const cookies = response.headers['set-cookie'];
    const clearedRefresh = cookies.find((cookie) => cookie.startsWith('sommos_refresh_token='));
    expect(clearedRefresh).toBeDefined();
    expect(clearedRefresh).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
  });

  test('POST /api/auth/logout revokes refresh tokens and removes cookies', async () => {
    const agent = request.agent(app);
    const password = 'CrewLogout!42';
    const user = await authService.createUser({
      email: 'logout@example.com',
      password,
      role: 'crew',
    });

    await agent
      .post('/api/auth/login')
      .send({ email: 'logout@example.com', password })
      .expect(200);

    let tokenRows = await db.all('SELECT token_hash FROM RefreshTokens WHERE user_id = ?', [user.id]);
    expect(tokenRows).toHaveLength(1);

    const logoutResponse = await agent.post('/api/auth/logout').expect(200);
    expect(logoutResponse.body.success).toBe(true);

    const cookies = logoutResponse.headers['set-cookie'];
    const clearedAccess = cookies.find((cookie) => cookie.startsWith('sommos_access_token='));
    const clearedRefresh = cookies.find((cookie) => cookie.startsWith('sommos_refresh_token='));

    expect(clearedAccess).toBeDefined();
    expect(clearedAccess).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
    expect(clearedRefresh).toBeDefined();
    expect(clearedRefresh).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970 00:00:00 GMT/);

    tokenRows = await db.all('SELECT token_hash FROM RefreshTokens WHERE user_id = ?', [user.id]);
    expect(tokenRows).toHaveLength(0);

    await agent.get('/protected').expect(401);
  });

  test('requireAuth and requireRole enforce RBAC expectations', async () => {
    await request(app).get('/protected').expect(401);

    const guestPassword = 'GuestAccess!9';
    await authService.createUser({
      email: 'guest@example.com',
      password: guestPassword,
      role: 'guest',
    });

    const guestAgent = request.agent(app);
    await guestAgent
      .post('/api/auth/login')
      .send({ email: 'guest@example.com', password: guestPassword })
      .expect(200);

    const protectedResponse = await guestAgent.get('/protected').expect(200);
    expect(protectedResponse.body.user).toMatchObject({
      email: 'guest@example.com',
      role: 'guest',
    });

    await guestAgent.post('/admin').expect(403);

    const adminPassword = 'AdminPower!55';
    await authService.createUser({
      email: 'admin@example.com',
      password: adminPassword,
      role: 'admin',
    });

    const adminAgent = request.agent(app);
    await adminAgent
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: adminPassword })
      .expect(200);

    const adminResponse = await adminAgent.post('/admin').expect(200);
    expect(adminResponse.body.user).toMatchObject({
      email: 'admin@example.com',
      role: 'admin',
    });
  });
});
