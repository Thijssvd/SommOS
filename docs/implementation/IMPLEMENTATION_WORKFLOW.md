# Wine Image Optimization - Implementation Workflow

This document provides a step-by-step implementation workflow to guide you through adding wine bottle images with optimization and virtual scrolling.

## 📚 Documentation Files

- **[TASK_WINE_IMAGE_OPTIMIZATION.md](./TASK_WINE_IMAGE_OPTIMIZATION.md)** - Complete technical specification with all details
- **[TASK_SUMMARY_QUICK_REF.md](./TASK_SUMMARY_QUICK_REF.md)** - Quick reference guide and checklists
- **This file** - Step-by-step implementation workflow

---

## 🚀 Getting Started

### Prerequisites Checklist
- [ ] Node.js and npm installed
- [ ] SommOS backend and frontend running locally
- [ ] Access to backend database (SQLite)
- [ ] Chrome DevTools for testing
- [ ] Text editor/IDE ready

### Time Estimate: 8-12 hours total
- Backend: 2-3 hours
- Frontend: 4-5 hours  
- Testing: 2-3 hours
- Buffer: 1 hour

---

## Phase 1: Backend Setup (2-3 hours)

### Step 1: Database Schema Update (30 min)

**Action:** Add image_url column to Wines table

```bash
# Navigate to backend directory
cd /Users/thijs/Documents/SommOS/backend
```

**1.1: Update Schema File**
```bash
# Edit backend/db/schema.sql
# Find the Wines table definition and add:
# image_url TEXT
```

**1.2: Create Migration Script**
```bash
# Create backend/migrations/add_image_url.js
```

**1.3: Run Migration**
```bash
node migrations/add_image_url.js
```

**Validation:**
```bash
# Check column was added
sqlite3 data/wines.db "PRAGMA table_info(Wines);"
# Should see image_url in the output
```

---

### Step 2: Get Unsplash API Key (15 min)

**Action:** Sign up for Unsplash API access

**2.1: Create Account**
- Visit: https://unsplash.com/developers
- Sign up or log in
- Accept terms of service

**2.2: Create Application**
- Click "Your apps" → "New Application"
- Name: "SommOS Wine Manager"
- Description: "Wine inventory management with bottle images"
- Accept API terms

**2.3: Copy Access Key**
- Copy the "Access Key" (NOT the Secret Key)

**2.4: Add to .env**
```bash
cd /Users/thijs/Documents/SommOS/backend
echo "UNSPLASH_ACCESS_KEY=your_access_key_here" >> .env
```

**2.5: Install Package**
```bash
npm install unsplash-js
```

**Validation:**
```bash
# Verify package installed
npm list unsplash-js
# Should show version ^7.0.19 or similar
```

---

### Step 3: Create Image Service (1.5 hours)

**Action:** Build image search service

**3.1: Create Service File**
```bash
touch backend/services/imageService.js
```

**3.2: Implement Core Service**
Open `backend/services/imageService.js` and implement:
- Constructor with Unsplash API initialization
- `searchWineImage(wine)` function
- Error handling for rate limits and network errors
- Caching logic

**3.3: Add Service to Server**
Edit `backend/server.js` or service registry:
- Import ImageService
- Initialize with database connection
- Add to services object

**Validation:**
```bash
# Test the service in isolation
node -e "
const ImageService = require('./services/imageService');
const service = new ImageService();
service.searchWineImage({
  name: 'Chateau Margaux',
  producer: 'Chateau Margaux',
  year: 2015
}).then(console.log);
"
# Should return an image URL or placeholder
```

---

### Step 4: Integrate into Wine Creation (1 hour)

**Action:** Hook image service into POST /api/wines endpoint

**4.1: Modify routes.js**
```bash
# Edit backend/api/routes.js around line 1132
```

Add imageService to dependencies:
- Import imageService in withServices
- Call searchWineImage before creating wine
- Store result in wine.image_url
- Handle errors gracefully

