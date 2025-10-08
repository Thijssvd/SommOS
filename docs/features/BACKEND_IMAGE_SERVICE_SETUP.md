# Backend Image Service - Setup & Integration Guide

## ✅ Completed Tasks

1. **Database Schema Updated** - `image_url TEXT` column added to Wines table
2. **Image Service Created** - Full-featured service in `backend/services/imageService.js`
3. **Migration Script Created** - `backend/database/migrations/008_add_wine_images.sql`

## 📦 Required NPM Packages

Add these to `backend/package.json`:

```bash
cd /Users/thijs/Documents/SommOS/backend
npm install unsplash-js node-fetch
```

Or add to package.json dependencies:
```json
{
  "dependencies": {
    "unsplash-js": "^7.0.19",
    "node-fetch": "^2.7.0"
  }
}
```

## 🔑 Environment Variables

Add to `backend/.env`:

```bash
# Unsplash API for wine bottle images
UNSPLASH_ACCESS_KEY=your_access_key_here
```

**Get API Key:**
1. Visit https://unsplash.com/developers
2. Sign up / Log in
3. Create new application: "SommOS Wine Manager"
4. Copy Access Key (NOT Secret Key)
5. Add to .env file

## 🔌 Integration into Server

### Option 1: Add to existing service initialization

If you have a central services setup (like `backend/server.js` or `backend/core/service_registry.js`), add:

```javascript
const ImageService = require('./services/imageService');

// In your initialization code:
const imageService = new ImageService(db, {
  accessKey: process.env.UNSPLASH_ACCESS_KEY
});

// Make available to routes
app.locals.imageService = imageService;
// OR add to your services object:
services.imageService = imageService;
```

### Option 2: Direct integration in routes.js

At the top of `backend/api/routes.js`:

```javascript
const ImageService = require('../services/imageService');

// Initialize with database connection
const imageService = new ImageService(db);
```

## 🔗 Integration into Wine Creation Endpoint

In `backend/api/routes.js` around line 1132 (POST /api/wines):

### Before (existing code):
```javascript
router.post('/wines', requireRole('admin', 'crew'), 
  validate(validators.winesCreate), 
  asyncHandler(withServices(async ({ inventoryManager }, req, res) => {
    const { wine, vintage, stock } = req.body;
    
    const result = await inventoryManager.addWineToInventory(wine, vintage, stock, {
      // ... existing options
    });
    
    // ... rest of handler
  })));
```

### After (with image lookup):
```javascript
router.post('/wines', requireRole('admin', 'crew'), 
  validate(validators.winesCreate), 
  asyncHandler(withServices(async ({ inventoryManager, imageService }, req, res) => {
    const { wine, vintage, stock } = req.body;
    
    // NEW: Auto-fetch image if not provided
    if (!wine.image_url && imageService) {
      try {
        wine.image_url = await imageService.searchWineImage({
          name: wine.name,
          producer: wine.producer,
          year: vintage?.year,
          varietal: wine.grape_varieties?.[0],
          wine_type: wine.wine_type
        });
        
        console.log(`✓ Found image for ${wine.name}: ${wine.image_url}`);
      } catch (error) {
        console.warn(`⚠ Image lookup failed for ${wine.name}:`, error.message);
        wine.image_url = null; // Will use placeholder in frontend
      }
    }
    
    // Continue with existing flow
    const result = await inventoryManager.addWineToInventory(wine, vintage, stock, {
      // ... existing options
    });
    
    // ... rest of handler
  })));
```

**Key Points:**
- Image lookup happens BEFORE saving to database
- Errors are caught and logged, but don't fail wine creation
- If imageService is unavailable, wine creation still succeeds
- Placeholder URL will be used in frontend if lookup fails

## 🗄️ Database Migration

Run the migration to add image_url column to existing databases:

### Method 1: Using sqlite3 command line
```bash
cd /Users/thijs/Documents/SommOS/backend
sqlite3 data/sommos.db < database/migrations/008_add_wine_images.sql
```

