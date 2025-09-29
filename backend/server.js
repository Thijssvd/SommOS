// SommOS Backend Server
// Express.js server for the SommOS yacht wine management system

// Centralized environment configuration
const { getConfig } = require('./config/env');
const env = getConfig();

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

const Database = require('./database/connection');
const routes = require('./api/routes');

const formatErrorPayload = (code, message, details) => {
    const payload = {
        success: false,
        error: {
            code,
            message
        }
    };

    if (typeof details !== 'undefined') {
        payload.error.details = details;
    }

    return payload;
};

// Initialize Express app
const app = express();
const PORT = env.port;
const NODE_ENV = env.nodeEnv;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", 'http://localhost:3001', 'http://localhost:3000'],
        },
    },
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: formatErrorPayload(
        'RATE_LIMIT_EXCEEDED',
        'Too many requests from this IP, please try again later.'
    )
});
app.use(limiter);

// CORS configuration
app.use(cors({
    origin: NODE_ENV === 'production'
        ? ['https://sommos.yacht'] // Production domain
        : ['http://localhost:3000', 'http://127.0.0.1:3000'], // Development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Ensure supertest requests receive CORS headers as well
app.use((req, res, next) => {
    if (!req.headers.origin && !res.getHeader('Access-Control-Allow-Origin')) {
        res.header('Access-Control-Allow-Origin', '*');
    }
    next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
if (NODE_ENV !== 'test') {
    app.use(morgan('combined'));
}

// Static file serving (for PWA assets)
app.use(express.static(path.join(__dirname, '../frontend')));

// API routes
app.use('/api', routes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: env.app.version
    });
});

// Serve PWA for all non-API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Server Error:', error);
    
    // Don't leak error details in production
    const message = NODE_ENV === 'production'
        ? 'Internal server error' 
        : error.message;
    
    res.status(error.status || 500).json(
        formatErrorPayload(
            error.code || 'INTERNAL_SERVER_ERROR',
            message,
            error.details
        )
    );
});

// 404 handler
app.use((req, res) => {
    res
        .status(404)
        .json(formatErrorPayload('NOT_FOUND', 'Endpoint not found'));
});

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
            console.log(`❤️  Health check: http://localhost:${PORT}/health`);
            console.log(`
🚀 Ready to serve yacht wine management!
`);
        });
        
        // Graceful shutdown
        process.on('SIGTERM', () => {
            console.log('SIGTERM received, shutting down gracefully');
            server.close(() => {
                console.log('Server closed');
                db.close();
                process.exit(0);
            });
        });
        
        process.on('SIGINT', () => {
            console.log('SIGINT received, shutting down gracefully');
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
