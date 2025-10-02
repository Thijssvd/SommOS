const AuthService = require('../core/auth_service');

const authService = new AuthService();
const AUTH_DISABLED = Boolean(authService.config?.features?.authDisabled);

const TRUTHY_ENV_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSY_ENV_VALUES = new Set(['0', 'false', 'no', 'off']);

function shouldBypassAuth() {
    if (AUTH_DISABLED) {
        return true;
    }
    const { nodeEnv } = authService.config;

    if (nodeEnv === 'production') {
        return false;
    }

    // Always bypass auth in test environment
    if (nodeEnv === 'test') {
        return true;
    }

    const rawFlag = process.env.SOMMOS_AUTH_TEST_BYPASS;

    if (typeof rawFlag === 'string') {
        const normalized = rawFlag.trim().toLowerCase();

        if (FALSY_ENV_VALUES.has(normalized)) {
            return false;
        }

        if (TRUTHY_ENV_VALUES.has(normalized)) {
            return true;
        }
    }

    return nodeEnv === 'performance';
}

function extractAccessToken(req) {
    if (req.cookies && req.cookies.sommos_access_token) {
        return req.cookies.sommos_access_token;
    }

    const header = req.headers?.authorization || req.headers?.Authorization;
    if (header && typeof header === 'string' && header.startsWith('Bearer ')) {
        return header.slice('Bearer '.length).trim();
    }

    return null;
}

async function authenticateRequest(req) {
    if (req.user) {
        return req.user;
    }

    const token = extractAccessToken(req);

    if (!token) {
        if (shouldBypassAuth()) {
            const fallbackEmail = 'test-admin@sommos.local';
            let testUser = await authService.getUserByEmail(fallbackEmail);

            if (!testUser) {
                testUser = await authService.createUser({
                    email: fallbackEmail,
                    password: 'test-password',
                    role: 'admin',
                });
            }

            const serialized = authService.serializeUser(testUser);
            req.user = serialized;
            return serialized;
        }

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
}

function unauthorized(res) {
    return res.status(401).json({
        success: false,
        error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication is required to access this resource.',
        },
    });
}

function forbidden(res) {
    return res.status(403).json({
        success: false,
        error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to perform this action.',
        },
    });
}

function requireAuth() {
    return async (req, res, next) => {
        if (AUTH_DISABLED) {
            req.user = req.user || { id: 'anonymous', role: 'admin', email: 'anonymous@sommos.local' };
            return next();
        }
        const user = await authenticateRequest(req);

        if (!user) {
            return unauthorized(res);
        }

        next();
    };
}

function requireRole(...roles) {
    const allowedRoles = roles.length > 0 ? roles : AuthService.Roles;

    return async (req, res, next) => {
        if (AUTH_DISABLED) {
            req.user = req.user || { id: 'anonymous', role: 'admin', email: 'anonymous@sommos.local' };
            return next();
        }
        const user = await authenticateRequest(req);

        if (!user) {
            return unauthorized(res);
        }

        if (!allowedRoles.includes(user.role)) {
            return forbidden(res);
        }

        next();
    };
}

module.exports = {
    authService,
    authenticateRequest,
    requireAuth,
    requireRole,
};