**4.2: Test API Endpoint**
```bash
# Start backend server
npm start

# In another terminal, test the endpoint:
curl -X POST http://localhost:3001/api/wines \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "wine": {
      "name": "Test Wine",
      "producer": "Test Producer",
      "wine_type": "Red"
    },
    "vintage": { "year": 2020 },
    "stock": { "quantity": 12, "location": "main-cellar" }
  }'
```

**Validation:**
- Response should include `image_url` field
- Check database: `sqlite3 data/wines.db "SELECT name, image_url FROM Wines ORDER BY id DESC LIMIT 1;"`
- Verify image_url is populated

---

## Phase 2: Frontend Implementation (4-5 hours)

### Step 5: Add Images to Inventory Cards (1 hour)

**Action:** Modify createInventoryWineCard function

```bash
cd /Users/thijs/Documents/SommOS/frontend
```

**5.1: Open app.js**
```bash
# Navigate to line ~1505, function createInventoryWineCard()
```

**5.2: Add Image HTML**
- Create imageUrl variable with fallback
- Build image container HTML with:
  - wine-image-container div
  - img element with lazy loading
  - image-skeleton div for loading animation
  - onerror handler for fallback

**5.3: Insert at Top of Card**
- Place image HTML before wine-header

**Validation:**
```bash
# Start frontend dev server
npm run dev

# Open browser to http://localhost:3000
# Navigate to Inventory view
# Check browser console for errors
# Images should show placeholder (SVG not created yet)
```

---

### Step 6: Add Images to Catalog Cards (1.5 hours)

**Action:** Update createCatalogWineCard for all views

**6.1: Locate Function**
```bash
# Navigate to line ~4362, function createCatalogWineCard()
```

**6.2: Add View-Specific Logic**
- Create imageSizes config object
- Determine dimensions based on viewType
- Build image HTML similar to inventory

**6.3: Update Each View**
- **Grid view:** Image at top (300x450)
- **List view:** Thumbnail on left (80x120)
- **Detail view:** Large image (600x400)

**Validation:**
```bash
# Open Catalog view in browser
# Test each view mode:
#   - Grid view: ⊞ button
#   - List view: ☰ button  
#   - Detail view: 📋 button
# Verify layout doesn't break
```

---

### Step 7: Connect ImageOptimizer (1 hour)

**Action:** Hook up existing ImageOptimizer to wine cards

**7.1: Modify displayInventory()**
```bash
# Around line ~1443 in app.js
```

Update `setRenderCallback` to:
- Convert HTML string to DOM element
- Find img.wine-bottle-image
- Call window.imageOptimizer.optimizeImage()
- Return DOM element

**7.2: Modify displayCatalogWines()**
```bash
# Around line ~4276 in app.js
```

Same pattern as inventory, but with view-specific dimensions

**7.3: Verify Optimizer Exists**
Check that imageOptimizer is initialized:
```javascript
// In browser console:
console.log(window.imageOptimizer);
// Should not be undefined
```

**Validation:**
```bash
# Open DevTools Network tab
# Scroll through inventory/catalog
# Verify: Images load only when visible
# Check: WebP format if browser supports
```

---

### Step 8: Update Virtual Scroll (30 min)

**Action:** Ensure VirtualScroll handles images

**8.1: Open ui.js**
```bash
# Navigate to line ~542, createItemElement()
```

**8.2: Add Image Optimization**
- Check if window.imageOptimizer exists
- Query for images with data-optimized="false"
- Call optimizeImage on each

**8.3: Test Height Calculations**
Verify card heights still match:
```javascript
// In browser console:
app.getCatalogItemHeight('grid'); // Should return 280
app.getCatalogItemHeight('list'); // Should return 80
app.getCatalogItemHeight('detail'); // Should return 300
```

**Validation:**
- Scroll performance should remain smooth (60fps)
- Check Performance tab in DevTools while scrolling
- Verify no layout thrashing

---

## Phase 3: Styling & Polish (1-2 hours)

### Step 9: Add CSS Styles (1 hour)

**Action:** Create image container styles

**9.1: Open styles.css**
```bash
# Edit frontend/css/styles.css
```

**9.2: Add Image Styles**
Copy styles from TASK_WINE_IMAGE_OPTIMIZATION.md:
- Wine image container
- Aspect ratio classes
- Loading skeleton animation
- Hover effects
- Responsive breakpoints

