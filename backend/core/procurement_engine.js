/**
 * SommOS Procurement Engine
 * Core business logic for wine procurement and supplier management
 */

const Database = require('../database/connection');

class ProcurementEngine {
    constructor(database, learningEngine = null) {
        this.db = database || Database.getInstance();
        this.learningEngine = learningEngine;
        this.defaultScoringWeights = {
            stock_urgency: 0.28,
            value_proposition: 0.23,
            quality_score: 0.18,
            supplier_reliability: 0.12,
            seasonal_relevance: 0.09,
            budget_alignment: 0.10
        };
    }

    /**
     * Generate procurement recommendations based on current stock and demand
     */
    async generateProcurementRecommendations(criteria = {}) {
        const normalizedCriteria = this.normalizeProcurementCriteria(criteria);

        const {
            budget_limit,
            stock_threshold,
            priority_regions,
            wine_types,
            minimum_quality_score
        } = normalizedCriteria;

        const lowStockItems = await this.identifyLowStock(stock_threshold);

        const opportunities = await this.getProcurementOpportunities({
            budget_limit,
            priority_regions,
            wine_types,
            minimum_quality_score
        });

        const recommendations = [];

        const learningContext = await this.getAdaptiveProcurementContext();

        for (const opportunity of opportunities) {
            const score = await this.scoreProcurementOpportunity(
                opportunity,
                lowStockItems,
                normalizedCriteria,
                learningContext
            );

            if (score.total > 0.5) {
                const recommended_quantity = this.calculateRecommendedQuantity(
                    opportunity,
                    lowStockItems,
                    normalizedCriteria,
                    learningContext.demandMultipliers
                );
                const estimated_market_price = this.estimateMarketPrice(opportunity);
                const estimated_value = estimated_market_price * recommended_quantity;
                const estimated_investment = opportunity.price_per_bottle * recommended_quantity;
                const estimated_savings = Math.max(0, estimated_value - estimated_investment);

                recommendations.push({
                    ...opportunity,
                    score,
                    reasoning: this.generateProcurementReasoning(
                        opportunity,
                        score,
                        normalizedCriteria,
                        recommended_quantity,
                        learningContext.demandMultipliers
                    ),
                    recommended_quantity,
                    estimated_value: this.roundCurrency(estimated_value),
                    estimated_investment: this.roundCurrency(estimated_investment),
                    estimated_savings: this.roundCurrency(estimated_savings),
                    urgency: this.getUrgencyLabel(score),
                    confidence: score.confidence
                });
            }
        }

        const ranked = recommendations
            .sort((a, b) => b.score.total - a.score.total)
            .slice(0, 20);

        return {
            criteria: normalizedCriteria,
            summary: this.buildOpportunitySummary(ranked, normalizedCriteria),
            opportunities: ranked
        };
    }

    /**
     * Score procurement opportunity
     */
    async scoreProcurementOpportunity(opportunity, lowStockItems, criteria = {}, learningContext = {}) {
        const scores = {
            stock_urgency: this.calculateStockUrgency(opportunity, lowStockItems),
            value_proposition: this.calculateValueProposition(opportunity),
            quality_score: this.normalizeQualityScore(opportunity.quality_score),
            supplier_reliability: await this.getSupplierReliability(opportunity.supplier_id),
            seasonal_relevance: this.calculateSeasonalRelevance(opportunity),
            budget_alignment: this.calculateBudgetAlignment(
                opportunity,
                criteria,
                lowStockItems,
                learningContext.demandMultipliers
            )
        };

        const demandFactor = learningContext?.demandMultipliers?.[opportunity.wine_type] || 1;

        if (demandFactor && demandFactor !== 1) {
            scores.stock_urgency = Math.min(1, scores.stock_urgency * demandFactor);
            scores.seasonal_relevance = Math.min(1, scores.seasonal_relevance * (0.9 + 0.1 * demandFactor));
        }

        const weights = learningContext?.weights || this.defaultScoringWeights;

        let total = 0;
        for (const [category, score] of Object.entries(scores)) {
            total += score * (weights[category] || 0);
        }

        return {
            ...scores,
            total: Math.min(1.0, total),
            confidence: this.calculateConfidence(scores)
        };
    }

