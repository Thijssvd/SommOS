// SommOS Image Optimization System
// Handles lazy loading, responsive images, WebP conversion, and performance optimization

export class ImageOptimizer {
    constructor(options = {}) {
        this.options = {
            // Default configuration
            lazyLoadThreshold: 100, // pixels from viewport to start loading
            placeholderColor: '#1a1a2e',
            placeholderBlur: 'blur(10px)',
            fadeInDuration: 300,
            compressionQuality: 0.8,
            enableWebP: true,
            enableAVIF: false, // AVIF support is still limited
            maxRetries: 3,
            retryDelay: 1000,
            ...options
        };

        this.observer = null;
        this.imageCache = new Map();
        this.loadingImages = new Set();
        this.failedImages = new Set();
        
        this.init();
    }

    init() {
        this.setupIntersectionObserver();
        this.setupImagePreloading();
        this.setupErrorHandling();
    }

    setupIntersectionObserver() {
        if (!('IntersectionObserver' in window)) {
            // Fallback for older browsers
            this.loadAllImages();
            return;
        }

        this.observer = new IntersectionObserver(
            (entries) => this.handleIntersection(entries),
            {
                rootMargin: `${this.options.lazyLoadThreshold}px`,
                threshold: 0.01
            }
        );
    }

    setupImagePreloading() {
        // Preload critical images
        const criticalImages = document.querySelectorAll('[data-preload="true"]');
        criticalImages.forEach(img => this.preloadImage(img));
    }

    setupErrorHandling() {
        // Global error handler for failed image loads
        document.addEventListener('error', (e) => {
            if (e.target.tagName === 'IMG') {
                this.handleImageError(e.target);
            }
        }, true);
    }

    // Main method to optimize an image element
    optimizeImage(img, options = {}) {
        const config = { ...this.options, ...options };
        
        // Skip if already optimized or failed
        if (img.dataset.optimized === 'true' || this.failedImages.has(img.src)) {
            return;
        }

        // Set up lazy loading
        if (config.lazyLoad !== false) {
            this.setupLazyLoading(img, config);
        } else {
            this.loadImage(img, config);
        }

        // Mark as optimized
        img.dataset.optimized = 'true';
    }

    setupLazyLoading(img, config) {
        // Create placeholder
        this.createPlaceholder(img, config);
        
        // Add to intersection observer
        if (this.observer) {
            this.observer.observe(img);
        } else {
            // Fallback: load immediately
            this.loadImage(img, config);
        }
    }

