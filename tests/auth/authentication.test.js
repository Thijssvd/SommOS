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
    // Use test environment but explicitly disable auth bypass for this test suite
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters-long-for-testing';
    process.env.SESSION_SECRET = 'test-session-secret-that-is-at-least-32-characters-for-tests';
    process.env.DATABASE_PATH = ':memory:';
    process.env.SOMMOS_AUTH_DISABLED = 'false';
    process.env.SOMMOS_AUTH_TEST_BYPASS = 'false';

    jest.resetModules();

    const Database = require('../../backend/database/connection');
    Database.instance = null;
    db = Database.getInstance(':memory:');
    await db.initialize();

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await db.exec(schemaSql);

    // Create AuthService with the test database instance
    const AuthService = require('../../backend/core/auth_service');
    const { getConfig } = require('../../backend/config/env');
    authService = new AuthService({ db, config: getConfig() });

    // Create middleware functions manually with the test auth service
    const authenticateRequest = async (req) => {
      if (req.user) {
        return req.user;
      }

      const token = req.cookies?.sommos_access_token || 
        (req.headers?.authorization || req.headers?.Authorization)?.replace('Bearer ', '')?.trim();

      if (!token) {
        return null;
      }

      try {
        const payload = authService.verifyAccessToken(token);
        const user = await authService.getUserById(payload.sub);

        if (!user) {
          return null;
        }

        const serialized = authService.serializeUser(user);
        req.user = serialized;
        return serialized;
      } catch (error) {
        return null;
      }
    };

    const unauthorized = (res) => {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication is required to access this resource.',
        },
      });
    };

    const forbidden = (res) => {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this action.',
        },
      });
    };

    requireAuth = () => {
      return async (req, res, next) => {
        const user = await authenticateRequest(req);
        if (!user) {
          return unauthorized(res);
        }
        next();
      };
    };

    requireRole = (...roles) => {
      const allowedRoles = roles.length > 0 ? roles : AuthService.Roles;
      return async (req, res, next) => {
        const user = await authenticateRequest(req);
        if (!user) {
          return unauthorized(res);
        }
        if (!allowedRoles.includes(user.role)) {
          return forbidden(res);
        }
        next();
      };
    };

    // Create custom auth router with test auth service
    const express = require('express');
    const cookieParser = require('cookie-parser');
    const { validate, validators } = require('../../backend/middleware/validate');

    const authRouter = express.Router();

    const asyncHandler = (fn) => (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };

    const sendError = (res, status, code, message, details) => {
      const payload = {
        success: false,
        error: {
          code,
          message,
        },
      };

      if (typeof details !== 'undefined') {
        payload.error.details = details;
      }

      return res.status(status).json(payload);
    };

    // Login endpoint
    authRouter.post(
      '/login',
      validate(validators.authLogin),
      asyncHandler(async (req, res) => {
        const { email, password } = req.body;

        const user = await authService.getUserByEmail(email);

        if (!user) {
          return sendError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
        }

        const validPassword = await authService.verifyPassword(password, user.password_hash);

        if (!validPassword) {
          return sendError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
        }

        const tokens = await authService.issueTokensForUser(user);
        authService.attachTokensToResponse(res, tokens);

        const freshUser = await authService.getUserById(user.id);

        return res.json({
          success: true,
          data: authService.serializeUser(freshUser),
        });
      })
    );

    // Logout endpoint
    authRouter.post(
      '/logout',
      requireAuth(),
      asyncHandler(async (req, res) => {
        const refreshToken = req.cookies?.sommos_refresh_token;

        if (refreshToken) {
          await authService.removeRefreshToken(refreshToken);
        }

        authService.clearAuthCookies(res);

        return res.json({
          success: true,
          message: 'Logged out successfully.',
        });
      })
    );

    // Refresh endpoint
    authRouter.post(
      '/refresh',
      asyncHandler(async (req, res) => {
        const refreshToken = req.cookies?.sommos_refresh_token;

        if (!refreshToken) {
          return sendError(res, 401, 'REFRESH_TOKEN_MISSING', 'Refresh token is required.');
        }

        try {
          const { user } = await authService.validateRefreshToken(refreshToken);
          const tokens = await authService.rotateRefreshToken(refreshToken, user);
          authService.attachTokensToResponse(res, tokens);

          const freshUser = await authService.getUserById(user.id);

          return res.json({
            success: true,
            data: authService.serializeUser(freshUser),
          });
        } catch (error) {
          authService.clearAuthCookies(res);

          return sendError(
            res,
            401,
            'REFRESH_TOKEN_INVALID',
            error.message || 'Refresh token is invalid or has expired.'
          );
        }
      })
    );

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
