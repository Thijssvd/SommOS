# Wine Image Optimization - Quick Reference

## 🎯 One-Sentence Summary

Add wine bottle images to inventory/catalog views with automatic web lookup, lazy loading, and virtual scrolling optimized for 60fps performance.

---

## 📋 Todo List (10 Tasks)

### Backend (Tasks 1-3)

- [ ] **1. Database**: Add `image_url TEXT` column to Wines table
- [ ] **2. Image Service**: Create `imageService.js` to search Unsplash API for wine images
- [ ] **3. API Integration**: Hook imageService into POST `/api/wines` endpoint

### Frontend (Tasks 4-7)

- [ ] **4. Inventory Cards**: Add image HTML to `createInventoryWineCard()` function
- [ ] **5. Catalog Cards**: Add images to `createCatalogWineCard()` for all 3 views
- [ ] **6. Optimizer Integration**: Connect `window.imageOptimizer` to render callbacks
- [ ] **7. Virtual Scroll**: Update VirtualScroll to handle image optimization

### Polish (Tasks 8-9)

- [ ] **8. CSS Styling**: Add image container styles with skeleton animations
- [ ] **9. Placeholders**: Create SVG placeholder and error fallback chain

### Validation (Task 10)

- [ ] **10. Testing**: Performance, network throttling, memory, responsiveness

---

## 🔑 Key Implementation Points

### Backend

```javascript
// imageService.js - Core function
async searchWineImage({ name, producer, year, varietal }) {
  const query = `${producer} ${name} ${year} wine bottle`;
  const result = await unsplash.search.getPhotos({ query, per_page: 5 });
  return result.response.results[0]?.urls.regular || '/images/wine-placeholder.svg';
}
```

### Frontend - Card HTML

```javascript
// Add to createInventoryWineCard() and createCatalogWineCard()
const imageHtml = `
  <div class="wine-image-container aspect-3-2">
    <img 
      class="wine-bottle-image" 
      src="${wine.image_url || '/images/wine-placeholder.svg'}"
      alt="${wine.name} bottle"
      loading="lazy"
      data-optimized="false"
      onerror="this.src='/images/wine-placeholder.svg'"
    />
    <div class="image-skeleton"></div>
  </div>
`;
```

### Frontend - Optimizer Hook

```javascript
// In displayInventory() and displayCatalogWines()
this.inventoryVirtualScroll.setRenderCallback((item, index) => {
  const card = createCardElement(item); // Returns DOM element
  
  const img = card.querySelector('img.wine-bottle-image');
  if (img && window.imageOptimizer) {
    window.imageOptimizer.optimizeImage(img, {
      width: 300, height: 450, lazyLoad: true
    });
  }
  
  return card;
});
```

---

## 📁 Files to Modify/Create

### Create New

- `backend/services/imageService.js` - Image search service
- `backend/migrations/add_image_url.js` - Database migration
- `frontend/images/wine-placeholder.svg` - Fallback image

### Modify Existing

- `backend/db/schema.sql` - Add image_url column
- `backend/api/routes.js` - POST /api/wines (line 1132)
- `frontend/js/app.js` - Both card creation functions (lines 1505, 4362)
- `frontend/css/styles.css` - Image container styles

### Reference Only

- `frontend/js/image-optimizer.js` - Already implemented
- `frontend/js/ui.js` - VirtualScroll class (lines 400-671)

---

## 🔧 Environment Setup

### 1. Get Unsplash API Key

```bash
# Visit: https://unsplash.com/developers
# Create app → Copy Access Key → Add to .env
```

### 2. Add to .env

```bash
UNSPLASH_ACCESS_KEY=your_actual_key_here
```

### 3. Install Package

```bash
cd backend
npm install unsplash-js
```

---

## 🎨 Image Dimensions by View

| View | Size | Aspect | Usage |
|------|------|--------|-------|
| Inventory Cards | 300x450 | 2:3 | Grid layout |
| Catalog Grid | 300x450 | 2:3 | Grid layout |
| Catalog List | 80x120 | 2:3 | Thumbnail |
| Catalog Detail | 600x400 | 16:9 | Large view |

---

## ✅ Testing Checklist

### Performance

- [ ] 200+ wines load and scroll at 60fps
- [ ] Virtual scroll only renders visible items
- [ ] Memory usage < 50MB increase after full scroll

### Image Loading

- [ ] Lazy loading triggers on viewport entry
- [ ] WebP format used (Chrome/Firefox)
- [ ] Skeleton animation shows during load
- [ ] 3 retry attempts on network failure

### Fallback Behavior

- [ ] Missing image → SVG placeholder
- [ ] Failed SVG → Emoji fallback (🍷)
- [ ] Wine creation succeeds even if image lookup fails

### Responsive

- [ ] Mobile (375px): Smaller images, proper layout
- [ ] Tablet (768px): Medium images
- [ ] Desktop (1920px): Full-size images

---

## 🚀 Performance Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Frame Rate** | 60fps | Chrome DevTools Performance |
| **First Paint** | < 500ms | Network tab, throttle to Fast 3G |
| **Image Load** | Lazy only | Only visible in viewport |
| **Memory** | Stable | Heap snapshot before/after scroll |
| **Virtual Items** | 10-20 | Console log visible range |

---

## 💡 Key Architecture Decisions

### Why Unsplash?

- ✅ Free tier (50 req/hour) sufficient for development
- ✅ High-quality wine images
- ✅ Simple REST API
- ✅ No attribution needed in UI

### Why NOT Use OptimizedWineCard Component?

- Existing `app.js` has string-based rendering (returns HTML strings)
- OptimizedWineCard uses DOM manipulation (returns DOM elements)
- Would require refactoring entire card rendering system
- Better to integrate ImageOptimizer directly into existing flow

### Why Maintain Virtual Scroll?

- Already working perfectly for inventory/catalog
- Just need to ensure image optimization hooks into render callbacks
- Image heights don't change scroll calculations (padding-bottom maintains space)

---

## 🐛 Common Issues & Solutions

### Issue: Images don't load in virtualized items

**Solution:** Ensure ImageOptimizer runs in `setRenderCallback`, not just initial render

### Issue: Layout shifts during image load

**Solution:** Use `padding-bottom` percentage for aspect ratio (e.g., 66.67% for 2:3)

### Issue: Virtual scroll positioning breaks

**Solution:** Verify card heights match `getCatalogItemHeight()` values after adding images

### Issue: Rate limited by Unsplash

**Solution:** imageService should catch 429 errors and return placeholder gracefully

### Issue: Performance degrades with 500+ wines

**Solution:** Double-check virtual scroll threshold and buffer settings

---

## 📊 Success Metrics

After implementation, verify:

- ✅ Wine cards show bottle images (not just placeholders)
- ✅ New wines get automatic image lookup
- ✅ Smooth scrolling maintained (60fps in Performance tab)
- ✅ No console errors during normal operation
- ✅ Graceful degradation when images fail to load

---

## 🔗 Related Documentation

- [Full Task Description](./TASK_WINE_IMAGE_OPTIMIZATION.md)
- [Image Optimization README](./frontend/IMAGE_OPTIMIZATION_README.md)
- [Virtual Scroll Implementation](./frontend/js/ui.js) (lines 400-671)

---

**Estimated Implementation Time:** 8-12 hours  
**Difficulty Level:** Intermediate  
**Risk Level:** Low (existing infra, graceful fallbacks)

---

Last Updated: 2025-10-04  
Status: **Ready to Implement** ✅
