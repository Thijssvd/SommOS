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

const { createApi } = require('unsplash-js');
const fetch = require('node-fetch');

class ImageService {
    constructor(db, config = {}) {
        this.db = db;
        this.config = {
            accessKey: process.env.UNSPLASH_ACCESS_KEY || config.accessKey,
            placeholderUrl: '/images/wine-placeholder.svg',
            maxRetries: 3,
            retryDelay: 1000,
            cacheExpiry: 90 * 24 * 60 * 60 * 1000, // 90 days in milliseconds
            ...config
        };

        // Initialize Unsplash API client if access key is available
        if (this.config.accessKey) {
            this.unsplash = createApi({
                accessKey: this.config.accessKey,
                fetch: fetch
            });
            console.log('✓ ImageService initialized with Unsplash API');
        } else {
            console.warn('⚠ ImageService initialized without Unsplash API key - will use placeholders');
            this.unsplash = null;
        }
    }

    /**
     * Search for a wine bottle image
     * @param {Object} wine - Wine details { name, producer, year, varietal }
     * @returns {Promise<string>} Image URL or placeholder
     */
    async searchWineImage(wine) {
        if (!wine || !wine.name || !wine.producer) {
            console.warn('ImageService: Insufficient wine data for image search');
            return this.config.placeholderUrl;
        }

        // Check if Unsplash API is available
        if (!this.unsplash) {
            console.log('ImageService: No Unsplash API key, returning placeholder');
            return this.config.placeholderUrl;
        }

        try {
            // Try primary search query
            let imageUrl = await this.searchWithQuery(
                this.constructPrimaryQuery(wine)
            );

            // If no results, try fallback query
            if (!imageUrl) {
                console.log('ImageService: Primary search failed, trying fallback');
                imageUrl = await this.searchWithQuery(
                    this.constructFallbackQuery(wine)
                );
            }

            // If still no results, try generic wine bottle search
            if (!imageUrl) {
                console.log('ImageService: Fallback failed, trying generic search');
                imageUrl = await this.searchWithQuery('wine bottle');
            }

            return imageUrl || this.config.placeholderUrl;

        } catch (error) {
            console.error('ImageService: Search failed:', error.message);
            return this.config.placeholderUrl;
        }
    }

    /**
     * Construct primary search query
     * @private
     */
    constructPrimaryQuery(wine) {
        const parts = [];
        
        if (wine.producer) parts.push(wine.producer);
        if (wine.name) parts.push(wine.name);
        if (wine.year) parts.push(wine.year.toString());
        
        parts.push('wine bottle');
        
        return parts.join(' ');
    }

    /**
     * Construct fallback search query
     * @private
     */
    constructFallbackQuery(wine) {
        const parts = ['wine bottle'];
        
        // Try with varietal if available
        if (wine.varietal) {
            parts.push(wine.varietal);
        } else if (wine.grape_varieties) {
            // If grape_varieties is a JSON array string, parse it
            try {
                const varieties = typeof wine.grape_varieties === 'string' 
                    ? JSON.parse(wine.grape_varieties) 
                    : wine.grape_varieties;
                    
                if (Array.isArray(varieties) && varieties.length > 0) {
                    parts.push(varieties[0]);
                }
            } catch (e) {
                // If parsing fails, try using it directly
                if (wine.grape_varieties) {
                    parts.push(wine.grape_varieties.toString().split(',')[0].trim());
                }
            }
        }
        
        // Add wine type if available
        if (wine.wine_type) {
            parts.push(wine.wine_type.toLowerCase());
        }
        
        return parts.join(' ');
    }

    /**
     * Search Unsplash with a specific query
     * @private
     */
    async searchWithQuery(query, retries = 0) {
        try {
            console.log(`ImageService: Searching Unsplash for "${query}"`);
            
            const result = await this.unsplash.search.getPhotos({
                query: query,
                page: 1,
                perPage: 5,
                orientation: 'portrait'
            });

            if (result.errors) {
                console.error('ImageService: Unsplash API errors:', result.errors);
                
                // Check for rate limiting
                if (result.errors.includes('Rate Limit Exceeded')) {
                    console.warn('ImageService: Rate limit exceeded - using placeholder');
                    return null;
                }
                
                throw new Error(result.errors.join(', '));
            }

            if (result.response && result.response.results && result.response.results.length > 0) {
                // Get the first result's regular sized URL
                const imageUrl = result.response.results[0].urls.regular;
                console.log(`ImageService: Found image: ${imageUrl.substring(0, 80)}...`);
                return imageUrl;
            }

            console.log(`ImageService: No results found for "${query}"`);
            return null;

        } catch (error) {
            // Handle rate limiting and network errors with retry
            if (retries < this.config.maxRetries && this.shouldRetry(error)) {
                const delay = this.config.retryDelay * Math.pow(2, retries);
                console.log(`ImageService: Retrying in ${delay}ms (attempt ${retries + 1}/${this.config.maxRetries})`);
                
                await this.sleep(delay);
                return this.searchWithQuery(query, retries + 1);
            }

            console.error(`ImageService: Search failed after ${retries} retries:`, error.message);
            return null;
        }
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