**9.3: Test Responsiveness**
```bash
# In DevTools, test various viewports:
# - Mobile: 375px
# - Tablet: 768px  
# - Desktop: 1920px
```

**Validation:**
- Images should scale properly at all sizes
- Skeleton animation should be visible during load
- Hover effect should work on desktop

---

### Step 10: Create Placeholder & Fallbacks (30 min)

**Action:** Add fallback images

**10.1: Create Images Directory**
```bash
mkdir -p frontend/images
```

**10.2: Create SVG Placeholder**
```bash
cat > frontend/images/wine-placeholder.svg << 'SVG'
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
SVG
```

**10.3: Test Fallback Chain**
```bash
# In browser console, force image error:
document.querySelector('.wine-bottle-image').src = 'invalid-url.jpg';
# Should fallback to SVG placeholder
```

**Validation:**
- Test with invalid image URL
- Verify SVG placeholder appears
- Check emoji fallback if SVG fails

---

## Phase 4: Testing & Validation (2-3 hours)

### Step 11: Performance Testing (1 hour)

**11.1: Load Test**
```bash
# Add 200+ wines to inventory (use seed script or API)
# Navigate to Inventory view
```

**11.2: Record Performance**
- Open DevTools → Performance tab
- Click Record
- Scroll rapidly through entire list
- Stop recording

**11.3: Analyze Results**
Check for:
- Frame rate: Should be 60fps
- Layout shifts: Should be minimal
- Long tasks: Should be < 50ms
- Memory: Check for leaks

**Success Criteria:**
- ✅ 60fps maintained during scroll
- ✅ No major layout thrashing
- ✅ Memory stable (< 50MB increase)

---

### Step 12: Network Testing (30 min)

**12.1: Slow 3G Test**
- DevTools → Network tab → Throttling → Slow 3G
- Refresh page
- Scroll through inventory

**12.2: Verify Behavior**
- Skeleton loaders should appear
- Images should load progressively
- No crashes or timeouts

**12.3: Test Retry Logic**
- DevTools → Network → Offline
- Reload page to cache HTML/JS
- Go back online
- Verify images retry and load

**Success Criteria:**
- ✅ Graceful degradation on slow network
- ✅ Skeleton animations visible
- ✅ Images eventually load

---

### Step 13: Image Search Testing (30 min)

**13.1: Test Auto-Lookup**
```bash
# Create new wine via API without image_url
curl -X POST http://localhost:3001/api/wines \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "wine": {
      "name": "Barolo DOCG",
      "producer": "Pio Cesare",
      "wine_type": "Red"
    },
    "vintage": { "year": 2018 },
    "stock": { "quantity": 6, "location": "main-cellar" }
  }'
```

**13.2: Verify Image Found**
```bash
# Check database
sqlite3 backend/data/wines.db "SELECT name, image_url FROM Wines ORDER BY id DESC LIMIT 1;"
# Should show image URL
```

**13.3: Test Rate Limiting**
- Make 51+ requests in rapid succession
- Verify 51st request gets placeholder
- Check logs for rate limit warning

**Success Criteria:**
- ✅ Images found for real wines
- ✅ Placeholder used when not found
- ✅ Graceful handling of rate limits

---

### Step 14: Cross-Browser Testing (30 min)

**14.1: Test in Multiple Browsers**
- Chrome (primary)
- Firefox
- Safari (if on Mac)

**14.2: Check Format Support**
```javascript
// In each browser console:
console.log('WebP:', document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0);
console.log('AVIF:', document.createElement('canvas').toDataURL('image/avif').indexOf('data:image/avif') === 0);
```

**14.3: Verify Fallbacks**
- Images should work in all browsers
- Format may differ (WebP in Chrome, JPEG in Safari)

**Success Criteria:**
- ✅ Images load in all tested browsers
- ✅ Layout consistent across browsers
- ✅ No console errors

---

### Step 15: Accessibility Testing (30 min)

**15.1: Screen Reader Test**
- macOS: Enable VoiceOver (Cmd+F5)
- Windows: Use NVDA or JAWS