### Method 2: Using Node.js script
Create `backend/scripts/migrate-images.js`:

```javascript
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../data/sommos.db');
const migrationPath = path.join(__dirname, '../database/migrations/008_add_wine_images.sql');

const db = new sqlite3.Database(dbPath);
const migration = fs.readFileSync(migrationPath, 'utf8');

db.serialize(() => {
  migration.split(';').forEach(statement => {
    if (statement.trim()) {
      db.run(statement, (err) => {
        if (err) console.error('Migration error:', err.message);
        else console.log('✓ Migration statement executed');
      });
    }
  });
  
  db.close(() => console.log('✓ Migration complete!'));
});
```

Run with: `node backend/scripts/migrate-images.js`

## 🧪 Testing the Image Service

### Test 1: Search for a wine image
```bash
node -e "
const ImageService = require('./backend/services/imageService');
const service = new ImageService();
service.searchWineImage({
  name: 'Chateau Margaux',
  producer: 'Chateau Margaux',
  year: 2015,
  wine_type: 'Red'
}).then(url => console.log('Image URL:', url));
"
```

### Test 2: Check service stats
```bash
node -e "
const sqlite3 = require('sqlite3').verbose();
const ImageService = require('./backend/services/imageService');
const db = new sqlite3.Database('./backend/data/sommos.db');
const service = new ImageService(db);
service.getStats().then(stats => {
  console.log('Image Service Stats:', stats);
  db.close();
});
"
```

### Test 3: Create wine with image via API
```bash
curl -X POST http://localhost:3001/api/wines \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "wine": {
      "name": "Barolo DOCG",
      "producer": "Pio Cesare",
      "wine_type": "Red",
      "region": "Piedmont",
      "country": "Italy",
      "grape_varieties": "[\"Nebbiolo\"]"
    },
    "vintage": {
      "year": 2018
    },
    "stock": {
      "quantity": 6,
      "location": "main-cellar",
      "cost_per_bottle": 89.99
    }
  }'
```

Check response includes `image_url` field.

## 📊 Monitoring

Add logging to track image service usage:

```javascript
// In your route handler
console.log('=== Wine Creation with Image Lookup ===');
console.log('Wine:', wine.name, wine.producer);
console.log('Image URL:', wine.image_url || 'None (will use placeholder)');
```

Check logs for:
- ✓ Successful image lookups
- ⚠ Rate limit warnings
- ❌ API errors

## 🔍 Troubleshooting

### Issue: "ImageService initialized without Unsplash API key"
**Solution:** Add UNSPLASH_ACCESS_KEY to .env file

### Issue: "unsplash-js module not found"
**Solution:** Run `npm install unsplash-js node-fetch` in backend directory

### Issue: "Rate Limit Exceeded"
**Solution:** Unsplash free tier allows 50 requests/hour. Wait or upgrade plan.

### Issue: Images not appearing in database
**Solution:** Check that image_url column exists:
```bash
sqlite3 data/sommos.db "PRAGMA table_info(Wines);"
```

### Issue: All wines getting placeholder
**Solution:** Check Unsplash API key is valid and network connection works

## ✅ Verification Checklist

Before moving to frontend implementation, verify:

- [ ] unsplash-js and node-fetch installed
- [ ] UNSPLASH_ACCESS_KEY in .env file
- [ ] image_url column exists in Wines table
- [ ] ImageService initializes without errors
- [ ] POST /api/wines includes imageService integration
- [ ] Test wine creation returns image_url in response
- [ ] Database shows image_url populated for new wines

## 🚀 Next Steps

Once backend is complete and verified:
1. Move to frontend implementation (Task 4-7)
2. Add images to wine cards
3. Integrate ImageOptimizer
4. Add CSS styling
5. Test performance

---

**Status:** Backend components created, ready for integration  
**Time to integrate:** ~30-45 minutes  
**Risk:** Low (graceful fallbacks, no breaking changes)