    /**
     * Calculate stock urgency score
     */
    calculateStockUrgency(opportunity, lowStockItems) {
        const isLowStock = lowStockItems.some(item => 
            item.wine_name === opportunity.wine_name && 
            item.producer === opportunity.producer
        );
        
        if (isLowStock) return 1.0;
        
        // Check if we have any stock of this wine
        const hasStock = opportunity.current_stock > 0;
        return hasStock ? 0.3 : 0.7; // Higher score for wines we don't have
    }

    /**
     * Calculate value proposition score
     */
    calculateValueProposition(opportunity) {
        const { price_per_bottle, market_price, quality_score } = opportunity;
        
        if (!market_price) return 0.5; // Default if no market price available
        
        const priceRatio = price_per_bottle / market_price;
        const qualityFactor = quality_score / 100;
        
        // Good value = low price ratio + high quality
        const valueScore = (1 - priceRatio) * 0.7 + qualityFactor * 0.3;
        
        return Math.max(0, Math.min(1.0, valueScore));
    }

    /**
     * Normalize quality score to 0-1 range
     */
    normalizeQualityScore(qualityScore) {
        return Math.max(0, Math.min(1.0, qualityScore / 100));
    }

    /**
     * Get supplier reliability score
     */
    async getSupplierReliability(supplierId) {
        try {
            const supplier = await this.db.all(`
                SELECT rating, active FROM Suppliers WHERE id = ?
            `, [supplierId]);
            
            if (!supplier.length || !supplier[0].active) return 0;
            
            return (supplier[0].rating || 3) / 5; // Convert 1-5 rating to 0-1
        } catch (error) {
            console.error('Error getting supplier reliability:', error.message);
            return 0.5; // Default reliability score
        }
    }

    /**
     * Calculate seasonal relevance
     */
    calculateSeasonalRelevance(opportunity) {
        const currentSeason = this.getCurrentSeason();
        const wineType = opportunity.wine_type.toLowerCase();
        
        const seasonalPreferences = {
            'spring': { 'white': 0.9, 'rosé': 0.8, 'sparkling': 0.7, 'red': 0.5 },
            'summer': { 'white': 1.0, 'rosé': 0.9, 'sparkling': 0.8, 'red': 0.4 },
            'autumn': { 'red': 0.9, 'white': 0.6, 'dessert': 0.8, 'fortified': 0.7 },
            'winter': { 'red': 1.0, 'fortified': 0.8, 'dessert': 0.7, 'white': 0.5 }
        };
        
        return seasonalPreferences[currentSeason]?.[wineType] || 0.6;
    }

    /**
     * Generate procurement reasoning
     */
    generateProcurementReasoning(opportunity, score, criteria = {}, recommendedQuantity, demandMultipliers = {}) {
        const reasons = [];

        if (score.stock_urgency > 0.8) {
            reasons.push('Critical stock replenishment needed');
        } else if (score.stock_urgency > 0.6) {
            reasons.push('Low stock levels detected');
        }

        const demandFactor = demandMultipliers?.[opportunity.wine_type] || 1;
        if (demandFactor > 1.25) {
            reasons.push('Consumption trends show rising demand for this wine style');
        } else if (demandFactor < 0.85) {
            reasons.push('Demand is stable; consider moderate restock levels');
        }

        if (score.value_proposition > 0.8) {
            reasons.push('Excellent value proposition with high quality-to-price ratio');
        } else if (score.value_proposition > 0.6) {
            reasons.push('Good value for money');
        }
        
        if (score.quality_score > 0.85) {
            reasons.push('Exceptional quality wine from renowned vintage');
        }
        
        if (score.supplier_reliability > 0.8) {
            reasons.push('Highly reliable supplier with excellent track record');
        }
        
        if (score.seasonal_relevance > 0.8) {
            reasons.push('Perfect seasonal timing for this wine style');
        }

        if (score.budget_alignment > 0.8) {
            reasons.push('Fits comfortably within configured budget expectations');
        } else if (score.budget_alignment < 0.4) {
            reasons.push('Requires budget stretch beyond preferred range');
        }

        if (criteria?.budget_limit) {
            const recommended = recommendedQuantity ?? this.calculateRecommendedQuantity(
                opportunity,
                [],
                criteria,
                demandMultipliers
            );
            reasons.push(`Projected spend of $${this.roundCurrency(
                (opportunity.price_per_bottle || 0) * recommended
            )} stays within $${criteria.budget_limit} budget window.`);
        }

        return reasons.join('. ') + '.';
    }

