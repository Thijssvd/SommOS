# SommOS: Main Context Document (MCD)

## Yacht Sommelier Operating System

**Document Version**: 1.0  
**Created**: October 5, 2025  
**Project Location**: `/Users/thijs/Documents/SommOS`  
**Development Status**: Production-Ready PWA with Docker Deployment

---

## 1. 🎯 Overview & Goals

### Project Vision

SommOS is an **offline-first Progressive Web App (PWA)** designed specifically for **luxury yacht wine management**. It combines enterprise-grade inventory tracking with AI-powered wine intelligence, creating a sommelier assistant that works seamlessly in maritime environments with intermittent internet connectivity.

### Target Users

1. **Yacht Crew (Primary)**:
   - Sommeliers and stewards managing wine collections at sea
   - Require offline-first functionality
   - Need quick pairing recommendations for guest meals
   - Manage multi-location inventory (cellars, service bars, cabins)

2. **Yacht Administrators**:
   - Fleet managers overseeing multiple vessels
   - Procurement officers making purchase decisions
   - Compliance officers tracking inventory and consumption

3. **Event Guests (Secondary)**:
   - Temporary read-only access for wine tastings
   - Browse collection without full system access
   - Event-code based authentication

### Core Features (Priority Order)

1. **Offline-First Wine Inventory Management** - Complete CRUD with real-time sync
2. **AI-Powered Wine Pairing** - 4-line recommendations using DeepSeek/OpenAI
3. **Vintage Intelligence** - Weather-based quality scoring and aging analysis
4. **Procurement Assistant** - Automated buying recommendations with ROI analysis
5. **Guest Access System** - Temporary event codes for wine tasting events
6. **PWA Installation** - Native-like app experience on iOS/Android/Desktop

### Success Criteria

- ✅ Works offline for minimum 72 hours without internet
- ✅ Responds within 2 seconds for all core inventory operations
- ✅ AI pairing recommendations delivered in <10 seconds
- ✅ Zero data loss during network transitions
- ✅ Installable on mobile devices as standalone app
- ✅ Pass 600+ automated tests (Jest + Playwright)
- ✅ Docker-deployable for yacht network environments

### Business Context

SommOS addresses the unique challenge of wine management in maritime environments where:

- Internet connectivity is expensive, slow, or unavailable
- Wine collections are valuable and require precise tracking
- Service staff need instant access to pairing recommendations
- Multiple storage locations require careful inventory management
- Regulatory compliance demands complete audit trails

---

## 2. 🏗️ Technical Architecture

### Stack Overview

```
Frontend (PWA)
├── Vanilla JavaScript (ES6+)
├── Vite 6.0 (build tool)
├── Service Worker (sw.js) for offline support
├── IndexedDB for local data persistence
└── Progressive Enhancement patterns

Backend (Node.js API)
├── Express.js 4.x
├── SQLite3 (offline-first database)
├── WebSocket (real-time sync)
├── JWT authentication
└── DeepSeek AI (primary) / OpenAI (fallback)

Deployment
├── Docker + Docker Compose
├── Nginx reverse proxy
├── Multi-stage builds for optimization
└── Production-ready with health monitoring
```

### Technology Justifications

#### Why Vanilla JavaScript (not React/Vue)?

- **Smaller bundle size** (~200KB vs 1MB+) critical for slow yacht networks
- **Faster initial load** - no framework parsing overhead
- **Offline-first reliability** - fewer dependencies to cache
- **Progressive enhancement** - works with degraded networks
- **Team familiarity** - simpler for crew with basic dev knowledge

#### Why SQLite (not PostgreSQL/MySQL)?

- **Zero-conf deployment** - no database server to manage
- **Atomic writes** - ACID compliance prevents corruption during power loss
- **Single-file portability** - easy backups for yacht administrators
- **Offline-first architecture** - perfect for embedded systems
- **Low memory footprint** - runs on yacht servers with limited resources

#### Why DeepSeek AI?

- **Cost-effective** - 90% cheaper than OpenAI for equivalent quality
- **Fast inference** - <2s response times for pairing recommendations
- **OpenAI-compatible API** - seamless fallback if DeepSeek unavailable
- **Privacy-friendly** - can self-host if needed for sensitive data

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                   FRONTEND (PWA)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │  Service     │  │   IndexedDB   │  │  UI Layer│ │
│  │  Worker      │  │  (Offline DB) │  │  (Vanilla│ │
│  │  (sw.js)     │  │               │  │   JS)    │ │
│  └──────────────┘  └──────────────┘  └──────────┘ │
└───────────────┬─────────────────────────────────────┘
                │ HTTP/WebSocket
┌───────────────▼─────────────────────────────────────┐
│              BACKEND (Node.js/Express)               │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌──────────┐│
│  │   Auth   │ │ Inventory│ │ Pairing│ │Procurement││
│  │  Routes  │ │  Manager │ │ Engine │ │  Engine  ││
│  └──────────┘ └──────────┘ └────────┘ └──────────┘│
└───────────────┬─────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────┐
│         DATA LAYER (SQLite + External APIs)         │
│  ┌──────────────┐  ┌──────────┐  ┌───────────────┐│
│  │  sommos.db   │  │ DeepSeek │  │  Open-Meteo  ││
│  │  (12 tables) │  │    API   │  │ (Weather API) ││
│  └──────────────┘  └──────────┘  └───────────────┘│
└─────────────────────────────────────────────────────┘
```

### Infrastructure

- **Docker Containers**: `sommos-frontend`, `sommos-backend`, `nginx-proxy`
- **Network**: `sommos-network` (internal bridge)
- **Volumes**: `./data` (SQLite DB), `./frontend/dist` (static assets)
- **Ports**: 80 (HTTP), 3001 (backend API), 3000 (frontend dev)

### External Services

1. **DeepSeek AI** (Primary) - `https://api.deepseek.com`
   - Wine pairing recommendations
   - Natural language dish parsing
   - Confidence scoring for recommendations

