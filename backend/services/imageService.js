/**
 * SommOS Image Service
 * 
 * Automatically searches for wine bottle images using the Unsplash API
 * when new wines are added without images. Caches results in the database
 * to avoid repeated API calls.
 * 
 * Features:
 * - Unsplash API integration (free tier: 50 requests/hour)
 * - Intelligent search query construction
 * - Fallback search strategies
 * - Rate limiting and error handling
 * - Database caching
 */

const fetch = require('node-fetch');

class ImageService {
    constructor(db, config = {}) {
        this.db = db;
        this.config = {
            placeholderUrl: '/images/wine-placeholder.svg',
            maxRetries: 3,
            retryDelay: 1000,
            cacheExpiry: 90 * 24 * 60 * 60 * 1000, // 90 days in milliseconds
            ...config
        };

        console.log('✓ ImageService initialized with Vivino wine image search (no API key needed!)');
    }

    /**
     * Search for a wine bottle image using Vivino's database
     * @param {Object} wine - Wine details { name, producer, year, varietal }
     * @returns {Promise<string>} Image URL or placeholder
     */
    async searchWineImage(wine) {
        if (!wine || !wine.name || !wine.producer) {
            console.warn('ImageService: Insufficient wine data for image search');
            return this.config.placeholderUrl;
        }

        try {
            // Try Vivino search first (has actual wine bottles!)
            let imageUrl = await this.searchVivino(wine);
            if (imageUrl) return imageUrl;

            // Fallback to Wine-Searcher
            imageUrl = await this.searchWineSearcher(wine);
            if (imageUrl) return imageUrl;

            // Final fallback to generic wine-type image
            return this.getGenericWineImage(wine);

        } catch (error) {
            console.error('ImageService: Search failed:', error.message);
            return this.config.placeholderUrl;
        }
    }