**15.2: Navigate Wine Cards**
- Tab through cards
- Verify alt text is read correctly
- Check aria-labels

**15.3: Keyboard Navigation**
- Tab to wine cards
- Enter/Space should open details
- Images shouldn't block navigation

**Success Criteria:**
- ✅ All images have descriptive alt text
- ✅ Screen reader reads card content properly
- ✅ Keyboard navigation works

---

## 🎉 Final Checklist

Before considering the task complete, verify:

### Functional Requirements
- [ ] Wine cards display bottle images in inventory view
- [ ] Wine cards display bottle images in catalog (all 3 views)
- [ ] New wines get automatic image lookup from Unsplash
- [ ] Existing wines without images show placeholder
- [ ] Failed images fallback gracefully

### Performance Requirements
- [ ] 60fps scrolling with 200+ wines
- [ ] Virtual scroll only renders visible items
- [ ] Images load lazily (Network tab proof)
- [ ] WebP format used where supported
- [ ] Memory usage stable during scrolling

### User Experience
- [ ] Skeleton loaders appear during image load
- [ ] Smooth fade-in transitions
- [ ] No layout shifts during load
- [ ] Hover effects work on desktop
- [ ] Responsive at all screen sizes

### Code Quality
- [ ] No console errors in normal operation
- [ ] Database migration successful
- [ ] API tests pass
- [ ] Code follows existing patterns
- [ ] Comments added where needed

### Documentation
- [ ] README updated with image feature
- [ ] API documentation includes image_url field
- [ ] Environment variables documented
- [ ] Unsplash API key setup documented

---

## 🆘 Troubleshooting

### Common Issues

**Issue: Images not appearing**
1. Check browser console for errors
2. Verify image_url in database is valid
3. Test image URL directly in browser
4. Check network tab for failed requests

**Issue: Virtual scroll broken**
1. Verify card heights match getCatalogItemHeight()
2. Check console for VirtualScroll errors
3. Test with virtual scrolling disabled (reduce threshold)

**Issue: Performance degraded**
1. Check if too many items rendered (should be 10-20)
2. Verify images have loading="lazy"
3. Profile with Performance tab
4. Check memory for leaks

**Issue: Unsplash API errors**
1. Verify API key is correct in .env
2. Check rate limit (50 req/hour)
3. Test API key directly with curl
4. Review Unsplash dashboard for quota

**Issue: Layout shifts**
1. Ensure padding-bottom set on image containers
2. Verify aspect-ratio classes applied
3. Check CSS for conflicting styles
4. Test with images disabled

---

## 📈 Success Metrics

After full implementation, you should see:

1. **Visual Improvement**: Wine cards now have attractive bottle images
2. **Performance Maintained**: Smooth 60fps scrolling even with images
3. **User Experience**: Professional polish with loading animations
4. **Automation**: New wines automatically get images
5. **Reliability**: Graceful fallbacks when images unavailable

---

## 🎯 Next Steps (Future Enhancements)

After completing this task, consider:

1. **Custom Image Upload**: Allow users to upload their own bottle photos
2. **Image Caching**: Add CDN or local caching for faster loads
3. **AI Image Scoring**: Rank search results by relevance
4. **Progressive Images**: Implement LQIP (Low Quality Image Placeholder)
5. **Multiple Sources**: Add Pexels/Pixabay as fallback sources

---

## 📞 Support & Questions

If you run into issues:

1. Review full specification: [TASK_WINE_IMAGE_OPTIMIZATION.md](./TASK_WINE_IMAGE_OPTIMIZATION.md)
2. Check quick reference: [TASK_SUMMARY_QUICK_REF.md](./TASK_SUMMARY_QUICK_REF.md)
3. Review existing docs: [frontend/IMAGE_OPTIMIZATION_README.md](./frontend/IMAGE_OPTIMIZATION_README.md)
4. Check browser console for errors
5. Profile with Chrome DevTools

---

**Implementation Status:** Ready to Start ✅  
**Estimated Time:** 8-12 hours  
**Difficulty:** Intermediate  
**Risk:** Low

Good luck with the implementation! 🚀🍷
