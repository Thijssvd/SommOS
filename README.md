# SommOS - Yacht Sommelier Operating System

[![Test Suite](https://github.com/Thijssvd/SommOS/actions/workflows/tests.yml/badge.svg)](https://github.com/Thijssvd/SommOS/actions/workflows/tests.yml)
[![CI](https://github.com/Thijssvd/SommOS/actions/workflows/ci.yml/badge.svg)](https://github.com/Thijssvd/SommOS/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An offline-first Progressive Web Application (PWA) for luxury yacht wine management with AI-powered pairing recommendations, weather intelligence, and comprehensive inventory management.

![SommOS Overview](https://img.shields.io/badge/Status-Production%20Ready-brightgreen) ![Node.js](https://img.shields.io/badge/Node.js-16.0+-green) ![SQLite](https://img.shields.io/badge/SQLite-3.0+-blue) ![PWA](https://img.shields.io/badge/PWA-Ready-purple)

## 📋 Table of Contents

- [Overview](#-overview)
- [✨ Key Features](#-key-features)
- [🏗️ Architecture](#️-architecture)
- [🚀 Quick Start](#-quick-start)
- [⚙️ Installation](#️-installation)
- [🔧 Configuration](#-configuration)
- [📚 API Reference](#-api-reference)
- [📱 User Guide](#-user-guide)
- [🧪 Testing](#-testing)
- [🚢 Deployment](#-deployment)
- [💻 Development](#-development)
- [🤝 Contributing](#-contributing)
- [📞 Support](#-support)

## 🌟 Overview

SommOS is a comprehensive wine management system designed specifically for luxury yachts. It combines advanced inventory management, AI-powered wine pairing recommendations, weather-informed vintage intelligence, and procurement optimization in a modern Progressive Web Application.

Built for the unique challenges of yacht environments:
- **Offline-first design** for remote locations
- **Mobile-optimized interface** for touch devices
- **Real-time synchronization** when connectivity is available
- **Progressive Web App** installation for native-like experience

## ✨ Key Features

### 🍷 Wine Inventory Management
- **Multi-location storage tracking** (Main Cellar, Service Bar, Deck Storage, Private Reserve)
- **Real-time stock management** with transaction history and audit trails
- **Vintage-specific inventory** with detailed wine metadata
- **Automated low-stock alerts** and procurement suggestions

### 🤖 AI-Powered Wine Pairing
- **Intelligent dish pairing** using DeepSeek (primary) or OpenAI (fallback)
- **Context-aware recommendations** considering occasion, guest preferences, and weather
- **Confidence scoring** (0-100%) with detailed reasoning
- **Traditional fallback pairing** when AI services are unavailable

### 📊 Vintage Intelligence
- **Weather data integration** from Open-Meteo API for vintage analysis
- **Quality scoring and aging predictions** based on historical weather patterns
- **Regional wine insights** with climate impact analysis
- **Procurement optimization** with vintage availability forecasting

### 🚢 Yacht-Specific Features
- **Offline-first PWA** that works without internet connectivity
- **Mobile-optimized interface** for touch devices and small screens
- **Guest access system** for wine tastings and events
- **Multi-language support** for international crews

### 💰 Procurement Management
- **Supplier relationship management** with performance tracking
- **Automated purchase recommendations** based on consumption patterns
- **Cost analysis and budget optimization**
- **Purchase order generation** and tracking

## 🏗️ Architecture

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
│  │   SQLite3   │  │   DeepSeek  │  │ Open-Meteo  │            │
│  │  Optimized  │  │    API      │  │  Weather    │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Backend:**
- Node.js with Express.js framework
- SQLite3 database with optimized indexes
- DeepSeek API (primary) or OpenAI API (fallback) for AI pairing
- Open-Meteo API for weather data
- Comprehensive security middleware (Helmet, CORS, Rate Limiting)

**Frontend:**
- Vanilla JavaScript (ES6+) for optimal performance
- Progressive Web App (PWA) with Service Workers
- Chart.js for data visualization
- Responsive CSS Grid/Flexbox layout
- IndexedDB for offline data storage

**Development & Testing:**
- Jest for unit and integration testing
- Playwright for end-to-end testing
- ESLint and Prettier for code quality
- Docker for containerized deployment

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)

```bash
git clone https://github.com/Thijssvd/SommOS.git
cd SommOS
npm install
./setup.sh          # Interactive API key configuration
./deployment/deploy.sh  # One-click deployment
```

**Access**: <http://localhost:3000> after deployment

### Option 2: Manual Setup

1. **Clone and Install**
   ```bash
   git clone https://github.com/Thijssvd/SommOS.git
   cd SommOS
   npm install
   ```

2. **Configure API Keys**
   ```bash
   cp .env.example .env
   nano .env  # Edit with your keys
   ```

   **Optional (for AI features)**:
   - **DeepSeek API Key (Primary)**: Get from `https://platform.deepseek.com/api_keys`
   - **OpenAI API Key (Fallback)**: Get from `https://platform.openai.com/api-keys`
   - **Open-Meteo**: FREE! Leave empty for 10,000 requests/day

3. **Deploy**
   ```bash
   ./deployment/deploy.sh
   ```

### Development Mode

```bash
npm run dev       # Development server
npm test          # Run test suite
npm run test:e2e  # Run E2E tests
```

## ⚙️ Installation

### Prerequisites

- Node.js 16.0+
- npm 8.0+
- SQLite3
- Modern web browser with PWA support

### Environment Configuration

Create a `.env` file based on `.env.example`:

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | Local HTTP port for the API gateway (defaults to `3001`) |
| `NODE_ENV` | No | Runtime mode (`development` or `production`) |
| `DATABASE_PATH` | No | Location of the SQLite database file |
| `SESSION_SECRET` | Yes (prod) | Secret used to sign session cookies |
| `JWT_SECRET` | Yes (prod) | Secret used to issue API access tokens |
| `DEEPSEEK_API_KEY` | Optional | Enables AI features (primary provider) |
| `OPENAI_API_KEY` | Optional | AI fallback if DeepSeek not configured |
| `OPEN_METEO_BASE` | No | Open-Meteo API base URL (defaults to free tier) |

### Database Setup

```bash
# Initialize database with schema and sample data
npm run setup:db

# Import sample wine data (optional)
npm run import:cellar

# Verify environment configuration
npm run verify:env
```

## 🔧 Configuration

### AI Integration Setup

SommOS prefers DeepSeek as the primary AI provider with automatic fallback to OpenAI:

```bash
# .env
# AI Configuration (optional)
DEEPSEEK_API_KEY=sk-your-deepseek-key-here    # Primary AI provider
OPENAI_API_KEY=sk-your-openai-key-here        # Fallback AI provider
```

**Runtime Behavior:**
- Uses `DEEPSEEK_API_KEY` if present, otherwise falls back to `OPENAI_API_KEY`
- Provides traditional rule-based pairing when AI services are unavailable
- 30-second timeout for AI API calls with automatic retry logic

### Guest Access Configuration

Enable temporary guest access for wine tastings and events:

```bash
# Create guest invitation via API
curl -X POST http://localhost:3001/api/auth/invite \
  -H "Content-Type: application/json" \
  -d '{
    "email": "wine-tasting-event@local",
    "role": "guest",
    "expires_in_hours": 24,
    "pin": "1234"
  }'
```

## 📚 API Reference

### Base URL
```
http://localhost:3001/api
```

### Authentication

All mutation endpoints require authentication. Development mode can disable auth by setting `SOMMOS_AUTH_DISABLED=true`.

### Core Endpoints

#### System Health
```http
GET /api/system/health
```

Returns system status and statistics:
```json
{
  "success": true,
  "status": "healthy",
  "data": {
    "total_wines": 1250,
    "total_vintages": 2100,
    "total_bottles": 15600,
    "active_suppliers": 45
  }
}
```

#### Wine Pairing Recommendations
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

#### Quick Pairing (Fallback)
```http
POST /api/pairing/quick
Content-Type: application/json

{
  "dish": "Beef tenderloin",
  "context": {
    "occasion": "formal-dining"
  }
}
```

#### Inventory Management
```http
# Get stock levels
GET /api/inventory/stock?location=main-cellar&wine_type=Red

# Record consumption
POST /api/inventory/consume
Content-Type: application/json

{
  "vintage_id": "vintage-123",
  "location": "main-cellar",
  "quantity": 2,
  "notes": "Served at dinner"
}
```

#### Wine Catalog
```http
# Search wines
GET /api/wines?search=Bordeaux&wine_type=Red&limit=50

# Add new wine
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

## 📱 User Guide

### Getting Started

#### First Login
1. Access SommOS through your web browser at `http://localhost:3000`
2. If prompted, allow the app to install as a PWA
3. The dashboard displays your wine collection overview

#### Navigation
- **Dashboard:** Collection overview with charts and recent activity
- **Inventory:** Browse and manage your wine collection
- **Pairing:** Get AI-powered wine pairing recommendations
- **Catalog:** Browse the complete wine database
- **Procurement:** Manage suppliers and purchases (coming soon)

### Wine Inventory Management

#### Adding Wines
1. Go to **Inventory** section
2. Click **Add Wine** or use import features
3. Fill in wine details (name, producer, region, type, vintage)
4. Set storage location and quantity
5. Add cost information for procurement tracking

#### Recording Wine Consumption
1. Find the wine in your inventory
2. Click **Serve** on the wine card
3. Select storage location and quantity consumed
4. Add notes about the occasion or guests
5. Click **Record Service**

#### Managing Storage Locations
Wines can be stored in different yacht locations:

- **Main Cellar:** Primary long-term storage
- **Service Bar:** Ready for immediate service
- **Deck Storage:** Casual dining wines, weather considerations
- **Private Reserve:** Special occasion wines, restricted access

To move wines between locations:
1. Find the wine in inventory
2. Click **Move** on the wine card
3. Select source and destination locations
4. Enter quantity and notes

### AI-Powered Wine Pairing

#### Getting Recommendations
1. Go to **Pairing** section
2. Describe your dish in detail
3. Select dining occasion and guest count
4. Add guest preferences or dietary restrictions
5. Click **Get Pairings**

#### Understanding Results
Each recommendation includes:
- **Wine Details:** Name, producer, vintage, region
- **Confidence Score:** Match quality (0-100%)
- **Pairing Reasoning:** Why this wine works with your dish
- **Availability:** Current stock levels and location
- **Actions:** Reserve or serve the wine directly

### Search and Filtering

#### Searching
Use the search bar to find wines by:
- Wine name or producer
- Region or country
- Grape variety
- Tasting notes

#### Filtering Options
- **Wine Type:** Red, White, Sparkling, Rosé, Dessert, Fortified
- **Storage Location:** Filter by current location
- **Availability:** Show only available wines
- **Price Range:** Filter by cost per bottle
- **Vintage Year:** Specific years or ranges

### Guest Access System

#### For Guests
1. Visit login page and click **"Guest Access"** tab
2. Enter event code provided by crew
3. Enter PIN if required
4. Browse collection with read-only access

#### Guest Features
- ✅ Browse wine collection (read-only)
- ✅ View wine details and pairings
- ✅ Search and filter wines
- ✅ 4-hour session duration
- ✅ Optional PIN protection
- ❌ Cannot edit inventory
- ❌ Cannot access admin functions

## 🧪 Testing

### Test Suite Overview

SommOS includes comprehensive testing with 600+ tests across multiple layers:

- **Unit & Integration Tests:** Jest tests for backend and frontend
- **E2E Tests:** Playwright tests for critical user workflows
- **Performance Tests:** Load testing and optimization verification
- **Flakiness Detection:** Automated detection of inconsistent tests

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run E2E tests
npm run test:e2e

# Run E2E tests in UI mode
npm run test:e2e:ui

# Detect flaky tests locally
npm run test:flaky
```

### Performance Benchmarks

Target metrics for yacht environments:
- **API Response Time:** < 200ms (simple queries), < 2s (complex queries)
- **Page Load Time:** < 3s on 3G, < 1s on WiFi
- **Memory Usage:** < 100MB increase during operation
- **Offline Performance:** Full functionality without internet

## 🚢 Deployment

### Production Requirements

**Server Requirements:**
- Node.js 16.0+
- 2GB+ RAM
- 10GB+ storage
- SSL certificate (required for PWA)

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

**Deploy with Docker Compose:**
```bash
docker-compose up -d
```

### Cloud Platforms

#### AWS (Elastic Beanstalk)
```bash
eb init
eb create production
eb deploy
```

#### Google Cloud (Cloud Run)
```bash
gcloud run deploy sommos --image gcr.io/PROJECT-ID/sommos
```

#### Azure (App Service)
Deploy from GitHub or Docker Hub with custom domain and SSL.

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
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## 💻 Development

### Project Structure

```
SommOS/
├── frontend/           # Progressive Web App (vanilla JS)
│   ├── js/             # Application modules (SommOS, SommOSAPI, UI)
│   ├── css/            # Stylesheets
│   ├── sw.js           # Service worker
│   └── index.html      # Main HTML file
├── backend/            # Node.js API server
│   ├── api/            # REST API endpoints
│   ├── core/           # Business logic engines
│   ├── database/       # Schema, migrations, seed data
│   └── config/         # Environment and security
├── scripts/            # Utility scripts
├── tests/              # Test suites
└── docs/               # Documentation
```

### Key Classes

#### SommOSAPI
Handles all API communication with offline fallback:

```javascript
const api = new SommOSAPI();

// Get inventory with error handling
const inventory = await api.getInventory({ location: 'main-cellar' });

// Post with validation
await api.consumeWine(vintageId, location, quantity, notes);
```

#### SommOSUI
Manages UI components and interactions:

```javascript
const ui = new SommOSUI();

// Show notifications
ui.showToast('Wine added successfully', 'success');

// Display modals
ui.showModal('Wine Details', content);

// Loading states
ui.showLoading('save-button');
```

### Development Commands

```bash
# Development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Test with coverage
npm test -- --coverage

# E2E testing
npm run test:e2e

# Code quality
npm run lint
npm run format

# Database management
npm run setup:db        # Initialize database
npm run import:cellar   # Import sample data
npm run verify:env      # Check configuration
```

### Code Standards

- **JavaScript:** ES6+ with consistent formatting
- **CSS:** BEM methodology for class naming
- **Database:** Snake_case columns with proper indexing
- **API:** RESTful design with consistent response formats
- **Testing:** Comprehensive coverage for new features

## 🤝 Contributing

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
   npm run verify:env
   ```

5. **Run tests:**
   ```bash
   npm test
   ```

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

1. **Update documentation** for new features
2. **Add tests** for new functionality
3. **Ensure all tests pass**
4. **Update changelog** if applicable
5. **Submit PR** with detailed description

## 📞 Support

For support and questions:

- 📧 **Email:** <support@sommos.app>
- 📖 **Documentation:** <https://docs.sommos.app>
- 🐛 **Issues:** [GitHub Issues](https://github.com/Thijssvd/SommOS/issues)
- 💬 **Discussions:** [GitHub Discussions](https://github.com/Thijssvd/SommOS/discussions)

---

**SommOS** - Elevating yacht hospitality through intelligent wine management.

*Built with ❤️ for luxury yacht experiences.*
