// SommOS Backend Server
// Express.js server for the SommOS yacht wine management system

// Centralized environment configuration
const { getConfig } = require('./config/env');
const env = getConfig();

// Security configuration
const { 
    helmetConfig, 
    rateLimitConfigs, 
    corsConfig, 
    securityHeaders: securityConfig 
} = require('./config/security');

const REQUIRED_SECRETS = ['SESSION_SECRET', 'JWT_SECRET'];

function ensureRequiredSecrets(config) {
    const secretValues = {
        SESSION_SECRET: config.auth.sessionSecret,
        JWT_SECRET: config.auth.jwtSecret,
    };

    const missing = REQUIRED_SECRETS.filter((key) => !secretValues[key]);

    if (missing.length === 0) {
        console.log('🔐 Required secrets verified');
        return true;
    }

    if (config.isProduction) {
        console.error('❌ Missing required secrets.');
        missing.forEach((secret) => {
            console.error(`   - ${secret} is not set`);
        });
        console.error('Please set the missing secrets before starting the server.');
        console.error('Hint: run `npm run generate:secrets` and update your environment file.');

        process.exit(1);
    }

    console.warn('⚠️  Missing secrets detected (non-production environment).');
    missing.forEach((secret) => {
        console.warn(`   - ${secret} is not set`);
    });
    console.warn('The server will continue starting for local development, but secure cookies and tokens will be disabled.');

    return false;
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const cookieParser = require('cookie-parser');

const Database = require('./database/connection');
const routes = require('./api/routes');
const SommOSWebSocketServer = require('./core/websocket_server');
const { 
    validateRequestSize, 
    validateUrlLength, 
    validateContentType,
    requestTiming,
    securityHeaders,
    preventSQLInjection
} = require('./middleware/security');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Initialize Express app
const app = express();
const PORT = env.port;
const NODE_ENV = env.nodeEnv;

// Trust first proxy (nginx) for rate limiting and client IP detection
app.set('trust proxy', 1);

// Apply enhanced security middleware
app.use(helmet(helmetConfig));

// Additional security middleware
app.use((req, res, next) => {
    // Remove X-Powered-By header (redundant with helmet but extra safety)
    res.removeHeader('X-Powered-By');
    
    // Add additional security headers
    Object.entries(securityConfig.additionalHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
    });
    
    // Add cache control for sensitive endpoints
    if (securityConfig.sensitiveEndpoints.some(endpoint => req.path.startsWith(endpoint))) {
        Object.entries(securityConfig.noCacheHeaders).forEach(([key, value]) => {
            res.setHeader(key, value);
        });
    }
    
    next();
});

// Enhanced rate limiting with different limits for different endpoints
const generalLimiter = rateLimit({
    ...rateLimitConfigs.general,
    handler: (req, res) => {
        res.status(429).json(rateLimitConfigs.general.message);
    }
});

const authLimiter = rateLimit(rateLimitConfigs.auth);
const apiLimiter = rateLimit(rateLimitConfigs.api);
const websocketLimiter = rateLimit(rateLimitConfigs.websocket);

app.use(generalLimiter);

// Additional security middleware
app.use(validateRequestSize);
app.use(validateUrlLength);
app.use(validateContentType);
app.use(requestTiming(30000)); // 30 second timeout
app.use(securityHeaders);
app.use(preventSQLInjection);

// CORS configuration
app.use(cors(corsConfig));

// Ensure supertest requests receive CORS headers as well
app.use((req, res, next) => {
    if (!req.headers.origin && !res.getHeader('Access-Control-Allow-Origin')) {
        res.header('Access-Control-Allow-Origin', '*');
    }
    next();
});

// Enhanced body parsing middleware with security limits
const { validationRules } = require('./config/security');

// Input sanitization function
function sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }

    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            if (typeof obj[key] === 'string') {
                // Remove potentially dangerous characters
                obj[key] = obj[key]
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/javascript:/gi, '')
                    .replace(/on\w+\s*=/gi, '')
                    .trim();
            } else if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                sanitizeObject(obj[key]);
            }
        }
    }
    return obj;
}