2. **OpenAI** (Fallback) - `https://api.openai.com`
   - Automatic failover if DeepSeek unavailable
   - Same API compatibility

3. **Open-Meteo** (FREE) - `https://archive-api.open-meteo.com`
   - Historical weather data for vintage analysis
   - Temperature, precipitation, sunshine hours
   - 10,000 requests/day free tier

---

## 3. 📋 Detailed Implementation

### 3.1 Database Schema (SQLite)

#### Core Tables (15+ total)

**Wines** (wine labels and basic information)

```sql
CREATE TABLE Wines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    producer TEXT NOT NULL,
    region TEXT NOT NULL,
    country TEXT NOT NULL,
    wine_type TEXT NOT NULL CHECK (wine_type IN ('Red', 'White', 'Rosé', 'Sparkling', 'Dessert', 'Fortified')),
    grape_varieties TEXT NOT NULL, -- JSON array of grape varieties
    alcohol_content REAL,
    style TEXT, -- Light, Medium, Full-bodied, etc.
    tasting_notes TEXT,
    food_pairings TEXT, -- JSON array of pairing suggestions
    serving_temp_min INTEGER,
    serving_temp_max INTEGER,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_by TEXT DEFAULT 'system',
    op_id TEXT UNIQUE,
    origin TEXT DEFAULT 'server'
);
```

**Vintages** (specific years and quality data)

```sql
CREATE TABLE Vintages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wine_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    harvest_date DATE,
    bottling_date DATE,
    release_date DATE,
    peak_drinking_start INTEGER, -- Years from vintage
    peak_drinking_end INTEGER, -- Years from vintage
    quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
    weather_score INTEGER CHECK (weather_score >= 0 AND weather_score <= 100),
    critic_score INTEGER CHECK (critic_score >= 0 AND critic_score <= 100),
    production_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_by TEXT DEFAULT 'system',
    op_id TEXT UNIQUE,
    origin TEXT DEFAULT 'server',
    FOREIGN KEY (wine_id) REFERENCES Wines(id) ON DELETE RESTRICT,
    UNIQUE(wine_id, year)
);
```

**Stock** (bottle inventory by location)

```sql
CREATE TABLE Stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vintage_id INTEGER NOT NULL,
    location TEXT NOT NULL, -- Standard locations: main-cellar, service-bar, deck-storage, private-reserve
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
    cost_per_bottle DECIMAL(10,2),
    current_value DECIMAL(10,2),
    storage_conditions TEXT, -- JSON: temperature, humidity, etc.
    last_inventory_date DATE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_by TEXT DEFAULT 'system',
    op_id TEXT UNIQUE,
    origin TEXT DEFAULT 'server',
    FOREIGN KEY (vintage_id) REFERENCES Vintages(id) ON DELETE RESTRICT,
    UNIQUE(vintage_id, location)
);
```

**Ledger** (transaction history for audit trail)

```sql
CREATE TABLE Ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vintage_id INTEGER NOT NULL,
    location TEXT NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('IN', 'OUT', 'MOVE', 'ADJUST', 'RESERVE', 'UNRESERVE')),
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    unit_cost DECIMAL(10,2),
    total_cost DECIMAL(10,2),
    reference_id TEXT, -- Order ID, invoice number, etc.
    notes TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vintage_id) REFERENCES Vintages(id) ON DELETE RESTRICT
);
```

**WeatherVintage** (historical weather impact)

```sql
CREATE TABLE WeatherVintage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    region TEXT NOT NULL,
    year INTEGER NOT NULL,
    growing_season_temp_avg REAL,
    growing_season_rainfall REAL,
    harvest_conditions TEXT,
    weather_events TEXT, -- JSON array of significant events
    quality_impact_score INTEGER CHECK (quality_impact_score >= -50 AND quality_impact_score <= 50),
    vintage_rating TEXT CHECK (vintage_rating IN ('Exceptional', 'Excellent', 'Very Good', 'Good', 'Average', 'Below Average', 'Poor')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(region, year)
);
```

**Users** (authentication and roles)

```sql
CREATE TABLE Users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'crew', 'guest')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);
```

**Additional Core Tables**: Suppliers, PriceBook, Aliases, RegionCalendar, GrapeProfiles, Memories, Explainability, LearningPairingSessions, LearningConsumptionEvents, InventoryIntakeOrders, InventoryIntakeItems

*Advanced Tables*: WeatherCache, WineFeatures, DishFeatures, RefreshTokens, Invites, RumSessions, RumMetrics, RumErrors

### 3.2 API Endpoints (RESTful)

#### Authentication (`/api/auth`)

```javascript
POST /api/auth/login
  Body: { email, password }
  Returns: { token, user: { id, email, name, role } }

POST /api/auth/guest
  Body: { event_code, pin? }
  Returns: { token, expires_at }

POST /api/auth/invite
  Auth: Required (admin/crew)
  Body: { email, role, expires_in_hours }
  Returns: { event_code, pin?, expires_at }

POST /api/auth/logout
  Auth: Required
  Returns: { success: true }
```

#### Inventory (`/api/inventory`)

```javascript
GET /api/inventory/stock
  Query: ?location=string&wine_type=string&min_quantity=number
  Returns: { stocks: Stock[], total: number }

POST /api/inventory/consume
  Auth: Required (admin/crew)
  Body: { vintage_id, quantity, location, guest_name?, occasion? }
  Returns: { stock: Stock, ledger_id: number }

POST /api/inventory/reserve
  Body: { vintage_id, quantity, location, guest_name, occasion }
  Returns: { reservation_id: number, expires_at: datetime }

POST /api/inventory/move
  Body: { vintage_id, quantity, from_location, to_location }
  Returns: { from_stock: Stock, to_stock: Stock }

GET /api/inventory/transactions
  Query: ?vintage_id=number&start_date=string&end_date=string
  Returns: { transactions: Ledger[], total: number }
```

#### Wine Pairing (`/api/pairing`)

