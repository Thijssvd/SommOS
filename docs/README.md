# SommOS Documentation

> **Yacht Sommelier Operating System** - An AI-powered wine management PWA for luxury yachts

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Installation & Setup](#installation--setup)
- [API Reference](#api-reference)
- [Frontend Guide](#frontend-guide)
- [Testing Guide](#testing-guide)
- [Deployment](#deployment)
- [User Manual](#user-manual)
- [Contributing](#contributing)

---

## Overview

SommOS is a comprehensive wine management system designed specifically for luxury yachts. It combines advanced inventory management, AI-powered wine pairing recommendations, weather-informed vintage intelligence, and procurement optimization in a Progressive Web Application (PWA).

### Key Features

- 🍷 **Complete Wine Inventory Management**
  - Real-time stock tracking across multiple locations
  - Detailed wine catalog with vintage information
  - Transaction history and ledger system

- 🤖 **AI-Powered Wine Pairing**
  - Dish-specific recommendations
  - Guest preference consideration
  - Context-aware suggestions (occasion, weather, etc.)

- 📊 **Vintage Intelligence**
  - Weather data integration for vintage analysis
  - Quality scoring and aging predictions
  - Procurement recommendations

- 🚢 **Yacht-Specific Features**
  - Multi-location storage (cellar, service bar, deck)
  - Offline-first PWA design
  - Mobile-optimized interface
  - Chart visualization for inventory insights

- 💰 **Procurement Management**
  - Supplier relationship management
  - Purchase order generation
  - Cost analysis and optimization

### Technology Stack

**Backend:**

- Node.js with Express.js framework
- SQLite3 database with optimized indexes
- DeepSeek (primary) or OpenAI (fallback) for AI pairing intelligence
- Open-Meteo API for weather data
- Comprehensive security middleware (Helmet, CORS, Rate Limiting)

**Frontend:**

- Vanilla JavaScript (ES6+) for optimal performance
- Progressive Web App (PWA) with Service Workers
- Chart.js for data visualization
- Responsive CSS Grid/Flexbox layout
- IndexedDB for offline data storage

**Testing:**

- Jest for unit and integration testing
- Supertest for API testing
- JSDOM for frontend testing
- Performance testing suite
- Cross-browser compatibility testing

---

## Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        SommOS Architecture                      │
├─────────────────────────────────────────────────────────────────┤
│                          Frontend                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │     PWA     │  │   Charts    │  │   Offline   │            │
│  │  Interface  │  │Visualization│  │   Storage   │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│         │                 │                 │                  │
│         └─────────────────┼─────────────────┘                  │
│                           │                                    │
├───────────────────────────┼────────────────────────────────────┤
│                        API Layer                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ Inventory   │  │   Pairing   │  │Procurement  │            │
│  │  Manager    │  │   Engine    │  │   Engine    │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│         │                 │                 │                  │
├─────────┼─────────────────┼─────────────────┼──────────────────┤
│      Database         AI Services     External APIs           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   SQLite3   │  │   OpenAI    │  │ Open-Meteo  │            │
│  │  Optimized  │  │    GPT-4    │  │  Weather    │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### Core Components

1. **Inventory Manager** (`backend/core/inventory_manager.js`)
   - Stock level management
   - Transaction processing
   - Location-based operations

2. **Pairing Engine** (`backend/core/pairing_engine.js`)
   - AI-powered wine recommendations
   - Context-aware pairing logic
   - Guest preference processing

3. **Vintage Intelligence** (`backend/core/vintage_intelligence.js`)
   - Weather data integration
   - Quality analysis and scoring
   - Aging prediction algorithms

4. **Procurement Engine** (`backend/core/procurement_engine.js`)
   - Supplier management
   - Purchase optimization
   - Cost analysis

### Database Schema

```sql
-- Core wine information
Wines (id, name, producer, region, country, wine_type, grape_varieties)
Vintages (id, wine_id, year, quality_score, weather_score, production_notes)

-- Inventory management
Stock (id, vintage_id, location, quantity, cost_per_bottle)
Ledger (id, vintage_id, transaction_type, location, quantity, notes, created_by)

-- Procurement
Suppliers (id, name, contact_info, active)
PurchaseOrders (id, supplier_id, status, created_at)

-- Additional tables for aliases, pairing history, etc.
```

---

## Installation & Setup

### Prerequisites

- Node.js 16.0+
- npm 8.0+
- SQLite3
- OpenAI API key (optional, for AI features)

### Quick Start

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd SommOS
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Set up environment variables:**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   npm run verify:env
   ```

4. **Initialize the database:**

   ```bash
   npm run setup:db
   ```

5. **Import sample data (optional):**

   ```bash
   npm run import:cellar
   ```

6. **Start the development server:**

   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:3000`

### Environment Configuration

Create a `.env` file based on `.env.example`. The most important settings are:

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | Local HTTP port for the API gateway (defaults to `3001`). |
| `NODE_ENV` | No | Runtime mode. Use `development` locally. |
| `OPEN_METEO_BASE` | Production only | Base URL for the Open-Meteo archive API. |
| `DATABASE_PATH` | No | Location of the SQLite database file. |
| `SESSION_SECRET` | Yes (prod) | Secret used to sign session cookies. |
| `JWT_SECRET` | Yes (prod) | Secret used to issue API access tokens. |
| `DEEPSEEK_API_KEY` | Optional | Enables AI features (primary). |
| `OPENAI_API_KEY` | Optional | AI fallback if DeepSeek not set. |
| `SOMMOS_AUTH_DISABLED` | Optional | If `true`, disables all auth (dev only). |
| `WEATHER_API_KEY` | Optional | Unlocks premium weather insights. |
| `SOMMOS_DISABLE_EXTERNAL_CALLS` | No | Set to `true` to run fully offline (tests/demos). |

Run `npm run verify:env` after editing to confirm your configuration.

> 📘 Need to wire up GitHub checks and secrets? See [`docs/operations/github-quick-actions.md`](operations/github-quick-actions.md).

### Production Setup

For production deployment:

1. **Build optimized assets:**

   ```bash
   npm run build
   ```

2. **Set production environment:**

   ```bash
   export NODE_ENV=production
   ```

3. **Start with process manager:**

   ```bash
   pm2 start backend/server.js --name sommos
   ```

---

## API Reference

### Base URL

```
http://localhost:3001/api
```

### Authentication

Currently using basic authentication. JWT implementation planned for future versions.

### Endpoints

#### System Health

```http
GET /api/system/health
```

Returns system status and basic statistics.

**Response:**

```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "total_wines": 1250,
    "total_vintages": 2100,
    "total_bottles": 15600,
    "active_suppliers": 45
  }
}
```

#### Inventory Management

**Get Stock Levels**

```http
GET /api/inventory/stock?location=main-cellar&wine_type=Red&available_only=true
```

**Record Wine Consumption**

```http
POST /api/inventory/consume
Content-Type: application/json

{
  "vintage_id": "vintage-123",
  "location": "main-cellar",
  "quantity": 2,
  "notes": "Served at dinner",
  "created_by": "Sommelier"
}
```

**Create Inventory Intake Order**

```http
POST /api/inventory/intake
Content-Type: application/json

{
  "source_type": "pdf_invoice",
  "reference": "INV-2024-042",
  "supplier": { "name": "La Cave de Paris" },
  "order_date": "2024-05-18",
  "expected_delivery": "2024-05-25",
  "items": [
    {
      "wine": {
        "name": "Château Margaux",
        "producer": "Château Margaux",
        "region": "Bordeaux",
        "wine_type": "Red"
      },
      "vintage": { "year": 2015 },
      "stock": { "quantity": 6, "unit_cost": 780, "location": "receiving" }
    }
  ]
}
```

**Receive Bottles for Intake Order**

```http
POST /api/inventory/intake/{intakeId}/receive
Content-Type: application/json

{
  "receipts": [
    { "item_id": 12, "quantity": 6, "location": "main-cellar" }
  ],
  "notes": "Verified against delivery note",
  "created_by": "Sommelier"
}
```

**Verify Intake Completion**

```http
GET /api/inventory/intake/{intakeId}/status
```

Returns outstanding bottles and status (ORDERED, PARTIALLY_RECEIVED, RECEIVED).

**Move Wine Between Locations**

```http
POST /api/inventory/move
Content-Type: application/json

{
  "vintage_id": "vintage-123",
  "from_location": "main-cellar",
  "to_location": "service-bar",
  "quantity": 6,
  "notes": "Preparing for evening service"
}
```

**Reserve Wine**

```http
POST /api/inventory/reserve
Content-Type: application/json

{
  "vintage_id": "vintage-123",
  "location": "main-cellar",
  "quantity": 1,
  "notes": "Reserved for VIP dinner"
}
```

#### Wine Pairing

**Get Pairing Recommendations**

```http
POST /api/pairing/recommend
Content-Type: application/json

{
  "dish": "Grilled salmon with lemon herb butter",
  "context": {
    "occasion": "casual-dining",
    "guestCount": 4,
    "weather": "sunny",
    "season": "summer"
  },
  "guestPreferences": "Prefers lighter wines, no heavy reds"
}
```

**Quick Pairing**

```http
POST /api/pairing/quick
Content-Type: application/json

{
  "dish": "Beef tenderloin",
  "context": {
    "occasion": "formal-dining"
  },
  "ownerLikes": ["Bordeaux", "Cabernet Sauvignon"]
}
```

#### Wine Catalog

**Search Wines**

```http
GET /api/wines?search=Bordeaux&wine_type=Red&limit=50&offset=0
```

**Get Wine Details**

```http
GET /api/wines/123
```

**Add New Wine**

```http
POST /api/wines
Content-Type: application/json

{
  "wine": {
    "name": "Château Example 2020",
    "producer": "Château Example",
    "region": "Bordeaux",
    "wine_type": "Red"
  },
  "vintage": {
    "year": 2020,
    "quality_score": 92
  },
  "stock": {
    "quantity": 12,
    "location": "main-cellar",
    "unit_cost": 85.00
  }
}
```

#### Procurement

**Get Procurement Opportunities**

```http
GET /api/procurement/opportunities?region=Tuscany&max_price=100
```

**Analyze Purchase Decision**

```http
POST /api/procurement/analyze
Content-Type: application/json

{
  "vintage_id": "vintage-123",
  "supplier_id": "supplier-456",
  "quantity": 24,
  "context": {
    "budget": 2000,
    "timeline": "immediate"
  }
}
```

#### Vintage Intelligence

**Get Vintage Analysis**

```http
GET /api/vintage/analysis/wine-123
```

**Enrich Wine Data**

```http
POST /api/vintage/enrich
Content-Type: application/json

{
  "wine_id": "wine-123"
}
```

### Error Handling

All API endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Common HTTP Status Codes:**

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

---

## Frontend Guide

### Architecture

The frontend is built as a Single Page Application (SPA) with PWA capabilities:

- **`frontend/js/app.js`** - Main application logic and view management
- **`frontend/js/api.js`** - API client with offline fallback
- **`frontend/js/ui.js`** - UI utilities and component management
- **`frontend/css/styles.css`** - Responsive styling
- **`frontend/sw.js`** - Service Worker for offline functionality

### Key Classes

#### SommOSAPI

Handles all API communication with automatic retry and offline fallback:

```javascript
const api = new SommOSAPI();

// Get inventory with automatic error handling
const inventory = await api.getInventory({ location: 'main-cellar' });

// Post with validation
await api.consumeWine(vintageId, location, quantity, notes);
```

#### SommOSUI

Manages UI components and user interactions:

```javascript
const ui = new SommOSUI();

// Show notifications
ui.showToast('Wine added successfully', 'success');

// Display modals
ui.showModal('Wine Details', content);

// Manage loading states
ui.showLoading('save-button');
```

#### SommOS (Main App)

Central application controller:

```javascript
const app = new SommOS();

// Navigation
app.navigateToView('inventory');

// Data management
app.loadInventory();
app.displayInventory(wines);

// Search and filtering
app.handleSearch('Bordeaux');
app.applyFilters();
```

### PWA Features

#### Service Worker

Implements cache-first strategy for static assets and network-first for API calls:

```javascript
// Cache static resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Serve from cache with network fallback
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
```

#### Offline Storage

Uses IndexedDB for persistent data storage:

```javascript
// Initialize offline storage
const db = await openDB('SommOSDB', 1, {
  upgrade(db) {
    db.createObjectStore('wines', { keyPath: 'id' });
    db.createObjectStore('inventory', { keyPath: 'id' });
  }
});

// Store data for offline access
await db.put('inventory', wineData);
```

### Responsive Design

The interface adapts to different screen sizes:

- **Mobile (< 768px):** Single-column layout, touch-optimized controls
- **Tablet (768px - 1024px):** Two-column layout, enhanced navigation
- **Desktop (> 1024px):** Multi-column layout, full feature set

### Chart Integration

Uses Chart.js for data visualization:

```javascript
// Wine type distribution
new Chart(ctx, {
  type: 'doughnut',
  data: {
    labels: ['Red', 'White', 'Sparkling'],
    datasets: [{
      data: [150, 85, 30],
      backgroundColor: ['#b91c1c', '#f59e0b', '#6366f1']
    }]
  }
});
```

---

## Testing Guide

### Test Structure

```
tests/
├── backend/           # Backend API tests
│   └── api.test.js
├── frontend/          # Frontend unit tests  
│   └── frontend.test.js
├── integration/       # Full-stack integration tests
│   └── fullstack.test.js
├── performance/       # Performance and load tests
│   └── performance.test.js
└── browser/          # Browser compatibility tests
    └── compatibility.test.js
```

### Running Tests

**All tests:**

```bash
npm test
```

**Backend API tests:**

```bash
npm test -- tests/backend
```

**Frontend tests:**

```bash
npm test -- tests/frontend
```

**Integration tests:**

```bash
npm test -- tests/integration
```

**Performance tests:**

```bash
npm test -- tests/performance
```

### Test Coverage

Current test coverage includes:

- ✅ **Backend API Testing** (100+ test cases)
  - All endpoint functionality
  - Error handling and validation
  - Database operations
  - Rate limiting and security

- ✅ **Frontend Unit Testing** (80+ test cases)  
  - Component functionality
  - User interactions
  - Data processing
  - Offline capabilities

- ✅ **Integration Testing** (50+ test cases)
  - Full-stack workflows
  - Data consistency
  - Concurrent operations
  - Error recovery

- ✅ **Performance Testing** (30+ test cases)
  - Load testing with large datasets
  - Response time validation
  - Memory usage monitoring
  - Optimization verification

- ✅ **Browser Compatibility** (Testing framework)
  - Cross-browser functionality
  - Mobile device testing
  - PWA feature validation
  - Accessibility compliance

### Performance Benchmarks

Target performance metrics:

- **API Response Time:** < 200ms for simple queries, < 2s for complex queries
- **Page Load Time:** < 3s on 3G networks, < 1s on WiFi
- **Memory Usage:** < 100MB increase during operation
- **Database Queries:** Optimized with proper indexing

---

## Deployment

### Production Environment Requirements

**Server Requirements:**

- Node.js 16.0+
- 2GB+ RAM
- 10GB+ storage
- SSL certificate for HTTPS (required for PWA)

**Recommended Stack:**

- **Server:** Ubuntu 20.04+ or CentOS 8+
- **Reverse Proxy:** Nginx
- **Process Manager:** PM2
- **Database:** SQLite3 (or PostgreSQL for high-volume deployments)

### Docker Deployment

**Dockerfile:**

```dockerfile
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN npm run build

EXPOSE 3001

USER node

CMD ["node", "backend/server.js"]
```

**Docker Compose:**

```yaml
version: '3.8'
services:
  sommos:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_PATH=/app/data/sommos.db
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
    restart: unless-stopped
```

**Deploy with Docker:**

```bash
docker-compose up -d
```

### Cloud Deployment

#### AWS Deployment

**Using Elastic Beanstalk:**

1. Create Elastic Beanstalk application
2. Configure environment variables
3. Deploy using EB CLI:

   ```bash
   eb init
   eb create production
   eb deploy
   ```

**Using ECS:**

1. Build and push Docker image to ECR
2. Create ECS service
3. Configure load balancer and auto-scaling

#### Azure Deployment

**Using App Service:**

1. Create App Service plan
2. Deploy from GitHub or Docker Hub
3. Configure custom domain and SSL

#### Google Cloud Deployment

**Using Cloud Run:**

1. Build container image
2. Deploy to Cloud Run:

   ```bash
   gcloud run deploy sommos --image gcr.io/PROJECT-ID/sommos
   ```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}
```

### Environment Variables for Production

```bash
# Production Configuration
NODE_ENV=production
PORT=3001

# Database
DATABASE_PATH=/app/data/sommos.db

# Security
JWT_SECRET=your-secure-jwt-secret-here

# AI Features
OPENAI_API_KEY=your-openai-key

# Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true

# Performance
NODE_OPTIONS="--max-old-space-size=512"
```

### Backup and Monitoring

**Database Backup:**

```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d)
sqlite3 /app/data/sommos.db ".backup /backups/sommos_$DATE.db"

# Keep last 30 days
find /backups -name "sommos_*.db" -mtime +30 -delete
```

**Health Check:**

```bash
# Health check endpoint
curl -f http://localhost:3001/api/system/health || exit 1
```

**Process Monitoring with PM2:**

```bash
pm2 start backend/server.js --name sommos
pm2 startup
pm2 save
pm2 monit
```

### SSL Certificate Setup

**Using Let's Encrypt:**

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Performance Optimization for Production

1. **Enable Gzip compression**
2. **Configure CDN for static assets**
3. **Implement database connection pooling**
4. **Set up Redis caching (optional)**
5. **Configure log rotation**
6. **Enable HTTP/2**
7. **Implement rate limiting**
8. **Monitor with tools like New Relic or DataDog**

---

## User Manual

### Getting Started

#### First Login

1. Access SommOS through your web browser
2. If prompted, allow the app to install as a PWA
3. The dashboard will display your wine collection overview

#### Navigation

- **Dashboard:** Overview of your collection with charts and recent activity
- **Inventory:** Browse and manage your wine collection
- **Pairing:** Get AI-powered wine pairing recommendations
- **Procurement:** (Future feature) Manage suppliers and purchases
- **Catalog:** Browse the complete wine database

### Managing Your Wine Collection

#### Adding Wines

1. Go to the **Inventory** section
2. Click **Add Wine** (if available) or use the import feature
3. Fill in wine details:
   - Name and producer
   - Region and country
   - Wine type and vintage year
   - Storage location
   - Quantity and cost

#### Recording Wine Consumption

1. Find the wine in your inventory
2. Click **Serve** on the wine card
3. Select the storage location
4. Enter the quantity consumed
5. Add notes about the occasion or guests
6. Click **Record Service**

#### Moving Wines Between Locations

Wines can be stored in different locations on your yacht:

- **Main Cellar:** Primary storage
- **Service Bar:** Ready for immediate service  
- **Deck Storage:** Casual dining wines
- **Private Reserve:** Special occasion wines

To move wines:

1. Find the wine in inventory
2. Click on the wine card for options
3. Select **Move**
4. Choose source and destination locations
5. Enter quantity and notes

#### Reserving Wines

Reserve wines for special occasions:

1. Click **Reserve** on a wine card
2. Select the location
3. Enter quantity to reserve
4. Add notes about the reservation
5. Reserved wines are tracked separately from available stock

### Wine Pairing Recommendations

#### Getting Pairing Suggestions

1. Go to the **Pairing** section
2. Describe your dish in detail
3. Select the dining occasion:
   - Casual dining
   - Formal dinner  
   - Deck party
   - Romantic dinner
4. Enter guest count
5. Add any guest preferences or restrictions
6. Click **Get Pairings**

#### Understanding Pairing Results

Each recommendation includes:

- **Wine Details:** Name, producer, vintage, region
- **Confidence Score:** How well the wine matches (0-100%)
- **Pairing Reasoning:** Why this wine works with your dish
- **Availability:** Current stock levels and location
- **Action Buttons:** Reserve or serve the wine directly

### Search and Filters

#### Searching Your Collection

Use the search bar to find wines by:

- Wine name
- Producer name
- Region
- Grape variety
- Tasting notes

#### Using Filters

Filter your collection by:

- **Wine Type:** Red, White, Sparkling, Rosé, Dessert
- **Location:** Main Cellar, Service Bar, etc.
- **Availability:** Show only available wines
- **Price Range:** Filter by cost per bottle
- **Vintage Year:** Specific years or ranges

### Inventory Insights

#### Dashboard Charts

- **Wine Type Distribution:** See your collection breakdown
- **Stock by Location:** Monitor storage distribution
- **Recent Activity:** Track consumption and additions

#### Understanding Wine Cards

Each wine displays:

- Wine type badge with icon
- Name, producer, and vintage
- Region and country
- Current stock quantity and location
- Cost per bottle
- Action buttons (Reserve, Serve, Details)

### Mobile Usage

#### PWA Installation

On mobile devices:

1. Open SommOS in your browser
2. Look for "Add to Home Screen" prompt
3. Tap "Install" or "Add"
4. The app icon will appear on your home screen

#### Offline Usage

When internet is unavailable:

- Browse previously loaded wines
- View cached pairing recommendations
- Data syncs automatically when connection returns
- Offline indicator shows current status

#### Sync Conflict Resolution Rules

- **Metadata fields follow last-write-wins (LWW):** Each mutation carries `updated_at`, `updated_by`, `op_id`, and `origin`. The server compares timestamps and replaces metadata with the most recent change when concurrent edits occur.
- **Inventory deltas are additive:** Stock movements append ledger entries and adjust quantities incrementally so parallel receipts and consumptions accumulate rather than overwrite.
- **Negative stock is rejected with HTTP 409:** If a request would drive available inventory below zero, the API returns a 409 Conflict with an explanatory error so the client can reconcile before retrying.

### Troubleshooting

#### Common Issues

**App won't load:**

- Check internet connection
- Clear browser cache
- Try refreshing the page
- Check if JavaScript is enabled

**Pairing recommendations not working:**

- Ensure internet connectivity
- Check if AI features are enabled
- Try simplifying your dish description

**Charts not displaying:**

- Check if you have wines in your collection
- Try refreshing the page
- Ensure JavaScript is enabled

**Offline mode not working:**

- Make sure you've loaded the app online first
- Check browser support for Service Workers
- Clear cache and reload

#### Getting Help

For technical support:

1. Check the troubleshooting section
2. Review browser compatibility requirements
3. Contact your system administrator
4. Submit detailed bug reports with:
   - Browser and version
   - Device information
   - Steps to reproduce the issue
   - Screenshots (if applicable)

### Best Practices

#### Wine Data Management

- Keep wine information updated and accurate
- Use consistent naming conventions
- Add detailed tasting notes
- Record service occasions for future reference

#### Storage Location Management

- Keep frequently served wines in the service bar
- Store special occasion wines in the private reserve
- Use main cellar for long-term storage
- Consider temperature and accessibility for each location

#### Pairing Requests

- Be specific about cooking methods and ingredients
- Mention guest preferences and dietary restrictions
- Consider the dining environment and occasion
- Try different phrasing if results aren't satisfactory

---

## Contributing

### Development Setup

1. **Fork the repository**
2. **Create a feature branch:**

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Install dependencies:**

   ```bash
   npm install
   ```

4. **Set up development environment:**

   ```bash
   cp .env.example .env
   # Configure your development settings
   ```

5. **Run tests:**

   ```bash
   npm test
   ```

### Code Standards

- **JavaScript:** ES6+ with consistent formatting
- **CSS:** BEM methodology for class naming
- **Database:** Descriptive column names and proper indexing
- **API:** RESTful design with consistent response formats
- **Testing:** Comprehensive test coverage for new features

### Commit Guidelines

Use conventional commits:

- `feat:` New features
- `fix:` Bug fixes  
- `docs:` Documentation updates
- `test:` Test additions or updates
- `refactor:` Code refactoring
- `style:` Code formatting changes

Example:

```bash
git commit -m "feat: add wine reservation functionality"
```

### Pull Request Process

1. **Update documentation** for any new features
2. **Add tests** for new functionality
3. **Ensure all tests pass**
4. **Update the changelog** if applicable
5. **Submit PR** with detailed description

### Reporting Issues

When reporting bugs:

1. **Check existing issues** first
2. **Use the issue template**
3. **Provide reproduction steps**
4. **Include environment details**
5. **Add screenshots** if helpful

### Feature Requests

For new features:

1. **Describe the use case**
2. **Explain the expected behavior**
3. **Consider implementation complexity**
4. **Discuss potential impact**

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Support

For support and questions:

- 📧 Email: <support@sommos.app>
- 📖 Documentation: <https://docs.sommos.app>
- 🐛 Issues: GitHub Issues
- 💬 Discussions: GitHub Discussions

---

**SommOS** - Elevating yacht hospitality through intelligent wine management.

*Built with ❤️ for luxury yacht experiences.*
