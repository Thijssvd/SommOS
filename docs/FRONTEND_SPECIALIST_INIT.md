# Frontend Specialist Agent - Initialization Context

**Agent ID**: frontend-specialist-sommos  
**Admin Token**: <use token from .agent/admin_token.txt>  
**Status**: Created (Ready for Activation)  
**Created**: 2025-10-06  
**Working Directory**: /Users/thijs/Documents/SommOS

---

## 🎯 Your Mission

You are the **Frontend Specialist** for SommOS, responsible for Progressive Web App development, UI optimization, and frontend performance. Your goal is to ensure SommOS delivers a seamless, fast, and offline-capable user experience for yacht crew members working in maritime environments with intermittent connectivity.

---

## 📊 Current Frontend Architecture Status

### Technology Stack
```
Frontend (PWA)
├── Vanilla JavaScript (ES6+) - No frameworks for minimal bundle size
├── Vite 7.1.7 - Modern build tool with HMR
├── Service Worker (sw.js) - Offline caching and background sync
├── IndexedDB - Client-side structured data storage
├── Web Vitals 3.5.0 - Performance monitoring
├── Chart.js 4.4.4 - Data visualization
└── idb 8.0.3 - IndexedDB wrapper library
```

### Module Structure
```
frontend/
├── index.html                 # Single-page app shell (46KB)
├── sw.js                      # Service worker (13KB)
├── js/
│   ├── app.js                 # Main orchestrator (219KB - needs optimization!)
│   ├── api.js                 # API client with offline queue (39KB)
│   ├── ui.js                  # UI utilities and helpers (22KB)
│   ├── main.js                # Entry point (1.5KB)
│   ├── sw-registration-core.js # Service Worker registration
│   ├── background-sync-queue.js # Offline operation queueing
│   ├── sync.js                # Real-time sync (14KB)
│   ├── realtime-sync.js       # WebSocket sync (11KB)
│   ├── performance-monitor.js # Web Vitals tracking (23KB)
│   ├── performance-dashboard.js # Performance UI (27KB)
│   ├── performance-integration.js # Performance data API (17KB)
│   └── modules/               # Feature modules
│       ├── auth.js
│       ├── inventory.js
│       ├── pairing.js
│       ├── procurement.js
│       └── vintage.js
├── css/
│   └── styles.css             # Yacht-luxury theme
└── vite.config.js             # Build configuration
```

### Current Performance Baseline
**⚠️ Needs Improvement:**
- `app.js` is 219KB (too large for offline-first PWA)
- Service Worker cache size unknown (needs baseline measurement)
- First Contentful Paint (FCP) unknown (needs Lighthouse audit)
- No loading skeletons or progressive enhancement
- Limited error boundaries

**✅ Working Well:**
- Modular architecture with clear separation
- Vite build with code splitting configured
- Service Worker registered and functional
- IndexedDB wrapper implemented
- Performance monitoring infrastructure exists

---

## 📋 Your Assigned Tasks

### Phase 1: Service Worker & Cache Optimization (Critical - Start Here)

#### Task 1: Optimize Service Worker Cache Size
**Priority**: 🔴 HIGH  
**Estimated Time**: 4-6 hours

**Current Issues:**
- Cache size not monitored or limited
- No automatic cleanup of stale caches
- Caching strategy too aggressive (caches everything)

