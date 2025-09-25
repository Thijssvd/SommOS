/**
 * SommOS Procurement Engine
 * Core business logic for wine procurement and supplier management
 */

const Database = require('../database/connection');

class ProcurementEngine {
    constructor(database) {
        this.db = database || Database.getInstance();
    }

    /**
     * Generate procurement recommendations based on current stock and demand
     */
    async generateProcurementRecommendations(criteria = {}) {
        const {
            budget_limit,
            priority_regions,
            wine_types,
            minimum_quality_score = 75,
            stock_threshold = 5
        } = criteria;

        // Analyze current stock levels
        const lowStockItems = await this.identifyLowStock(stock_threshold);
        
        // Get procurement opportunities
        const opportunities = await this.getProcurementOpportunities({
            budget_limit,
            priority_regions,
            wine_types,
            minimum_quality_score
        });
        
        // Score and rank recommendations
        const recommendations = [];
        
        for (const opportunity of opportunities) {
            const score = await this.scoreProcurementOpportunity(opportunity, lowStockItems);
            
            if (score.total > 0.5) {
                recommendations.push({
                    ...opportunity,
                    score,
                    reasoning: this.generateProcurementReasoning(opportunity, score)
                });
            }
        }
        
        return recommendations
            .sort((a, b) => b.score.total - a.score.total)
            .slice(0, 20);
    }

    /**
     * Score procurement opportunity
     */
    async scoreProcurementOpportunity(opportunity, lowStockItems) {
        const scores = {
            stock_urgency: this.calculateStockUrgency(opportunity, lowStockItems),
            value_proposition: this.calculateValueProposition(opportunity),
            quality_score: this.normalizeQualityScore(opportunity.quality_score),
            supplier_reliability: await this.getSupplierReliability(opportunity.supplier_id),
            seasonal_relevance: this.calculateSeasonalRelevance(opportunity)
        };
        
        const weights = {
            stock_urgency: 0.30,
            value_proposition: 0.25,
            quality_score: 0.20,
            supplier_reliability: 0.15,
            seasonal_relevance: 0.10
        };
        
        let total = 0;
        for (const [category, score] of Object.entries(scores)) {
            total += score * weights[category];
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
    generateProcurementReasoning(opportunity, score) {
        const reasons = [];
        
        if (score.stock_urgency > 0.8) {
            reasons.push('Critical stock replenishment needed');
        } else if (score.stock_urgency > 0.6) {
            reasons.push('Low stock levels detected');
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
            
            // Calculate analysis scores
            const lowStockItems = await this.identifyLowStock(5);
            const opportunity = {
                wine_name: wine.name,
                producer: wine.producer,
                wine_type: wine.wine_type,
                region: wine.region,
                year: wine.year,
                quality_score: wine.quality_score || 0,
                price_per_bottle: wine.price_per_bottle || 0,
                current_stock: wine.current_stock,
                supplier_id: supplier_id
            };
            
            const score = await this.scoreProcurementOpportunity(opportunity, lowStockItems);
            const reasoning = this.generateProcurementReasoning(opportunity, score);
            
            // Calculate order details
            const totalCost = quantity * (wine.price_per_bottle || 0);
            
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
                analysis: {
                    score: score,
                    reasoning: reasoning,
                    recommendation: score.total > 0.6 ? 'Recommended' : 'Not Recommended'
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
            // Calculate totals
            let totalAmount = 0;
            for (const item of items) {
                totalAmount += item.quantity * item.unit_price;
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
                notes: notes
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