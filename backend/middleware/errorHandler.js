/**
 * SommOS Global Error Handler
 * Comprehensive error handling middleware for the SommOS yacht wine management system
 */

const { getConfig } = require('../config/env');
const { ZodError } = require('zod');

// Get environment configuration
const env = getConfig();

/**
 * Custom Error Classes for better error classification
 */
class SommOSError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
        super(message);
        this.name = 'SommOSError';
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.isOperational = true;
        this.timestamp = new Date().toISOString();
    }
}

class ValidationError extends SommOSError {
    constructor(message, details = null) {
        super(message, 400, 'VALIDATION_ERROR', details);
        this.name = 'ValidationError';
    }
}

class AuthenticationError extends SommOSError {
    constructor(message = 'Authentication failed') {
        super(message, 401, 'AUTHENTICATION_ERROR');
        this.name = 'AuthenticationError';
    }
}

class AuthorizationError extends SommOSError {
    constructor(message = 'Insufficient permissions') {
        super(message, 403, 'AUTHORIZATION_ERROR');
        this.name = 'AuthorizationError';
    }
}

class NotFoundError extends SommOSError {
    constructor(message = 'Resource not found') {
        super(message, 404, 'NOT_FOUND');
        this.name = 'NotFoundError';
    }
}

class ConflictError extends SommOSError {
    constructor(message = 'Resource conflict') {
        super(message, 409, 'CONFLICT_ERROR');
        this.name = 'ConflictError';
    }
}

class DatabaseError extends SommOSError {
    constructor(message = 'Database operation failed', originalError = null) {
        super(message, 500, 'DATABASE_ERROR');
        this.name = 'DatabaseError';
        this.originalError = originalError;
    }
}

