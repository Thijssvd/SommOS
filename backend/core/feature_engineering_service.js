/**
 * Enhanced Feature Engineering Service
 * Extracts and processes features from wines and dishes for machine learning
 */

const Database = require('../database/connection');
const crypto = require('crypto');

class FeatureEngineeringService {
    constructor(database) {
        this.db = database || Database.getInstance();
        
        // Wine feature mappings
        this.wineTypeMapping = {
            'Red': 1, 'White': 2, 'Rosé': 3, 'Sparkling': 4, 'Dessert': 5, 'Fortified': 6
        };
        
        this.styleMapping = {
            'Light': 1, 'Medium': 2, 'Full-bodied': 3, 'Crisp': 1, 'Smooth': 2, 'Tannic': 3
        };
        
        this.priceTierMapping = {
            'budget': 1, 'mid': 2, 'premium': 3, 'luxury': 4
        };
        
        // Dish feature mappings
        this.cuisineMapping = {
            'french': 1, 'italian': 2, 'spanish': 3, 'german': 4, 'american': 5,
            'asian': 6, 'mediterranean': 7, 'international': 8
        };
        
        this.preparationMapping = {
            'raw': 1, 'steamed': 2, 'poached': 3, 'grilled': 4, 'roasted': 5,
            'braised': 6, 'fried': 7, 'stewed': 8, 'baked': 9
        };
        
        this.proteinMapping = {
            'beef': 1, 'lamb': 2, 'pork': 3, 'chicken': 4, 'duck': 5,
            'fish': 6, 'seafood': 7, 'vegetarian': 8, 'vegan': 9
        };
    }

    /**
     * Extract and store wine features
     */
    async extractWineFeatures(wineId) {
        try {
            const wine = await this.db.get(`
                SELECT w.*, v.year, v.quality_score, v.critic_score, v.weather_score,
                       AVG(pb.price_per_bottle) as avg_price
                FROM Wines w
                LEFT JOIN Vintages v ON w.id = v.wine_id
                LEFT JOIN PriceBook pb ON v.id = pb.vintage_id
                WHERE w.id = ?
                GROUP BY w.id
            `, [wineId]);

            if (!wine) {
                throw new Error(`Wine with ID ${wineId} not found`);
            }

            const features = this.calculateWineFeatures(wine);
            const featureVector = this.createWineFeatureVector(features);

            // Store or update wine features
            await this.db.run(`
                INSERT INTO WineFeatures (
                    wine_id, grape_varieties, region_encoded, country_encoded,
                    vintage_year, alcohol_content, price_tier, style_encoded,
                    body_score, acidity_score, tannin_score, sweetness_score,
                    complexity_score, critic_score, quality_score, weather_score,
                    feature_vector
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(wine_id) DO UPDATE SET
                    grape_varieties = excluded.grape_varieties,
                    region_encoded = excluded.region_encoded,
                    country_encoded = excluded.country_encoded,
                    vintage_year = excluded.vintage_year,
                    alcohol_content = excluded.alcohol_content,
                    price_tier = excluded.price_tier,
                    style_encoded = excluded.style_encoded,
                    body_score = excluded.body_score,
                    acidity_score = excluded.acidity_score,
                    tannin_score = excluded.tannin_score,
                    sweetness_score = excluded.sweetness_score,
                    complexity_score = excluded.complexity_score,
                    critic_score = excluded.critic_score,
                    quality_score = excluded.quality_score,
                    weather_score = excluded.weather_score,
                    feature_vector = excluded.feature_vector,
                    updated_at = CURRENT_TIMESTAMP
            `, [
                wineId,
                JSON.stringify(this.parseGrapeVarieties(wine.grape_varieties)),
                this.encodeRegion(wine.region),
                this.encodeCountry(wine.country),
                wine.year,
                wine.alcohol_content,
                this.determinePriceTier(wine.avg_price),
                this.encodeStyle(wine.style),
                features.bodyScore,
                features.acidityScore,
                features.tanninScore,
                features.sweetnessScore,
                features.complexityScore,
                wine.critic_score,
                wine.quality_score,
                wine.weather_score,
                JSON.stringify(featureVector)
            ]);

            return features;
        } catch (error) {
            console.error('Error extracting wine features:', error.message);
            throw error;
        }
    }