    /**
     * API Method: Analyze procurement opportunities
     * Called by GET /api/procurement/opportunities
     */
    async analyzeProcurementOpportunities(criteria = {}) {
        try {
            return await this.generateProcurementRecommendations(criteria);
        } catch (error) {
            console.error('Error analyzing procurement opportunities:', error.message);
            throw new Error('Failed to analyze procurement opportunities: ' + error.message);
        }
    }

    /**
     * API Method: Generate purchase order
     * Called by POST /api/procurement/order
     */
    async generatePurchaseOrder(items, supplier_id, delivery_date, notes) {
        try {
            const orderData = {
                supplier_id,
                items: items.map(item => ({
                    vintage_id: item.vintage_id,
                    quantity: item.quantity,
                    unit_price: item.price || item.unit_price || 0
                })),
                delivery_date,
                notes,
                created_by: 'API User' // Could be enhanced with auth
            };
            
            return await this.createPurchaseOrder(orderData);
        } catch (error) {
            console.error('Error generating purchase order:', error.message);
            throw new Error('Failed to generate purchase order: ' + error.message);
        }
    }

    /**
     * API Method: Analyze specific purchase decision
     * Called by POST /api/procurement/analyze
     */
    async analyzePurchaseDecision(vintage_id, supplier_id, quantity = 12, context = {}) {
        try {
            // Get wine and supplier details
            const wineQuery = `
                SELECT w.name, w.producer, w.wine_type, w.region, v.year, v.quality_score,
                       pb.price_per_bottle, pb.availability_status,
                       COALESCE(SUM(st.quantity), 0) as current_stock
                FROM Vintages v
                JOIN Wines w ON v.wine_id = w.id
                LEFT JOIN PriceBook pb ON v.id = pb.vintage_id AND pb.supplier_id = ?
                LEFT JOIN Stock st ON v.id = st.vintage_id
                WHERE v.id = ?
                GROUP BY w.id, v.id
            `;

            const wineResults = await this.db.all(wineQuery, [supplier_id, vintage_id]);

            if (wineResults.length === 0) {
                throw new Error('Wine or price information not found');
            }

            const wine = wineResults[0];

            const supplier = await this.db.get(`
                SELECT name, rating, payment_terms, delivery_terms
                FROM Suppliers
                WHERE id = ?
            `, [supplier_id]);

            // Calculate analysis scores
            const lowStockItems = await this.identifyLowStock(5);
            const learningContext = await this.getAdaptiveProcurementContext();
            const opportunity = {
                wine_name: wine.name,
                producer: wine.producer,
                wine_type: wine.wine_type,
                region: wine.region,
                year: wine.year,
                quality_score: wine.quality_score || 0,
                price_per_bottle: wine.price_per_bottle || 0,
                current_stock: wine.current_stock,
                supplier_id: supplier_id,
                minimum_order: context.minimum_order || 1
            };

            const recommendedQuantity = this.calculateRecommendedQuantity(
                opportunity,
                lowStockItems,
                context,
                learningContext.demandMultipliers
            );
            const score = await this.scoreProcurementOpportunity(
                opportunity,
                lowStockItems,
                context,
                learningContext
            );
            const reasoning = this.generateProcurementReasoning(
                opportunity,
                score,
                context,
                recommendedQuantity,
                learningContext.demandMultipliers
            );

            // Calculate order details
            const totalCost = quantity * (wine.price_per_bottle || 0);
            const projectedStock = (wine.current_stock || 0) + quantity;
            const estimatedMarketPrice = this.estimateMarketPrice(opportunity);
            const estimatedValue = estimatedMarketPrice * quantity;
            const estimatedSavings = Math.max(0, estimatedValue - totalCost);
            const budget = context?.budget || context?.budget_limit;

            return {
                wine: {
                    name: wine.name,
                    producer: wine.producer,
                    year: wine.year,
                    quality_score: wine.quality_score
                },
                supplier_id,
                quantity,
                unit_price: wine.price_per_bottle || 0,
                total_cost: totalCost,
                availability: wine.availability_status || 'Unknown',
                current_stock: wine.current_stock,
                projected_stock_after_purchase: projectedStock,
                analysis: {
                    score: score,
                    reasoning: reasoning,
                    recommendation: score.total > 0.6 ? 'Recommended' : 'Not Recommended',
                    estimated_market_price: this.roundCurrency(estimatedMarketPrice),
                    estimated_savings: this.roundCurrency(estimatedSavings),
                    budget_impact: budget ? this.roundCurrency(totalCost - budget) : null,
                    supplier: supplier ? {
                        name: supplier.name,
                        rating: supplier.rating,
                        payment_terms: supplier.payment_terms,
                        delivery_terms: supplier.delivery_terms
                    } : null
                },
                context
            };
        } catch (error) {
            console.error('Error analyzing purchase decision:', error.message);
            throw new Error('Failed to analyze purchase decision: ' + error.message);
        }
    }

