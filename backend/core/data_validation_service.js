/**
 * Data Validation Service
 * Ensures data quality and consistency for learning engine
 */

class DataValidationService {
    constructor() {
        this.validationRules = {
            ratings: {
                min: 1,
                max: 5,
                required: ['overall'],
                optional: ['flavor_harmony', 'texture_balance', 'acidity_match', 'tannin_balance', 'body_match', 'regional_tradition']
            },
            context: {
                occasions: ['dinner', 'lunch', 'cocktail', 'celebration', 'casual', 'formal', 'business'],
                times: ['morning', 'afternoon', 'evening', 'night'],
                seasons: ['spring', 'summer', 'autumn', 'winter'],
                weather: ['indoor', 'outdoor', 'hot', 'cold', 'mild', 'rainy', 'sunny']
            },
            behavioral: {
                timeToSelect: { min: 0, max: 3600 }, // 0 to 1 hour in seconds
                viewedDuration: { min: 0, max: 1800 } // 0 to 30 minutes in seconds
            }
        };
    }

    /**
     * Validate enhanced feedback data
     */
    validateEnhancedFeedback(feedbackData) {
        const errors = [];
        const warnings = [];

        // Validate required fields
        if (!feedbackData.recommendation_id) {
            errors.push('recommendation_id is required');
        }

        if (!feedbackData.ratings) {
            errors.push('ratings object is required');
        } else {
            const ratingValidation = this.validateRatings(feedbackData.ratings);
            errors.push(...ratingValidation.errors);
            warnings.push(...ratingValidation.warnings);
        }

        // Validate context if provided
        if (feedbackData.context) {
            const contextValidation = this.validateContext(feedbackData.context);
            errors.push(...contextValidation.errors);
            warnings.push(...contextValidation.warnings);
        }

        // Validate behavioral data if provided
        if (feedbackData.behavioral_data) {
            const behavioralValidation = this.validateBehavioralData(feedbackData.behavioral_data);
            errors.push(...behavioralValidation.errors);
            warnings.push(...behavioralValidation.warnings);
        }

        // Validate additional feedback if provided
        if (feedbackData.additional_feedback) {
            const additionalValidation = this.validateAdditionalFeedback(feedbackData.additional_feedback);
            errors.push(...additionalValidation.errors);
            warnings.push(...additionalValidation.warnings);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            sanitizedData: this.sanitizeFeedbackData(feedbackData)
        };
    }

    /**
     * Validate ratings object
     */
    validateRatings(ratings) {
        const errors = [];
        const warnings = [];

        // Check required ratings
        if (!ratings.overall) {
            errors.push('overall rating is required');
        } else if (!this.isValidRating(ratings.overall)) {
            errors.push('overall rating must be between 1 and 5');
        }

        // Check optional ratings
        const optionalRatings = this.validationRules.ratings.optional;
        for (const rating of optionalRatings) {
            if (ratings[rating] !== undefined) {
                if (!this.isValidRating(ratings[rating])) {
                    errors.push(`${rating} rating must be between 1 and 5`);
                }
            }
        }

        // Check for rating consistency
        if (ratings.overall && this.hasMultipleRatings(ratings)) {
            const consistency = this.checkRatingConsistency(ratings);
            if (consistency < 0.7) {
                warnings.push('Rating consistency is low - some ratings seem inconsistent');
            }
        }

        return { errors, warnings };
    }

