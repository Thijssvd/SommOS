# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

**SommOS** (Sommelier Operating System) is a luxury yacht wine management system featuring AI-powered wine pairing recommendations, comprehensive inventory management, procurement intelligence, and weather-based vintage analysis. It's built as an **offline-first Progressive Web App (PWA)** designed specifically for yacht environments with limited connectivity.

### Core Features
- **AI-Powered Wine Pairing**: DeepSeek (primary) or OpenAI (fallback) integration with traditional sommelier fallback
- **Offline-First Architecture**: Full PWA capabilities with IndexedDB and service workers
- **Weather Intelligence**: Historical weather data integration for vintage quality analysis
- **Inventory Management**: Real-time stock tracking with location-based organization
- **Learning Engine**: Adaptive recommendation system that improves with feedback
- **Procurement Assistant**: Automated supplier recommendations and order generation
- **WebSocket Support**: Real-time updates for inventory and system events

## Essential Development Commands

### Development Servers
```bash
# Run both backend and frontend concurrently (uses vanilla JS frontend)
npm run dev

# Run backend only (port 3001)
npm run dev:backend

# Run vanilla JS frontend only (port 3000, with Vite)
npm run dev:frontend
```

### Testing
```bash
# Run all tests with coverage
npm test

# Run specific test suites
npm test -- --testNamePattern="Backend API Tests"
npm test -- --testNamePattern="Auth API Tests"
npm test -- --testNamePattern="Frontend Unit Tests"

# Watch mode for development
npm test -- --watch
```

### Database Operations
```bash
# Setup database schema from scratch
npm run setup:db

# Run migrations
npm run migrate
npm run migrate:status

# Seed database with all data
npm run seed                    # Runs all seed scripts
npm run seed:lookups            # Seed lookup tables
npm run seed:users              # Seed user accounts
npm run seed:data               # Seed wine inventory data

# Import wine cellar from CSV
npm run import:cellar

# View database summary stats
npm run summary
```

### Building
```bash
# Build vanilla JS frontend for production
cd frontend && npm run build

# Note: frontend-react is an archived/incomplete React POC
# See FRONTEND_COMPARISON.md for details - not actively developed

# Build backend (runs in place, no build step needed)
npm start
```

### Production Deployment
```bash
# One-command deployment (Docker + nginx)
./deployment/deploy.sh

# Manual deployment
docker-compose -f deployment/production.yml up -d --build

# Check deployment health
curl http://localhost/api/system/health
```

### Utility Scripts
```bash
# Verify environment configuration
npm run verify:env

# Generate secure secrets for production
npm run generate:secrets

# Check API spec parity
npm run spec:parity

# Generate software bill of materials
npm run sbom:generate

# Test Open-Meteo weather integration
npm run test:weather
```

## Architecture Overview

### Backend Structure (`/backend`)

**Port**: 3001 (development), reverse proxied in production

**Directory Layout**:
- **`api/`**: Express.js route handlers and API endpoints
  - `routes.js`: Main API router with all endpoints
  - `auth.js`: Authentication endpoints (login, register, refresh)
  - `enhanced_learning_routes.js`: ML learning endpoints
  - `ml_routes.js`: Machine learning model endpoints
  - `agent_routes.js`: AI agent integration endpoints
  - `agent_tools.js`: Tool definitions for AI agents

- **`core/`**: Business logic engines and services
  - `pairing_engine.js`: AI-powered wine pairing with traditional fallback
  - `inventory_manager.js`: Stock management and ledger operations
  - `procurement_engine.js`: Purchase recommendations and supplier analysis
  - `vintage_intelligence.js`: Weather-based vintage quality scoring
  - `learning_engine.js`: Adaptive recommendation learning
  - `enhanced_learning_engine.js`: Advanced ML-based learning
  - `websocket_server.js`: Real-time WebSocket communication
  - `explainability_service.js`: Recommendation explanation generation
  - `weather_analysis.js`: Historical weather data processing
  - `wine_guidance_service.js`: Expert wine guidance system
  - Additional ML services: `collaborative_filtering_engine.js`, `ensemble_engine.js`, `ml_model_manager.js`

