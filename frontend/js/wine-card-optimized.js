// SommOS Optimized Wine Card Component
// Integrates image optimization with wine card rendering

import { ImageOptimizer, VirtualScroll } from './image-optimizer.js';

export class OptimizedWineCard {
    constructor(options = {}) {
        this.options = {
            imageOptimizer: null,
            cardType: 'grid', // 'grid', 'list', 'detail'
            enableVirtualScroll: false,
            lazyLoadImages: true,
            showImageOptimizationBadge: false,
            ...options
        };

        this.imageOptimizer = this.options.imageOptimizer || window.imageOptimizer;
        this.virtualScroll = null;
        
        this.init();
    }

    init() {
        if (!this.imageOptimizer) {
            console.warn('ImageOptimizer not available, creating default instance');
            this.imageOptimizer = new ImageOptimizer();
        }
    }

    // Create optimized wine card HTML
    createWineCard(wine, options = {}) {
        const config = { ...this.options, ...options };
        const cardType = config.cardType || 'grid';
        
        switch (cardType) {
            case 'grid':
                return this.createGridCard(wine, config);
            case 'list':
                return this.createListCard(wine, config);
            case 'detail':
                return this.createDetailCard(wine, config);
            default:
                return this.createGridCard(wine, config);
        }
    }

    createGridCard(wine, config) {
        const card = document.createElement('div');
        card.className = 'wine-card catalog-card';
        card.dataset.wineId = wine.id;
        
        // Wine image with optimization
        const imageContainer = this.createOptimizedImageContainer(wine, {
            aspectRatio: 'aspect-3-2',
            showBadge: config.showImageOptimizationBadge,
            lazyLoad: config.lazyLoadImages
        });

        // Wine header with year and type badge
        const header = this.createWineHeader(wine);
        
        // Wine body with basic info
        const body = this.createWineBody(wine, 'grid');
        
        // Wine guidance section
        const guidance = this.createWineGuidance(wine);
        
        // Wine stats
        const stats = this.createWineStats(wine, 'grid');
        
        // Card actions
        const actions = this.createCardActions(wine);

        card.appendChild(imageContainer);
        card.appendChild(header);
        card.appendChild(body);
        card.appendChild(guidance);
        card.appendChild(stats);
        card.appendChild(actions);

        return card;
    }

    createListCard(wine, config) {
        const card = document.createElement('div');
        card.className = 'wine-list-item';
        card.dataset.wineId = wine.id;

        // Basic wine info
        const basicInfo = this.createWineBasicInfo(wine);
        
        // Wine details
        const details = this.createWineDetails(wine);
        
        // Wine metrics with scores
        const metrics = this.createWineMetrics(wine, 'list');

        card.appendChild(basicInfo);
        card.appendChild(details);
        card.appendChild(metrics);

        return card;
    }

    createDetailCard(wine, config) {
        const card = document.createElement('div');
        card.className = 'wine-detail-card';
        card.dataset.wineId = wine.id;

        // Large wine image
        const imageContainer = this.createOptimizedImageContainer(wine, {
            aspectRatio: 'aspect-16-9',
            showBadge: config.showImageOptimizationBadge,
            lazyLoad: config.lazyLoadImages,
            size: 'large'
        });

        // Detailed wine information
        const content = this.createDetailedWineContent(wine);
        
        // Wine metrics
        const metrics = this.createWineMetrics(wine, 'detail');

        card.appendChild(imageContainer);
        card.appendChild(content);
        card.appendChild(metrics);

        return card;
    }

    createOptimizedImageContainer(wine, options = {}) {
        const container = document.createElement('div');
        container.className = `image-container ${options.aspectRatio || 'aspect-3-2'}`;
        
        // Create image element
        const img = document.createElement('img');
        img.className = 'wine-bottle-image';
        img.alt = `${wine.name} - ${wine.producer}`;
        img.loading = options.lazyLoad !== false ? 'lazy' : 'eager';
        
        // Set image source (could be from wine.imageUrl or generated)
        img.src = this.getWineImageUrl(wine, options);
        
        // Add optimization attributes
        img.dataset.optimized = 'true';
        img.dataset.lazy = options.lazyLoad !== false ? 'true' : 'false';
        
        // Add image optimization badge if enabled
        if (options.showBadge) {
            const badge = this.createOptimizationBadge();
            container.appendChild(badge);
        }

        container.appendChild(img);

        // Optimize the image
        if (this.imageOptimizer) {
            this.imageOptimizer.optimizeImage(img, {
                width: this.getImageWidth(options.size),
                height: this.getImageHeight(options.size),
                lazyLoad: options.lazyLoad !== false
            });
        }

        return container;
    }