    createPlaceholder(img, config) {
        const placeholder = document.createElement('div');
        placeholder.className = 'image-placeholder';
        placeholder.style.cssText = `
            background: ${config.placeholderColor};
            filter: ${config.placeholderBlur};
            transition: opacity ${config.fadeInDuration}ms ease;
            position: relative;
            overflow: hidden;
        `;

        // Add skeleton loading animation
        const skeleton = document.createElement('div');
        skeleton.className = 'image-skeleton';
        skeleton.style.cssText = `
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
            animation: shimmer 1.5s infinite;
        `;
        placeholder.appendChild(skeleton);

        // Insert placeholder before image
        img.parentNode.insertBefore(placeholder, img);
        img.style.display = 'none';
        img.dataset.placeholder = 'true';
    }

    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                this.loadImage(img, this.options);
                this.observer.unobserve(img);
            }
        });
    }

    async loadImage(img, config) {
        if (this.loadingImages.has(img.src)) {
            return;
        }

        this.loadingImages.add(img.src);

        try {
            // Generate optimized image URL
            const optimizedUrl = await this.generateOptimizedUrl(img.src, config);
            
            // Create new image to test loading
            const testImg = new Image();
            
            await new Promise((resolve, reject) => {
                testImg.onload = resolve;
                testImg.onerror = reject;
                testImg.src = optimizedUrl;
            });

            // Update the actual image
            this.updateImage(img, optimizedUrl, config);
            
            // Cache the successful URL
            this.imageCache.set(img.src, optimizedUrl);
            
        } catch (error) {
            console.warn('Image optimization failed:', img.src, error);
            this.handleImageError(img);
        } finally {
            this.loadingImages.delete(img.src);
        }
    }

    async generateOptimizedUrl(originalUrl, config) {
        // Check cache first
        if (this.imageCache.has(originalUrl)) {
            return this.imageCache.get(originalUrl);
        }

        // For external URLs, try to use image optimization services
        if (this.isExternalUrl(originalUrl)) {
            return this.optimizeExternalImage(originalUrl, config);
        }

        // For local images, return as-is (could be enhanced with server-side optimization)
        return originalUrl;
    }

    isExternalUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.origin !== window.location.origin;
        } catch {
            return false;
        }
    }

    optimizeExternalImage(url, config) {
        // Use a public image optimization service
        // This is a placeholder - in production, you'd use your own service
        const params = new URLSearchParams({
            url: url,
            w: config.width || 'auto',
            h: config.height || 'auto',
            q: Math.round(config.compressionQuality * 100),
            f: config.enableWebP ? 'webp' : 'auto'
        });

        return `https://images.weserv.nl/?${params.toString()}`;
    }

    updateImage(img, optimizedUrl, config) {
        // Remove placeholder
        const placeholder = img.parentNode.querySelector('.image-placeholder');
        if (placeholder) {
            placeholder.style.opacity = '0';
            setTimeout(() => {
                if (placeholder.parentNode) {
                    placeholder.parentNode.removeChild(placeholder);
                }
            }, config.fadeInDuration);
        }

        // Update image source
        img.src = optimizedUrl;
        img.style.display = '';
        img.style.opacity = '0';
        img.style.transition = `opacity ${config.fadeInDuration}ms ease`;

        // Fade in
        requestAnimationFrame(() => {
            img.style.opacity = '1';
        });

        // Remove placeholder flag
        delete img.dataset.placeholder;
    }

    handleImageError(img, retryCount = 0) {
        this.failedImages.add(img.src);
        
        if (retryCount < this.options.maxRetries) {
            // Retry with exponential backoff
            setTimeout(() => {
                this.loadImage(img, this.options);
            }, this.options.retryDelay * Math.pow(2, retryCount));
            return;
        }

        // Show fallback image
        this.showFallbackImage(img);
    }

    showFallbackImage(img) {
        const placeholder = img.parentNode.querySelector('.image-placeholder');
        if (placeholder) {
            placeholder.innerHTML = `
                <div style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    color: #666;
                    font-size: 14px;
                    text-align: center;
                ">
                    🍷<br>
                    <small>Image unavailable</small>
                </div>
            `;
        }
    }

    // Preload critical images
    async preloadImage(img) {
        try {
            const optimizedUrl = await this.generateOptimizedUrl(img.src, this.options);
            const preloadImg = new Image();
            preloadImg.src = optimizedUrl;
            this.imageCache.set(img.src, optimizedUrl);
        } catch (error) {
            console.warn('Preload failed:', img.src, error);
        }
    }

    // Batch optimize all images on page
    optimizeAllImages(options = {}) {
        const images = document.querySelectorAll('img:not([data-optimized="true"])');
        images.forEach(img => this.optimizeImage(img, options));
    }

    // Load all images immediately (fallback for no IntersectionObserver)
    loadAllImages() {
        const images = document.querySelectorAll('img[data-lazy="true"]');
        images.forEach(img => this.loadImage(img, this.options));
    }

    // Clean up resources
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
        this.imageCache.clear();
        this.loadingImages.clear();
        this.failedImages.clear();
    }

    // Utility methods
    static supportsWebP() {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }

    static supportsAVIF() {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        return canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0;
    }

    static getOptimalFormat() {
        if (ImageOptimizer.supportsAVIF()) return 'avif';
        if (ImageOptimizer.supportsWebP()) return 'webp';
        return 'jpeg';
    }

    // Generate responsive image sources
    static generateResponsiveSources(baseUrl, sizes = [320, 640, 1024, 1920]) {
        const format = ImageOptimizer.getOptimalFormat();
        
        return sizes.map(size => ({
            url: `${baseUrl}?w=${size}&f=${format}`,
            width: size,
            descriptor: `${size}w`
        }));
    }
}

// Virtual Scroll implementation for efficient image rendering
export class VirtualScroll {
    constructor(container, items, itemHeight, options = {}) {
        this.container = container;
        this.items = items;
        this.itemHeight = itemHeight;
        this.options = {
            overscan: 5, // Number of items to render outside viewport
            ...options
        };

        this.visibleItems = [];
        this.scrollTop = 0;
        this.containerHeight = 0;
        this.totalHeight = items.length * itemHeight;
        
        this.init();
    }

    init() {
        this.setupContainer();
        this.setupScrollListener();
        this.renderChunk(0, this.getVisibleCount());
    }

    setupContainer() {
        this.container.style.position = 'relative';
        this.container.style.overflow = 'auto';
        this.container.style.height = '100%';
        
        // Create virtual content container
        this.virtualContent = document.createElement('div');
        this.virtualContent.style.height = `${this.totalHeight}px`;
        this.virtualContent.style.position = 'relative';
        this.container.appendChild(this.virtualContent);
    }

