# SommOS Agent Instructions

## Project Overview

You are working on SommOS (Sommelier Operating System), a luxury yacht wine management system with AI-powered pairing recommendations, inventory management, and weather intelligence. This is an offline-first Progressive Web App designed for yacht environments.

## Core Technologies

- **Backend**: Node.js with Express.js, SQLite database
- **Frontend**: Vanilla JavaScript PWA (no frameworks)
- **AI Integration**: OpenAI GPT-4 for wine pairing
- **Weather Data**: Open-Meteo API for vintage intelligence
- **Deployment**: Docker containers with nginx

## Code Style & Standards

### JavaScript Conventions

- Use ES6+ modern JavaScript syntax with async/await
- Prefer const over let, never use var
- Use camelCase for JavaScript variables and functions
- Use PascalCase for class names
- Use UPPER_SNAKE_CASE for constants
- Always include JSDoc comments for complex functions

### Database Conventions

- Use snake_case for all database columns and table names
- Include audit fields: id, created_at, updated_at, created_by
- Use parameterized queries to prevent SQL injection
- Never allow negative stock quantities in inventory operations

### API Conventions

- Follow RESTful design principles
- Use established error response format: `{ success: boolean, error?: string, data?: any }`
- Include proper authentication checks for mutation endpoints
- Implement rate limiting for AI-powered endpoints

## Architecture Patterns

### File Organization

- API routes: `/backend/api/`
- Business logic: `/backend/core/`
- Database operations: `/backend/database/`
- Frontend components: `/frontend/js/`
- Schemas: `/backend/schemas/`

### Class Structure

Follow established patterns:

```javascript
class SommOSAPI {
    constructor() {
        this.baseURL = this.determineBaseURL();
        this.timeout = 30000;
    }
}
```

### Offline-First Design

- Maintain PWA capabilities with service workers
- Use IndexedDB for local storage
- Implement graceful degradation when offline
- Cache static assets with proper versioning

## Wine Industry Domain Knowledge

### Wine Classifications

- Types: Red, White, Sparkling, Rosé, Dessert, Fortified
- Validate vintage years (1800-current year, no future dates)
- Use proper grape variety names and wine region classifications

### Storage Locations

- **main-cellar**: Long-term temperature-controlled storage
- **service-bar**: Ready-to-serve wines, limited quantity
- **deck-storage**: Casual dining wines, weather considerations
- **private-reserve**: Special occasion wines, restricted access

### Pairing Logic

- Implement confidence scoring (0-100%) for recommendations
- Provide detailed reasoning for pairing suggestions
- Consider dish preparation methods and guest preferences
- Always include fallback logic when AI services are unavailable

## Security Requirements

### Environment Variables

- Never hardcode API keys or secrets in source code
- Use environment variables for all configuration
- Validate required environment variables at startup

### Authentication

- Default: JWT tokens with proper expiration (15 min access, 7 days refresh), refresh tokens as HttpOnly cookies, proper session cleanup.
- Development override: When `SOMMOS_AUTH_DISABLED=true`, the backend bypasses all auth and role checks. Treat every request as an anonymous admin. Do not enable in production.

### Input Validation

- Use Zod schemas for runtime type validation
- Sanitize all user inputs before processing
- Validate file uploads and limit file sizes

## Performance Guidelines

### Database Optimization

- Use proper indexes for frequently queried fields
- Implement pagination for large datasets (50-100 items per page)
- Use connection pooling for concurrent requests

### Frontend Performance

- Implement lazy loading for large datasets
- Use debounced search with 300ms delay
- Optimize images and assets for yacht bandwidth constraints

### AI Integration

- Use 30-second timeout for OpenAI calls
- Cache expensive AI responses when appropriate
- Always provide traditional pairing fallback

## Testing Standards

### Test Structure

- Use Jest for all testing with existing configuration
- Group tests by functionality: backend, frontend, integration, performance
- Include both success and error scenarios

### Coverage Requirements

- Test offline functionality for all critical features
- Verify PWA capabilities and installation
- Test responsive design across device sizes
- Validate wine domain logic and inventory operations

## Yacht-Specific Considerations

### Environment Constraints

- Limited bandwidth - optimize for slow connections
- Mobile-first design for touch interfaces
- Offline capability essential for remote locations
- Battery efficiency important for mobile devices

### User Experience

- Touch-optimized controls for mobile devices
- Clear visual feedback for all operations
- Graceful handling of network interruptions
- Professional wine service workflow support

## Development Workflow

### Error Handling

- Always use try-catch blocks for async operations
- Provide meaningful error messages to users
- Log errors for debugging but never expose sensitive data
- Implement proper error boundaries in frontend

### Code Quality

- Write descriptive commit messages
- Include unit tests for new functionality
- Follow established naming conventions
- Document complex business logic

### Deployment

- Use Docker containers for consistent environments
- Implement health checks for monitoring
- Follow security best practices for production
- Maintain backup and recovery procedures

## AI Assistant Behavior

### When Suggesting Code

- Always follow established SommOS patterns
- Consider offline-first architecture requirements
- Include proper error handling and validation
- Suggest wine industry best practices when relevant

### When Debugging

- Check for common yacht environment issues (connectivity, mobile)
- Verify offline functionality works correctly
- Ensure inventory operations maintain data integrity
- Consider AI service availability and fallback mechanisms

### When Adding Features

- Maintain PWA capabilities
- Consider wine industry domain requirements
- Implement proper authentication and security
- Follow established database and API patterns