    /**
     * Create purchase order
     */
    async createPurchaseOrder(orderData) {
        const {
            supplier_id,
            items, // Array of { vintage_id, quantity, unit_price }
            delivery_date,
            notes,
            created_by
        } = orderData;

        try {
            if (!supplier_id) {
                throw new Error('Supplier is required for purchase orders');
            }

            if (!items || !Array.isArray(items) || items.length === 0) {
                throw new Error('At least one item is required');
            }

            // Calculate totals
            let totalAmount = 0;
            for (const item of items) {
                if (!item.vintage_id) {
                    throw new Error('Each item must reference a vintage_id');
                }

                if (!item.quantity || item.quantity <= 0) {
                    throw new Error('Each item must include a positive quantity');
                }

                const unitPrice = item.unit_price ?? item.price ?? 0;
                if (unitPrice < 0) {
                    throw new Error('Unit price must be zero or greater');
                }

                item.unit_price = unitPrice;
                totalAmount += item.quantity * unitPrice;
            }

            // Create order record (simplified - would need proper order table)
            const orderId = `PO-${Date.now()}`;

            // Record each item as a ledger entry with reference to the order
            for (const item of items) {
                await this.db.run(`
                    INSERT INTO Ledger (vintage_id, location, transaction_type, quantity,
                                       unit_cost, total_cost, reference_id, notes, created_by)
                    VALUES (?, 'INCOMING', 'IN', ?, ?, ?, ?, ?, ?)
                `, [
                    item.vintage_id, item.quantity, item.unit_price,
                    item.quantity * item.unit_price, orderId,
                    `Purchase Order: ${notes}`, created_by
                ]);
            }

            return {
                order_id: orderId,
                total_amount: totalAmount,
                item_count: items.length,
                success: true,
                supplier_id: supplier_id,
                delivery_date: delivery_date,
                notes: notes,
                validation: {
                    has_delivery_date: Boolean(delivery_date),
                    notes_included: Boolean(notes && notes.trim())
                }
            };

        } catch (error) {
            console.error('Error creating purchase order:', error.message);
            throw new Error('Failed to create purchase order: ' + error.message);
        }
    }

    /**
     * Track market prices and update price book
     */
    async updateMarketPrices(priceUpdates) {
        try {
            let updatedCount = 0;
            
            for (const update of priceUpdates) {
                const { vintage_id, supplier_id, new_price, availability_status } = update;
                
                const result = await this.db.run(`
                    INSERT OR REPLACE INTO PriceBook 
                    (vintage_id, supplier_id, price_per_bottle, availability_status, last_updated)
                    VALUES (?, ?, ?, ?, CURRENT_DATE)
                `, [vintage_id, supplier_id, new_price, availability_status]);
                
                if (result.changes > 0) {
                    updatedCount++;
                }
            }
            
            return { success: true, updated_count: updatedCount };
            
        } catch (error) {
            console.error('Error updating market prices:', error.message);
            throw new Error('Failed to update market prices: ' + error.message);
        }
    }

    // Helper methods
    async identifyLowStock(threshold) {
        try {
            return await this.db.all(`
                SELECT 
                    w.name as wine_name,
                    w.producer,
                    w.wine_type,
                    w.region,
                    v.year,
                    SUM(s.quantity - s.reserved_quantity) as available_quantity
                FROM Stock s
                JOIN Vintages v ON s.vintage_id = v.id
                JOIN Wines w ON v.wine_id = w.id
                GROUP BY w.id, v.id
                HAVING available_quantity <= ? AND available_quantity >= 0
                ORDER BY available_quantity ASC
            `, [threshold]);
        } catch (error) {
            console.error('Error identifying low stock:', error.message);
            return []; // Return empty array if query fails
        }
    }

