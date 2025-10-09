# Option: Static Wine Images (No API Required)

## Quick Setup - Use Generic Wine Images by Type

### Step 1: Add Static Images

Place generic wine bottle images in `frontend/images/wines/`:

```bash
mkdir -p frontend/images/wines

# Download free wine images from:
# - https://pixabay.com (no attribution required)
# - Public domain sources
# Or use AI-generated placeholders

# Name them by wine type:
frontend/images/wines/
  red-wine.jpg      # Generic red wine bottle
  white-wine.jpg    # Generic white wine bottle
  rose-wine.jpg     # Generic rosé wine bottle
  sparkling-wine.jpg # Generic sparkling wine bottle
  dessert-wine.jpg  # Generic dessert wine bottle
  fortified-wine.jpg # Generic fortified wine bottle
```

### Step 2: Modify ImageService

Replace the Unsplash lookup with type-based static images:

```javascript
// In backend/services/imageService.js

async searchWineImage(wine) {
    if (!wine) {
        return this.config.placeholderUrl;
    }
    
    // Map wine type to static image
    const wineType = (wine.wine_type || 'red').toLowerCase();
    const imageMap = {
        'red': '/images/wines/red-wine.jpg',
        'white': '/images/wines/white-wine.jpg',
        'rosé': '/images/wines/rose-wine.jpg',
        'sparkling': '/images/wines/sparkling-wine.jpg',
        'dessert': '/images/wines/dessert-wine.jpg',
        'fortified': '/images/wines/fortified-wine.jpg'
    };
    
    return imageMap[wineType] || '/images/wine-placeholder.svg';
}
```

### Pros

- ✅ No API needed
- ✅ Works offline
- ✅ Zero rate limits
- ✅ Instant setup
- ✅ Predictable behavior

### Cons

- ❌ Less specific (not actual wine bottles)
- ❌ Less visual variety
- ❌ Still generic

---

## Alternative: Wine Region Images

Use images of wine regions instead of bottles:

```javascript
const regionImageMap = {
    'bordeaux': '/images/regions/bordeaux.jpg',
    'burgundy': '/images/regions/burgundy.jpg',
    'napa valley': '/images/regions/napa.jpg',
    'tuscany': '/images/regions/tuscany.jpg',
    // etc.
};
```

This can be more atmospheric and educational!