    /**
     * Extract and store dish features
     */
    async extractDishFeatures(dishDescription) {
        try {
            const dishHash = this.createDishHash(dishDescription);
            
            // Check if features already exist
            const existing = await this.db.get(`
                SELECT * FROM DishFeatures WHERE dish_hash = ?
            `, [dishHash]);

            if (existing) {
                return JSON.parse(existing.feature_vector);
            }

            const features = this.calculateDishFeatures(dishDescription);
            const featureVector = this.createDishFeatureVector(features);

            // Store dish features
            await this.db.run(`
                INSERT INTO DishFeatures (
                    dish_description, dish_hash, cuisine_type, preparation_method,
                    protein_type, cooking_style, flavor_intensity, texture_profile,
                    spice_level, dominant_ingredients, flavor_notes, cooking_techniques,
                    richness_score, complexity_score, acidity_level, fat_content,
                    feature_vector
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                dishDescription,
                dishHash,
                features.cuisineType,
                features.preparationMethod,
                features.proteinType,
                features.cookingStyle,
                features.flavorIntensity,
                features.textureProfile,
                features.spiceLevel,
                JSON.stringify(features.dominantIngredients),
                JSON.stringify(features.flavorNotes),
                JSON.stringify(features.cookingTechniques),
                features.richnessScore,
                features.complexityScore,
                features.acidityLevel,
                features.fatContent,
                JSON.stringify(featureVector)
            ]);

            return featureVector;
        } catch (error) {
            console.error('Error extracting dish features:', error.message);
            throw error;
        }
    }

    /**
     * Calculate wine features from wine data
     */
    calculateWineFeatures(wine) {
        const grapeVarieties = this.parseGrapeVarieties(wine.grape_varieties);
        const tastingNotes = wine.tasting_notes?.toLowerCase() || '';
        const style = wine.style?.toLowerCase() || '';

        return {
            // Basic features
            wineType: this.wineTypeMapping[wine.wine_type] || 0,
            region: this.encodeRegion(wine.region),
            country: this.encodeCountry(wine.country),
            vintageYear: wine.year || new Date().getFullYear(),
            alcoholContent: wine.alcohol_content || 0,
            priceTier: this.determinePriceTier(wine.avg_price),
            style: this.encodeStyle(wine.style),

            // Derived scores (1-5 scale)
            bodyScore: this.calculateBodyScore(style, grapeVarieties, wine.wine_type),
            acidityScore: this.calculateAcidityScore(tastingNotes, grapeVarieties, wine.wine_type),
            tanninScore: this.calculateTanninScore(tastingNotes, grapeVarieties, wine.wine_type),
            sweetnessScore: this.calculateSweetnessScore(tastingNotes, wine.wine_type),
            complexityScore: this.calculateComplexityScore(tastingNotes, wine.critic_score, wine.quality_score),

            // Quality indicators
            criticScore: wine.critic_score || 0,
            qualityScore: wine.quality_score || 0,
            weatherScore: wine.weather_score || 0
        };
    }

    /**
     * Calculate dish features from dish description
     */
    calculateDishFeatures(dishDescription) {
        const description = dishDescription.toLowerCase();
        
        return {
            // Parsed features
            cuisineType: this.detectCuisineType(description),
            preparationMethod: this.detectPreparationMethod(description),
            proteinType: this.detectProteinType(description),
            cookingStyle: this.detectCookingStyle(description),
            flavorIntensity: this.detectFlavorIntensity(description),
            textureProfile: this.detectTextureProfile(description),
            spiceLevel: this.detectSpiceLevel(description),

            // Ingredient analysis
            dominantIngredients: this.extractDominantIngredients(description),
            flavorNotes: this.extractFlavorNotes(description),
            cookingTechniques: this.extractCookingTechniques(description),

            // Derived scores (1-5 scale)
            richnessScore: this.calculateRichnessScore(description),
            complexityScore: this.calculateDishComplexityScore(description),
            acidityLevel: this.calculateDishAcidityLevel(description),
            fatContent: this.calculateFatContent(description)
        };
    }

    /**
     * Create normalized feature vector for wine
     */
    createWineFeatureVector(features) {
        return [
            features.wineType / 6, // Normalize to 0-1
            features.region / 100, // Normalize region encoding
            features.country / 50, // Normalize country encoding
            (features.vintageYear - 1900) / 100, // Normalize vintage year
            features.alcoholContent / 20, // Normalize alcohol content
            features.priceTier / 4, // Normalize price tier
            features.style / 10, // Normalize style encoding
            features.bodyScore / 5, // Normalize body score
            features.acidityScore / 5, // Normalize acidity score
            features.tanninScore / 5, // Normalize tannin score
            features.sweetnessScore / 5, // Normalize sweetness score
            features.complexityScore / 5, // Normalize complexity score
            features.criticScore / 100, // Normalize critic score
            features.qualityScore / 100, // Normalize quality score
            features.weatherScore / 100 // Normalize weather score
        ];
    }

    /**
     * Create normalized feature vector for dish
     */
    createDishFeatureVector(features) {
        return [
            this.cuisineMapping[features.cuisineType] / 8, // Normalize cuisine
            this.preparationMapping[features.preparationMethod] / 9, // Normalize preparation
            this.proteinMapping[features.proteinType] / 9, // Normalize protein
            this.encodeCookingStyle(features.cookingStyle) / 10, // Normalize cooking style
            this.encodeFlavorIntensity(features.flavorIntensity) / 4, // Normalize flavor intensity
            this.encodeTextureProfile(features.textureProfile) / 10, // Normalize texture
            this.encodeSpiceLevel(features.spiceLevel) / 4, // Normalize spice level
            features.richnessScore / 5, // Normalize richness
            features.complexityScore / 5, // Normalize complexity
            features.acidityLevel / 5, // Normalize acidity
            features.fatContent / 5 // Normalize fat content
        ];
    }

    // Helper methods for wine feature calculation
    calculateBodyScore(style, grapeVarieties, wineType) {
        let score = 2.5; // Default medium body

        if (style.includes('full') || style.includes('bold')) score = 4.5;
        else if (style.includes('light') || style.includes('crisp')) score = 1.5;

        // Adjust based on grape varieties
        const fullBodiedGrapes = ['cabernet sauvignon', 'syrah', 'malbec', 'nebbiolo'];
        const lightBodiedGrapes = ['pinot noir', 'gamay', 'barbera'];
        
        if (grapeVarieties.some(g => fullBodiedGrapes.includes(g.toLowerCase()))) {
            score = Math.min(5, score + 1);
        } else if (grapeVarieties.some(g => lightBodiedGrapes.includes(g.toLowerCase()))) {
            score = Math.max(1, score - 1);
        }

        return Math.round(score * 10) / 10; // Round to 1 decimal
    }

    calculateAcidityScore(tastingNotes, grapeVarieties, wineType) {
        let score = 3; // Default medium acidity

        if (tastingNotes.includes('bright') || tastingNotes.includes('crisp') || tastingNotes.includes('fresh')) {
            score = 4.5;
        } else if (tastingNotes.includes('soft') || tastingNotes.includes('round') || tastingNotes.includes('smooth')) {
            score = 2;
        }

        // Adjust based on grape varieties
        const highAcidGrapes = ['riesling', 'sauvignon blanc', 'pinot noir', 'sangiovese'];
        const lowAcidGrapes = ['merlot', 'grenache', 'viognier'];
        
        if (grapeVarieties.some(g => highAcidGrapes.includes(g.toLowerCase()))) {
            score = Math.min(5, score + 1);
        } else if (grapeVarieties.some(g => lowAcidGrapes.includes(g.toLowerCase()))) {
            score = Math.max(1, score - 1);
        }

        return Math.round(score * 10) / 10;
    }

    calculateTanninScore(tastingNotes, grapeVarieties, wineType) {
        if (wineType.toLowerCase() !== 'red') return 1; // Whites have minimal tannins

        let score = 3; // Default medium tannins

        if (tastingNotes.includes('firm') || tastingNotes.includes('grippy') || tastingNotes.includes('structured')) {
            score = 4.5;
        } else if (tastingNotes.includes('soft') || tastingNotes.includes('silky') || tastingNotes.includes('smooth')) {
            score = 2;
        }

        // Adjust based on grape varieties
        const highTanninGrapes = ['cabernet sauvignon', 'nebbiolo', 'tannat', 'sangiovese'];
        const lowTanninGrapes = ['pinot noir', 'gamay', 'grenache'];
        
        if (grapeVarieties.some(g => highTanninGrapes.includes(g.toLowerCase()))) {
            score = Math.min(5, score + 1);
        } else if (grapeVarieties.some(g => lowTanninGrapes.includes(g.toLowerCase()))) {
            score = Math.max(1, score - 1);
        }

        return Math.round(score * 10) / 10;
    }

    calculateSweetnessScore(tastingNotes, wineType) {
        let score = 1; // Default dry

        if (tastingNotes.includes('sweet') || tastingNotes.includes('honey') || tastingNotes.includes('sugar')) {
            score = 4;
        } else if (tastingNotes.includes('off-dry') || tastingNotes.includes('semi-sweet')) {
            score = 2.5;
        }

        // Dessert wines are typically sweet
        if (wineType.toLowerCase() === 'dessert') {
            score = 5;
        }

        return Math.round(score * 10) / 10;
    }

    calculateComplexityScore(tastingNotes, criticScore, qualityScore) {
        let score = 3; // Default medium complexity

        if (tastingNotes.includes('complex') || tastingNotes.includes('layered') || tastingNotes.includes('nuanced')) {
            score = 4.5;
        } else if (tastingNotes.includes('simple') || tastingNotes.includes('straightforward')) {
            score = 2;
        }

        // Adjust based on quality scores
        const avgQuality = ((criticScore || 0) + (qualityScore || 0)) / 2;
        if (avgQuality > 90) {
            score = Math.min(5, score + 1);
        } else if (avgQuality < 80) {
            score = Math.max(1, score - 0.5);
        }

        return Math.round(score * 10) / 10;
    }

    // Helper methods for dish feature calculation
    detectCuisineType(description) {
        const cuisineKeywords = {
            'french': ['french', 'bourguignon', 'coq au vin', 'ratatouille'],
            'italian': ['italian', 'pasta', 'risotto', 'osso buco', 'carbonara'],
            'spanish': ['spanish', 'paella', 'tapas', 'gazpacho', 'chorizo'],
            'german': ['german', 'sauerkraut', 'bratwurst', 'schnitzel'],
            'american': ['american', 'bbq', 'burger', 'steak', 'mac and cheese'],
            'asian': ['asian', 'stir-fry', 'curry', 'sushi', 'ramen', 'thai', 'chinese', 'japanese'],
            'mediterranean': ['mediterranean', 'olive', 'feta', 'hummus', 'tzatziki']
        };

        for (const [cuisine, keywords] of Object.entries(cuisineKeywords)) {
            if (keywords.some(keyword => description.includes(keyword))) {
                return cuisine;
            }
        }

        return 'international';
    }

    detectPreparationMethod(description) {
        const preparationKeywords = {
            'raw': ['raw', 'tartare', 'carpaccio', 'ceviche'],
            'steamed': ['steamed', 'steam'],
            'poached': ['poached', 'poach'],
            'grilled': ['grilled', 'grill', 'charred'],
            'roasted': ['roasted', 'roast', 'baked'],
            'braised': ['braised', 'braise', 'stewed'],
            'fried': ['fried', 'fry', 'crispy', 'deep-fried'],
            'stewed': ['stewed', 'stew', 'braised'],
            'baked': ['baked', 'bake', 'casserole']
        };

        for (const [method, keywords] of Object.entries(preparationKeywords)) {
            if (keywords.some(keyword => description.includes(keyword))) {
                return method;
            }
        }

        return 'unknown';
    }

    detectProteinType(description) {
        const proteinKeywords = {
            'beef': ['beef', 'steak', 'burger', 'brisket', 'ribeye'],
            'lamb': ['lamb', 'mutton'],
            'pork': ['pork', 'bacon', 'ham', 'sausage'],
            'chicken': ['chicken', 'poultry'],
            'duck': ['duck', 'duckling'],
            'fish': ['fish', 'salmon', 'tuna', 'cod', 'halibut'],
            'seafood': ['seafood', 'shrimp', 'lobster', 'crab', 'scallops'],
            'vegetarian': ['vegetarian', 'veggie', 'tofu', 'tempeh'],
            'vegan': ['vegan', 'plant-based']
        };

        for (const [protein, keywords] of Object.entries(proteinKeywords)) {
            if (keywords.some(keyword => description.includes(keyword))) {
                return protein;
            }
        }

        return 'unknown';
    }

    detectCookingStyle(description) {
        if (description.includes('spicy') || description.includes('hot')) return 'spicy';
        if (description.includes('creamy') || description.includes('rich')) return 'creamy';
        if (description.includes('light') || description.includes('fresh')) return 'light';
        if (description.includes('smoky') || description.includes('barbecue')) return 'smoky';
        return 'classic';
    }

    detectFlavorIntensity(description) {
        if (description.includes('bold') || description.includes('intense') || description.includes('rich')) return 'bold';
        if (description.includes('light') || description.includes('delicate') || description.includes('subtle')) return 'light';
        if (description.includes('medium') || description.includes('balanced')) return 'medium';
        return 'medium';
    }

    detectTextureProfile(description) {
        if (description.includes('tender') || description.includes('soft')) return 'tender';
        if (description.includes('crispy') || description.includes('crunchy')) return 'crispy';
        if (description.includes('creamy') || description.includes('smooth')) return 'creamy';
        if (description.includes('firm') || description.includes('chewy')) return 'firm';
        return 'medium';
    }

    detectSpiceLevel(description) {
        if (description.includes('very spicy') || description.includes('hot')) return 'very_spicy';
        if (description.includes('spicy') || description.includes('chili')) return 'spicy';
        if (description.includes('mild spice') || description.includes('lightly spiced')) return 'mild';
        return 'medium';
    }

    extractDominantIngredients(description) {
        const commonIngredients = [
            'garlic', 'onion', 'tomato', 'herbs', 'spices', 'cream', 'butter',
            'olive oil', 'lemon', 'wine', 'cheese', 'mushroom', 'pepper'
        ];

        return commonIngredients.filter(ingredient => description.includes(ingredient));
    }

    extractFlavorNotes(description) {
        const flavorKeywords = [
            'sweet', 'sour', 'bitter', 'salty', 'umami', 'smoky', 'earthy',
            'fruity', 'herbaceous', 'nutty', 'spicy', 'rich', 'light'
        ];

        return flavorKeywords.filter(flavor => description.includes(flavor));
    }

    extractCookingTechniques(description) {
        const techniques = [
            'searing', 'braising', 'roasting', 'grilling', 'steaming',
            'poaching', 'frying', 'sautéing', 'marinating', 'brining'
        ];

        return techniques.filter(technique => description.includes(technique));
    }

    calculateRichnessScore(description) {
        let score = 3; // Default medium richness

        if (description.includes('rich') || description.includes('creamy') || description.includes('buttery')) {
            score = 4.5;
        } else if (description.includes('light') || description.includes('lean') || description.includes('healthy')) {
            score = 1.5;
        }

        return Math.round(score * 10) / 10;
    }

    calculateDishComplexityScore(description) {
        let score = 3; // Default medium complexity

        if (description.includes('complex') || description.includes('layered') || description.includes('sophisticated')) {
            score = 4.5;
        } else if (description.includes('simple') || description.includes('basic') || description.includes('straightforward')) {
            score = 2;
        }

        return Math.round(score * 10) / 10;
    }

    calculateDishAcidityLevel(description) {
        let score = 3; // Default medium acidity

        if (description.includes('citrus') || description.includes('lemon') || description.includes('vinegar')) {
            score = 4.5;
        } else if (description.includes('sweet') || description.includes('mild')) {
            score = 2;
        }

        return Math.round(score * 10) / 10;
    }

    calculateFatContent(description) {
        let score = 3; // Default medium fat

        if (description.includes('fatty') || description.includes('rich') || description.includes('buttery')) {
            score = 4.5;
        } else if (description.includes('lean') || description.includes('light') || description.includes('healthy')) {
            score = 1.5;
        }

        return Math.round(score * 10) / 10;
    }

    // Utility methods
    parseGrapeVarieties(grapeVarieties) {
        if (!grapeVarieties) return [];
        
        if (Array.isArray(grapeVarieties)) return grapeVarieties;
        
        if (typeof grapeVarieties === 'string') {
            try {
                return JSON.parse(grapeVarieties);
            } catch {
                return grapeVarieties.split(',').map(g => g.trim());
            }
        }
        
        return [];
    }

    encodeRegion(region) {
        // Simple hash-based encoding for regions
        if (!region) return 0;
        return Math.abs(this.simpleHash(region.toLowerCase())) % 100;
    }

    encodeCountry(country) {
        // Simple hash-based encoding for countries
        if (!country) return 0;
        return Math.abs(this.simpleHash(country.toLowerCase())) % 50;
    }

    encodeStyle(style) {
        if (!style) return 0;
        return this.styleMapping[style] || Math.abs(this.simpleHash(style.toLowerCase())) % 10;
    }

    encodeCookingStyle(style) {
        const styleMap = { 'spicy': 1, 'creamy': 2, 'light': 3, 'smoky': 4, 'classic': 5 };
        return styleMap[style] || 5;
    }

    encodeFlavorIntensity(intensity) {
        const intensityMap = { 'light': 1, 'medium': 2, 'rich': 3, 'bold': 4 };
        return intensityMap[intensity] || 2;
    }

    encodeTextureProfile(texture) {
        const textureMap = { 'tender': 1, 'crispy': 2, 'creamy': 3, 'firm': 4, 'medium': 5 };
        return textureMap[texture] || 5;
    }

    encodeSpiceLevel(level) {
        const spiceMap = { 'mild': 1, 'medium': 2, 'spicy': 3, 'very_spicy': 4 };
        return spiceMap[level] || 2;
    }

    determinePriceTier(avgPrice) {
        if (!avgPrice) return 'mid';
        if (avgPrice < 25) return 'budget';
        if (avgPrice < 75) return 'mid';
        if (avgPrice < 200) return 'premium';
        return 'luxury';
    }

    createDishHash(dishDescription) {
        const normalized = dishDescription.toLowerCase().trim();
        return crypto.createHash('md5').update(normalized).digest('hex');
    }

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash;
    }

    /**
     * Batch process multiple wines for feature extraction
     */
    async batchExtractWineFeatures(wineIds) {
        const results = [];
        const batchSize = 10;

        for (let i = 0; i < wineIds.length; i += batchSize) {
            const batch = wineIds.slice(i, i + batchSize);
            const batchPromises = batch.map(wineId => 
                this.extractWineFeatures(wineId).catch(error => {
                    console.error(`Failed to extract features for wine ${wineId}:`, error.message);
                    return null;
                })
            );

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults.filter(result => result !== null));
        }

        return results;
    }

    /**
     * Get wine features by wine ID
     */
    async getWineFeatures(wineId) {
        const features = await this.db.get(`
            SELECT * FROM WineFeatures WHERE wine_id = ?
        `, [wineId]);

        if (!features) {
            // Extract features if they don't exist
            await this.extractWineFeatures(wineId);
            return await this.db.get(`
                SELECT * FROM WineFeatures WHERE wine_id = ?
            `, [wineId]);
        }

        return features;
    }

    /**
     * Get dish features by description
     */
    async getDishFeatures(dishDescription) {
        const dishHash = this.createDishHash(dishDescription);
        
        const features = await this.db.get(`
            SELECT * FROM DishFeatures WHERE dish_hash = ?
        `, [dishHash]);

        if (!features) {
            // Extract features if they don't exist
            await this.extractDishFeatures(dishDescription);
            return await this.db.get(`
                SELECT * FROM DishFeatures WHERE dish_hash = ?
            `, [dishHash]);
        }

        return features;
    }
}

module.exports = FeatureEngineeringService;