```javascript
POST /api/pairing/recommend
  Body: { 
    dish: string,
    context: { occasion, guest_count, budget?, preferences? }
  }
  Returns: {
    recommendations: [
      { wine_id, vintage_id, label, confidence, reasoning, pairing_notes },
      ...
    ],
    ai_model: "deepseek-chat" | "gpt-4",
    response_time_ms: number
  }

POST /api/pairing/quick
  Body: { dish: string }
  Returns: { top_pick: Wine, alternatives: Wine[] }
```

#### Procurement (`/api/procurement`)

```javascript
GET /api/procurement/opportunities
  Query: ?wine_type=string&max_price=number&region=string
  Returns: { 
    opportunities: [
      { wine_id, reason, urgency, estimated_cost, roi_analysis },
      ...
    ]
  }

POST /api/procurement/analyze
  Body: { wine_id, vintage_year, quantity, price_per_bottle }
  Returns: {
    recommendation: "buy" | "wait" | "skip",
    confidence: number,
    factors: { quality_score, price_trend, aging_potential, ... },
    break_even_analysis: { months_to_peak, potential_value, ... }
  }

POST /api/procurement/order
  Auth: Required (admin)
  Body: { supplier_id, items: [{ wine_id, vintage_year, quantity }] }
  Returns: { order_id, estimated_total, delivery_estimate }
```

#### Vintage Intelligence (`/api/vintage`)

```javascript
GET /api/vintage/:wine_id/:year/weather
  Returns: {
    weather: WeatherVintage,
    quality_factors: { temperature, precipitation, sunshine },
    comparison_to_avg: { temp_delta, precip_delta, ... },
    aging_recommendation: string
  }

POST /api/vintage/:wine_id/:year/refresh
  Auth: Required (admin/crew)
  Returns: { weather: WeatherVintage, fetched_from_api: boolean }
```

#### System (`/api/system`)

```javascript
GET /api/system/health
  Returns: {
    status: "healthy" | "degraded" | "down",
    database: { connected: boolean, tables: number },
    ai_provider: { primary: string, available: boolean },
    uptime_seconds: number
  }

GET /api/system/stats
  Auth: Required (admin)
  Returns: {
    wines: number,
    vintages: number,
    bottles: number,
    users: number,
    transactions_last_30d: number
  }
```

### 3.3 Frontend Components (Modular Architecture)

#### Core Modules (`frontend/js/`)

```
app.js                 # Main application orchestrator
├── init()             # Initialize PWA, register service worker
├── loadUser()         # Check authentication state
├── setupRouter()      # Client-side routing
└── syncData()         # Background sync with backend

api.js                 # API client with offline queue
├── class SommOSAPI
│   ├── baseURL        # Auto-detect dev/prod
│   ├── token          # JWT storage
│   ├── fetch()        # Enhanced fetch with retry
│   └── queueOffline() # Store requests for later sync

ui.js                  # UI helpers and utilities
├── showLoading()      # Loading overlays
├── showToast()        # Notification system
├── formatCurrency()   # Display helpers
└── renderWineCard()   # Component rendering

modules/
├── auth.js            # Authentication logic
│   ├── login()
│   ├── guestLogin()
│   └── validateSession()
│
├── inventory.js       # Inventory management
│   ├── loadStock()
│   ├── consumeBottle()
│   ├── reserveWine()
│   └── moveBottle()
│
├── pairing.js         # Wine pairing interface
│   ├── searchDish()
│   ├── displayRecommendations()
│   └── saveFavorites()
│
├── procurement.js     # Procurement assistant
│   ├── scanOpportunities()
│   ├── analyzePurchase()
│   └── generateOrder()
│
└── vintage.js         # Vintage intelligence
    ├── loadWeatherData()
    ├── displayQualityScore()
    └── showAgingCurve()
```

#### Service Worker (`sw.js`)

```javascript
const CACHE_VERSION = 'v1.2.0';
const STATIC_CACHE = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/api.js',
  '/js/ui.js',
  // ... all modules
];

// Install: Cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(STATIC_CACHE))
  );
});

// Fetch: Network first, fall back to cache
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});

// Sync: Background data sync when online
self.addEventListener('sync', event => {
  if (event.tag === 'sync-inventory') {
    event.waitUntil(syncOfflineQueue());
  }
});
```

---

## 4. 📁 File Structure & Organization