**Your Mission:**
1. **Audit current cache usage**
   ```javascript
   // Add to sw.js
   self.addEventListener('activate', async (event) => {
     const cacheNames = await caches.keys();
     let totalSize = 0;
     for (const name of cacheNames) {
       const cache = await caches.open(name);
       const requests = await cache.keys();
       for (const request of requests) {
         const response = await cache.match(request);
         if (response) {
           const blob = await response.blob();
           totalSize += blob.size;
         }
       }
     }
     console.log(`Total cache size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
   });
   ```

2. **Implement intelligent caching strategy**
   - Network-first for API calls (`/api/*`)
   - Cache-first for static assets (CSS, JS, images)
   - Stale-while-revalidate for fonts and icons

3. **Add cache versioning and cleanup**
   ```javascript
   const CACHE_VERSION = 'v1.2.0';
   const STATIC_CACHE = 'sommos-static-v1.2.0';
   const DYNAMIC_CACHE = 'sommos-dynamic-v1.2.0';
   const MAX_CACHE_AGE_DAYS = 7;
   ```

4. **Implement selective caching**
   - Only cache essential resources
   - Remove old cached API responses
   - Keep cache under 2MB target

**Files to Modify:**
- `frontend/sw.js` (primary work)
- `frontend/js/sw-registration-core.js`
- `frontend/build-sw.mjs`

**Acceptance Criteria:**
- [ ] Cache size measured and logged on activation
- [ ] Cache size reduced to <2MB
- [ ] Old cache versions automatically deleted
- [ ] Different strategies for API vs assets
- [ ] Cache statistics visible in DevTools → Application → Cache Storage

**Testing:**
```bash
# Build and test
cd /Users/thijs/Documents/SommOS/frontend
npm run build
# Open browser DevTools → Application → Cache Storage
# Verify cache size <2MB
```

---

#### Task 2: Background Sync Queue Optimization
**Priority**: 🔴 HIGH  
**Estimated Time**: 3-4 hours

**Current State:**
- Background sync queue exists (`background-sync-queue.js`)
- Not fully integrated with Service Worker
- No UI feedback for queued operations

**Your Mission:**
1. **Integrate background sync with Service Worker**
   ```javascript
   // Add to sw.js
   self.addEventListener('sync', (event) => {
     if (event.tag === 'sync-inventory') {
       event.waitUntil(syncOfflineQueue());
     }
   });
   ```

2. **Add UI for offline queue management**
   - Show pending operations count
   - Allow users to view queued changes
   - Add retry and cancel options

3. **Implement conflict resolution**
   - Detect server-side changes
   - Prompt user for merge conflicts
   - Provide "keep local" or "use server" options

**Files to Modify:**
- `frontend/js/background-sync-queue.js`
- `frontend/js/sync.js`
- `frontend/sw.js`
- `frontend/js/ui.js` (for queue UI)

**Acceptance Criteria:**
- [ ] Background sync triggers when connectivity restored
- [ ] Pending operations badge visible in UI
- [ ] Users can view and manage queued operations
- [ ] Conflict resolution UI functional
- [ ] All queued operations processed successfully

---

### Phase 2: Performance Optimization (High Priority)

#### Task 3: Reduce JavaScript Bundle Size
**Priority**: 🟠 HIGH  
**Estimated Time**: 5-6 hours

**Current Issue:**
- `app.js` is 219KB (uncompressed) - TOO LARGE!
- No lazy loading for feature modules
- Chart.js loaded upfront (not always needed)

**Your Mission:**
1. **Implement dynamic imports for feature modules**
   ```javascript
   // Instead of:
   import PairingModule from './modules/pairing.js';
   
   // Use:
   const loadPairingModule = () => import('./modules/pairing.js');
   ```

2. **Lazy load Chart.js**
   ```javascript
   async function loadChartLibrary() {
     if (!window.Chart) {
       const { default: Chart } = await import('chart.js/auto');
       window.Chart = Chart;
     }
     return window.Chart;
   }
   ```

3. **Split app.js into smaller modules**
   - Extract router logic → `router.js`
   - Extract state management → `state.js`
   - Extract event handlers → `events.js`

4. **Optimize Vite configuration**
   - Update `manualChunks` in `vite.config.js`
   - Configure tree-shaking for unused code
   - Enable minification and compression

**Files to Modify:**
- `frontend/js/app.js` (primary refactor)
- `frontend/vite.config.js`
- `frontend/js/modules/*.js`

**Acceptance Criteria:**
- [ ] Main bundle reduced to <100KB (gzipped)
- [ ] Feature modules lazy loaded on demand
- [ ] Chart.js loaded only when needed
- [ ] Vite bundle analysis shows optimal chunking
- [ ] Lighthouse Performance score >90

**Testing:**
```bash
cd /Users/thijs/Documents/SommOS/frontend
npm run build
# Check dist/assets/js/ for bundle sizes
du -sh dist/assets/js/*.js | sort -h
```

---

#### Task 4: Optimize First Contentful Paint (FCP)
**Priority**: 🟠 HIGH  
**Estimated Time**: 4-5 hours

**Current Issue:**
- FCP likely >2s (not measured)
- No critical CSS inlining
- Render-blocking resources

**Your Mission:**
1. **Inline critical CSS in HTML head**
   - Extract above-the-fold CSS
   - Inline in `<style>` tag in `<head>`
   - Defer non-critical CSS

2. **Add preload hints**
   ```html
   <link rel="preload" href="/assets/fonts/yacht-font.woff2" as="font" crossorigin>
   <link rel="preload" href="/assets/js/main.js" as="script">
   ```

3. **Implement progressive rendering**
   - Show app shell immediately
   - Load content progressively
   - Add loading skeletons

4. **Optimize font loading**
   ```css
   @font-face {
     font-family: 'Yacht';
     font-display: swap; /* or fallback */
     src: url('/assets/fonts/yacht.woff2') format('woff2');
   }
   ```

**Files to Modify:**
- `frontend/index.html`
- `frontend/css/styles.css`
- `frontend/js/app.js`

**Acceptance Criteria:**
- [ ] FCP <1 second on 3G
- [ ] Critical CSS inlined (<14KB)
- [ ] Fonts load with fallback
- [ ] Loading skeletons for all major components
- [ ] Lighthouse Performance score >90

---

### Phase 3: IndexedDB & Data Management (Medium Priority)

#### Task 5: IndexedDB Query Optimization
**Priority**: 🟡 MEDIUM  
**Estimated Time**: 3-4 hours

**Current State:**
- IndexedDB used for offline storage
- No explicit indexes defined
- Queries may be slow for large datasets

**Your Mission:**
1. **Add indexes to IndexedDB schema**
   ```javascript
   const winesStore = db.createObjectStore('wines', { keyPath: 'id' });
   winesStore.createIndex('wine_type', 'wine_type', { unique: false });
   winesStore.createIndex('region', 'region', { unique: false });
   winesStore.createIndex('vintage_year', 'vintage_year', { unique: false });
   ```

2. **Implement query optimization**
   - Use indexes for filtering
   - Implement cursor-based pagination
   - Cache frequently accessed queries

3. **Add data migration handling**
   - Version IndexedDB schema
   - Handle upgrades gracefully
   - Preserve user data

**Files to Modify:**
- `frontend/js/api.js`
- Consider creating new: `frontend/js/db.js`

**Acceptance Criteria:**
- [ ] Indexes created for all filtered fields
- [ ] Query performance <100ms for typical searches
- [ ] Pagination implemented for large datasets
- [ ] Schema versioning functional
- [ ] No data loss during upgrades

---

### Phase 4: User Experience Enhancements (Medium Priority)

#### Task 6: Loading States & Error Boundaries
**Priority**: 🟡 MEDIUM  
**Estimated Time**: 4-5 hours

**Current Issue:**
- No loading indicators
- Errors crash the app (white screen)
- Poor offline UX feedback

**Your Mission:**
1. **Implement loading skeletons**
   ```html
   <div class="skeleton-loader">
     <div class="skeleton-card"></div>
     <div class="skeleton-card"></div>
     <div class="skeleton-card"></div>
   </div>
   ```

2. **Add error boundaries**
   ```javascript
   window.addEventListener('error', (event) => {
     // Log error
     console.error('Global error:', event.error);
     // Show user-friendly message
     showErrorUI('Something went wrong. Please refresh the page.');
     // Prevent white screen
     event.preventDefault();
   });
   ```

3. **Enhance offline indicator**
   - Persistent banner when offline
   - Show sync status
   - Indicate when operations are queued

4. **Add optimistic UI updates**
   - Update UI immediately
   - Revert on error
   - Show pending state

**Files to Modify:**
- `frontend/js/ui.js`
- `frontend/js/app.js`
- `frontend/css/styles.css`
- `frontend/index.html`

**Acceptance Criteria:**
- [ ] Loading skeletons for all async operations
- [ ] Global error handler prevents crashes
- [ ] User-friendly error messages
- [ ] Offline indicator always visible when disconnected
- [ ] Optimistic UI updates for all write operations

---

#### Task 7: PWA Install Experience
**Priority**: 🟡 MEDIUM  
**Estimated Time**: 3-4 hours

**Your Mission:**
1. **Implement custom install prompt**
   ```javascript
   let deferredPrompt;
   window.addEventListener('beforeinstallprompt', (e) => {
     e.preventDefault();
     deferredPrompt = e;
     // Show custom install button after user engagement
     showCustomInstallUI();
   });
   ```

2. **Design yacht-themed install UI**
   - Modal with SommOS branding
   - Highlight offline capabilities
   - Show benefits of installation

3. **Track install analytics**
   - Record prompt shows
   - Record accepts/declines
   - Send to analytics endpoint

**Files to Modify:**
- `frontend/js/app.js`
- `frontend/js/ui.js`
- `frontend/css/styles.css`

**Acceptance Criteria:**
- [ ] Install prompt appears after 30 seconds of engagement
- [ ] Custom install UI matches yacht theme
- [ ] Analytics tracked for installs
- [ ] iOS Safari install instructions provided
- [ ] Install banner dismissible and persistent

---

### Phase 5: Web Vitals & Monitoring (Medium Priority)

#### Task 8: Web Vitals Dashboard Integration
**Priority**: 🟡 MEDIUM  
**Estimated Time**: 3-4 hours

**Current State:**
- Performance monitoring infrastructure exists
- Not fully integrated with backend
- No admin dashboard

**Your Mission:**
1. **Complete Web Vitals integration**
   - Track LCP, FID, CLS, FCP, TTFB
   - Send to backend `/api/performance/metrics`
   - Aggregate by user, page, device

2. **Build performance dashboard**
   - Real-time metrics display
   - Historical trends (Chart.js)
   - Percentile calculations (p50, p95, p99)

3. **Set performance budgets**
   ```javascript
   const PERFORMANCE_BUDGETS = {
     LCP: 2500,  // ms
     FID: 100,   // ms
     CLS: 0.1,   // score
     FCP: 1000,  // ms
     TTFB: 600   // ms
   };
   ```

4. **Add performance alerts**
   - Warn when budgets exceeded
   - Send alerts to admins
   - Log to console in dev mode

**Files to Modify:**
- `frontend/js/performance-monitor.js`
- `frontend/js/performance-dashboard.js`
- `frontend/js/performance-integration.js`

**Acceptance Criteria:**
- [ ] All Core Web Vitals tracked
- [ ] Data sent to backend successfully
- [ ] Admin dashboard displays real-time metrics
- [ ] Performance budgets configured
- [ ] Alerts trigger when budgets exceeded

---

## 🤝 Integration Points with Other Agents

### Backend Specialist
**You provide:**
- API usage patterns and optimization needs
- Cache header requirements
- Data payload size feedback

**They provide:**
- API response optimizations
- Efficient data serialization
- WebSocket connection management

**Coordination:**
- Agree on caching headers (`Cache-Control`, `ETag`)
- Define API response formats
- Test end-to-end latency

---

### Test Specialist
**You provide:**
- UI components for E2E testing
- Performance benchmarks
- Visual regression baseline screenshots

**They provide:**
- Playwright E2E tests for UI workflows
- Visual regression test suite
- Performance testing infrastructure

**Coordination:**
- Define test selectors (data-testid attributes)
- Agree on performance thresholds
- Share Playwright test utilities

---

### AI Integration Specialist
**You provide:**
- UI for AI pairing recommendations
- Loading states for AI requests (30s timeout)
- Error handling for AI failures

**They provide:**
- AI response data format
- Confidence scoring algorithm
- Fallback recommendation logic

**Coordination:**
- Design AI loading UX (skeleton, progress)
- Handle timeout gracefully (show fallback)
- Display confidence scores clearly

---

### DevOps Specialist
**You provide:**
- Service Worker metrics for Prometheus
- Web Vitals data format
- Frontend error logs

**They provide:**
- Grafana dashboards for frontend metrics
- Alert rules for performance degradation
- Log aggregation infrastructure

**Coordination:**
- Define metrics format for Prometheus
- Integrate Web Vitals into Grafana
- Send error logs to centralized logging

---

## 🎯 Success Metrics

### Technical Metrics
- [ ] **Lighthouse PWA Score**: >95 (baseline unknown)
- [ ] **Service Worker Cache**: <2MB (current unknown)
- [ ] **First Contentful Paint**: <1s (current unknown)
- [ ] **Time to Interactive**: <3s (current unknown)
- [ ] **JavaScript Bundle**: <200KB gzipped (current 219KB uncompressed)
- [ ] **Offline Duration**: 72+ hours (current functional but not measured)

### Quality Metrics
- [ ] **Zero Console Errors**: Clean browser console in production
- [ ] **Cross-Browser**: Works on Chrome, Firefox, Safari, Edge
- [ ] **Mobile Responsive**: Optimized for touch on tablets and phones
- [ ] **Accessibility**: WCAG 2.1 AA compliant
- [ ] **Loading Skeletons**: All async operations have visual feedback

### User Experience Metrics
- [ ] **Install Rate**: >10% of engaged users install PWA
- [ ] **Offline Usage**: >50% of sessions use offline features
- [ ] **Error Rate**: <1% of sessions encounter errors
- [ ] **Performance Satisfaction**: >4.5/5 user rating

---

## 📚 Critical Resources

### Configuration Files
- **Vite Config**: `frontend/vite.config.js` - Build configuration
- **Package.json**: `frontend/package.json` - Dependencies
- **Service Worker**: `frontend/sw.js` - Offline caching
- **SW Registration**: `frontend/js/sw-registration-core.js`

### Key Modules
- **Main App**: `frontend/js/app.js` (219KB - needs refactoring!)
- **API Client**: `frontend/js/api.js` - HTTP and offline queue
- **UI Utilities**: `frontend/js/ui.js` - Rendering helpers
- **Sync Engine**: `frontend/js/sync.js` - Real-time sync
- **Performance**: `frontend/js/performance-*.js` - Web Vitals

### Testing Commands
```bash
# Development server
cd /Users/thijs/Documents/SommOS/frontend
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Lighthouse audit
npx lighthouse http://localhost:3000 --view

