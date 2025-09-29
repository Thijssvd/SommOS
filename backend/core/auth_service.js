const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const Database = require('../database/connection');
const { getConfig } = require('../config/env');
const { serializeUser: serializeUserPayload } = require('../utils/serialize');

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const STANDARD_INVITE_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const GUEST_INVITE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const GUEST_ACCESS_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes
const GUEST_REFRESH_TOKEN_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const BCRYPT_ROUNDS = 12;

const ROLES = ['admin', 'crew', 'guest'];

class AuthService {
    constructor(options = {}) {
        this.db = options.db || Database.getInstance();
        this.config = options.config || getConfig();

        const configuredSecret = this.config.auth && this.config.auth.jwtSecret;

        if (configuredSecret) {
            this.jwtSecret = configuredSecret;
        } else if (this.config.isProduction) {
            throw new Error('JWT_SECRET is not configured.');
        } else {
            this.jwtSecret = 'sommos-dev-secret';
        }
    }

    static get Roles() {
        return ROLES;
    }

    normalizeEmail(email) {
        return (email || '').trim().toLowerCase();
    }

    async getUserByEmail(email) {
        const normalized = this.normalizeEmail(email);
        return this.db.get('SELECT * FROM Users WHERE email = ?', [normalized]);
    }

    async getUserById(id) {
        return this.db.get('SELECT * FROM Users WHERE id = ?', [id]);
    }

    async getUserCount() {
        const result = await this.db.get('SELECT COUNT(*) as count FROM Users');
        return result?.count || 0;
    }

    async createUser({ email, password, role }) {
        const normalized = this.normalizeEmail(email);

        if (!ROLES.includes(role)) {
            throw new Error('INVALID_ROLE');
        }

        const passwordHash = password ? await bcrypt.hash(password, BCRYPT_ROUNDS) : null;

        const result = await this.db.run(
            'INSERT INTO Users (email, password_hash, role) VALUES (?, ?, ?)',
            [normalized, passwordHash, role]
        );

        return this.getUserById(result.lastID);
    }

