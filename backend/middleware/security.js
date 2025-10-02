// SommOS Security Middleware
// Additional security utilities and middleware functions

const { getConfig } = require('../config/env');
const { validationRules } = require('../config/security');

/**
 * Request size validation middleware
 */
function validateRequestSize(req, res, next) {
    const contentLength = parseInt(req.get('Content-Length') || '0');
    const maxSize = parseSize(validationRules.maxRequestSize);
    
    if (contentLength > maxSize) {
        return res.status(413).json({
            success: false,
            error: {
                code: 'REQUEST_TOO_LARGE',
                message: `Request size exceeds maximum allowed size of ${validationRules.maxRequestSize}`
            }
        });
    }
    
    next();
}

/**
 * URL length validation middleware
 */
function validateUrlLength(req, res, next) {
    const fullUrl = req.originalUrl || req.url;
    
    if (fullUrl.length > validationRules.maxUrlLength) {
        return res.status(414).json({
            success: false,
            error: {
                code: 'URL_TOO_LONG',
                message: `URL length exceeds maximum allowed length of ${validationRules.maxUrlLength} characters`
            }
        });
    }
    
    next();
}

/**
 * Content-Type validation middleware
 */
function validateContentType(req, res, next) {
    if (!validationRules.validateContentType) {
        return next();
    }
    
    const contentType = req.get('Content-Type');
    
    // Skip validation for GET requests and requests without body
    if (req.method === 'GET' || !contentType) {
        return next();
    }
    
    // Allow common content types
    const allowedTypes = [
        'application/json',
        'application/x-www-form-urlencoded',
        'multipart/form-data',
        'text/plain'
    ];
    
    const isValidType = allowedTypes.some(type => contentType.includes(type));
    
    if (!isValidType) {
        return res.status(415).json({
            success: false,
            error: {
                code: 'UNSUPPORTED_MEDIA_TYPE',
                message: 'Unsupported content type'
            }
        });
    }
    
    next();
}

/**
 * File upload validation middleware
 */
function validateFileUpload(req, res, next) {
    if (!req.files || Object.keys(req.files).length === 0) {
        return next();
    }
    
    const files = Array.isArray(req.files) ? req.files : Object.values(req.files);
    
    for (const file of files) {
        // Check file size
        if (file.size > validationRules.maxFileSize) {
            return res.status(413).json({
                success: false,
                error: {
                    code: 'FILE_TOO_LARGE',
                    message: `File size exceeds maximum allowed size of ${formatBytes(validationRules.maxFileSize)}`
                }
            });
        }
        
        // Check file type
        if (!validationRules.allowedFileTypes.includes(file.mimetype)) {
            return res.status(415).json({
                success: false,
                error: {
                    code: 'INVALID_FILE_TYPE',
                    message: `File type ${file.mimetype} is not allowed`
                }
            });
        }
    }
    
    next();
}

/**
 * IP whitelist middleware (for admin endpoints)
 */
function ipWhitelist(allowedIPs) {
    return (req, res, next) => {
        const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
        
        if (!allowedIPs.includes(clientIP)) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'IP_NOT_ALLOWED',
                    message: 'Access denied from this IP address'
                }
            });
        }
        
        next();
    };
}

/**
 * Request timing middleware to detect slow requests
 */
function requestTiming(maxDuration = 30000) {
    return (req, res, next) => {
        const startTime = Date.now();
        
        res.on('finish', () => {
            const duration = Date.now() - startTime;
            
            if (duration > maxDuration) {
                console.warn(`Slow request detected: ${req.method} ${req.originalUrl} took ${duration}ms`);
            }
        });
        
        next();
    };
}

/**
 * Security headers middleware for specific routes
 */
function securityHeaders(req, res, next) {
    // Add additional security headers for sensitive routes
    if (req.path.startsWith('/api/auth') || req.path.startsWith('/api/admin')) {
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    
    next();
}

/**
 * Utility function to parse size strings (e.g., "10mb" -> 10485760)
 */
function parseSize(sizeStr) {
    const units = {
        'b': 1,
        'kb': 1024,
        'mb': 1024 * 1024,
        'gb': 1024 * 1024 * 1024
    };
    
    const match = sizeStr.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
    
    if (!match) {
        return 0;
    }
    
    const value = parseFloat(match[1]);
    const unit = match[2] || 'b';
    
    return Math.floor(value * units[unit]);
}

/**
 * Utility function to format bytes
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * SQL injection prevention middleware
 */
function preventSQLInjection(req, res, next) {
    const sqlPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
        /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
        /(\b(OR|AND)\s+['"]\s*=\s*['"])/gi,
        /(\b(OR|AND)\s+['"]\s*LIKE\s*['"])/gi,
        /(\b(OR|AND)\s+['"]\s*IN\s*\()/gi
    ];
    
    const checkObject = (obj) => {
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                if (typeof obj[key] === 'string') {
                    for (const pattern of sqlPatterns) {
                        if (pattern.test(obj[key])) {
                            return false;
                        }
                    }
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    if (!checkObject(obj[key])) {
                        return false;
                    }
                }
            }
        }
        return true;
    };
    
    // Check request body, query, and params
    if (req.body && !checkObject(req.body)) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_INPUT',
                message: 'Invalid input detected'
            }
        });
    }
    
    if (req.query && !checkObject(req.query)) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_INPUT',
                message: 'Invalid input detected'
            }
        });
    }
    
    if (req.params && !checkObject(req.params)) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_INPUT',
                message: 'Invalid input detected'
            }
        });
    }
    
    next();
}

module.exports = {
    validateRequestSize,
    validateUrlLength,
    validateContentType,
    validateFileUpload,
    ipWhitelist,
    requestTiming,
    securityHeaders,
    preventSQLInjection,
    parseSize,
    formatBytes
};