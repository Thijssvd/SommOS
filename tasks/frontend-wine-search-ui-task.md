# Task: Implement Wine Search UI Component

**Task ID**: To be assigned by Agent-MCP  
**Assigned To**: frontend-specialist-sommos  
**Priority**: High (1)  
**Status**: Created  
**Created**: 2025-10-06  
**Estimated Time**: 4-6 hours

---

## 📋 Task Description

Create a responsive wine search interface for the SommOS wine inventory system.

## 🎯 Requirements

### 1. Real-Time Search Functionality

- Search input with debouncing (300ms delay)
- Search as user types
- Clear search button
- Search across: wine name, producer, region, vintage

### 2. Filter Controls

Implement filtering by:

- **Wine Type**: Red, White, Rosé, Sparkling, Dessert
- **Region/Country**: Dropdown or autocomplete
- **Vintage Year Range**: Slider or dual input (min/max)
- **Stock Status**: In Stock, Low Stock, Out of Stock

### 3. Results Display

Show results in responsive card grid:

- Wine label image (if available)
- Wine name (bold)
- Producer name
- Region/Country
- Vintage year
- Current stock quantity
- Price per bottle
- Quick action buttons (View Details, Add to Event)

### 4. User Experience Features

- Loading states during search
- Empty state message ("No wines found")
- Error handling with user-friendly messages
- Results count ("Showing X of Y wines")
- Sort options (Name, Price, Vintage, Stock)
- Pagination or infinite scroll (if >50 results)

### 5. Mobile Responsiveness

- Touch-friendly filter controls
- Collapsible filter panel on mobile
- Swipeable cards on mobile
- Optimized layout for tablets

---

## 🔌 API Integration

### Endpoint

```
GET /api/inventory/stock
```

### Query Parameters

```javascript
{
  search: string,        // Search term
  wine_type: string,     // Filter by type
  region: string,        // Filter by region
  vintage_min: number,   // Minimum vintage year
  vintage_max: number,   // Maximum vintage year
  min_quantity: number,  // Minimum stock
  sort_by: string,       // Sort field
  sort_order: string,    // 'asc' or 'desc'
  limit: number,         // Results per page
  offset: number         // Pagination offset
}
```

### Expected Response

```javascript
{
  stocks: [
    {
      wine_id: number,
      wine_name: string,
      producer: string,
      region: string,
      country: string,
      wine_type: string,
      vintage_year: number,
      quantity: number,
      location: string,
      price_per_bottle: number,
      last_updated: string
    }
  ],
  total: number,
  filtered: number
}
```

---

## 📁 Files to Create/Modify

### New Files

- `frontend/js/modules/wine-search.js` - Search component logic
- `frontend/css/wine-search.css` - Search UI styles
- `frontend/js/components/wine-card.js` - Wine result card component

### Modified Files

- `frontend/js/app.js` - Import and initialize search module
- `frontend/index.html` - Add search container section
- `frontend/js/api.js` - Add search API method (if not exists)

---

## 🎨 UI Design Guidelines

### Search Bar

```html
<div class="wine-search-container">
  <div class="search-header">
    <input type="search" 
           class="search-input" 
           placeholder="Search wines by name, producer, or region..."
           id="wineSearchInput">
    <button class="search-clear" id="clearSearch">✕</button>
  </div>
</div>
```

### Filter Panel

```html
<div class="filter-panel">
  <div class="filter-group">
    <label>Wine Type</label>
    <select id="filterWineType">
      <option value="">All Types</option>
      <option value="Red">Red</option>
      <option value="White">White</option>
      <!-- ... -->
    </select>
  </div>
  <!-- More filters... -->
</div>
```

### Results Grid

```html
<div class="search-results">
  <div class="results-header">
    <span class="results-count">Showing X of Y wines</span>
    <select class="results-sort">
      <option value="name">Sort by Name</option>
      <option value="price">Sort by Price</option>
      <option value="vintage">Sort by Vintage</option>
    </select>
  </div>
  <div class="wine-grid" id="wineResults">
    <!-- Wine cards inserted here -->
  </div>
</div>
```

---

## ✅ Acceptance Criteria

1. ✅ Search returns results within 500ms
2. ✅ Debouncing prevents excessive API calls
3. ✅ All filters work correctly and can be combined
4. ✅ Results display in responsive grid (4 cols desktop, 2 cols tablet, 1 col mobile)
5. ✅ Loading states shown during API calls
6. ✅ Error messages displayed for API failures
7. ✅ Empty state shown when no results found
8. ✅ Pagination or infinite scroll works smoothly
9. ✅ Search state persists when navigating away and back
10. ✅ All UI elements are keyboard accessible

---

## 🧪 Testing Requirements

### Unit Tests

- Search debouncing logic
- Filter combination logic
- API query parameter building

### Integration Tests

- Search with various terms
- Filter combinations
- Pagination/sorting

### E2E Tests (Playwright)

- User searches for "Bordeaux"
- User filters by "Red" wine type
- User sorts by vintage year
- User views wine details from results

---

## 📊 Performance Targets

- **Initial Load**: < 1 second
- **Search Response**: < 500ms
- **Filter Change**: < 300ms
- **Smooth Scrolling**: 60fps
- **Bundle Size**: Add < 15KB to main.js

---

## 🔗 Dependencies

- SommOS API backend (must be running on port 3001)
- `frontend/js/api.js` (API client)
- `frontend/js/ui.js` (UI utilities)
- Existing CSS framework/utilities

---

## 📝 Implementation Notes

### Debouncing Example

```javascript
let searchTimeout;
function handleSearchInput(event) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    performSearch(event.target.value);
  }, 300);
}
```

### API Integration Example

```javascript
async function searchWines(params) {
  const queryString = new URLSearchParams(params).toString();
  const response = await fetch(`/api/inventory/stock?${queryString}`);
  if (!response.ok) throw new Error('Search failed');
  return await response.json();
}
```

### State Management

```javascript
const searchState = {
  query: '',
  filters: {
    wine_type: null,
    region: null,
    vintage_min: null,
    vintage_max: null
  },
  sort: { field: 'name', order: 'asc' },
  page: 1,
  results: []
};
```

---

## 🚀 Next Steps After Completion

1. **Backend Integration**: Coordinate with backend-specialist-sommos to ensure API returns correct data
2. **Performance Testing**: Work with test-specialist-sommos for load testing
3. **PWA Optimization**: Ensure search works offline (cached results)
4. **Analytics**: Add search analytics tracking
5. **Documentation**: Update user guide with search feature documentation

---

## 📚 Reference Documentation

- **SommOS API Docs**: `/Users/thijs/Documents/SommOS/docs/API.md`
- **Frontend Structure**: `/Users/thijs/Documents/SommOS/frontend/README.md`
- **Database Schema**: `/Users/thijs/Documents/SommOS/docs/SOMMOS_MCD.md`
- **Style Guide**: `/Users/thijs/Documents/SommOS/docs/STYLE_GUIDE.md`

---

**Admin Token**: `<use token from .agent/admin_token.txt>`  
**MCP Server**: `http://localhost:8080`  
**Frontend Dev Server**: `http://localhost:5173`
