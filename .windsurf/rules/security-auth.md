---
trigger: always_on
description: Security and Authentication Standards for SommOS
globs: ["backend/middleware/*.js", "backend/config/*.js", "**/*auth*.js"]
---

# Security and Authentication Rules

## Environment Variables
- Never hardcode API keys, secrets, or sensitive data in source code
- Use environment variables for all configuration
- Validate required environment variables at startup
- Use different configurations for development/production

## Authentication Patterns
- Use JWT tokens with proper expiration (15 minutes for access, 7 days for refresh)
- Store refresh tokens as HttpOnly cookies
- Implement proper session management with cleanup
- Use bcrypt for password hashing with proper salt rounds

## API Security
- Implement rate limiting for all endpoints (1000 requests per 15 minutes)
- Use CORS configuration for allowed origins
- Include security headers via Helmet middleware
- Validate and sanitize all user inputs

## Content Security Policy
```javascript
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    connectSrc: ["'self'", 'http://localhost:3001', 'http://localhost:3000'],
  },
}
```

## Input Validation
- Use Zod schemas for runtime type validation
- Sanitize all user inputs before database operations
- Validate file uploads and limit file sizes
- Prevent SQL injection with parameterized queries

## Error Handling
- Never expose sensitive system information in error messages
- Log security events for audit purposes
- Implement proper error boundaries
- Use consistent error response formats

## API Key Management
- Store OpenAI and weather API keys securely
- Implement proper key rotation procedures
- Monitor API usage and rate limits
- Use least privilege access principles

## Session Security
- Implement proper session timeout handling
- Clear sensitive data from memory after use
- Use secure cookie settings in production
- Implement CSRF protection for state-changing operations