```
SommOS/
├── .agent/                     # Agent-MCP state (git-ignored)
│   ├── config.json            # MCP configuration
│   ├── logs/                  # Agent activity logs
│   └── mcp_state.db           # Agent knowledge graph
│
├── .github/                    # CI/CD workflows
│   └── workflows/
│       ├── tests.yml          # Jest unit tests
│       ├── ci.yml             # Full CI pipeline
│       └── deploy.yml         # Deployment workflow
│
├── backend/                    # Node.js API server
│   ├── server.js              # Express app entry point
│   ├── api/                   # Route handlers
│   │   ├── auth.js            # Authentication routes
│   │   ├── inventory.js       # Inventory CRUD
│   │   ├── pairing.js         # AI pairing engine
│   │   ├── procurement.js     # Procurement routes
│   │   ├── vintage.js         # Vintage intelligence
│   │   └── system.js          # Health and stats
│   ├── core/                  # Business logic (engines)
│   │   ├── pairing_engine.js  # AI wine matching
│   │   ├── inventory_manager.js # Stock calculations
│   │   ├── procurement_engine.js # Buy recommendations
│   │   └── vintage_intelligence.js # Weather analysis
│   ├── database/              # Schema & migrations
│   │   ├── connection.js      # SQLite client
│   │   ├── schema.sql         # Table definitions
│   │   ├── migrations/        # Schema changes
│   │   ├── seed.js            # Test data generator
│   │   └── import.js          # CSV import tools
│   └── config/                # Environment & security
│       ├── env.js             # Environment variables
│       └── security.js        # Helmet, CORS, rate limiting
│
├── frontend/                   # PWA (Vite + Vanilla JS)
│   ├── index.html             # Single-page app shell
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service worker
│   ├── js/                    # Application code
│   │   ├── app.js             # Main orchestrator
│   │   ├── api.js             # API client
│   │   ├── ui.js              # UI utilities
│   │   └── modules/           # Feature modules
│   │       ├── auth.js
│   │       ├── inventory.js
│   │       ├── pairing.js
│   │       ├── procurement.js
│   │       └── vintage.js
│   ├── css/                   # Stylesheets
│   │   └── styles.css         # Yacht-luxury theme
│   ├── assets/                # Images, icons, fonts
│   ├── vite.config.js         # Build configuration
│   └── package.json           # Frontend dependencies
│
├── data/                       # Runtime database (git-ignored)
│   └── sommos.db              # SQLite database file
│
├── deployment/                 # Docker & deployment
│   ├── production.yml         # Docker Compose config
│   ├── deploy.sh              # One-click deployment
│   ├── Dockerfile.frontend    # Frontend container
│   ├── Dockerfile.backend     # Backend container
│   └── nginx.conf             # Reverse proxy config
│
├── tests/                      # Test suites
│   ├── unit/                  # Jest unit tests
│   │   ├── backend/           # Backend tests
│   │   └── frontend/          # Frontend tests
│   ├── integration/           # API integration tests
│   └── e2e/                   # Playwright E2E tests
│       ├── auth.spec.js
│       ├── inventory.spec.js
│       └── pairing.spec.js
│
├── scripts/                    # Utility scripts
│   ├── setup.sh               # Initial project setup
│   ├── db-backup.sh           # Database backup
│   └── test-flaky.sh          # Flakiness detection
│
├── docs/                       # Documentation
│   ├── guides/                # Detailed guides
│   │   ├── SOMMOS_MCD.md      # This document
│   │   ├── GUEST_ACCESS.md    # Guest system docs
│   │   └── FLAKINESS_DETECTION.md # Testing docs
│   ├── features/              # Feature documentation
│   ├── deployment/             # Deployment guides
│   └── README.md              # Main documentation (consolidated)
│
├── Agent-MCP/                  # Agent-MCP suite (external)
│   ├── agent_mcp/             # MCP server implementation
│   │   └── dashboard/         # Web dashboard (port 3847)
│   └── .venv/                  # Python virtual environment
│
├── monitoring/                 # Grafana/Prometheus monitoring
│   ├── grafana/               # Dashboards
│   └── prometheus.yml         # Metrics configuration
│
├── reports/                    # Analysis and reports
│   └── model_comparison.json  # AI model evaluations
│
├── .env.example               # Environment template
├── .env.secrets-template      # Secrets template
├── package.json               # Root dependencies
├── jest.config.js             # Jest configuration
├── README.md                  # Comprehensive project documentation
├── compose.yaml               # Docker Compose orchestration
└── Dockerfile                 # Main container definition

# Key Conventions:
# - All API routes prefix with /api
# - All database files in /data (git-ignored)
# - All logs in .agent/logs or logs/ (git-ignored)
# - All tests mirror source structure
# - All docs in /docs for discoverability
```

### Naming Conventions

#### Files

- **Frontend**: `kebab-case.js` (e.g., `pairing-engine.js`)
- **Backend**: `snake_case.js` (e.g., `vintage_intelligence.js`)
- **Components**: `PascalCase.js` (if using frameworks, but N/A here)
- **Tests**: `*.spec.js` or `*.test.js`
- **Config**: `lowercase.config.js` (e.g., `vite.config.js`)

#### Code

- **Variables**: `camelCase` (e.g., `wineCollection`, `userToken`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `API_TIMEOUT`, `MAX_RETRIES`)
- **Functions**: `camelCase` (e.g., `fetchWineData()`, `calculateQuality()`)
- **Classes**: `PascalCase` (e.g., `SommOSAPI`, `InventoryManager`)
- **Database Tables**: `PascalCase` (e.g., `Wines`, `Vintages`)
- **Database Columns**: `snake_case` (e.g., `wine_id`, `created_at`)

#### Routes

- **REST endpoints**: `/api/<resource>/<action>` (e.g., `/api/inventory/consume`)
- **Parameterized**: `/api/<resource>/:id/<action>` (e.g., `/api/vintage/:wine_id/:year/weather`)

---

## 5. ✅ Task Breakdown & Implementation Plan

### Phase 1: Foundation & Core Features ✅ COMPLETE

**Status**: Production-ready, deployed via Docker

#### Task 1.1: Backend API Foundation

- [x] Express server setup with middleware (helmet, CORS, compression)
- [x] SQLite database schema (12 tables with indexes)
- [x] Connection pooling and error handling
- [x] Environment configuration and secrets management
- [x] Health check endpoint
- **Acceptance Criteria**: Server runs, database connects, health check returns 200

#### Task 1.2: Authentication System

- [x] JWT token generation and validation
- [x] Password hashing (bcrypt)
- [x] Role-based access control (admin/crew/guest)
- [x] Guest invite system with event codes
- [x] Session management
- **Acceptance Criteria**: Users can login, roles enforced, guest access works

#### Task 1.3: Inventory Management

- [x] Stock CRUD operations
- [x] Multi-location tracking (4 locations)
- [x] Transaction ledger for audit trail
- [x] Quantity validation and constraints
- [x] Move/consume/reserve operations
- **Acceptance Criteria**: Inventory accurate, ledger complete, no negative stock

#### Task 1.4: Wine Pairing Engine

- [x] DeepSeek API integration (primary)
- [x] OpenAI fallback mechanism
- [x] Prompt engineering for 4-line recommendations
- [x] Confidence scoring
- [x] Response caching
- **Acceptance Criteria**: <10s response, fallback works, quality recommendations

#### Task 1.5: Frontend PWA

- [x] Vite build configuration
- [x] Service worker with offline caching
- [x] IndexedDB for local storage
- [x] Responsive yacht-luxury UI
- [x] Module-based architecture
- **Acceptance Criteria**: Works offline 72+ hours, installable, responsive