    async getProcurementOpportunities(criteria) {
        try {
            let query = `
                SELECT
                    w.name as wine_name,
                    w.producer,
                    w.wine_type,
                    w.region,
                    v.year,
                    v.quality_score,
                    pb.price_per_bottle,
                    pb.availability_status,
                    pb.minimum_order,
                    s.name as supplier_name,
                    pb.supplier_id,
                    COALESCE(SUM(st.quantity), 0) as current_stock
                FROM PriceBook pb
                JOIN Vintages v ON pb.vintage_id = v.id
                JOIN Wines w ON v.wine_id = w.id
                JOIN Suppliers s ON pb.supplier_id = s.id
                LEFT JOIN Stock st ON v.id = st.vintage_id
                WHERE pb.availability_status IN ('In Stock', 'Limited')
                AND s.active = 1
            `;
            
            const params = [];
            
            if (criteria.minimum_quality_score) {
                query += ' AND v.quality_score >= ?';
                params.push(criteria.minimum_quality_score);
            }
            
            if (criteria.wine_types && criteria.wine_types.length > 0) {
                query += ` AND w.wine_type IN (${criteria.wine_types.map(() => '?').join(',')})`;
                params.push(...criteria.wine_types);
            }

            if (criteria.priority_regions && criteria.priority_regions.length > 0) {
                query += ` AND w.region IN (${criteria.priority_regions.map(() => '?').join(',')})`;
                params.push(...criteria.priority_regions);
            }

            if (criteria.budget_limit) {
                query += ' AND pb.price_per_bottle <= ?';
                params.push(criteria.budget_limit);
            }

            query += ' GROUP BY w.id, v.id, pb.supplier_id ORDER BY v.quality_score DESC';

            return await this.db.all(query, params);
        } catch (error) {
            console.error('Error getting procurement opportunities:', error.message);
            return []; // Return empty array if query fails
        }
    }

    normalizeProcurementCriteria(criteria = {}) {
        const budget_limit = criteria.budget_limit || criteria.max_price || criteria.budget || undefined;

        const regions = [];
        if (criteria.priority_regions && Array.isArray(criteria.priority_regions)) {
            regions.push(...criteria.priority_regions);
        }
        if (criteria.region) {
            regions.push(...String(criteria.region).split(',').map(region => region.trim()).filter(Boolean));
        }
        if (criteria.regions) {
            regions.push(...String(criteria.regions).split(',').map(region => region.trim()).filter(Boolean));
        }

        const types = [];
        if (criteria.wine_types && Array.isArray(criteria.wine_types)) {
            types.push(...criteria.wine_types);
        }
        if (criteria.wine_type) {
            types.push(...String(criteria.wine_type).split(',').map(type => type.trim()).filter(Boolean));
        }

        return {
            budget_limit,
            minimum_quality_score: criteria.minimum_quality_score || criteria.min_score || 75,
            priority_regions: [...new Set(regions)],
            wine_types: [...new Set(types)],
            stock_threshold: criteria.stock_threshold || 5
        };
    }

    calculateRecommendedQuantity(opportunity, lowStockItems, criteria = {}, demandMultipliers = {}) {
        const lowStockItem = lowStockItems.find(item =>
            item.wine_name === opportunity.wine_name &&
            item.producer === opportunity.producer
        );

        const baseQuantity = Math.max(opportunity.minimum_order || 6, 6);
        const desiredStockLevel = criteria.desired_stock_level || 24;
        const currentStock = opportunity.current_stock || 0;
        const deficit = Math.max(0, desiredStockLevel - currentStock);

        const rawMultiplier = demandMultipliers?.[opportunity.wine_type] || 1;
        const demandMultiplier = Math.max(0.7, Math.min(1.6, rawMultiplier));
        const cap = Math.max(baseQuantity, criteria.max_restock || 48);

        if (lowStockItem) {
            const quantity = Math.max(baseQuantity, deficit || baseQuantity);
            return Math.min(cap, Math.max(baseQuantity, Math.round(quantity * demandMultiplier)));
        }

        const quantity = Math.max(baseQuantity, deficit || baseQuantity);
        return Math.min(cap, Math.max(baseQuantity, Math.round(quantity * demandMultiplier)));
    }

