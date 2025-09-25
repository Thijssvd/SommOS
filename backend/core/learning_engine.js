/**
 * SommOS Learning Engine
 * Continuously captures operational signals to adapt pairing and procurement intelligence.
 */

const Database = require('../database/connection');

class LearningEngine {
    constructor(database) {
        this.db = database || Database.getInstance();
        this.parameterCache = {};
        this.defaultPairingWeights = {
            style_match: 0.25,
            flavor_harmony: 0.30,
            texture_balance: 0.20,
            regional_tradition: 0.15,
            seasonal_appropriateness: 0.10
        };

        this.defaultProcurementWeights = {
            stock_urgency: 0.28,
            value_proposition: 0.23,
            quality_score: 0.18,
            supplier_reliability: 0.12,
            seasonal_relevance: 0.09,
            budget_alignment: 0.10
        };

        this.parametersLoaded = false;
    }

    async initialize() {
        await this.loadParameters();
    }

    async loadParameters() {
        try {
            const rows = await this.db.all(`
                SELECT parameter_name, parameter_value
                FROM LearningParameters
            `);

            this.parameterCache = rows.reduce((cache, row) => {
                try {
                    cache[row.parameter_name] = JSON.parse(row.parameter_value);
                } catch (error) {
                    console.warn(`Failed to parse learning parameter ${row.parameter_name}:`, error.message);
                }
                return cache;
            }, {});

            this.parametersLoaded = true;
        } catch (error) {
            console.warn('Unable to load learning parameters:', error.message);
            this.parameterCache = {};
        }
    }

    async ensureParametersLoaded() {
        if (!this.parametersLoaded) {
            await this.loadParameters();
        }
    }

    async getParameter(name, defaultValue) {
        await this.ensureParametersLoaded();
        if (this.parameterCache[name]) {
            return this.parameterCache[name];
        }
        return defaultValue;
    }

    async setParameter(name, value) {
        try {
            await this.db.run(`
                INSERT INTO LearningParameters (parameter_name, parameter_value, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(parameter_name) DO UPDATE SET
                    parameter_value = excluded.parameter_value,
                    updated_at = CURRENT_TIMESTAMP
            `, [name, JSON.stringify(value)]);

            this.parameterCache[name] = value;
        } catch (error) {
            console.error(`Failed to persist learning parameter ${name}:`, error.message);
        }
    }

    async getPairingWeights() {
        const stored = await this.getParameter('pairing_weights', null);
        if (!stored) {
            return { ...this.defaultPairingWeights };
        }

        return this.normalizeWeights(stored, this.defaultPairingWeights);
    }

    async getProcurementWeights() {
        const stored = await this.getParameter('procurement_weights', null);
        if (!stored) {
            return { ...this.defaultProcurementWeights };
        }

        return this.normalizeWeights(stored, this.defaultProcurementWeights);
    }

    async getDemandMultipliers() {
        const stored = await this.getParameter('demand_factors', {});
        return stored || {};
    }

    getDemandMultiplier(wineType) {
        const factors = this.parameterCache.demand_factors || {};
        return factors?.[wineType] || 1;
    }

    normalizeWeights(weights, defaults) {
        const normalized = { ...defaults, ...weights };
        let total = 0;

        for (const value of Object.values(normalized)) {
            total += Number.isFinite(value) ? value : 0;
        }

        if (total <= 0) {
            return { ...defaults };
        }

        for (const key of Object.keys(normalized)) {
            normalized[key] = Math.max(0.01, normalized[key] / total);
        }

        return normalized;
    }

