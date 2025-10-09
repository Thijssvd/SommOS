# SommOS Image Optimization System

A comprehensive frontend image optimization solution for the SommOS yacht wine management system, featuring lazy loading, responsive images, WebP/AVIF support, virtual scrolling, and performance monitoring.

## Features

### 🚀 Core Optimization Features

- **Lazy Loading**: Images load only when they enter the viewport
- **Responsive Images**: Automatic sizing based on container and device
- **Format Optimization**: WebP and AVIF support with fallbacks
- **Image Compression**: Client-side compression with quality control
- **Progressive Loading**: Blur-to-sharp loading transitions
- **Error Handling**: Graceful fallbacks for failed image loads

### 📱 Performance Features

- **Virtual Scrolling**: Efficient rendering of large image lists
- **Intersection Observer**: Modern, performant lazy loading
- **Image Caching**: Prevents redundant downloads
- **Retry Logic**: Automatic retry with exponential backoff
- **Performance Monitoring**: Track image load times and optimization metrics

### 🎨 UI/UX Features

- **Skeleton Loading**: Animated placeholders during image load
- **Smooth Transitions**: Fade-in animations and hover effects
- **Optimization Badges**: Visual indicators for supported formats
- **Responsive Design**: Mobile-first approach with breakpoints
- **Accessibility**: Proper alt text and ARIA labels

## Quick Start

### 1. Basic Usage

```javascript
import { ImageOptimizer } from './js/image-optimizer.js';

// Initialize the optimizer
const imageOptimizer = new ImageOptimizer({
    lazyLoadThreshold: 100,
    compressionQuality: 0.8,
    enableWebP: true
});

// Optimize all images on the page
imageOptimizer.optimizeAllImages();
```

### 2. Optimize Individual Images

```javascript
// Get an image element
const img = document.querySelector('img');

// Optimize it
imageOptimizer.optimizeImage(img, {
    width: 400,
    height: 600,
    lazyLoad: true
});
```

### 3. Create Optimized Wine Cards

```javascript
import OptimizedWineCard from './js/wine-card-optimized.js';

const wineCard = new OptimizedWineCard({
    imageOptimizer: imageOptimizer,
    enableVirtualScroll: true
});

// Create a wine card
const card = wineCard.createWineCard(wineData, {
    cardType: 'grid',
    showImageOptimizationBadge: true
});
```

## API Reference

### ImageOptimizer Class

#### Constructor Options

```javascript
const optimizer = new ImageOptimizer({
    lazyLoadThreshold: 100,        // Pixels from viewport to start loading
    placeholderColor: '#1a1a2e',   // Placeholder background color
    placeholderBlur: 'blur(10px)', // Placeholder blur effect
    fadeInDuration: 300,           // Fade-in animation duration (ms)
    compressionQuality: 0.8,       // Image compression quality (0-1)
    enableWebP: true,              // Enable WebP format
    enableAVIF: false,             // Enable AVIF format (limited support)
    maxRetries: 3,                 // Maximum retry attempts
    retryDelay: 1000              // Base retry delay (ms)
});
```

#### Methods

- `optimizeImage(img, options)` - Optimize a single image
- `optimizeAllImages(options)` - Optimize all images on page
- `preloadImage(img)` - Preload critical images
- `destroy()` - Clean up resources

### VirtualScroll Class

#### Constructor

```javascript
const virtualScroll = new VirtualScroll(container, items, itemHeight, {
    overscan: 5,                   // Items to render outside viewport
    createItemElement: (item, index) => { /* return DOM element */ }
});
```

#### Methods

- `updateItems(newItems)` - Update the items list
- `scrollToItem(index)` - Scroll to specific item
- `getItemAtScrollPosition()` - Get item at current scroll position
- `destroy()` - Clean up resources

### ImageCompressor Class

#### Static Methods

```javascript
// Compress an image file
const compressedBlob = await ImageCompressor.compressImage(file, {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 0.8,
    format: 'image/jpeg'
});

// Resize an image
const resizedBlob = await ImageCompressor.resizeImage(file, 800, 600, 0.8);

// Convert to WebP
const webpBlob = await ImageCompressor.convertToWebP(file, 0.8);
```

## CSS Classes

### Image Optimization Classes