### Phase 2: Advanced Features ✅ COMPLETE

#### Task 2.1: Vintage Intelligence

- [x] Open-Meteo API integration
- [x] Weather data fetching and caching
- [x] Quality scoring algorithm
- [x] Aging potential calculations
- [x] Weather-to-quality mapping
- **Acceptance Criteria**: Weather data accurate, quality scores reasonable

#### Task 2.2: Procurement Assistant

- [x] Opportunity scanner (low stock detection)
- [x] Price trend analysis
- [x] ROI calculations
- [x] Purchase recommendation engine
- [x] Order generation
- **Acceptance Criteria**: Recommends wines correctly, ROI makes sense

#### Task 2.3: Guest Access System

- [x] Event code generation
- [x] PIN protection (optional)
- [x] Time-based expiration
- [x] Use-count limiting
- [x] Read-only enforcement
- **Acceptance Criteria**: Guests can browse, no write access, codes expire

### Phase 3: Testing & Quality ✅ COMPLETE

#### Task 3.1: Test Suite Implementation

- [x] Jest unit tests (600+ tests)
- [x] Playwright E2E tests (critical workflows)
- [x] Integration tests (API + DB)
- [x] Flakiness detection system
- [x] CI/CD pipeline (GitHub Actions)
- **Acceptance Criteria**: >90% coverage, all tests pass, CI green

#### Task 3.2: Docker Deployment

- [x] Multi-stage Dockerfiles
- [x] Docker Compose orchestration
- [x] Nginx reverse proxy
- [x] Volume persistence
- [x] Health monitoring
- **Acceptance Criteria**: One-command deployment, zero-downtime restart

### Phase 4: Production Hardening ✅ COMPLETE

#### Task 4.1: Security Hardening

- [x] Content Security Policy (CSP)
- [x] Rate limiting
- [x] Input validation and sanitization
- [x] SQL injection prevention
- [x] XSS protection
- **Acceptance Criteria**: Passes OWASP top 10 security checks

#### Task 4.2: Performance Optimization

- [x] Response compression (gzip)
- [x] API response caching
- [x] Database query optimization (indexes)
- [x] Lazy loading for large datasets
- [x] Image optimization
- **Acceptance Criteria**: <2s page load, <500ms API response (p95)

#### Task 4.3: Documentation

- [x] API documentation (OpenAPI/Swagger)
- [x] Deployment guide
- [x] User guide (crew + admin)
- [x] Guest access guide
- [x] Troubleshooting guide
- **Acceptance Criteria**: All docs complete, accurate, tested

---

## 6. 🔗 Integration & Dependencies

### Internal Dependencies

#### Module Dependency Graph

```
app.js
├── api.js (HTTP client)
│   └── auth.js (token management)
├── ui.js (rendering utilities)
└── modules/
    ├── inventory.js
    │   ├── api.js
    │   └── ui.js
    ├── pairing.js
    │   ├── api.js
    │   └── ui.js
    ├── procurement.js
    │   ├── api.js
    │   ├── ui.js
    │   └── vintage.js
    └── vintage.js
        ├── api.js
        └── ui.js
```

#### Backend Dependencies

```
server.js
├── api/routes.js (all routes)
│   ├── auth.js
│   ├── inventory.js → inventory_manager.js
│   ├── pairing.js → pairing_engine.js
│   ├── procurement.js → procurement_engine.js
│   └── vintage.js → vintage_intelligence.js
├── database/connection.js (SQLite client)
└── config/security.js (middleware)
```

### External Dependencies

#### NPM Packages (Backend)

```json
{
  "express": "^4.18.2",              // Web framework
  "sqlite3": "^5.1.6",               // Database driver
  "bcrypt": "^5.1.1",                // Password hashing
  "jsonwebtoken": "^9.0.2",          // JWT authentication
  "helmet": "^7.0.0",                // Security headers
  "cors": "^2.8.5",                  // Cross-origin support
  "compression": "^1.7.4",           // Response compression
  "express-rate-limit": "^6.10.0",   // Rate limiting
  "dotenv": "^16.3.1",               // Environment variables
  "openai": "^4.20.0"                // AI API (DeepSeek compatible)
}
```

#### NPM Packages (Frontend)

```json
{
  "vite": "^6.0.0",                  // Build tool
  "workbox-precaching": "^7.0.0",    // Service worker helper
  "idb": "^7.1.1"                    // IndexedDB wrapper
}
```

#### Test Dependencies

```json
{
  "jest": "^29.7.0",                 // Test framework
  "@playwright/test": "^1.40.0",     // E2E testing
  "supertest": "^6.3.3"              // API testing
}
```

### API Integrations

#### DeepSeek AI (Primary)

- **Endpoint**: `https://api.deepseek.com/v1/chat/completions`
- **Authentication**: Bearer token (`DEEPSEEK_API_KEY`)
- **Model**: `deepseek-chat`
- **Rate Limit**: 60 requests/minute (free tier)
- **Timeout**: 30 seconds
- **Fallback**: OpenAI if unavailable

#### OpenAI (Fallback)

- **Endpoint**: `https://api.openai.com/v1/chat/completions`
- **Authentication**: Bearer token (`OPENAI_API_KEY`)
- **Model**: `gpt-4` or `gpt-3.5-turbo`
- **Rate Limit**: Depends on plan
- **Use Case**: Automatic failover from DeepSeek

#### Open-Meteo (Weather Data)

