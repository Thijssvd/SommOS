// SommOS Security Configuration
// Centralized security settings for the application

const { getConfig } = require('./env');
const env = getConfig();

/**
 * Enhanced CSP configuration with strict security policies
 */
const helmetConfig = {
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: [
                "'self'", 
                "https://api.openai.com", 
                "https://archive-api.open-meteo.com",
                ...(env.nodeEnv === 'development' ? ["http://localhost:3001", "http://localhost:3000"] : [])
            ],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false, // Disable for PWA compatibility
    hsts: env.nodeEnv === 'production' ? {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
    } : false,
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    frameguard: { action: "deny" },
    hidePoweredBy: true,
    crossOriginResourcePolicy: { policy: "cross-origin" } // Allow PWA resources
};

/**
 * Rate limiting configurations for different endpoint types
 */
const rateLimitConfigs = {
    general: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1000, // Limit each IP to 1000 requests per windowMs
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            success: false,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many requests from this IP, please try again later.'
            }
        }
    },
    auth: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // Limit each IP to 5 auth requests per windowMs
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: true,
        message: {
            success: false,
            error: {
                code: 'AUTH_RATE_LIMIT_EXCEEDED',
                message: 'Too many authentication attempts from this IP, please try again later.'
            }
        }
    },
    api: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 200, // Limit each IP to 200 API requests per windowMs
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            success: false,
            error: {
                code: 'API_RATE_LIMIT_EXCEEDED',
                message: 'Too many API requests from this IP, please try again later.'
            }
        }
    },
    websocket: {
        windowMs: 60 * 1000, // 1 minute
        max: 100, // Limit each IP to 100 WebSocket connections per minute
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            success: false,
            error: {
                code: 'WEBSOCKET_RATE_LIMIT_EXCEEDED',
                message: 'Too many WebSocket connections from this IP, please try again later.'
            }
        }
    }
};

/**
 * CORS configuration based on environment
 */
const corsConfig = {
    origin: env.nodeEnv === 'production'
        ? ['https://sommos.yacht'] // Production domain
        : ['http://localhost:3000', 'http://127.0.0.1:3000'], // Development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400 // 24 hours
};

/**
 * Security headers configuration
 */
const securityHeaders = {
    // Content Security Policy is handled by helmet
    contentSecurityPolicy: helmetConfig.contentSecurityPolicy,
    
    // Additional security headers
    additionalHeaders: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
    },
    
    // Cache control for sensitive endpoints
    sensitiveEndpoints: ['/api/auth', '/api/user', '/api/admin'],
    noCacheHeaders: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    }
};

/**
 * Input validation and sanitization rules
 */
const validationRules = {
    maxRequestSize: '10mb',
    maxUrlLength: 2048,
    allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxFileSize: 5 * 1024 * 1024, // 5MB
    sanitizeInput: true,
    validateContentType: true
};

/**
 * Session security configuration
 */
const sessionConfig = {
    secure: env.nodeEnv === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    rolling: true,
    resave: false,
    saveUninitialized: false
};

module.exports = {
    helmetConfig,
    rateLimitConfigs,
    corsConfig,
    securityHeaders,
    validationRules,
    sessionConfig
};