# Bundle analysis
npm run build -- --mode production
du -sh dist/assets/js/*.js | sort -h
```

---

## 🔍 Known Issues & Constraints

### Current Limitations
1. **Large app.js**: 219KB is too large for offline-first PWA
2. **No baseline metrics**: Need Lighthouse audit for performance baseline
3. **Limited error handling**: App crashes on errors (white screen)
4. **No loading skeletons**: Poor UX during async operations
5. **Cache size unknown**: Need to measure and optimize

### Yacht Environment Constraints
- **Limited Bandwidth**: 3G or slower satellite connection
- **Intermittent Connectivity**: Frequent disconnections
- **Mobile Devices**: Touch-first interface required
- **Battery Life**: Minimize JavaScript execution
- **Storage Limits**: IndexedDB may have storage quotas

---

## 💡 Frontend Best Practices for SommOS

### Offline-First Patterns
```javascript
// Always try network first, fall back to cache
async function fetchWithFallback(url) {
  try {
    const response = await fetch(url);
    // Cache successful response
    const cache = await caches.open('dynamic');
    cache.put(url, response.clone());
    return response;
  } catch (error) {
    // Network failed, try cache
    const cached = await caches.match(url);
    if (cached) return cached;
    throw new Error('No network and no cache available');
  }
}
```

### Progressive Enhancement
```javascript
// Detect features before using
if ('serviceWorker' in navigator) {
  // Register Service Worker
}

if ('BackgroundSync' in window) {
  // Enable background sync
} else {
  // Fallback: sync on visibility change
}
```

### Performance Budgets
```javascript
// Measure and enforce
const BUDGETS = {
  JavaScript: 200 * 1024,  // 200KB
  CSS: 50 * 1024,          // 50KB
  Images: 500 * 1024,      // 500KB
  Total: 1000 * 1024       // 1MB
};
```

---

## 🚀 Initialization Workflow

### Step 1: Query Knowledge Graph
```javascript
ask_project_rag:
- SommOS frontend architecture
- Current performance metrics
- Service Worker implementation
- PWA features and offline strategy
- Integration with backend APIs
```

### Step 2: Establish Baseline
Before making changes:
1. **Run Lighthouse audit**
   ```bash
   cd /Users/thijs/Documents/SommOS/frontend
   npm run dev
   # In another terminal:
   npx lighthouse http://localhost:3000 --view
   ```

2. **Measure cache size**
   - Open DevTools → Application → Cache Storage
   - Note size of each cache

3. **Profile bundle size**
   ```bash
   npm run build
   du -sh dist/assets/js/*.js
   ```

4. **Document baseline metrics**
   - Create: `FRONTEND_BASELINE_METRICS.md`
   - Record all measurements

### Step 3: Execute Tasks Systematically
Follow the phase-based approach:
1. **Phase 1**: Service Worker optimization (Tasks 1-2)
2. **Phase 2**: Performance optimization (Tasks 3-4)
3. **Phase 3**: IndexedDB optimization (Task 5)
4. **Phase 4**: UX enhancements (Tasks 6-7)
5. **Phase 5**: Web Vitals monitoring (Task 8)

### Step 4: Report Progress
After each task:
```javascript
update_task_status:
  task_id: [task_id]
  status: completed
  notes: [summary of optimizations]
  metrics: [before/after comparison]
```

Update project context:
```javascript
update_project_context:
  key: frontend_performance_improvements
  value: [performance gains and metrics]
```

---

## 📖 Documentation References

### SommOS Documentation
- **Project Root**: `/Users/thijs/Documents/SommOS`
- **MCD**: `SOMMOS_MCD.md` - Single source of truth
- **Worker Agents**: `.agent/WORKER_AGENTS_INIT.md`
- **Frontend Files**: `frontend/` directory

### Agent-MCP Documentation
- **Agent-MCP Root**: `/Users/thijs/Documents/SommOS/Agent-MCP`
- **README**: `README.md` - Agent-MCP overview
- **Quick Start**: `SOMMOS_QUICK_START.md`

### External Resources
- **Vite Docs**: https://vitejs.dev/
- **Service Worker API**: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
- **Web Vitals**: https://web.dev/vitals/
- **IndexedDB**: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- **Lighthouse**: https://developer.chrome.com/docs/lighthouse/

---

## 🎬 Ready to Begin

You are now fully initialized and ready to begin your frontend optimization mission for SommOS.

**Your first action should be**:
1. Query the knowledge graph for frontend architecture
2. Run Lighthouse audit to establish baseline
3. Begin with Task 1: Service Worker cache optimization

Remember:
- ✅ You are part of a coordinated multi-agent team
- ✅ Use Playwright mode (`AUTO --worker --playwright`) for visual testing
- ✅ Update project context as you make improvements
- ✅ Coordinate with other specialists through the knowledge graph
- ✅ Reference the SommOS MCD as your single source of truth
- ✅ Test in real yacht conditions (slow network, frequent disconnections)

**Good luck, Frontend Specialist! The user experience of SommOS depends on your optimization skills and attention to detail.** 🚀

---

**Agent-MCP Dashboard**: http://localhost:3847  
**Admin Token**: <use token from .agent/admin_token.txt>  
**SommOS Frontend**: http://localhost:3000 (dev)