- **`database/`**: SQLite database layer
  - `connection.js`: Database connection singleton
  - `schema.sql`: Complete database schema definition
  - `migrate.js`: Migration runner
  - `migrations/`: Schema version migrations
  - `seed.js`, `seed-lookups.js`, `seed-users.js`: Data seeding scripts
  - `import-cellar.js`: CSV import for wine inventory
  - `summary.js`: Database statistics utility

- **`config/`**: Configuration management
  - `env.js`: Environment variable configuration with validation
  - `security.js`: Helmet, CORS, rate limiting, CSP configurations

- **`middleware/`**: Express middleware
  - `auth.js`: JWT authentication and role-based access control
  - `security.js`: Input validation, SQL injection prevention
  - `validate.js`: Zod schema validation middleware
  - `errorHandler.js`: Global error handling

- **`schemas/`**: Zod validation schemas for API requests

### Frontend Structure

**Vanilla JavaScript PWA** (`/frontend`): **Port 3000** (Vite dev server)
- **`index.html`**: Main application entry point
- **`js/`**: Application modules
  - `app.js`: Main SommOS application class (~174KB, core application logic)
  - `api.js`: SommOSAPI client with retry logic and timeout handling
  - `ui.js`: UI helper utilities and components
  - `main.js`: Application initialization
  - `modules/`: Feature-specific modules (pairing, inventory, procurement, etc.)
  - `sync.js`, `realtime-sync.js`: Offline sync and WebSocket integration
  - `performance-*.js`: Performance monitoring integration
- **`css/`**: Stylesheets for yacht-luxury theme
- **`sw.js`**: Service worker for offline functionality
- **`vite.config.js`**: Vite build configuration with code splitting

**React/TypeScript POC** (`/frontend-react`): ⚠️ **ARCHIVED** - Incomplete alternative implementation
- This is an incomplete proof-of-concept and is NOT actively developed
- Production frontend is the vanilla JavaScript PWA in `/frontend`
- See `FRONTEND_COMPARISON.md` for full details on feature parity

### Key Architectural Patterns

**Offline-First Design**:
- Service workers cache static assets and API responses
- IndexedDB for local data persistence
- Background sync for deferred operations
- Graceful degradation when offline

**AI Integration Strategy**:
- Primary: DeepSeek API (`DEEPSEEK_API_KEY`)
- Fallback: OpenAI API (`OPENAI_API_KEY`)
- Final fallback: Traditional sommelier pairing algorithm
- 30-second timeout for AI calls, 10 seconds for other APIs

**Wine Domain Modeling**:
- Normalized schema: `Wines → Vintages → Stock → Ledger`
- Vintage-specific tracking (not just wine names)
- Location-based storage: `main-cellar`, `service-bar`, `deck-storage`, `private-reserve`
- Transaction logging for audit trails

**WebSocket Real-Time Updates**:
- Server: `backend/core/websocket_server.js`
- Client: `frontend/js/realtime-sync.js`
- Events: inventory changes, pairing updates, system notifications

**Response Format Standard**:
```javascript
// Success
{ success: true, data: any, meta?: object }

// Error
{ success: false, error: { code: string, message: string, details?: any } }
```

**Security Architecture**:
- JWT authentication with 15-minute access tokens, 7-day refresh tokens
- HttpOnly cookies for refresh tokens
- Helmet for security headers, CSP for XSS protection
- Rate limiting per endpoint type (general, auth, API, WebSocket)
- Development override: `SOMMOS_AUTH_DISABLED=true` bypasses all auth (never use in production)

## Development Environment

### Port Configuration
- **Backend API**: 3001
- **Frontend (Vite dev)**: 3000
- **Frontend Preview**: 4173
- **WebSocket**: Same as backend (3001)

### Environment Setup

1. **Install dependencies**:
```bash
npm install
cd frontend && npm install
# Note: frontend-react is archived and not required
```

2. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Key environment variables**:
```bash
# Core
NODE_ENV=development
PORT=3001

# AI Integration (optional, system works without these)
DEEPSEEK_API_KEY=sk-...          # Primary AI provider
OPENAI_API_KEY=sk-...             # Fallback AI provider

# Weather Data (optional, free tier available without key)
OPEN_METEO_API_KEY=               # Leave empty for 10k req/day free tier

# Security (generate with `npm run generate:secrets`)
JWT_SECRET=your_jwt_secret_here
SESSION_SECRET=your_session_secret_here

# Development: Disable authentication (NEVER in production)
SOMMOS_AUTH_DISABLED=true         # Bypasses all auth checks
```

