# SommOS Copilot Instructions

## Project Architecture
- **Frontend**: Vanilla JavaScript PWA in `frontend/` (modules in `frontend/js/`, service worker in `frontend/sw.js`, built with Vite)
- **Backend**: Node.js + Express in `backend/` (API routes in `backend/api/`, business logic in `backend/core/`, DB setup in `backend/database/`)
- **Database**: SQLite, schema and migrations in `backend/database/`, uses snake_case columns and audit fields
- **AI Integration**: DeepSeek (primary) and OpenAI (fallback) for wine pairing recommendations
- **Weather Data**: Open-Meteo API for vintage intelligence
- **Deployment**: Docker containers with nginx reverse proxy

## Key Patterns & Conventions
- **JavaScript**: ES6+, async/await, `const` preferred, camelCase for variables/functions, PascalCase for classes, UPPER_SNAKE_CASE for constants
- **API**: RESTful, error format `{ success: boolean, error?: string, data?: any }`, JWT auth (bypass with `SOMMOS_AUTH_DISABLED=true` for dev)
- **Database**: Always use parameterized queries, never allow negative stock, audit fields required
- **Wine Domain**: Validate vintage years (1800-current), use correct grape/region names, storage locations: `main-cellar`, `service-bar`, `deck-storage`, `private-reserve`
- **Pairing Logic**: Confidence scoring (0-100%), fallback if AI unavailable, detailed reasoning required
- **Offline-First**: IndexedDB for local storage, service worker for caching, graceful offline degradation

## Developer Workflows
- **Setup**: `./setup.sh` for API keys, `./deployment/deploy.sh` for deployment
- **Dev Mode**: `npm run dev` (server), `npm test` (Jest), `npm run test:e2e` (Playwright)
- **Flakiness Detection**: `npm run test:flaky` (Jest 5x), `npm run test:e2e:flaky` (Playwright 3x)
- **Guest Access**: Use `/api/auth/invite` or `./scripts/test-guest-access.sh` for event codes

## Integration Points
- **AI**: Use DeepSeek API key if present, fallback to OpenAI
- **Weather**: Open-Meteo API, free tier (no key required)
- **Frontend/Backend Sync**: WebSockets for real-time updates, background sync for offline

## Examples
- **API Route Example**: See `backend/api/agent_routes.js` for RESTful patterns
- **Class Example**: See `frontend/js/api.js` for `SommOSAPI` usage
- **Database Example**: See `backend/database/schema.sql` for table conventions

## Additional Notes
- Always follow SommOS code style and domain rules (see `AGENTS.md`)
- Document complex business logic with JSDoc
- Never hardcode secrets; use environment variables
- For full details, see `README.md` and `AGENTS.md`
