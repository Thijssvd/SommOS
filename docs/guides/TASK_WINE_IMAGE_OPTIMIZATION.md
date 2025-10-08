# Task: Wine Bottle Images with Optimization & Virtual Scrolling

## Overview
Add wine bottle images to inventory and catalog displays with automatic web lookup for new wines, applying the existing image optimization system, and ensuring virtual scrolling performs smoothly with image-heavy content.

## Context & Current State

### What Exists
- ✅ **VirtualScroll Implementation**: Fully functional in `frontend/js/ui.js` (lines 400-671)
  - Inventory: threshold 50 items, buffer 3, height 220px
  - Catalog: threshold 30 items, buffer 2, dynamic heights (80-300px)
  - Already integrated in `app.js` for both views

- ✅ **Image Optimization System**: Comprehensive infrastructure ready
  - `frontend/js/image-optimizer.js` - ImageOptimizer class with lazy loading, WebP/AVIF support, retry logic
  - `frontend/js/wine-card-optimized.js` - OptimizedWineCard component (not currently used in main app)
  - `frontend/IMAGE_OPTIMIZATION_README.md` - Complete documentation
  - IntersectionObserver-based lazy loading
  - Automatic format detection and conversion
  - Placeholder/skeleton loading animations

### What's Missing
- ❌ **No Images in Wine Cards**: `createInventoryWineCard()` and `createCatalogWineCard()` don't render any `<img>` elements
- ❌ **No Image Storage**: Database doesn't have an `image_url` column
- ❌ **No Image Lookup Service**: No backend service to search for wine bottle images
- ❌ **No Integration**: ImageOptimizer exists but isn't connected to wine card rendering

## Goals

1. **Add wine bottle images** to both inventory and catalog views
2. **Automatic image lookup** when new wines are added without images (using free image API)
3. **Apply existing optimization** (lazy loading, WebP, caching, retry logic)
4. **Maintain 60fps scrolling** with virtual scroll for large lists
5. **Graceful fallbacks** for missing/failed images

## Implementation Plan (10 Steps)

### Phase 1: Backend - Image Storage & Lookup

#### 1. Update Database Schema for Image Storage
**File:** `backend/db/schema.sql`

Add `image_url` column to store cached image URLs:
```sql
ALTER TABLE Wines ADD COLUMN image_url TEXT;
```

**Migration Script:** `backend/migrations/add_image_url.js` (create if needed)
- Check if column exists before adding
- Backfill with NULL for existing records

---

#### 2. Create Wine Image Lookup Service
**File:** `backend/services/imageService.js` (NEW)

Build service to search for wine bottle images:
```javascript
// Use Unsplash API (free tier: 50 requests/hour)
// API Key setup in .env: UNSPLASH_ACCESS_KEY

class ImageService {
  async searchWineImage(wine) {
    // 1. Construct search query: `${producer} ${name} ${year} wine bottle`
    // 2. Call Unsplash API: GET /search/photos
    // 3. Filter results for wine bottles (check description, tags)
    // 4. Return first relevant result URL
    // 5. Fallback: search "wine bottle ${varietal}" if no results
    // 6. Ultimate fallback: return generic placeholder URL
    // 7. Cache in database to avoid repeated lookups
    // 8. Handle rate limiting (429) and network errors
  }
  
  async getOrFetchImage(wineId, wineData) {
    // Check database first, fetch if not found
  }
}
```

**Dependencies:**
- Add to `package.json`: `"unsplash-js": "^7.0.19"`
- Environment variable: `UNSPLASH_ACCESS_KEY` in `.env`

**Error Handling:**
- Rate limiting → return placeholder, log warning
- Network errors → retry with exponential backoff
- No results → fallback search, then placeholder
- Never fail wine creation due to image lookup

---

#### 3. Integrate Image Lookup into Wine Creation
**File:** `backend/api/routes.js` (line 1132, POST /api/wines endpoint)

