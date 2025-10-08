---
trigger: always_on
description: API Development Standards for SommOS Backend
globs: ["backend/api/*.js", "backend/core/*.js"]
---

# API Development Rules

## Authentication & Security
- All mutation endpoints must include JWT authentication checks
- Use the established auth middleware: `requireAuth`
- Implement proper rate limiting for AI-powered endpoints
- Never expose sensitive data in error messages

## Request Validation
- Validate all inputs using the schemas in `/backend/schemas/`
- Use Zod for runtime type validation
- Return 400 Bad Request for validation failures
- Sanitize all user inputs before processing

## Response Patterns
Success responses:
```javascript
res.json({
  success: true,
  data: result,
  meta: { pagination, timestamps, etc. }
});
```

Error responses:
```javascript
res.status(statusCode).json({
  success: false,
  error: {
    code: 'ERROR_CODE',
    message: 'Human readable message'
  }
});
```

## Database Operations
- Use parameterized queries to prevent SQL injection
- Implement proper transaction handling for inventory operations
- Include audit fields: created_at, updated_at, created_by
- Never allow operations that would create negative stock

## AI Integration Patterns
- Always implement fallback logic for AI service failures
- Use proper timeout handling (30 seconds for OpenAI calls)
- Cache expensive AI responses when appropriate
- Include confidence scores in AI-generated recommendations

## Wine Pairing Endpoints
- Implement both `/pairing/recommend` (full AI) and `/pairing/quick` (fallback)
- Include learning session IDs for recommendation tracking
- Support both string and structured dish inputs
- Return wine availability and location information