    createOptimizationBadge() {
        const badge = document.createElement('div');
        badge.className = 'image-optimization-badge';
        
        // Detect supported formats
        if (ImageOptimizer.supportsAVIF()) {
            badge.classList.add('avif-supported');
        } else if (ImageOptimizer.supportsWebP()) {
            badge.classList.add('webp-supported');
        }
        
        return badge;
    }

    createWineHeader(wine) {
        const header = document.createElement('div');
        header.className = 'wine-card-header';

        const year = document.createElement('div');
        year.className = 'wine-year';
        year.textContent = wine.vintage || 'NV';

        const typeBadge = document.createElement('div');
        typeBadge.className = `wine-type-badge ${(wine.type || '').toLowerCase()}`;
        typeBadge.textContent = wine.type || 'Unknown';

        header.appendChild(year);
        header.appendChild(typeBadge);

        return header;
    }

    createWineBody(wine, type) {
        const body = document.createElement('div');
        body.className = 'wine-card-body';

        const name = document.createElement('h3');
        name.className = 'wine-name';
        name.textContent = wine.name;

        const producer = document.createElement('div');
        producer.className = 'producer';
        producer.textContent = wine.producer;

        const region = document.createElement('div');
        region.className = 'region';
        region.textContent = `${wine.region}, ${wine.country}`;

        body.appendChild(name);
        body.appendChild(producer);
        body.appendChild(region);

        return body;
    }

    createWineGuidance(wine) {
        const guidance = document.createElement('div');
        guidance.className = 'wine-guidance';

        if (wine.guidance) {
            const peakWindow = document.createElement('div');
            peakWindow.className = 'guidance-line';
            peakWindow.innerHTML = `
                <span class="guidance-label">Peak Window</span>
                <span class="guidance-value">${wine.guidance.peakWindow || 'N/A'}</span>
            `;

            const servingTemp = document.createElement('div');
            servingTemp.className = 'guidance-line';
            servingTemp.innerHTML = `
                <span class="guidance-label">Serving Temp</span>
                <span class="guidance-value">${wine.guidance.servingTemperature || 'N/A'}</span>
            `;

            guidance.appendChild(peakWindow);
            guidance.appendChild(servingTemp);
        }

        return guidance;
    }

    createWineStats(wine, type) {
        const stats = document.createElement('div');
        stats.className = 'wine-stats';

        const stock = document.createElement('div');
        stock.className = 'stat-block';
        stock.innerHTML = `
            <div class="stat-label">Stock</div>
            <div class="stat-value">${wine.stock || 0}</div>
            <div class="stat-unit">bottles</div>
        `;

        const value = document.createElement('div');
        value.className = 'stat-block';
        value.innerHTML = `
            <div class="stat-label">Value</div>
            <div class="stat-value">$${wine.totalValue || 0}</div>
            <div class="stat-unit">total</div>
        `;

        stats.appendChild(stock);
        stats.appendChild(value);

        return stats;
    }

    createWineBasicInfo(wine) {
        const info = document.createElement('div');
        info.className = 'wine-basic-info';

        const name = document.createElement('h4');
        name.textContent = wine.name;

        const producer = document.createElement('div');
        producer.className = 'producer';
        producer.textContent = wine.producer;

        info.appendChild(name);
        info.appendChild(producer);

        return info;
    }

    createWineDetails(wine) {
        const details = document.createElement('div');
        details.className = 'wine-details';

        const vintage = document.createElement('span');
        vintage.textContent = wine.vintage || 'NV';

        const region = document.createElement('span');
        region.textContent = wine.region;

        const type = document.createElement('span');
        type.textContent = wine.type;

        details.appendChild(vintage);
        details.appendChild(region);
        details.appendChild(type);

        return details;
    }

    createWineMetrics(wine, type) {
        const metrics = document.createElement('div');
        metrics.className = 'wine-metrics';

        if (type === 'list') {
            const scoreSummary = this.createScoreSummary(wine, 'list');
            metrics.appendChild(scoreSummary);
        } else if (type === 'detail') {
            const scoreSummary = this.createScoreSummary(wine, 'detail');
            metrics.appendChild(scoreSummary);
        }

        return metrics;
    }