Modify wine creation flow:
```javascript
router.post('/wines', requireRole('admin', 'crew'), 
  validate(validators.winesCreate), 
  asyncHandler(withServices(async ({ inventoryManager, imageService }, req, res) => {
    const { wine, vintage, stock } = req.body;
    
    // NEW: Auto-fetch image if not provided
    if (!wine.image_url) {
      try {
        wine.image_url = await imageService.searchWineImage({
          name: wine.name,
          producer: wine.producer,
          year: vintage.year,
          varietal: wine.grape_varieties?.[0]
        });
      } catch (error) {
        console.warn('Image lookup failed:', error.message);
        wine.image_url = null; // Will use placeholder in frontend
      }
    }
    
    // Continue with existing flow...
    const result = await inventoryManager.addWineToInventory(wine, vintage, stock, {...});
    // ... rest of existing code
})));
```

**Service Injection:**
- Add `imageService` to `withServices` dependencies
- Initialize in server startup: `services.imageService = new ImageService(db)`

---

### Phase 2: Frontend - Image Rendering

#### 4. Add Image HTML to Inventory Wine Cards
**File:** `frontend/js/app.js` (line ~1505, `createInventoryWineCard()`)

Add image container at top of card:
```javascript
createInventoryWineCard(item, index, isGuest) {
  // NEW: Image container
  const imageUrl = item.image_url || '/images/wine-placeholder.svg';
  const imageHtml = `
    <div class="wine-image-container aspect-3-2">
      <img 
        class="wine-bottle-image" 
        src="${imageUrl}"
        alt="${item.name} - ${item.producer} bottle"
        loading="lazy"
        data-optimized="false"
        onerror="this.src='/images/wine-placeholder.svg'; this.onerror=null;"
      />
      <div class="image-skeleton"></div>
    </div>
  `;
  
  return `
    <div class="wine-card simple-card fade-in" style="animation-delay: ${Math.min(index * 0.02, 2)}s">
      ${imageHtml}
      <div class="wine-header">
        <!-- existing header content -->
      </div>
      <!-- rest of existing card content -->
    </div>
  `;
}
```

**Key Attributes:**
- `loading="lazy"` - Native browser lazy loading
- `data-optimized="false"` - Flag for ImageOptimizer
- `onerror` - Fallback to placeholder on load failure
- `alt` - Accessibility text

---

#### 5. Add Image HTML to Catalog Wine Cards
**File:** `frontend/js/app.js` (line ~4362, `createCatalogWineCard()`)

Add images with view-specific dimensions:

```javascript
createCatalogWineCard(wine, viewType) {
  const imageUrl = wine.image_url || '/images/wine-placeholder.svg';
  
  // Determine size based on view type
  const imageSizes = {
    grid: { aspectRatio: 'aspect-3-2', dimensions: '300x450' },
    list: { aspectRatio: 'aspect-thumbnail', dimensions: '80x120' },
    detail: { aspectRatio: 'aspect-16-9', dimensions: '600x400' }
  };
  const imageConfig = imageSizes[viewType] || imageSizes.grid;
  
  const imageHtml = `
    <div class="wine-image-container ${imageConfig.aspectRatio}">
      <img 
        class="wine-bottle-image" 
        src="${imageUrl}"
        alt="${wine.name} bottle"
        loading="lazy"
        data-optimized="false"
        data-dimensions="${imageConfig.dimensions}"
        onerror="this.src='/images/wine-placeholder.svg'; this.onerror=null;"
      />
      <div class="image-skeleton"></div>
    </div>
  `;
  
  if (viewType === 'grid') {
    return `
      <div class="wine-card catalog-card" onclick="app.showWineDetails('${wine.id}')">
        ${imageHtml}
        <!-- existing grid content -->
      </div>
    `;
  } else if (viewType === 'list') {
    return `
      <div class="wine-list-item" onclick="app.showWineDetails('${wine.id}')">
        ${imageHtml}
        <div class="wine-basic-info">
          <!-- existing list content -->
        </div>
      </div>
    `;
  } else { // detail view
    return `
      <div class="wine-detail-card" onclick="app.showWineDetails('${wine.id}')">
        ${imageHtml}
        <!-- existing detail content -->
      </div>
    `;
  }
}
```