    /**
     * Validate context object
     */
    validateContext(context) {
        const errors = [];
        const warnings = [];

        // Validate occasion
        if (context.occasion) {
            if (!this.validationRules.context.occasions.includes(context.occasion)) {
                warnings.push(`Unknown occasion: ${context.occasion}. Valid options: ${this.validationRules.context.occasions.join(', ')}`);
            }
        }

        // Validate time of day
        if (context.time_of_day) {
            if (!this.validationRules.context.times.includes(context.time_of_day)) {
                warnings.push(`Unknown time of day: ${context.time_of_day}. Valid options: ${this.validationRules.context.times.join(', ')}`);
            }
        }

        // Validate season
        if (context.season) {
            if (!this.validationRules.context.seasons.includes(context.season)) {
                warnings.push(`Unknown season: ${context.season}. Valid options: ${this.validationRules.context.seasons.join(', ')}`);
            }
        }

        // Validate guest count
        if (context.guest_count !== undefined) {
            if (!Number.isInteger(context.guest_count) || context.guest_count < 1 || context.guest_count > 50) {
                errors.push('guest_count must be an integer between 1 and 50');
            }
        }

        // Validate weather context
        if (context.weather_context) {
            if (!this.validationRules.context.weather.includes(context.weather_context)) {
                warnings.push(`Unknown weather context: ${context.weather_context}. Valid options: ${this.validationRules.context.weather.join(', ')}`);
            }
        }

        return { errors, warnings };
    }

    /**
     * Validate behavioral data
     */
    validateBehavioralData(behavioral) {
        const errors = [];
        const warnings = [];

        // Validate selected flag
        if (behavioral.selected !== undefined && typeof behavioral.selected !== 'boolean') {
            errors.push('selected must be a boolean value');
        }

        // Validate time to select
        if (behavioral.time_to_select !== undefined) {
            if (!Number.isInteger(behavioral.time_to_select) || 
                behavioral.time_to_select < this.validationRules.behavioral.timeToSelect.min ||
                behavioral.time_to_select > this.validationRules.behavioral.timeToSelect.max) {
                errors.push(`time_to_select must be an integer between ${this.validationRules.behavioral.timeToSelect.min} and ${this.validationRules.behavioral.timeToSelect.max} seconds`);
            }
        }

        // Validate viewed duration
        if (behavioral.viewed_duration !== undefined) {
            if (!Number.isInteger(behavioral.viewed_duration) || 
                behavioral.viewed_duration < this.validationRules.behavioral.viewedDuration.min ||
                behavioral.viewed_duration > this.validationRules.behavioral.viewedDuration.max) {
                errors.push(`viewed_duration must be an integer between ${this.validationRules.behavioral.viewedDuration.min} and ${this.validationRules.behavioral.viewedDuration.max} seconds`);
            }
        }

        return { errors, warnings };
    }

    /**
     * Validate additional feedback
     */
    validateAdditionalFeedback(additional) {
        const errors = [];
        const warnings = [];

        // Validate notes
        if (additional.notes && typeof additional.notes !== 'string') {
            errors.push('notes must be a string');
        } else if (additional.notes && additional.notes.length > 1000) {
            warnings.push('notes is very long (>1000 characters)');
        }

        // Validate would_recommend
        if (additional.would_recommend !== undefined && typeof additional.would_recommend !== 'boolean') {
            errors.push('would_recommend must be a boolean value');
        }

        // Validate price_satisfaction
        if (additional.price_satisfaction !== undefined) {
            if (!this.isValidRating(additional.price_satisfaction)) {
                errors.push('price_satisfaction must be between 1 and 5');
            }
        }

        return { errors, warnings };
    }

    /**
     * Sanitize feedback data
     */
    sanitizeFeedbackData(feedbackData) {
        const sanitized = { ...feedbackData };

        // Sanitize ratings
        if (sanitized.ratings) {
            sanitized.ratings = this.sanitizeRatings(sanitized.ratings);
        }

        // Sanitize context
        if (sanitized.context) {
            sanitized.context = this.sanitizeContext(sanitized.context);
        }

        // Sanitize behavioral data
        if (sanitized.behavioral_data) {
            sanitized.behavioral_data = this.sanitizeBehavioralData(sanitized.behavioral_data);
        }

        // Sanitize additional feedback
        if (sanitized.additional_feedback) {
            sanitized.additional_feedback = this.sanitizeAdditionalFeedback(sanitized.additional_feedback);
        }

        return sanitized;
    }

