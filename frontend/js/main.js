import '../css/styles-cache-bust.css';
import SommOS from './app';
import { registerServiceWorker } from './sw-registration.mjs';
import { ImageOptimizer } from './image-optimizer.js';
import OptimizedWineCard from './wine-card-optimized.js';

function bootstrapApp() {
  // Initialize image optimization system
  window.imageOptimizer = new ImageOptimizer({
    lazyLoadThreshold: 100,
    compressionQuality: 0.8,
    enableWebP: ImageOptimizer.supportsWebP(),
    enableAVIF: ImageOptimizer.supportsAVIF()
  });

  // Initialize optimized wine card system
  window.optimizedWineCard = new OptimizedWineCard({
    imageOptimizer: window.imageOptimizer,
    enableVirtualScroll: true,
    showImageOptimizationBadge: false // Set to true for debugging
  });

  // Initialize main app
  window.app = new SommOS();
  window.sommOS = window.app;
}

if (document.readyState !== 'loading') {
  bootstrapApp();
} else {
  document.addEventListener('DOMContentLoaded', bootstrapApp);
}

registerServiceWorker();