---

#### 6. Integrate ImageOptimizer with Wine Cards
**Files:** `frontend/js/app.js` (both `displayInventory()` and `displayCatalogWines()`)

Hook up ImageOptimizer after rendering:

```javascript
displayInventory(inventory) {
  const startTime = this.startPerformanceTimer();
  // ... existing virtual scroll setup ...
  
  // NEW: Optimize images after render
  if (this.inventoryVirtualScroll) {
    this.inventoryVirtualScroll.setRenderCallback((item, index) => {
      const cardHtml = this.createInventoryWineCard(item, index, isGuest);
      
      // Convert HTML string to DOM element
      const template = document.createElement('template');
      template.innerHTML = cardHtml.trim();
      const card = template.content.firstChild;
      
      // Optimize images in this card
      const img = card.querySelector('img.wine-bottle-image');
      if (img && window.imageOptimizer) {
        window.imageOptimizer.optimizeImage(img, {
          width: 300,
          height: 450,
          lazyLoad: true,
          compressionQuality: 0.8
        });
      }
      
      return card;
    });
  }
  
  // ... rest of existing code
}
```

**Same pattern for `displayCatalogWines()`** with view-specific dimensions:
- Grid: 300x450
- List: 80x120
- Detail: 600x400

---

#### 7. Update Virtual Scroll Integration
**File:** `frontend/js/ui.js` (lines 542-560, `createItemElement()`)

Ensure images are optimized when items enter viewport:

```javascript
createItemElement(item, index) {
  // ... existing code to create element ...
  
  // NEW: Trigger image optimization after element creation
  if (element && window.imageOptimizer) {
    requestAnimationFrame(() => {
      const images = element.querySelectorAll('img[data-optimized="false"]');
      images.forEach(img => {
        window.imageOptimizer.optimizeImage(img, {
          lazyLoad: true,
          fadeInDuration: 300
        });
      });
    });
  }
  
  return element;
}
```

**Height Verification:**
- Measure actual rendered card heights with images
- Update `getCatalogItemHeight()` if needed (line 4337)
- Test that virtual scroll positioning remains accurate

---

### Phase 3: Styling & Polish

#### 8. Add CSS Styles for Wine Images
**File:** `frontend/css/styles.css`

Add comprehensive image styles:

```css
/* Wine Image Containers */
.wine-image-container {
  position: relative;
  width: 100%;
  overflow: hidden;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 8px 8px 0 0;
}

/* Aspect Ratios */
.wine-image-container.aspect-3-2 {
  padding-bottom: 66.67%; /* 2:3 = 66.67% */
}

.wine-image-container.aspect-16-9 {
  padding-bottom: 56.25%; /* 9:16 = 56.25% */
}

.wine-image-container.aspect-thumbnail {
  padding-bottom: 150%; /* 2:3 for thumbnails */
  max-width: 80px;
}

/* Wine Bottle Images */
.wine-bottle-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  transition: transform 0.3s ease, opacity 0.3s ease;
  opacity: 0; /* Start hidden, ImageOptimizer will fade in */
}

.wine-bottle-image[data-loaded="true"] {
  opacity: 1;
}

/* Hover Effects */
.wine-card:hover .wine-bottle-image {
  transform: scale(1.05);
}

/* Skeleton Loading Animation */
.image-skeleton {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.05) 0%,
    rgba(255, 255, 255, 0.1) 50%,
    rgba(255, 255, 255, 0.05) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  pointer-events: none;
  opacity: 1;
  transition: opacity 0.3s ease;
}

.wine-bottle-image[data-loaded="true"] ~ .image-skeleton {
  opacity: 0;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* List View Specific */
.wine-list-item {
  display: flex;
  align-items: center;
  gap: 16px;
}

.wine-list-item .wine-image-container {
  flex-shrink: 0;
  width: 80px;
  height: 120px;
  border-radius: 4px;
}

/* Responsive Adjustments */
@media (max-width: 768px) {
  .wine-image-container.aspect-3-2 {
    padding-bottom: 75%; /* Slightly less tall on mobile */
  }
  
  .wine-list-item .wine-image-container {
    width: 60px;
    height: 90px;
  }
}

/* High DPI / Retina Displays */
@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
  .wine-bottle-image {
    image-rendering: -webkit-optimize-contrast;
  }
}
```