    /**
     * Sanitize ratings
     */
    sanitizeRatings(ratings) {
        const sanitized = {};

        for (const [key, value] of Object.entries(ratings)) {
            if (this.isValidRating(value)) {
                sanitized[key] = Math.round(value);
            }
        }

        return sanitized;
    }

    /**
     * Sanitize context
     */
    sanitizeContext(context) {
        const sanitized = {};

        if (context.occasion && this.validationRules.context.occasions.includes(context.occasion)) {
            sanitized.occasion = context.occasion;
        }

        if (context.time_of_day && this.validationRules.context.times.includes(context.time_of_day)) {
            sanitized.time_of_day = context.time_of_day;
        }

        if (context.season && this.validationRules.context.seasons.includes(context.season)) {
            sanitized.season = context.season;
        }

        if (context.weather_context && this.validationRules.context.weather.includes(context.weather_context)) {
            sanitized.weather_context = context.weather_context;
        }

        if (Number.isInteger(context.guest_count) && context.guest_count >= 1 && context.guest_count <= 50) {
            sanitized.guest_count = context.guest_count;
        }

        return sanitized;
    }

    /**
     * Sanitize behavioral data
     */
    sanitizeBehavioralData(behavioral) {
        const sanitized = {};

        if (typeof behavioral.selected === 'boolean') {
            sanitized.selected = behavioral.selected;
        }

        if (Number.isInteger(behavioral.time_to_select) && 
            behavioral.time_to_select >= this.validationRules.behavioral.timeToSelect.min &&
            behavioral.time_to_select <= this.validationRules.behavioral.timeToSelect.max) {
            sanitized.time_to_select = behavioral.time_to_select;
        }

        if (Number.isInteger(behavioral.viewed_duration) && 
            behavioral.viewed_duration >= this.validationRules.behavioral.viewedDuration.min &&
            behavioral.viewed_duration <= this.validationRules.behavioral.viewedDuration.max) {
            sanitized.viewed_duration = behavioral.viewed_duration;
        }

        return sanitized;
    }

    /**
     * Sanitize additional feedback
     */
    sanitizeAdditionalFeedback(additional) {
        const sanitized = {};

        if (typeof additional.notes === 'string') {
            sanitized.notes = additional.notes.trim().substring(0, 1000);
        }

        if (typeof additional.would_recommend === 'boolean') {
            sanitized.would_recommend = additional.would_recommend;
        }

        if (this.isValidRating(additional.price_satisfaction)) {
            sanitized.price_satisfaction = Math.round(additional.price_satisfaction);
        }

        return sanitized;
    }