class ExternalServiceError extends SommOSError {
    constructor(service, message = 'External service error') {
        super(`${service}: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR');
        this.name = 'ExternalServiceError';
        this.service = service;
    }
}

class RateLimitError extends SommOSError {
    constructor(message = 'Rate limit exceeded') {
        super(message, 429, 'RATE_LIMIT_ERROR');
        this.name = 'RateLimitError';
    }
}

/**
 * Error classification and mapping
 */
const ERROR_MAPPINGS = {
    // Database errors
    'SQLITE_ERROR': { status: 500, code: 'DATABASE_ERROR' },
    'SQLITE_CONSTRAINT': { status: 409, code: 'CONFLICT_ERROR' },
    'SQLITE_BUSY': { status: 503, code: 'DATABASE_BUSY' },
    'SQLITE_LOCKED': { status: 503, code: 'DATABASE_LOCKED' },
    
    // Validation errors
    'ValidationError': { status: 400, code: 'VALIDATION_ERROR' },
    'ZodError': { status: 400, code: 'VALIDATION_ERROR' },
    
    // Authentication/Authorization errors
    'JsonWebTokenError': { status: 401, code: 'AUTHENTICATION_ERROR' },
    'TokenExpiredError': { status: 401, code: 'AUTHENTICATION_ERROR' },
    'NotBeforeError': { status: 401, code: 'AUTHENTICATION_ERROR' },
    
    // Network/External service errors
    'ECONNREFUSED': { status: 502, code: 'SERVICE_UNAVAILABLE' },
    'ETIMEDOUT': { status: 504, code: 'SERVICE_TIMEOUT' },
    'ENOTFOUND': { status: 502, code: 'SERVICE_NOT_FOUND' },
    
    // File system errors
    'ENOENT': { status: 404, code: 'FILE_NOT_FOUND' },
    'EACCES': { status: 403, code: 'ACCESS_DENIED' },
    'EMFILE': { status: 503, code: 'TOO_MANY_FILES' },
    
    // Memory/Resource errors
    'ENOMEM': { status: 507, code: 'INSUFFICIENT_STORAGE' },
    'EMFILE': { status: 503, code: 'TOO_MANY_FILES' },
};

/**
 * Enhanced error logging with structured data
 */
function logError(error, req, additionalContext = {}) {
    const errorLog = {
        timestamp: new Date().toISOString(),
        level: 'error',
        message: error.message,
        name: error.name,
        code: error.code || 'UNKNOWN_ERROR',
        statusCode: error.statusCode || 500,
        stack: error.stack,
        request: {
            method: req.method,
            url: req.originalUrl || req.url,
            userAgent: req.get('User-Agent'),
            ip: req.ip || req.connection?.remoteAddress,
            userId: req.user?.id,
            sessionId: req.sessionID,
        },
        context: {
            ...additionalContext,
            environment: env.nodeEnv,
            version: env.app?.version,
        }
    };

    // In production, use structured logging
    if (env.nodeEnv === 'production') {
        console.error(JSON.stringify(errorLog));
        // Note: For production deployments, consider integrating with external logging services
        // such as Sentry, LogRocket, or Datadog for advanced error tracking and monitoring.
    } else if (env.nodeEnv !== 'test') {
        // In development, use more readable format (skip in test environment)
        console.error('\n🚨 ERROR OCCURRED:');
        console.error(`   Message: ${error.message}`);
        console.error(`   Type: ${error.name}`);
        console.error(`   Code: ${error.code || 'UNKNOWN'}`);
        console.error(`   Status: ${error.statusCode || 500}`);
        console.error(`   URL: ${req.method} ${req.originalUrl || req.url}`);
        console.error(`   User: ${req.user?.id || 'Anonymous'}`);
        console.error(`   Stack: ${error.stack}\n`);
    }
}

/**
 * Format error response for client
 */
function formatErrorResponse(error, req) {
    const isDevelopment = env.nodeEnv === 'development';
    const isTest = env.nodeEnv === 'test';
    
    const response = {
        success: false,
        error: {
            code: error.code || 'INTERNAL_SERVER_ERROR',
            message: error.message || 'An unexpected error occurred',
            timestamp: error.timestamp || new Date().toISOString(),
        }
    };

    // Add details in development/test environments
    if (isDevelopment || isTest) {
        response.error.details = error.details;
        response.error.stack = error.stack;
        response.error.name = error.name;
    }

    // Add request ID for tracking (if available)
    if (req.requestId) {
        response.error.requestId = req.requestId;
    }

    return response;
}

/**
 * Handle specific error types
 */
function handleSpecificErrors(error) {
    // Handle Zod validation errors
    if (error instanceof ZodError) {
        const details = error.issues.map(issue => ({
            path: issue.path.length ? issue.path.join('.') : null,
            message: issue.message,
            code: issue.code,
        }));

        return new ValidationError(
            'Request validation failed',
            details
        );
    }

    // Handle database constraint errors
    if (error.code === 'SQLITE_CONSTRAINT') {
        return new ConflictError(
            'Database constraint violation',
            { constraint: error.message }
        );
    }

    // Handle JWT errors
    if (error.name === 'JsonWebTokenError') {
        return new AuthenticationError('Invalid authentication token');
    }

    if (error.name === 'TokenExpiredError') {
        return new AuthenticationError('Authentication token has expired');
    }

    // Handle network errors
    if (error.code === 'ECONNREFUSED') {
        return new ExternalServiceError('External Service', 'Connection refused');
    }

    if (error.code === 'ETIMEDOUT') {
        return new ExternalServiceError('External Service', 'Request timeout');
    }

    return null;
}

/**
 * Main error handler middleware
 */
const errorHandler = (err, req, res, next) => {
    let error = err;

    // Handle specific error types
    const specificError = handleSpecificErrors(err);
    if (specificError) {
        error = specificError;
    }

    // Apply error mappings for known error codes
    const mapping = ERROR_MAPPINGS[error.name] || ERROR_MAPPINGS[error.code];
    if (mapping && !error.isOperational) {
        error.statusCode = mapping.status;
        error.code = mapping.code;
    }

    // Ensure we have a status code
    if (!error.statusCode) {
        error.statusCode = 500;
    }

    // Ensure we have an error code
    if (!error.code) {
        error.code = 'INTERNAL_SERVER_ERROR';
    }

    // Log the error
    logError(error, req, {
        originalError: err.name !== error.name ? err : null,
        isOperational: error.isOperational,
    });

    // Format and send response
    const response = formatErrorResponse(error, req);
    res.status(error.statusCode).json(response);
};

/**
 * 404 handler for unmatched routes
 */
const notFoundHandler = (req, res) => {
    const error = new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`);
    
    logError(error, req, { type: '404_NOT_FOUND' });
    
    const response = formatErrorResponse(error, req);
    res.status(404).json(response);
};

/**
 * Async error wrapper (alternative to asyncHandler)
 */
const asyncErrorHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Utility function to create standardized errors
 */
const createError = {
    validation: (message, details) => new ValidationError(message, details),
    authentication: (message) => new AuthenticationError(message),
    authorization: (message) => new AuthorizationError(message),
    notFound: (message) => new NotFoundError(message),
    conflict: (message) => new ConflictError(message),
    database: (message, originalError) => new DatabaseError(message, originalError),
    externalService: (service, message) => new ExternalServiceError(service, message),
    rateLimit: (message) => new RateLimitError(message),
    custom: (message, statusCode, code, details) => new SommOSError(message, statusCode, code, details),
};

module.exports = {
    errorHandler,
    notFoundHandler,
    asyncErrorHandler,
    createError,
    // Export error classes for use in other modules
    SommOSError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    DatabaseError,
    ExternalServiceError,
    RateLimitError,
};