---

#### 9. Create Placeholder Images and Error Handling
**Files:** 
- `frontend/images/wine-placeholder.svg` (NEW)
- `frontend/js/app.js` (error handling)

**Create SVG Placeholder:**
```svg
<!-- frontend/images/wine-placeholder.svg -->
<svg width="300" height="450" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#16213e;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="300" height="450" fill="url(#bg)"/>
  <text x="150" y="200" font-family="Arial, sans-serif" font-size="48" 
        fill="#e94560" text-anchor="middle">🍷</text>
  <text x="150" y="250" font-family="Arial, sans-serif" font-size="14" 
        fill="#a8b2d1" text-anchor="middle">Wine Bottle</text>
</svg>
```

**Enhanced Error Handling in Cards:**
```javascript
// Add to image element creation
onerror="
  if (!this.dataset.fallbackAttempted) {
    this.dataset.fallbackAttempted = 'true';
    this.src = '/images/wine-placeholder.svg';
  } else {
    // Last resort: replace with emoji
    const parent = this.parentElement;
    parent.innerHTML = '<div class=\\"emoji-placeholder\\">🍷</div>';
  }
  this.onerror = null;
"
```

**Fallback Chain:**
1. Original `wine.image_url` from database
2. Generic SVG placeholder
3. Emoji fallback (🍷)

---

### Phase 4: Testing & Validation

#### 10. Test Performance and Optimization
**Comprehensive Testing Checklist:**

**✅ Virtual Scroll Performance:**
- [ ] Load inventory with 200+ wines
- [ ] Open Chrome DevTools Performance tab
- [ ] Record while scrolling rapidly
- [ ] Verify: 60fps maintained, no layout thrashing
- [ ] Check: Only visible items have rendered images

**✅ Image Optimization:**
- [ ] Verify `loading="lazy"` attribute present
- [ ] Check Network tab: images load as cards enter viewport
- [ ] Confirm WebP format used (if browser supports)
- [ ] Test retry logic: throttle network, verify 3 retry attempts

**✅ View Modes:**
- [ ] Test catalog grid view with images
- [ ] Test catalog list view with thumbnails
- [ ] Test catalog detail view with large images
- [ ] Verify layout doesn't break in any view

**✅ Network Conditions:**
- [ ] Throttle to "Slow 3G" in DevTools
- [ ] Verify skeleton loaders appear
- [ ] Confirm smooth fade-in transitions
- [ ] Check placeholder appears for failed loads

**✅ Memory Usage:**
- [ ] Record heap snapshot with 500+ wines
- [ ] Scroll through entire list
- [ ] Take second snapshot
- [ ] Verify: Detached DOM nodes < 100
- [ ] Check: Memory increase < 50MB

**✅ Backend Image Search:**
- [ ] Create new wine without image_url
- [ ] Verify API called to search for image
- [ ] Check database: image_url stored
- [ ] Test rate limiting behavior (51st request)
- [ ] Verify wine creation succeeds even if image search fails

**✅ Responsive Design:**
- [ ] Test on mobile viewport (375px)
- [ ] Test on tablet viewport (768px)
- [ ] Test on desktop (1920px)
- [ ] Verify images scale appropriately

**✅ Accessibility:**
- [ ] Verify all images have descriptive `alt` text
- [ ] Test with screen reader (VoiceOver/NVDA)
- [ ] Check keyboard navigation works with images
- [ ] Ensure sufficient color contrast for placeholders