    calculateBudgetAlignment(opportunity, criteria = {}, lowStockItems = [], demandMultipliers = {}) {
        if (!criteria?.budget_limit) {
            return 0.6; // neutral score when no budget constraint
        }

        const recommendedQuantity = this.calculateRecommendedQuantity(
            opportunity,
            lowStockItems,
            criteria,
            demandMultipliers
        );
        const projectedSpend = opportunity.price_per_bottle * recommendedQuantity;

        if (projectedSpend <= criteria.budget_limit * 0.5) return 1.0;
        if (projectedSpend <= criteria.budget_limit * 0.9) return 0.8;
        if (projectedSpend <= criteria.budget_limit) return 0.6;
        if (projectedSpend <= criteria.budget_limit * 1.2) return 0.4;

        return 0.2;
    }

    getUrgencyLabel(score) {
        if (score.stock_urgency >= 0.9) return 'Critical';
        if (score.stock_urgency >= 0.7) return 'High';
        if (score.stock_urgency >= 0.5) return 'Moderate';
        return 'Low';
    }

    roundCurrency(value) {
        if (value === null || value === undefined || Number.isNaN(value)) {
            return 0;
        }
        return Math.round(value * 100) / 100;
    }

    estimateMarketPrice(opportunity) {
        if (opportunity.market_price && opportunity.market_price > 0) {
            return opportunity.market_price;
        }

        const base = opportunity.price_per_bottle || 0;
        const qualityMultiplier = Math.max(0.8, (opportunity.quality_score || 0) / 80);
        const scarcityMultiplier = opportunity.availability_status === 'Limited' ? 1.1 : 1;

        return base * qualityMultiplier * scarcityMultiplier;
    }

    async getAdaptiveProcurementContext() {
        if (!this.learningEngine) {
            return {
                weights: this.defaultScoringWeights,
                demandMultipliers: {}
            };
        }

        try {
            const [weights, demandMultipliers] = await Promise.all([
                this.learningEngine.getProcurementWeights(),
                this.learningEngine.getDemandMultipliers()
            ]);

            return {
                weights: weights || this.defaultScoringWeights,
                demandMultipliers: demandMultipliers || {}
            };
        } catch (error) {
            console.warn('Failed to load adaptive procurement context:', error.message);
            return {
                weights: this.defaultScoringWeights,
                demandMultipliers: {}
            };
        }
    }

    buildOpportunitySummary(opportunities, criteria) {
        if (!opportunities.length) {
            return {
                total_opportunities: 0,
                recommended_spend: 0,
                projected_value: 0,
                average_score: 0,
                top_regions: [],
                urgent_actions: 0,
                budget_limit: criteria.budget_limit || null
            };
        }

        const totals = opportunities.reduce((acc, opp) => {
            acc.recommended_spend += opp.estimated_investment || 0;
            acc.projected_value += opp.estimated_value || 0;
            acc.average_score += opp.score.total;
            acc.urgent_actions += opp.urgency === 'Critical' || opp.urgency === 'High' ? 1 : 0;

            if (opp.region) {
                acc.regions[opp.region] = (acc.regions[opp.region] || 0) + 1;
            }

            return acc;
        }, { recommended_spend: 0, projected_value: 0, average_score: 0, urgent_actions: 0, regions: {} });

        const top_regions = Object.entries(totals.regions)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([region, count]) => ({ region, count }));

        return {
            total_opportunities: opportunities.length,
            recommended_spend: this.roundCurrency(totals.recommended_spend),
            projected_value: this.roundCurrency(totals.projected_value),
            average_score: this.roundCurrency(totals.average_score / opportunities.length),
            top_regions,
            urgent_actions: totals.urgent_actions,
            budget_limit: criteria.budget_limit || null
        };
    }

    getCurrentSeason() {
        const month = new Date().getMonth();
        if (month >= 2 && month <= 4) return 'spring';
        if (month >= 5 && month <= 7) return 'summer';
        if (month >= 8 && month <= 10) return 'autumn';
        return 'winter';
    }

    calculateConfidence(scores) {
        const values = Object.values(scores);
        const average = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((acc, val) => acc + Math.pow(val - average, 2), 0) / values.length;
        
        return Math.max(0.1, Math.min(1.0, average - Math.sqrt(variance)));
    }
}

module.exports = ProcurementEngine;