4. **Database setup**:
```bash
npm run setup:db
npm run seed
```

### Requirements
- **Node.js**: >= 16.0.0 (tested with v24.8.0)
- **npm**: >= 8.0.0
- **Docker**: 20.0+ (for production deployment)
- **SQLite**: Built-in with sqlite3 npm package

## Code Conventions

### JavaScript Standards
- **ES6+ syntax**: Use `async`/`await`, arrow functions, destructuring
- **Variable declarations**: `const` preferred, `let` when reassignment needed, never `var`
- **Naming**:
  - `camelCase`: JavaScript variables and functions
  - `PascalCase`: Class names
  - `UPPER_SNAKE_CASE`: Constants
  - `snake_case`: Database fields and API parameters
- **JSDoc**: Required for complex functions and all exported classes

### Database Naming
- Tables and columns: `snake_case`
- Primary keys: `id`
- Foreign keys: `{table}_id`
- Audit fields: `created_at`, `updated_at`, `created_by`
- Always use parameterized queries (no string concatenation for SQL)

### API Design Principles
- RESTful resource paths: `/api/{resource}/{action}`
- Authentication: JWT bearer tokens in Authorization header
- Rate limiting: Different limits for auth (100/15min), API (1000/15min), general endpoints
- Validation: Zod schemas in `/backend/schemas/` for all inputs
- Error codes: Uppercase snake_case (e.g., `INVALID_PIN`, `WINE_NOT_FOUND`)

### Wine Domain Specifics

**Wine Types**: `Red`, `White`, `Sparkling`, `Rosé`, `Dessert`, `Fortified`

**Storage Locations**:
- `main-cellar`: Long-term, temperature-controlled
- `service-bar`: Ready-to-serve, limited quantity
- `deck-storage`: Casual dining, weather considerations
- `private-reserve`: Special occasions, restricted access

**Vintage Years**: Validate 1800 to current year, no future dates

**Confidence Scoring**: All pairing recommendations include 0-100% confidence score with detailed reasoning

## Testing

### Test Infrastructure
- **Framework**: Jest 30.x with jsdom for frontend tests
- **Configuration**: `jest.config.js` at project root
- **Test suites**: Backend API, Auth, Frontend Unit, Integration, Performance, Security, Browser Compatibility, Sync Workflows
- **Coverage**: Reports in `coverage/` directory (HTML, LCOV, text formats)
- **Setup files**: `tests/setup-env.js`, `tests/setup.js`, `tests/frontend-setup.js`

### Running Tests
```bash
# All tests with coverage
npm test

# Specific project (e.g., Backend API Tests, Frontend Unit Tests)
npm test -- --testNamePattern="Backend"

# Watch mode for TDD
npm test -- --watch

# Coverage report only
npm test -- --coverage --coverageReporters=text
```

### Test File Locations
- Backend: `tests/backend/**/*.test.js`
- Frontend: `tests/frontend/**/*.test.js`
- Integration: `tests/integration/**/*.test.js`
- Auth: `tests/auth/**/*.test.js`
- Performance: `tests/performance/**/*.test.js`
- Security: `tests/security/**/*.test.js`

## Database

### Architecture
- **Type**: SQLite for offline-first, ACID compliance
- **File**: `data/sommos.db` (in production) or `backend/database/sommos.db` (in dev)
- **Migrations**: Versioned migrations in `backend/database/migrations/`
- **Connection**: Singleton pattern in `backend/database/connection.js`

### Core Tables
- **Wines**: Base wine information (producer, region, type, style)
- **Vintages**: Year-specific wine records linked to wines
- **Stock**: Inventory quantities by vintage and location
- **Ledger**: Transaction history for all inventory changes
- **Suppliers**: Supplier contact and performance data
- **PriceBook**: Historical pricing information
- **WeatherVintage**: Historical weather data for vintage analysis
- **Memories**: Learning engine feedback storage
- **Explainability**: Pairing recommendation explanations

### Migration System
```bash
# Apply pending migrations
npm run migrate

# Check migration status
npm run migrate:status

# Migrations are in backend/database/migrations/ with format: YYYYMMDDHHMMSS_description.sql
```