    /**
     * Validate wine data for feature extraction
     */
    validateWineData(wineData) {
        const errors = [];
        const warnings = [];

        // Required fields
        if (!wineData.name) {
            errors.push('Wine name is required');
        }

        if (!wineData.wine_type) {
            errors.push('Wine type is required');
        } else if (!['Red', 'White', 'Rosé', 'Sparkling', 'Dessert', 'Fortified'].includes(wineData.wine_type)) {
            errors.push('Invalid wine type');
        }

        if (!wineData.region) {
            errors.push('Region is required');
        }

        if (!wineData.country) {
            errors.push('Country is required');
        }

        // Optional fields validation
        if (wineData.alcohol_content && (wineData.alcohol_content < 0 || wineData.alcohol_content > 25)) {
            warnings.push('Alcohol content seems unusual');
        }

        if (wineData.grape_varieties) {
            const grapes = this.parseGrapeVarieties(wineData.grape_varieties);
            if (grapes.length === 0) {
                warnings.push('No grape varieties found');
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate dish description for feature extraction
     */
    validateDishDescription(dishDescription) {
        const errors = [];
        const warnings = [];

        if (!dishDescription || typeof dishDescription !== 'string') {
            errors.push('Dish description is required and must be a string');
        } else {
            const trimmed = dishDescription.trim();
            if (trimmed.length < 3) {
                errors.push('Dish description is too short');
            } else if (trimmed.length > 500) {
                warnings.push('Dish description is very long (>500 characters)');
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Check for data quality issues in feedback history
     */
    async analyzeFeedbackQuality(feedbackData) {
        const issues = [];

        // Check for rating distribution
        const ratings = feedbackData.map(f => f.overall_rating);
        const distribution = this.calculateRatingDistribution(ratings);
        
        if (distribution.variance < 0.5) {
            issues.push({
                type: 'low_variance',
                severity: 'warning',
                message: 'Very low variance in ratings - may indicate bias or limited feedback'
            });
        }

        if (distribution.mean > 4.5) {
            issues.push({
                type: 'high_ratings',
                severity: 'warning',
                message: 'Very high average ratings - may indicate selection bias'
            });
        }

        // Check for temporal patterns
        const temporalIssues = this.analyzeTemporalPatterns(feedbackData);
        issues.push(...temporalIssues);

        // Check for user consistency
        const userIssues = this.analyzeUserConsistency(feedbackData);
        issues.push(...userIssues);

        return issues;
    }

    /**
     * Calculate rating distribution statistics
     */
    calculateRatingDistribution(ratings) {
        if (ratings.length === 0) {
            return { mean: 0, variance: 0, distribution: {} };
        }

        const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
        const variance = ratings.reduce((acc, rating) => acc + Math.pow(rating - mean, 2), 0) / ratings.length;
        
        const distribution = {};
        ratings.forEach(rating => {
            distribution[rating] = (distribution[rating] || 0) + 1;
        });

        return { mean, variance, distribution };
    }

    /**
     * Analyze temporal patterns in feedback
     */
    analyzeTemporalPatterns(feedbackData) {
        const issues = [];

        // Check for clustering in time
        const timestamps = feedbackData.map(f => new Date(f.created_at)).sort();
        const timeGaps = [];
        
        for (let i = 1; i < timestamps.length; i++) {
            const gap = timestamps[i] - timestamps[i - 1];
            timeGaps.push(gap);
        }

        const avgGap = timeGaps.reduce((a, b) => a + b, 0) / timeGaps.length;
        const gapVariance = timeGaps.reduce((acc, gap) => acc + Math.pow(gap - avgGap, 2), 0) / timeGaps.length;

        if (gapVariance < avgGap * 0.1) {
            issues.push({
                type: 'temporal_clustering',
                severity: 'warning',
                message: 'Feedback appears to be clustered in time - may indicate batch input'
            });
        }

        return issues;
    }

    /**
     * Analyze user consistency
     */
    analyzeUserConsistency(feedbackData) {
        const issues = [];

        // Group by user
        const userGroups = {};
        feedbackData.forEach(f => {
            if (f.user_id) {
                if (!userGroups[f.user_id]) {
                    userGroups[f.user_id] = [];
                }
                userGroups[f.user_id].push(f);
            }
        });

        // Check each user's consistency
        for (const [userId, userFeedback] of Object.entries(userGroups)) {
            if (userFeedback.length >= 3) {
                const ratings = userFeedback.map(f => f.overall_rating);
                const distribution = this.calculateRatingDistribution(ratings);
                
                if (distribution.variance < 0.3) {
                    issues.push({
                        type: 'user_inconsistency',
                        severity: 'info',
                        message: `User ${userId} shows very consistent ratings - may indicate limited preference range`
                    });
                }
            }
        }

        return issues;
    }

    // Helper methods
    isValidRating(rating) {
        return Number.isInteger(rating) && rating >= 1 && rating <= 5;
    }

    hasMultipleRatings(ratings) {
        return Object.keys(ratings).length > 1;
    }

    checkRatingConsistency(ratings) {
        const values = Object.values(ratings).filter(v => v !== undefined);
        if (values.length < 2) return 1;

        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
        
        // Lower variance = higher consistency
        return Math.max(0, 1 - (variance / 2));
    }

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
}

module.exports = DataValidationService;