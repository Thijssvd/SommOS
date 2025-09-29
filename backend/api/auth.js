const express = require('express');

const { validate, validators } = require('../middleware/validate');
const { authService, requireAuth, requireRole } = require('../middleware/auth');
const { serializeInvite } = require('../utils/serialize');

const router = express.Router();

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

router.post(
    '/register',
    validate(validators.authRegister),
    asyncHandler(async (req, res) => {
        const { email, password } = req.body;

        const existingCount = await authService.getUserCount();

        if (existingCount > 0) {
            return sendError(
                res,
                403,
                'REGISTRATION_DISABLED',
                'Direct registration is disabled after the first account is created.'
            );
        }

        const existingUser = await authService.getUserByEmail(email);

        if (existingUser) {
            return sendError(res, 409, 'USER_EXISTS', 'An account with this email already exists.');
        }

        const user = await authService.createUser({ email, password, role: 'admin' });
        const tokens = await authService.issueTokensForUser(user);
        authService.attachTokensToResponse(res, tokens);

        const freshUser = await authService.getUserById(user.id);

        return res.status(201).json({
            success: true,
            data: authService.serializeUser(freshUser),
        });
    })
);

router.post(
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

router.post(
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

router.post(
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

router.post(
    '/invite',
    requireRole('admin'),
    validate(validators.authInvite),
    asyncHandler(async (req, res) => {
        const { email, role, expires_in_hours, pin } = req.body;

        const expiresInMs = expires_in_hours
            ? Number(expires_in_hours) * 60 * 60 * 1000
            : undefined;

        if (expiresInMs && (!Number.isFinite(expiresInMs) || expiresInMs <= 0)) {
            return sendError(res, 400, 'INVALID_INVITE_EXPIRATION', 'expires_in_hours must be positive.');
        }

        try {
            const invite = await authService.createInvite({
                email,
                role,
                expiresInMs,
                pin,
            });

            return res.status(201).json({
                success: true,
                data: serializeInvite(invite),
            });
        } catch (error) {
            return sendError(
                res,
                400,
                'INVITE_CREATION_FAILED',
                error.message || 'Failed to create invite.'
            );
        }
    })
);

router.post(
    '/accept-invite',
    validate(validators.authAcceptInvite),
    asyncHandler(async (req, res) => {
        const { token, password, pin } = req.body;

        try {
            const user = await authService.consumeInvite(token, { password, pin });
            const tokens = await authService.issueTokensForUser(user);
            authService.attachTokensToResponse(res, tokens);

            const freshUser = await authService.getUserById(user.id);

            return res.json({
                success: true,
                data: authService.serializeUser(freshUser),
            });
        } catch (error) {
            const message = error.message || 'Unable to accept invite.';

            if (['PIN_REQUIRED', 'INVALID_PIN', 'PASSWORD_REQUIRED'].includes(error.message)) {
                return sendError(res, 400, error.message, message);
            }

            return sendError(res, 400, 'INVALID_INVITE', message);
        }
    })
);

router.get(
    '/me',
    requireAuth(),
    asyncHandler(async (req, res) => {
        return res.json({
            success: true,
            data: req.user,
        });
    })
);

module.exports = router;