    setupScrollListener() {
        this.container.addEventListener('scroll', () => {
            this.scrollTop = this.container.scrollTop;
            this.updateVisibleItems();
        });

        // Handle resize
        window.addEventListener('resize', () => {
            this.updateContainerHeight();
            this.updateVisibleItems();
        });

        this.updateContainerHeight();
    }

    updateContainerHeight() {
        this.containerHeight = this.container.clientHeight;
    }

    getVisibleCount() {
        return Math.ceil(this.containerHeight / this.itemHeight) + this.options.overscan * 2;
    }

    getVisibleRange() {
        const startIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.options.overscan);
        const endIndex = Math.min(
            this.items.length - 1,
            startIndex + this.getVisibleCount()
        );
        
        return { startIndex, endIndex };
    }

    updateVisibleItems() {
        const { startIndex, endIndex } = this.getVisibleRange();
        
        // Remove items outside visible range
        this.visibleItems.forEach(item => {
            if (item.index < startIndex || item.index > endIndex) {
                this.removeItem(item);
            }
        });

        // Add new items in visible range
        for (let i = startIndex; i <= endIndex; i++) {
            if (!this.visibleItems.find(item => item.index === i)) {
                this.addItem(i);
            }
        }
    }

    addItem(index) {
        const item = this.items[index];
        const element = this.createItemElement(item, index);
        
        element.style.position = 'absolute';
        element.style.top = `${index * this.itemHeight}px`;
        element.style.width = '100%';
        element.style.height = `${this.itemHeight}px`;
        
        this.virtualContent.appendChild(element);
        
        this.visibleItems.push({
            index,
            element,
            data: item
        });
    }

    removeItem(item) {
        if (item.element.parentNode) {
            item.element.parentNode.removeChild(item.element);
        }
        
        const index = this.visibleItems.indexOf(item);
        if (index > -1) {
            this.visibleItems.splice(index, 1);
        }
    }

    createItemElement(item, index) {
        // This should be overridden by the parent class
        const div = document.createElement('div');
        div.textContent = `Item ${index}`;
        return div;
    }

    renderChunk(startIndex, count) {
        const endIndex = Math.min(startIndex + count, this.items.length);
        
        for (let i = startIndex; i < endIndex; i++) {
            this.addItem(i);
        }
    }

    // Update items and re-render
    updateItems(newItems) {
        this.items = newItems;
        this.totalHeight = newItems.length * this.itemHeight;
        this.virtualContent.style.height = `${this.totalHeight}px`;
        
        // Clear visible items
        this.visibleItems.forEach(item => this.removeItem(item));
        this.visibleItems = [];
        
        // Re-render visible range
        this.updateVisibleItems();
    }

    // Scroll to specific item
    scrollToItem(index) {
        const scrollTop = index * this.itemHeight;
        this.container.scrollTop = scrollTop;
    }

    // Get item at scroll position
    getItemAtScrollPosition() {
        const index = Math.floor(this.scrollTop / this.itemHeight);
        return this.items[index] || null;
    }

    destroy() {
        this.container.removeEventListener('scroll', this.updateVisibleItems);
        window.removeEventListener('resize', this.updateContainerHeight);
        
        this.visibleItems.forEach(item => this.removeItem(item));
        this.visibleItems = [];
    }
}

// Image compression utilities
export class ImageCompressor {
    static async compressImage(file, options = {}) {
        const config = {
            maxWidth: 1920,
            maxHeight: 1080,
            quality: 0.8,
            format: 'image/jpeg',
            ...options
        };

        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                // Calculate new dimensions
                let { width, height } = img;
                
                if (width > config.maxWidth || height > config.maxHeight) {
                    const ratio = Math.min(
                        config.maxWidth / width,
                        config.maxHeight / height
                    );
                    width *= ratio;
                    height *= ratio;
                }

                // Set canvas dimensions
                canvas.width = width;
                canvas.height = height;

                // Draw and compress
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob(resolve, config.format, config.quality);
            };

            img.src = URL.createObjectURL(file);
        });
    }

    static async resizeImage(file, width, height, quality = 0.8) {
        return this.compressImage(file, {
            maxWidth: width,
            maxHeight: height,
            quality
        });
    }

    static async convertToWebP(file, quality = 0.8) {
        return this.compressImage(file, {
            format: 'image/webp',
            quality
        });
    }
}

// Initialize image optimization on page load
document.addEventListener('DOMContentLoaded', () => {
    // Auto-initialize image optimizer
    window.imageOptimizer = new ImageOptimizer({
        lazyLoadThreshold: 100,
        compressionQuality: 0.8,
        enableWebP: ImageOptimizer.supportsWebP()
    });

    // Optimize all existing images
    window.imageOptimizer.optimizeAllImages();
});

// Export for use in other modules
export default ImageOptimizer;