### Seed Data
- **Lookups**: Reference data (wine types, regions, grape varieties)
- **Users**: Default admin and test accounts
- **Wines**: Sample inventory from `backend/database/example_cellar.csv`

## AI Integration

### Architecture
- **Primary provider**: DeepSeek (`DEEPSEEK_API_KEY`)
- **Fallback provider**: OpenAI (`OPENAI_API_KEY`)
- **Final fallback**: Traditional pairing algorithm (no API required)
- **Timeout**: 30 seconds for AI calls, automatic fallback on timeout

### Key Files
- `backend/core/pairing_engine.js`: Main AI pairing logic with multi-tier fallback
- `backend/core/learning_engine.js`: Basic learning from user feedback
- `backend/core/enhanced_learning_engine.js`: Advanced ML-based learning
- `backend/core/wine_guidance_service.js`: Expert wine guidance system

### Graceful Degradation
System fully functional without AI keys:
1. Attempts DeepSeek if `DEEPSEEK_API_KEY` is set
2. Falls back to OpenAI if `OPENAI_API_KEY` is set
3. Falls back to traditional sommelier algorithm (always available)

## Deployment

### Docker Production
```bash
# Automated deployment script
./deployment/deploy.sh

# Manual Docker Compose
docker-compose -f deployment/production.yml up -d --build

# View logs
docker-compose -f deployment/production.yml logs -f
```

### Production Configuration
- **Files**: `deployment/production.yml`, `deployment/nginx.conf`
- **Containers**: sommos-app (Node.js), sommos-nginx (reverse proxy)
- **Volumes**: Persistent data in `/opt/sommos/data`, logs in `/opt/sommos/logs`
- **Health checks**: `GET /api/system/health` endpoint

### Nginx Configuration
- Static file serving for frontend
- API proxy to backend on port 3001
- Gzip compression enabled
- Security headers applied
- WebSocket upgrade support

## Important Files Reference

### Documentation
- `README.md`: Quick start, system overview, deployment instructions
- `PROJECT_WORKFLOW.md`: Development timeline, technical stack, API endpoints, troubleshooting
- `DEVELOPMENT_NOTEBOOK.md`: Architecture decisions, technical challenges, performance metrics
- `AGENTS.md`: Agent-specific instructions for AI assistants working on this codebase
- `DEPLOYMENT.md`: Comprehensive production deployment guide
- `SECURITY.md`: Security considerations and best practices
- `API_KEYS.md`: API key setup instructions

### Cursor AI Rules
Located in `.cursor/rules/`:
- `wine-domain.mdc`: Wine industry domain rules and business logic
- `architecture-patterns.mdc`: SommOS architecture and code organization
- `api-development.mdc`: API development standards
- `database-patterns.mdc`: Database operations and patterns
- `frontend-pwa.mdc`: PWA and frontend development
- `security-auth.mdc`: Security and authentication patterns
- `testing-quality.mdc`: Testing standards

## Development Tips

### Concurrent Frontend Options
The project has two frontend implementations:
- **Vanilla JS PWA** (primary, in `frontend/`): Lightweight, no framework, production-ready
- **React/TypeScript** (alternative, in `frontend-react/`): Modern stack, TypeScript support

Both connect to the same backend API on port 3001.

### Vite Proxy Setup
Both frontends use Vite with automatic proxy:
- Frontend runs on port 3000
- API requests to `/api/*` automatically proxy to `http://localhost:3001`
- No CORS issues in development

### Database Utilities
```bash
# Quick database stats
npm run summary

# Reset database completely
npm run setup:db && npm run seed

# Import custom wine list
npm run import:cellar
```

### Testing Specific Features
```bash
# Test weather API integration
npm run test:weather

# Verify environment configuration
npm run verify:env

# Check API endpoint parity with documentation
npm run spec:parity
```

### Common Development Scenarios

**Starting fresh**:
```bash
npm install
npm run setup:db
npm run seed
npm run dev
```

**Running with React frontend instead**:
```bash
npm run dev:backend
cd frontend-react && npm run dev
```

**Testing production build locally**:
```bash
cd frontend && npm run build && npm run preview
# OR
cd frontend-react && npm run build && npm run preview
```

**Debugging authentication issues**:
```bash
# Temporarily disable auth for development
echo "SOMMOS_AUTH_DISABLED=true" >> .env
npm run dev:backend
# REMEMBER: Remove this before committing!
```