    createScoreSummary(wine, type) {
        const summary = document.createElement('div');
        summary.className = `wine-score-summary ${type}`;

        // Overall score chip
        const overallChip = document.createElement('div');
        overallChip.className = 'score-chip overall';
        overallChip.innerHTML = `
            <div class="score-label">Overall</div>
            <div class="score-value">${wine.overallScore || 0}<span class="score-unit">/100</span></div>
        `;

        summary.appendChild(overallChip);

        if (type === 'detail' && wine.scores) {
            const breakdown = document.createElement('div');
            breakdown.className = 'score-breakdown';

            Object.entries(wine.scores).forEach(([key, value]) => {
                if (key !== 'overall') {
                    const pill = document.createElement('div');
                    pill.className = 'score-pill';
                    pill.innerHTML = `
                        <span class="pill-label">${key}</span>
                        <span class="pill-value">${value}</span>
                    `;
                    breakdown.appendChild(pill);
                }
            });

            summary.appendChild(breakdown);
        }

        return summary;
    }

    createCardActions(wine) {
        const actions = document.createElement('div');
        actions.className = 'card-actions-simple';

        const viewBtn = document.createElement('button');
        viewBtn.className = 'btn-small primary';
        viewBtn.innerHTML = '<span>👁️</span> View';
        viewBtn.addEventListener('click', () => this.handleViewWine(wine));

        const pairBtn = document.createElement('button');
        pairBtn.className = 'btn-small';
        pairBtn.innerHTML = '<span>🍽️</span> Pair';
        pairBtn.addEventListener('click', () => this.handlePairWine(wine));

        actions.appendChild(viewBtn);
        actions.appendChild(pairBtn);

        return actions;
    }

    createDetailedWineContent(wine) {
        const content = document.createElement('div');
        content.className = 'wine-detail-content';

        const header = document.createElement('div');
        header.className = 'wine-main-info';
        header.innerHTML = `
            <h2>${wine.name}</h2>
            <div class="wine-producer">${wine.producer}</div>
            <div class="wine-vintage-info">
                <span class="vintage">${wine.vintage || 'NV'}</span>
                <span class="region">${wine.region}</span>
                <span class="country">${wine.country}</span>
            </div>
        `;

        content.appendChild(header);

        if (wine.description) {
            const description = document.createElement('div');
            description.className = 'wine-description';
            description.textContent = wine.description;
            content.appendChild(description);
        }

        return content;
    }

    // Utility methods
    getWineImageUrl(wine, options = {}) {
        // In a real application, this would generate or fetch the appropriate image URL
        // For now, we'll use a placeholder or the wine's imageUrl
        if (wine.imageUrl) {
            return wine.imageUrl;
        }

        // Generate a placeholder image URL based on wine properties
        const size = this.getImageSize(options.size);
        const params = new URLSearchParams({
            text: `${wine.name} ${wine.vintage}`,
            width: size.width,
            height: size.height,
            bg: '1a1a2e',
            color: 'ffffff'
        });

        return `https://via.placeholder.com/${size.width}x${size.height}?${params.toString()}`;
    }

    getImageSize(size) {
        const sizes = {
            small: { width: 200, height: 300 },
            medium: { width: 300, height: 450 },
            large: { width: 600, height: 400 }
        };
        return sizes[size] || sizes.medium;
    }

    getImageWidth(size) {
        return this.getImageSize(size).width;
    }

    getImageHeight(size) {
        return this.getImageSize(size).height;
    }

    // Event handlers
    handleViewWine(wine) {
        // Emit custom event or call callback
        const event = new CustomEvent('wine:view', {
            detail: { wine },
            bubbles: true
        });
        document.dispatchEvent(event);
    }

    handlePairWine(wine) {
        // Emit custom event or call callback
        const event = new CustomEvent('wine:pair', {
            detail: { wine },
            bubbles: true
        });
        document.dispatchEvent(event);
    }

    // Virtual scroll integration
    createVirtualScrollContainer(container, items, options = {}) {
        if (!this.options.enableVirtualScroll) {
            return null;
        }

        const config = {
            itemHeight: 200, // Adjust based on card height
            ...options
        };

        this.virtualScroll = new VirtualScroll(container, items, config.itemHeight, {
            ...config,
            createItemElement: (item, index) => {
                return this.createWineCard(item, { cardType: 'grid' });
            }
        });

        return this.virtualScroll;
    }

    // Batch render wine cards with optimization
    renderWineCards(container, wines, options = {}) {
        const config = { ...this.options, ...options };
        
        // Clear container
        container.innerHTML = '';

        if (config.enableVirtualScroll && wines.length > 50) {
            // Use virtual scroll for large datasets
            return this.createVirtualScrollContainer(container, wines, config);
        } else {
            // Render all cards normally
            wines.forEach(wine => {
                const card = this.createWineCard(wine, config);
                container.appendChild(card);
            });
        }
    }

    // Clean up resources
    destroy() {
        if (this.virtualScroll) {
            this.virtualScroll.destroy();
            this.virtualScroll = null;
        }
    }
}

// Export for use in other modules
export default OptimizedWineCard;