```css
/* Image containers */
.image-container { /* Base container styles */ }
.image-placeholder { /* Loading placeholder */ }
.image-skeleton { /* Skeleton loading animation */ }

/* Optimized images */
img[data-optimized="true"] { /* Optimized image styles */ }
img[data-loaded="true"] { /* Loaded image styles */ }

/* Aspect ratio containers */
.aspect-ratio-container.aspect-16-9 { /* 16:9 aspect ratio */ }
.aspect-ratio-container.aspect-4-3 { /* 4:3 aspect ratio */ }
.aspect-ratio-container.aspect-1-1 { /* 1:1 aspect ratio */ }

/* Optimization badges */
.image-optimization-badge { /* Base badge styles */ }
.webp-supported::after { /* WebP support indicator */ }
.avif-supported::after { /* AVIF support indicator */ }
```

### Wine Card Classes

```css
/* Wine card variants */
.wine-card { /* Base wine card */ }
.wine-list-item { /* List view wine card */ }
.wine-detail-card { /* Detailed wine card */ }

/* Wine card components */
.wine-card-header { /* Card header */ }
.wine-card-body { /* Card body */ }
.wine-guidance { /* Wine guidance section */ }
.wine-stats { /* Wine statistics */ }
.wine-score-summary { /* Score display */ }
```

## Configuration

### Environment Variables

```javascript
// In your main.js or configuration file
window.imageOptimizer = new ImageOptimizer({
    lazyLoadThreshold: process.env.IMAGE_LAZY_THRESHOLD || 100,
    compressionQuality: process.env.IMAGE_QUALITY || 0.8,
    enableWebP: process.env.ENABLE_WEBP !== 'false',
    enableAVIF: process.env.ENABLE_AVIF === 'true'
});
```

### Service Worker Integration

The image optimization system works seamlessly with service workers for caching:

```javascript
// In your service worker
self.addEventListener('fetch', event => {
    if (event.request.destination === 'image') {
        event.respondWith(
            caches.match(event.request).then(response => {
                return response || fetch(event.request);
            })
        );
    }
});
```

## Performance Monitoring

### Built-in Metrics

The system automatically tracks:

- Image load times
- Optimization success/failure rates
- Format support detection
- Cache hit rates

### Custom Analytics

```javascript
// Track custom metrics
imageOptimizer.on('imageLoaded', (data) => {
    gtag('event', 'image_load_time', {
        load_time: data.loadTime,
        image_url: data.url,
        format: data.format
    });
});
```

## Browser Support

### Modern Browsers (Recommended)

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

### Fallbacks

- Intersection Observer polyfill for older browsers
- Automatic fallback to immediate loading
- Progressive enhancement approach

## Best Practices

### 1. Image Sizing

```javascript
// Always specify dimensions for better performance
imageOptimizer.optimizeImage(img, {
    width: 400,
    height: 600
});
```

### 2. Critical Images

```html
<!-- Mark critical images for preloading -->
<img src="hero-image.jpg" data-preload="true" alt="Hero image">
```

### 3. Virtual Scrolling

```javascript
// Use virtual scrolling for lists > 50 items
if (items.length > 50) {
    wineCard.createVirtualScrollContainer(container, items, 200);
}
```

### 4. Error Handling

```javascript
// Provide fallback images
const fallbackUrl = '/images/placeholder-wine.jpg';
imageOptimizer.optimizeImage(img, {
    fallbackUrl: fallbackUrl
});
```

## Troubleshooting

### Common Issues

1. **Images not loading**
   - Check network connectivity
   - Verify image URLs are accessible
   - Check browser console for CORS errors

2. **WebP not working**
   - Verify browser support: `ImageOptimizer.supportsWebP()`
   - Check server supports WebP delivery
   - Ensure proper MIME type headers

3. **Virtual scroll performance**
   - Reduce item height for better performance
   - Limit overscan items
   - Use `will-change: transform` for animated elements

### Debug Mode

```javascript
// Enable debug logging
const imageOptimizer = new ImageOptimizer({
    debug: true,
    showOptimizationBadge: true
});
```

## Demo

Run the demo to see all features in action:

```bash
# Open the demo file in your browser
open frontend/image-optimization-demo.html
```

The demo includes:

- Performance statistics
- Interactive controls
- Image compression comparison
- Virtual scroll demonstration
- Optimized wine cards

## Contributing

When contributing to the image optimization system:

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Test across different browsers
5. Consider performance implications

## License

This image optimization system is part of the SommOS project and follows the same licensing terms.