- **Endpoint**: `https://archive-api.open-meteo.com/v1/archive`
- **Authentication**: None (free tier)
- **Parameters**: `latitude`, `longitude`, `start_date`, `end_date`, `daily=temperature_2m_mean,precipitation_sum`
- **Rate Limit**: 10,000 requests/day
- **Caching**: 1 year (weather data doesn't change)

### Data Flow Diagram

```
┌──────────┐
│  User    │ Enters dish "Grilled Salmon"
└────┬─────┘
     │ HTTP POST /api/pairing/recommend
     ▼
┌──────────────────┐
│  Express Server  │ Validates input, checks auth
└────┬─────────────┘
     │ Calls pairing_engine.js
     ▼
┌──────────────────┐
│ Pairing Engine   │ Constructs AI prompt
└────┬─────────────┘
     │ HTTP POST to DeepSeek
     ▼
┌──────────────────┐
│  DeepSeek API    │ Returns 4-line recommendation
└────┬─────────────┘
     │ JSON response
     ▼
┌──────────────────┐
│ Pairing Engine   │ Parses, scores confidence
└────┬─────────────┘
     │ Queries Wines table
     ▼
┌──────────────────┐
│  SQLite DB       │ Returns matching wines
└────┬─────────────┘
     │ Enriched response
     ▼
┌──────────────────┐
│  Express Server  │ Returns JSON to client
└────┬─────────────┘
     │ HTTP 200
     ▼
┌──────────┐
│ Frontend │ Displays recommendations
└──────────┘
```

---

## 7. 🧪 Testing & Validation

### Test Strategy

#### Test Pyramid

```
      /\
     /E2E\     10% - Critical user workflows (Playwright)
    /------\
   /  API  \   30% - Integration tests (Supertest)
  /--------\
 /   Unit   \  60% - Component tests (Jest)
/____________\
```

### Unit Tests (Jest) - 600+ tests

#### Backend Tests (`tests/unit/backend/`)

```javascript
// Example: inventory_manager.test.js
describe('InventoryManager', () => {
  test('consumeBottle() reduces stock correctly', async () => {
    const result = await InventoryManager.consumeBottle({
      vintage_id: 1,
      quantity: 2,
      location: 'Service Bar'
    });
    expect(result.newQuantity).toBe(8); // Was 10, consumed 2
  });

  test('consumeBottle() prevents negative stock', async () => {
    await expect(
      InventoryManager.consumeBottle({ vintage_id: 1, quantity: 50, location: 'Service Bar' })
    ).rejects.toThrow('Insufficient stock');
  });

  test('moveBottle() updates both locations', async () => {
    const result = await InventoryManager.moveBottle({
      vintage_id: 1,
      quantity: 3,
      from_location: 'Main Cellar',
      to_location: 'Service Bar'
    });
    expect(result.from.newQuantity).toBe(47); // Was 50, moved 3
    expect(result.to.newQuantity).toBe(11);   // Was 8, received 3
  });
});

// Example: pairing_engine.test.js
describe('PairingEngine', () => {
  test('recommend() returns valid wine pairings', async () => {
    const result = await PairingEngine.recommend({
      dish: 'Grilled Salmon',
      context: { occasion: 'dinner' }
    });
    expect(result.recommendations).toHaveLength(3);
    expect(result.recommendations[0]).toHaveProperty('wine_id');
    expect(result.recommendations[0]).toHaveProperty('confidence');
    expect(result.recommendations[0].confidence).toBeGreaterThanOrEqual(0);
    expect(result.recommendations[0].confidence).toBeLessThanOrEqual(100);
  });

  test('recommend() handles API timeouts gracefully', async () => {
    // Mock slow API response
    jest.spyOn(global, 'fetch').mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 35000))
    );
    await expect(
      PairingEngine.recommend({ dish: 'Test' })
    ).rejects.toThrow('Request timeout');
  });
});
```

#### Frontend Tests (`tests/unit/frontend/`)

```javascript
// Example: api.test.js
describe('SommOSAPI', () => {
  test('fetch() automatically retries on network failure', async () => {
    // Mock fetch to fail twice, succeed third time
    let attempts = 0;
    global.fetch = jest.fn(() => {
      attempts++;
      if (attempts < 3) return Promise.reject(new Error('Network error'));
      return Promise.resolve({ ok: true, json: () => ({ data: 'success' }) });
    });

    const api = new SommOSAPI();
    const result = await api.fetch('/test');
    expect(attempts).toBe(3);
    expect(result.data).toBe('success');
  });

  test('queueOffline() stores requests for later sync', async () => {
    const api = new SommOSAPI();
    await api.queueOffline({
      method: 'POST',
      url: '/api/inventory/consume',
      body: { vintage_id: 1, quantity: 2 }
    });
    
    const queue = await api.getOfflineQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].url).toBe('/api/inventory/consume');
  });
});
```

### Integration Tests (`tests/integration/`)

```javascript
// Example: inventory-api.test.js
const request = require('supertest');
const app = require('../../backend/server');

describe('Inventory API Integration', () => {
  let authToken;

  beforeAll(async () => {
    // Login to get token
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@sommos.local', password: 'admin123' });
    authToken = res.body.token;
  });

  test('POST /api/inventory/consume reduces stock and creates ledger entry', async () => {
    // Get initial stock
    const initialStock = await request(app)
      .get('/api/inventory/stock')
      .set('Authorization', `Bearer ${authToken}`);
    const initial = initialStock.body.stocks.find(s => s.vintage_id === 1);

    // Consume bottles
    const consumeRes = await request(app)
      .post('/api/inventory/consume')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        vintage_id: 1,
        quantity: 2,
        location: 'Service Bar',
        guest_name: 'John Doe'
      });

    expect(consumeRes.status).toBe(200);
    expect(consumeRes.body.stock.quantity).toBe(initial.quantity - 2);

    // Verify ledger entry
    const ledger = await request(app)
      .get('/api/inventory/transactions?vintage_id=1')
      .set('Authorization', `Bearer ${authToken}`);
    expect(ledger.body.transactions[0].transaction_type).toBe('consume');
    expect(ledger.body.transactions[0].quantity).toBe(2);
  });
});
```

### E2E Tests (Playwright) (`tests/e2e/`)

```javascript
// Example: pairing.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Wine Pairing Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.fill('[name="email"]', 'crew@sommos.local');
    await page.fill('[name="password"]', 'crew123');
    await page.click('button:has-text("Login")');
    await expect(page).toHaveURL('/dashboard');
  });

  test('User can search for wine pairing and see recommendations', async ({ page }) => {
    // Navigate to pairing page
    await page.click('text=Pairing');
    await expect(page).toHaveURL('/pairing');

    // Enter dish
    await page.fill('[placeholder="Enter dish name"]', 'Grilled Salmon');
    await page.click('button:has-text("Find Pairing")');

    // Wait for AI recommendations
    await page.waitForSelector('.recommendation-card', { timeout: 15000 });

    // Verify recommendations displayed
    const recommendations = await page.$$('.recommendation-card');
    expect(recommendations.length).toBeGreaterThan(0);

    // Check first recommendation has required fields
    await expect(page.locator('.recommendation-card').first()).toContainText(/Wine:/);
    await expect(page.locator('.recommendation-card').first()).toContainText(/Confidence:/);
  });

  test('Pairing works offline after initial load', async ({ page, context }) => {
    // Cache pairing data
    await page.goto('/pairing');
    await page.fill('[placeholder="Enter dish name"]', 'Steak');
    await page.click('button:has-text("Find Pairing")');
    await page.waitForSelector('.recommendation-card');

    // Go offline
    await context.setOffline(true);

    // Try same search
    await page.goto('/pairing');
    await page.fill('[placeholder="Enter dish name"]', 'Steak');
    await page.click('button:has-text("Find Pairing")');

    // Should show cached results
    await page.waitForSelector('.recommendation-card');
    await expect(page.locator('.offline-indicator')).toBeVisible();
  });
});
```

### Flakiness Detection

```bash
# Run tests multiple times to detect flaky tests
npm run test:flaky       # Jest tests 5x
npm run test:e2e:flaky   # Playwright tests 3x

# Output: Detailed report of inconsistent tests
# Example output:
# ✓ Passed all 5 runs: inventory_manager.test.js::consumeBottle()
# ✗ Flaky (3/5 passed): pairing_engine.test.js::recommend() [NEEDS FIX]
#   - Failure pattern: Timeout on runs 2, 4
#   - Root cause: Mock API delay inconsistent
```

### Test Coverage Goals

- **Unit Tests**: >90% line coverage
- **Integration Tests**: All API endpoints covered
- **E2E Tests**: All critical user workflows
- **Performance**: No test >5 seconds (except E2E)
- **Flakiness**: <2% flaky test rate

### Acceptance Criteria Summary

- ✅ All unit tests pass (600+ tests)
- ✅ All integration tests pass (API + DB)
- ✅ All E2E tests pass (critical workflows)
- ✅ CI/CD pipeline green
- ✅ Test coverage >90%
- ✅ No known flaky tests
- ✅ Performance benchmarks met (<2s page load, <10s AI response)

---

## 8. 📚 References & Resources

### Design & Planning Documents

- **Project README**: `README.md` - Comprehensive project documentation (consolidated)
  - System overview, architecture, and quick start
  - Complete API reference with examples
  - User guide and usage instructions
  - Testing and development guidelines
  - Deployment instructions for multiple platforms
  - Contributing guidelines and support information

- **Main Context Document**: `docs/guides/SOMMOS_MCD.md` - This technical blueprint
- **Project Workflow**: `docs/archive/PROJECT_WORKFLOW.md` - Development history
- **Guest Access Guide**: `docs/GUEST_ACCESS.md` - Event code system
- **Flakiness Detection**: `docs/FLAKINESS_DETECTION.md` - Test quality
- **AB Testing Documentation**: `docs/features/AB_TESTING_API_DOCUMENTATION.md` - API specs

### Database Documentation

- **Schema Definition**: `backend/database/schema.sql`
- **Migration Scripts**: `backend/database/migrations/`
- **Database Setup**: `docs/guides/DATABASE_SETUP.md`
- **Import Tools**: `scripts/add-diverse-wines.js`

### Docker & Deployment

- **Docker Compose**: `compose.yaml` (updated from production.yml)
- **Deployment Script**: `deployment/deploy.sh`
- **Docker Success Report**: `docs/archive/DOCKER_DEPLOYMENT_SUCCESS.md`
- **Nginx Configuration**: `deployment/nginx.conf`

### Testing Resources

- **Test Coverage Analysis**: `docs/TEST_COVERAGE_ANALYSIS_PLAN.md`
- **Playwright Configuration**: `playwright.config.ts`
- **Jest Configuration**: `jest.config.js`

### Agent-MCP Integration

- **Agent Setup**: `docs/guides/AGENT_SETUP_VERIFICATION_UPDATED.md`
- **Agent Activation**: `docs/guides/AGENT_ACTIVATION_GUIDE.md`
- **DevOps Agent**: `docs/guides/DEVOPS_AGENT_ACTIVATION_GUIDE.md`
- **Agent-MCP Dashboard**: `Agent-MCP/agent_mcp/dashboard/` (port 3847)

### Code Quality & Standards

- **Cursor Rules**: `.cursor/rules/` - AI-assisted coding guidelines
  - `architecture-patterns.mdc` - System architecture patterns
  - `database-patterns.mdc` - Database development rules
  - `frontend-pwa.mdc` - PWA development standards
  - `security-auth.mdc` - Security and authentication
  - `testing-quality.mdc` - Testing standards
  - `wine-domain.mdc` - Wine industry domain knowledge

### External Resources

- **DeepSeek API**: <https://platform.deepseek.com/docs>
- **OpenAI API**: <https://platform.openai.com/docs>
- **Open-Meteo**: <https://open-meteo.com/en/docs/historical-weather-api>
- **SQLite Documentation**: <https://www.sqlite.org/docs.html>
- **Express.js**: <https://expressjs.com/>
- **Vite**: <https://vitejs.dev/>
- **Playwright**: <https://playwright.dev/>
- **Jest**: <https://jestjs.io/>

### Style Guides

- **JavaScript**: Airbnb JavaScript Style Guide (ES6+)
- **CSS**: BEM naming convention
- **Git Commits**: Conventional Commits (feat:, fix:, docs:, etc.)

### Production Monitoring

- **Health Check**: `http://localhost/api/system/health`
- **System Stats**: `http://localhost/api/system/stats` (admin only)
- **API Documentation**: `http://localhost/docs` (Swagger/OpenAPI)

### Environment Variables Reference

```bash
# Core Configuration
NODE_ENV=production
PORT=3001
FRONTEND_PORT=3000

# Database
DATABASE_PATH=./data/sommos.db
DATABASE_URL=./data/sommos.db

# AI Services (Optional - for pairing)
DEEPSEEK_API_KEY=sk-your-deepseek-key    # Primary AI provider
OPENAI_API_KEY=sk-your-openai-key        # Fallback AI provider

# Weather Service (Optional - FREE)
OPEN_METEO_BASE=https://archive-api.open-meteo.com/v1

# Security
JWT_SECRET=your_jwt_secret_here           # Generate with: openssl rand -base64 32
SESSION_SECRET=your_session_secret_here
SESSION_TIMEOUT=86400                     # 24 hours in seconds

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000               # 1 minute
RATE_LIMIT_MAX_REQUESTS=100              # 100 requests per minute

# Agent-MCP Integration
SOMMOS_ALLOW_CLAUDE=true                 # Enable Claude integration
MCP_SERVER_URL=http://localhost:8080     # Agent-MCP HTTP API

# Docker
COMPOSE_PROJECT_NAME=sommos
```

---

## Implementation Notes for Agent-MCP

### Current Agent-MCP Deployment Status

**Agent-MCP Suite**: ✅ **Deployed and Active** (as of October 8, 2025)

#### Deployment Details
- **MCP Server**: Running on port 8080 via uv (Agent-MCP project)
- **Active Sessions**: 5 specialized tmux sessions
  - `backend-specialist-sommos` - API and database optimization
  - `frontend-specialist-sommos` - PWA and UI enhancements
  - `ai-integration-specialist-sommos` - DeepSeek/OpenAI integration
  - `devops-specialist-sommos` - Deployment and monitoring
  - `test-specialist-sommos` - Testing and quality assurance

#### Integration Points
- **HTTP API**: Agent-MCP HTTP API at `http://localhost:8080/api/`
  - Agent registration: `POST /api/create-agent`
  - Agent termination: `POST /api/terminate-agent`
  - Token management: `GET /api/tokens` (admin access)
- **Database Path**: `/Users/thijs/Documents/SommOS/.agent/mcp_state.db`
- **Dashboard**: Web interface at `Agent-MCP/agent_mcp/dashboard/` (port 3847)

#### Monitoring Scripts
- **Health Check**: `scripts/health_check_agents.sh`
- **Enhanced Monitoring**: `scripts/monitor_agents_enhanced.sh`
- **Agent Watching**: `scripts/watch_agents.sh`
- **Startup Scripts**: `scripts/start_all_agents.sh`, `scripts/restart_agent.sh`
- **Backup**: `scripts/backup_agent_state.sh`

### For Admin Agent

This MCD represents a **production-ready** system with:

- ✅ All core features implemented and tested
- ✅ 600+ unit tests passing
- ✅ E2E tests covering critical workflows
- ✅ Docker deployment working
- ✅ Security hardened
- ✅ Documentation complete

**Key Strengths**:

1. **Offline-first architecture** - Works without internet for 72+ hours
2. **AI integration** - DeepSeek/OpenAI for wine pairing with fallback
3. **Comprehensive testing** - Jest + Playwright + flakiness detection
4. **Production-ready deployment** - Docker + nginx + CI/CD
5. **Security-hardened** - CSP, rate limiting, input validation

**Current Agent Team Structure**:

1. **Backend Specialist** - API optimization, database tuning
2. **Frontend Specialist** - PWA enhancements, UI polish
3. **AI Integration Specialist** - Pairing engine refinement
4. **DevOps Specialist** - Monitoring, logging, performance
5. **Test Specialist** - Expand test coverage, reduce flakiness

### For Worker Agents

Use this MCD as your **single source of truth**. Key sections:

- **Section 3**: Detailed implementation (DB schema, API endpoints, components)
- **Section 4**: File structure and naming conventions
- **Section 5**: Task breakdown (reference for completed work)
- **Section 6**: Integration points and dependencies
- **Section 7**: Testing requirements and acceptance criteria

**Before implementing**:

1. Query the knowledge graph for existing implementations
2. Check file structure to understand module organization
3. Review API documentation for endpoint contracts
4. Understand database schema before making changes
5. Follow existing patterns (e.g., error handling, logging)

### Agent-MCP Integration Guidelines

#### API Usage
```bash
# Register a new agent
curl -X POST http://localhost:8080/api/create-agent \
  -H "Authorization: Bearer $(cat admin_token.txt)" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "specialist-name",
    "role": "backend|frontend|ai|devops|test",
    "capabilities": ["api-development", "database-optimization"]
  }'

# Terminate existing agent
curl -X POST http://localhost:8080/api/terminate-agent \
  -H "Authorization: Bearer $(cat admin_token.txt)" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "agent-id-to-terminate"}'
```

#### Development Workflow
1. **Check Agent Status**: Use monitoring scripts to verify active sessions
2. **Coordinate Changes**: Reference existing implementations before modifying
3. **Test Integration**: Ensure changes work with existing agent capabilities
4. **Update Documentation**: Keep this MCD current with any architectural changes

### Project Maturity: Production-Ready ✅

- **Current State**: Deployed, tested, documented, agent-enhanced
- **Next Phase**: Performance optimization, user feedback integration
- **Recommended Work**: Focus on observability, AI model improvements, user experience enhancements

---

**End of Main Context Document**

*This MCD serves as the comprehensive blueprint for the SommOS project. All agent interactions should reference this document as the authoritative source for project structure, implementation details, and development standards.*