    async recordPairingSession({
        dishDescription,
        dishContext,
        preferences,
        recommendations,
        generatedByAI = false
    }) {
        if (!recommendations || recommendations.length === 0) {
            return null;
        }

        try {
            const sessionResult = await this.db.run(`
                INSERT INTO LearningPairingSessions (
                    dish_description,
                    dish_context,
                    preferences,
                    generated_by_ai
                ) VALUES (?, ?, ?, ?)
            `, [
                dishDescription || null,
                JSON.stringify(dishContext || {}),
                JSON.stringify(preferences || {}),
                generatedByAI ? 1 : 0
            ]);

            const sessionId = sessionResult.lastID;
            const recommendationIds = [];

            for (let index = 0; index < recommendations.length; index += 1) {
                const recommendation = recommendations[index];
                const wine = recommendation.wine || {};

                const result = await this.db.run(`
                    INSERT INTO LearningPairingRecommendations (
                        session_id,
                        wine_id,
                        wine_name,
                        producer,
                        wine_type,
                        region,
                        score_breakdown,
                        ai_enhanced,
                        ranking
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    sessionId,
                    wine.id || null,
                    wine.name || recommendation.wine_name || 'Unknown Wine',
                    wine.producer || null,
                    wine.wine_type || null,
                    wine.region || null,
                    JSON.stringify(recommendation.score || {}),
                    recommendation.ai_enhanced ? 1 : 0,
                    index + 1
                ]);

                recommendationIds.push(result.lastID);
            }

            return { sessionId, recommendationIds };
        } catch (error) {
            console.warn('Failed to capture pairing session for learning:', error.message);
            return null;
        }
    }

    async recordPairingFeedback(recommendationId, rating, notes = '', selected = true) {
        if (!recommendationId || !rating) {
            throw new Error('recommendationId and rating are required');
        }

        try {
            await this.db.run(`
                INSERT INTO LearningPairingFeedback (
                    recommendation_id,
                    rating,
                    notes,
                    selected
                ) VALUES (?, ?, ?, ?)
            `, [
                recommendationId,
                rating,
                notes || null,
                selected ? 1 : 0
            ]);

            await this.updatePairingWeights();
            return true;
        } catch (error) {
            console.error('Failed to record pairing feedback:', error.message);
            throw error;
        }
    }

    async updatePairingWeights() {
        try {
            const rows = await this.db.all(`
                SELECT
                    json_extract(r.score_breakdown, '$.style_match') as style_match,
                    json_extract(r.score_breakdown, '$.flavor_harmony') as flavor_harmony,
                    json_extract(r.score_breakdown, '$.texture_balance') as texture_balance,
                    json_extract(r.score_breakdown, '$.regional_tradition') as regional_tradition,
                    json_extract(r.score_breakdown, '$.seasonal_appropriateness') as seasonal_appropriateness,
                    f.rating
                FROM LearningPairingRecommendations r
                JOIN LearningPairingFeedback f ON f.recommendation_id = r.id
                WHERE f.rating IS NOT NULL
            `);

            if (!rows.length) {
                return;
            }

            const accumulator = {
                style_match: { score: 0, weight: 0 },
                flavor_harmony: { score: 0, weight: 0 },
                texture_balance: { score: 0, weight: 0 },
                regional_tradition: { score: 0, weight: 0 },
                seasonal_appropriateness: { score: 0, weight: 0 }
            };

            for (const row of rows) {
                const rating = Number(row.rating) / 5; // Normalize to 0-1
                if (!Number.isFinite(rating)) {
                    continue;
                }

                for (const key of Object.keys(accumulator)) {
                    const contribution = Number(row[key]);
                    if (Number.isFinite(contribution) && contribution > 0) {
                        accumulator[key].score += rating * contribution;
                        accumulator[key].weight += contribution;
                    }
                }
            }

            const blended = {};
            for (const [key, values] of Object.entries(accumulator)) {
                const defaultWeight = this.defaultPairingWeights[key];
                if (values.weight === 0) {
                    blended[key] = defaultWeight;
                    continue;
                }

                const normalizedFeedback = values.score / values.weight;
                blended[key] = 0.55 * defaultWeight + 0.45 * normalizedFeedback;
            }

            const weights = this.normalizeWeights(blended, this.defaultPairingWeights);
            await this.setParameter('pairing_weights', weights);
        } catch (error) {
            console.error('Failed to update pairing weights:', error.message);
        }
    }

    async recordConsumptionEvent({
        vintage_id,
        quantity,
        location,
        event_type = 'consume',
        metadata = {}
    }) {
        if (!vintage_id || !quantity) {
            return;
        }

        try {
            const wine = await this.db.get(`
                SELECT w.id as wine_id, w.wine_type
                FROM Vintages v
                JOIN Wines w ON w.id = v.wine_id
                WHERE v.id = ?
            `, [vintage_id]);

            await this.db.run(`
                INSERT INTO LearningConsumptionEvents (
                    vintage_id,
                    wine_id,
                    wine_type,
                    quantity,
                    location,
                    event_type,
                    metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                vintage_id,
                wine?.wine_id || null,
                wine?.wine_type || null,
                quantity,
                location || null,
                event_type,
                JSON.stringify(metadata || {})
            ]);

            await this.updateDemandModels();
        } catch (error) {
            console.warn('Failed to capture consumption signal:', error.message);
        }
    }

    async updateDemandModels() {
        try {
            const typeTotals = await this.db.all(`
                SELECT
                    wine_type,
                    SUM(CASE WHEN event_type = 'consume' THEN ABS(quantity) ELSE 0 END) as consumed,
                    SUM(CASE WHEN event_type = 'receive' THEN ABS(quantity) ELSE 0 END) as received
                FROM LearningConsumptionEvents
                WHERE created_at >= DATE('now', '-365 days')
                GROUP BY wine_type
            `);

            const monthlyConsumption = await this.db.all(`
                SELECT
                    strftime('%Y-%m', created_at) as month,
                    SUM(CASE WHEN event_type = 'consume' THEN ABS(quantity) ELSE 0 END) as consumed
                FROM LearningConsumptionEvents
                WHERE created_at >= DATE('now', '-365 days')
                GROUP BY strftime('%Y-%m', created_at)
            `);

            const demandFactors = {};
            let totalConsumed = 0;

            for (const row of typeTotals) {
                if (!row.wine_type) {
                    continue;
                }

                const consumed = Number(row.consumed) || 0;
                totalConsumed += consumed;
                demandFactors[row.wine_type] = consumed;
            }

            const typeKeys = Object.keys(demandFactors);
            if (typeKeys.length > 0 && totalConsumed > 0) {
                const average = totalConsumed / typeKeys.length;
                for (const key of typeKeys) {
                    const demandIntensity = demandFactors[key] / average;
                    demandFactors[key] = Number.isFinite(demandIntensity) && demandIntensity > 0
                        ? Math.max(0.6, Math.min(1.6, 0.5 + demandIntensity / 2))
                        : 1;
                }
            }

            await this.setParameter('demand_factors', demandFactors);

            const monthsTracked = Math.max(1, monthlyConsumption.length);
            const aggregateConsumed = monthlyConsumption.reduce((total, row) => {
                const consumed = Number(row.consumed) || 0;
                return total + consumed;
            }, 0);

            const averageMonthly = aggregateConsumed / monthsTracked;
            const demandIntensity = Math.min(1, averageMonthly / 60); // Assume 60 bottles/month baseline

            const adjustedWeights = { ...this.defaultProcurementWeights };
            adjustedWeights.stock_urgency += 0.12 * demandIntensity;
            adjustedWeights.seasonal_relevance += 0.05 * demandIntensity;
            adjustedWeights.value_proposition -= 0.07 * demandIntensity;
            adjustedWeights.budget_alignment -= 0.03 * demandIntensity;

            const normalizedWeights = this.normalizeWeights(adjustedWeights, this.defaultProcurementWeights);
            await this.setParameter('procurement_weights', normalizedWeights);
        } catch (error) {
            console.error('Failed to update demand models:', error.message);
        }
    }
}

module.exports = LearningEngine;