app.use(express.json({ 
    limit: validationRules.maxRequestSize,
    verify: (req, res, buf) => {
        // Basic JSON validation
        try {
            JSON.parse(buf);
        } catch (e) {
            throw new Error('Invalid JSON payload');
        }
    }
}));

app.use(express.urlencoded({ 
    extended: true, 
    limit: validationRules.maxRequestSize,
    parameterLimit: 1000 // Limit number of parameters
}));

// Input sanitization middleware
app.use((req, res, next) => {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
        sanitizeObject(req.body);
    }
    
    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
        sanitizeObject(req.query);
    }
    
    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
        sanitizeObject(req.params);
    }
    
    next();
});

// Cookie parsing middleware for auth tokens
app.use(cookieParser(env.auth.sessionSecret || undefined));

// Compression middleware
app.use(compression());

// Logging middleware
if (NODE_ENV !== 'test') {
    app.use(morgan('combined'));
}

// Static file serving (for PWA assets)
// In production, serve from dist directory
const frontendPath = NODE_ENV === 'production' 
    ? path.join(__dirname, '../frontend/dist')
    : path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// Apply specific rate limiters to API routes
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);
// Versioned API rate limiters
app.use('/api/v1', apiLimiter);
app.use('/api/v1/auth', authLimiter);

// API routes
app.use('/api', routes);
// Versioned API routes (v1)
app.use('/api/v1', routes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: env.app.version
    });
});

// API documentation (Swagger UI via Redoc) served at /docs
app.get('/docs', (req, res) => {
    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>SommOS API Docs</title>
    <style>
      body { margin: 0; padding: 0; }
      redoc { height: 100vh; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/redoc@next/bundles/redoc.standalone.min.js"></script>
  </head>
  <body>
    <redoc spec-url="/api/system/spec"></redoc>
  </body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
});

// Serve PWA for all non-API routes
app.use((req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
        return next();
    }
    const indexPath = NODE_ENV === 'production'
        ? path.join(__dirname, '../frontend/dist/index.html')
        : path.join(__dirname, '../frontend/index.html');
    res.sendFile(indexPath);
});

// Global error handler
app.use(errorHandler);

// 404 handler
app.use(notFoundHandler);

// Initialize database and start server
async function startServer() {
    try {
        ensureRequiredSecrets(env);

        // Initialize database
        console.log('Initializing database...');
        const db = Database.getInstance();
        await db.initialize();
        console.log('Database initialized successfully');
        
        // Start server
        const server = app.listen(PORT, () => {
            console.log(`
🍷 SommOS Server running on port ${PORT}`);
            console.log(`📱 PWA available at: http://localhost:${PORT}`);
            console.log(`🔌 API available at: http://localhost:${PORT}/api`);
            console.log(`🔌 API v1 available at: http://localhost:${PORT}/api/v1`);
            console.log(`📘 API docs: http://localhost:${PORT}/docs`);
            console.log(`🔌 WebSocket available at: ws://localhost:${PORT}/api/ws`);
            console.log(`❤️  Health check: http://localhost:${PORT}/health`);
            console.log(`
🚀 Ready to serve yacht wine management!
`);
        });

        // Initialize WebSocket server
        const wsServer = new SommOSWebSocketServer(server);
        
        // Make WebSocket server available globally for broadcasting
        app.locals.wsServer = wsServer;
        
        // Graceful shutdown
        process.on('SIGTERM', () => {
            console.log('SIGTERM received, shutting down gracefully');
            wsServer.close();
            server.close(() => {
                console.log('Server closed');
                db.close();
                process.exit(0);
            });
        });
        
        process.on('SIGINT', () => {
            console.log('SIGINT received, shutting down gracefully');
            wsServer.close();
            server.close(() => {
                console.log('Server closed');
                db.close();
                process.exit(0);
            });
        });
        
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
if (require.main === module) {
    startServer();
}

module.exports = app;