    /**
     * Search Vivino for actual wine bottle images
     * @private
     */
    async searchVivino(wine) {
        try {
            // Construct search query: "Producer Name Year"
            const query = `${wine.producer} ${wine.name} ${wine.year || ''}`.trim();
            const encodedQuery = encodeURIComponent(query);
            
            console.log(`ImageService: Searching Vivino for "${query}"`);
            
            // Vivino's public search endpoint (used by their website)
            const url = `https://www.vivino.com/api/wines/search?q=${encodedQuery}`;
            
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'application/json'
                },
                timeout: 5000
            });
            
            if (!response.ok) {
                console.log(`Vivino returned ${response.status}`);
                return null;
            }
            
            const data = await response.json();
            
            // Vivino returns array of wine matches
            if (data.explore_vintage && data.explore_vintage.records && data.explore_vintage.records.length > 0) {
                const firstMatch = data.explore_vintage.records[0].vintage;
                if (firstMatch && firstMatch.image && firstMatch.image.location) {
                    const imageUrl = firstMatch.image.location;
                    console.log(`✓ Found Vivino image: ${imageUrl.substring(0, 60)}...`);
                    return imageUrl;
                }
            }
            
            console.log('Vivino: No results found');
            return null;
            
        } catch (error) {
            console.log('Vivino search error:', error.message);
            return null;
        }
    }

    /**
     * Search Wine-Searcher as fallback
     * @private
     */
    async searchWineSearcher(wine) {
        try {
            // Wine-Searcher has structured URLs
            const producer = wine.producer.toLowerCase().replace(/\s+/g, '-');
            const name = wine.name.toLowerCase().replace(/\s+/g, '-');
            const year = wine.year || '';
            
            console.log(`ImageService: Trying Wine-Searcher for ${wine.producer} ${wine.name}`);
            
            // Construct predictable Wine-Searcher URL
            const url = `https://www.wine-searcher.com/find/${producer}-${name}-${year}`;
            
            // Note: This is a fallback and may not always work
            // Wine-Searcher uses dynamic image loading
            console.log('Wine-Searcher: URL constructed but images require scraping');
            return null;
            
        } catch (error) {
            return null;
        }
    }

    /**
     * Get generic wine image based on wine type
     * @private
     */
    getGenericWineImage(wine) {
        // Return wine-type specific placeholder
        const wineType = (wine.wine_type || 'red').toLowerCase();
        
        const imageMap = {
            'red': '/images/wine-placeholder.svg',
            'white': '/images/wine-placeholder.svg',
            'rosé': '/images/wine-placeholder.svg',
            'sparkling': '/images/wine-placeholder.svg',
            'dessert': '/images/wine-placeholder.svg',
            'fortified': '/images/wine-placeholder.svg'
        };
        
        console.log(`Using generic ${wineType} wine placeholder`);
        return imageMap[wineType] || this.config.placeholderUrl;
    }

    /**
     * Determine if an error should trigger a retry
     * @private
     */
    shouldRetry(error) {
        const retryableErrors = [
            'ECONNRESET',
            'ETIMEDOUT',
            'ENOTFOUND',
            'network',
            'timeout',
            'fetch failed'
        ];

        const errorString = error.message?.toLowerCase() || '';
        return retryableErrors.some(err => errorString.includes(err.toLowerCase()));
    }

    /**
     * Sleep utility for retries
     * @private
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get or fetch image URL for a wine
     * Checks database cache first, then searches if not found
     * 
     * @param {number} wineId - Wine ID
     * @param {Object} wineData - Wine details for search if needed
     * @returns {Promise<string>} Image URL
     */
    async getOrFetchImage(wineId, wineData) {
        if (!this.db) {
            console.warn('ImageService: No database connection, cannot cache images');
            return this.searchWineImage(wineData);
        }

        try {
            // Check if wine already has an image URL in database
            const wine = await this.db.get(
                'SELECT image_url FROM Wines WHERE id = ?',
                [wineId]
            );

            if (wine && wine.image_url) {
                console.log(`ImageService: Using cached image for wine ${wineId}`);
                return wine.image_url;
            }

            // No cached image, search for one
            console.log(`ImageService: No cached image for wine ${wineId}, searching...`);
            const imageUrl = await this.searchWineImage(wineData);

            // Cache the result in database (even if it's the placeholder)
            if (imageUrl && imageUrl !== this.config.placeholderUrl) {
                await this.cacheImageUrl(wineId, imageUrl);
            }

            return imageUrl;

        } catch (error) {
            console.error('ImageService: getOrFetchImage failed:', error.message);
            return this.config.placeholderUrl;
        }
    }

    /**
     * Cache image URL in database
     * @private
     */
    async cacheImageUrl(wineId, imageUrl) {
        if (!this.db) return;

        try {
            await this.db.run(
                'UPDATE Wines SET image_url = ?, updated_at = strftime(\'%s\',\'now\') WHERE id = ?',
                [imageUrl, wineId]
            );
            console.log(`ImageService: Cached image URL for wine ${wineId}`);
        } catch (error) {
            console.error('ImageService: Failed to cache image URL:', error.message);
        }
    }

    /**
     * Get service statistics
     */
    async getStats() {
        if (!this.db) {
            return {
                totalWines: 0,
                winesWithImages: 0,
                winesWithoutImages: 0,
                cacheHitRate: 0
            };
        }

        try {
            const stats = await this.db.get(`
                SELECT 
                    COUNT(*) as total_wines,
                    SUM(CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 1 ELSE 0 END) as wines_with_images,
                    SUM(CASE WHEN image_url IS NULL OR image_url = '' THEN 1 ELSE 0 END) as wines_without_images
                FROM Wines
            `);

            const cacheHitRate = stats.total_wines > 0 
                ? (stats.wines_with_images / stats.total_wines * 100).toFixed(1)
                : 0;

            return {
                totalWines: stats.total_wines || 0,
                winesWithImages: stats.wines_with_images || 0,
                winesWithoutImages: stats.wines_without_images || 0,
                cacheHitRate: parseFloat(cacheHitRate)
            };
        } catch (error) {
            console.error('ImageService: Failed to get stats:', error.message);
            return {
                totalWines: 0,
                winesWithImages: 0,
                winesWithoutImages: 0,
                cacheHitRate: 0
            };
        }
    }

    /**
     * Clear expired cache entries (if implementing cache expiry)
     */
    async clearExpiredCache() {
        // Placeholder for future implementation
        // Could check image URLs and clear ones that are no longer accessible
        console.log('ImageService: Cache clearing not yet implemented');
    }
}

module.exports = ImageService;