---

## Dependencies & Environment

### Backend Dependencies
```json
{
  "unsplash-js": "^7.0.19"
}
```

### Environment Variables
```bash
# .env
UNSPLASH_ACCESS_KEY=your_access_key_here
```

**Get Unsplash API Key:**
1. Sign up at https://unsplash.com/developers
2. Create new application
3. Copy Access Key
4. Add to `.env` file

### Frontend Dependencies
No new dependencies needed - all infrastructure exists:
- `ImageOptimizer` class in `frontend/js/image-optimizer.js`
- `VirtualScroll` class in `frontend/js/ui.js`

---

## Success Criteria

✅ **Functional:**
- Wine cards display bottle images in both inventory and catalog
- Images load lazily as cards enter viewport
- New wines automatically get images from web search
- Graceful fallbacks for missing/failed images

✅ **Performance:**
- 60fps scrolling maintained with 200+ wines
- Virtual scroll working correctly with image heights
- Memory usage remains stable during scrolling
- Images use WebP format where supported

✅ **User Experience:**
- Smooth skeleton → image transitions
- No layout shifts during image loading
- Responsive images on all screen sizes
- Hover effects and visual polish

---

## Implementation Timeline

**Phase 1 (Backend):** ~2-3 hours
- Database schema update (30 min)
- Image service implementation (1.5 hours)
- API integration (1 hour)

**Phase 2 (Frontend - Rendering):** ~3-4 hours
- Inventory card images (1 hour)
- Catalog card images (1.5 hours)
- ImageOptimizer integration (1 hour)
- Virtual scroll updates (30 min)

**Phase 3 (Styling):** ~1-2 hours
- CSS implementation (1 hour)
- Placeholder creation (30 min)
- Error handling polish (30 min)

**Phase 4 (Testing):** ~2-3 hours
- Performance testing (1 hour)
- Cross-browser testing (1 hour)
- Bug fixes and refinement (1 hour)

**Total Estimated Time:** 8-12 hours

---

## Notes & Considerations

### Image Source Options
**Recommended: Unsplash API**
- ✅ Free tier: 50 requests/hour
- ✅ High-quality images
- ✅ Good search API
- ✅ No attribution required in UI

**Alternatives:**
- Pexels API (200 requests/hour, attribution required)
- Pixabay API (Unlimited, lower quality)
- Wine.com scraping (legal concerns, not recommended)

### Performance Optimization Tips
1. **Preload critical images**: First 10 visible wines
2. **Connection hints**: Add `<link rel="preconnect">` for image CDN
3. **Adaptive loading**: Lower quality on slow connections
4. **Progressive images**: Consider LQIP (Low Quality Image Placeholder)

### Future Enhancements
- 📸 Upload custom wine photos
- 🤖 AI-powered image relevance scoring
- 🌐 Multiple image sources/CDNs
- 📊 Analytics on image load performance
- 🔄 Periodic re-validation of cached images

---

## Related Files

### Must Modify
- ✏️ `backend/db/schema.sql` - Add image_url column
- ✏️ `backend/api/routes.js` - Integrate image lookup
- ✏️ `frontend/js/app.js` - Add images to cards
- ✏️ `frontend/css/styles.css` - Style image containers

### Must Create
- 🆕 `backend/services/imageService.js` - Image search service
- 🆕 `frontend/images/wine-placeholder.svg` - Fallback image
- 🆕 `backend/migrations/add_image_url.js` - Schema migration

### Reference
- 📖 `frontend/js/image-optimizer.js` - Existing optimizer
- 📖 `frontend/js/ui.js` - VirtualScroll implementation
- 📖 `frontend/IMAGE_OPTIMIZATION_README.md` - Documentation

---

## Questions & Support

If you encounter issues:
1. Check browser console for ImageOptimizer errors
2. Verify Unsplash API key is valid
3. Test with network throttling disabled
4. Review VirtualScroll performance logs
5. Check database schema matches expectations

**Ready to implement!** 🚀🍷