    async updatePassword(userId, password) {
        const passwordHash = password ? await bcrypt.hash(password, BCRYPT_ROUNDS) : null;
        await this.db.run('UPDATE Users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
    }

    async updateRole(userId, role) {
        if (!ROLES.includes(role)) {
            throw new Error('INVALID_ROLE');
        }
        await this.db.run('UPDATE Users SET role = ? WHERE id = ?', [role, userId]);
    }

    async updateLastLogin(userId) {
        const timestamp = new Date().toISOString();
        await this.db.run('UPDATE Users SET last_login = ? WHERE id = ?', [timestamp, userId]);
    }

    async verifyPassword(password, hash) {
        if (!hash) {
            return false;
        }
        return bcrypt.compare(password, hash);
    }

    serializeUser(user) {
        return serializeUserPayload(user);
    }

    generateAccessToken(user, ttlMs = ACCESS_TOKEN_TTL_MS) {
        return jwt.sign(
            {
                sub: user.id,
                role: user.role,
                type: 'access',
            },
            this.jwtSecret,
            { expiresIn: Math.floor(ttlMs / 1000) }
        );
    }

    generateRefreshToken(user, ttlMs = REFRESH_TOKEN_TTL_MS) {
        return jwt.sign(
            {
                sub: user.id,
                role: user.role,
                type: 'refresh',
                jti: crypto.randomUUID(),
            },
            this.jwtSecret,
            { expiresIn: Math.floor(ttlMs / 1000) }
        );
    }

    hashToken(token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    async storeRefreshToken(userId, token, ttlMs = REFRESH_TOKEN_TTL_MS) {
        const tokenHash = this.hashToken(token);
        const expiresAt = new Date(Date.now() + ttlMs).toISOString();

        await this.db.run(
            'INSERT INTO RefreshTokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
            [userId, tokenHash, expiresAt]
        );
    }

    async removeRefreshToken(token) {
        if (!token) {
            return;
        }

        const tokenHash = this.hashToken(token);
        await this.db.run('DELETE FROM RefreshTokens WHERE token_hash = ?', [tokenHash]);
    }

    async revokeUserRefreshTokens(userId) {
        await this.db.run('DELETE FROM RefreshTokens WHERE user_id = ?', [userId]);
    }

    verifyAccessToken(token) {
        const payload = jwt.verify(token, this.jwtSecret);

        if (payload.type !== 'access') {
            throw new Error('INVALID_TOKEN_TYPE');
        }

        return payload;
    }

    verifyRefreshToken(token) {
        const payload = jwt.verify(token, this.jwtSecret);

        if (payload.type !== 'refresh') {
            throw new Error('INVALID_TOKEN_TYPE');
        }

        return payload;
    }

    async validateRefreshToken(token) {
        const payload = this.verifyRefreshToken(token);
        const tokenHash = this.hashToken(token);

        const record = await this.db.get(
            'SELECT * FROM RefreshTokens WHERE token_hash = ?',
            [tokenHash]
        );

        if (!record) {
            throw new Error('REFRESH_TOKEN_REVOKED');
        }

        const expiresAt = new Date(record.expires_at).getTime();
        if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
            await this.db.run('DELETE FROM RefreshTokens WHERE id = ?', [record.id]);
            throw new Error('REFRESH_TOKEN_EXPIRED');
        }

        const user = await this.getUserById(record.user_id);

        if (!user) {
            await this.db.run('DELETE FROM RefreshTokens WHERE id = ?', [record.id]);
            throw new Error('USER_NOT_FOUND');
        }

        return { payload, record, user };
    }

    async issueTokensForUser(
        user,
        { accessTtlMs = ACCESS_TOKEN_TTL_MS, refreshTtlMs = REFRESH_TOKEN_TTL_MS } = {}
    ) {
        const accessToken = this.generateAccessToken(user, accessTtlMs);
        const refreshToken = this.generateRefreshToken(user, refreshTtlMs);

        await this.storeRefreshToken(user.id, refreshToken, refreshTtlMs);
        await this.updateLastLogin(user.id);

        return { accessToken, refreshToken, accessTtlMs, refreshTtlMs };
    }

    async rotateRefreshToken(oldToken, user, options) {
        await this.removeRefreshToken(oldToken);
        return this.issueTokensForUser(user, options);
    }

    getCookieOptions({ accessTtlMs = ACCESS_TOKEN_TTL_MS, refreshTtlMs = REFRESH_TOKEN_TTL_MS } = {}) {
        const base = {
            httpOnly: true,
            sameSite: this.config.isProduction ? 'none' : 'lax',
            secure: this.config.isProduction,
            path: '/',
        };

        return {
            access: {
                ...base,
                maxAge: accessTtlMs,
            },
            refresh: {
                ...base,
                maxAge: refreshTtlMs,
            },
        };
    }

    attachTokensToResponse(res, tokens, { accessTtlMs, refreshTtlMs } = {}) {
        const options = this.getCookieOptions({
            accessTtlMs: accessTtlMs || tokens.accessTtlMs,
            refreshTtlMs: refreshTtlMs || tokens.refreshTtlMs,
        });

        res.cookie('sommos_access_token', tokens.accessToken, options.access);
        res.cookie('sommos_refresh_token', tokens.refreshToken, options.refresh);
    }

    clearAuthCookies(res) {
        const options = this.getCookieOptions();
        res.clearCookie('sommos_access_token', { ...options.access, maxAge: 0 });
        res.clearCookie('sommos_refresh_token', { ...options.refresh, maxAge: 0 });
    }

    async createGuestSession({ token, pin } = {}) {
        if (!token) {
            throw new Error('GUEST_CODE_REQUIRED');
        }

        const invite = await this.getInviteByToken(token);

        if (!invite || invite.role !== 'guest') {
            throw new Error('INVALID_GUEST_CODE');
        }

        const user = await this.consumeInvite(token, { pin });

        if (!user || user.role !== 'guest') {
            throw new Error('INVALID_GUEST_PROFILE');
        }

        const tokens = await this.issueTokensForUser(user, {
            accessTtlMs: GUEST_ACCESS_TOKEN_TTL_MS,
            refreshTtlMs: GUEST_REFRESH_TOKEN_TTL_MS,
        });

        const freshUser = await this.getUserById(user.id);

        return {
            user: this.serializeUser(freshUser),
            tokens,
        };
    }

    async createInvite({ email, role, expiresInMs, pin }) {
        const normalized = this.normalizeEmail(email);

        if (!ROLES.includes(role)) {
            throw new Error('INVALID_ROLE');
        }

        const token = crypto.randomBytes(48).toString('hex');
        const tokenHash = this.hashToken(token);

        const ttl = role === 'guest' ? GUEST_INVITE_TTL_MS : (expiresInMs || STANDARD_INVITE_TTL_MS);
        const expiresAt = new Date(Date.now() + ttl).toISOString();

        const pinHash = pin ? await bcrypt.hash(String(pin), BCRYPT_ROUNDS) : null;

        await this.db.run('DELETE FROM Invites WHERE email = ? AND accepted_at IS NULL', [normalized]);

        await this.db.run(
            'INSERT INTO Invites (email, role, token_hash, pin_hash, expires_at) VALUES (?, ?, ?, ?, ?)',
            [normalized, role, tokenHash, pinHash, expiresAt]
        );

        return {
            token,
            email: normalized,
            role,
            expires_at: expiresAt,
            requires_pin: Boolean(pinHash),
        };
    }

    async getInviteByToken(token) {
        if (!token) {
            return null;
        }

        const tokenHash = this.hashToken(token);
        const invite = await this.db.get(
            'SELECT * FROM Invites WHERE token_hash = ?',
            [tokenHash]
        );

        if (!invite) {
            return null;
        }

        if (invite.accepted_at && invite.role !== 'guest') {
            return null;
        }

        const expiresAt = new Date(invite.expires_at).getTime();
        if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
            await this.db.run('DELETE FROM Invites WHERE id = ?', [invite.id]);
            return null;
        }

        return invite;
    }

    async consumeInvite(token, { pin, password } = {}) {
        const invite = await this.getInviteByToken(token);

        if (!invite) {
            throw new Error('INVALID_INVITE');
        }

        if (invite.pin_hash) {
            if (!pin) {
                throw new Error('PIN_REQUIRED');
            }

            const pinValid = await bcrypt.compare(String(pin), invite.pin_hash);
            if (!pinValid) {
                throw new Error('INVALID_PIN');
            }
        }

        if (invite.role !== 'guest' && !password) {
            throw new Error('PASSWORD_REQUIRED');
        }

        const normalizedEmail = this.normalizeEmail(invite.email);
        let user = await this.getUserByEmail(normalizedEmail);

        if (!user) {
            user = await this.createUser({
                email: normalizedEmail,
                password: password || crypto.randomBytes(16).toString('hex'),
                role: invite.role,
            });
        } else {
            await this.updateRole(user.id, invite.role);
            if (password) {
                await this.updatePassword(user.id, password);
            }
        }

        if (invite.role === 'guest') {
            await this.db.run('UPDATE Invites SET accepted_at = COALESCE(accepted_at, CURRENT_TIMESTAMP) WHERE id = ?', [invite.id]);
        } else {
            await this.db.run('UPDATE Invites SET accepted_at = CURRENT_TIMESTAMP WHERE id = ?', [invite.id]);
        }

        return this.getUserById(user.id);
    }
}

module.exports = AuthService;
