/**
 * SommOS Inventory Manager
 * Core business logic for wine inventory management
 */

const Database = require('../database/connection');
const VintageIntelligenceService = require('./vintage_intelligence');

class InventoryManager {
    constructor(database) {
        this.db = database || Database.getInstance();
        this.vintageIntelligence = new VintageIntelligenceService(this.db);
    }

    /**
     * Add new wine to inventory
     */
    async addWineToInventory(wineData, vintageData, stockData) {
        try {
            // Insert or get wine
            let wine = await this.findOrCreateWine(wineData);
            
            // Insert or get vintage
            let vintage = await this.findOrCreateVintage(wine.id, vintageData);
            
            // Add to stock
            await this.addToStock(vintage.id, stockData);
            
            // Record in ledger
            const unitCost = stockData.cost_per_bottle || stockData.unit_cost || 0;
            await this.recordTransaction({
                vintage_id: vintage.id,
                location: stockData.location,
                transaction_type: 'IN',
                quantity: stockData.quantity,
                unit_cost: unitCost,
                total_cost: unitCost * stockData.quantity,
                reference_id: stockData.reference_id,
                notes: stockData.notes,
                created_by: stockData.created_by
            });
            
            // Enrich wine data with vintage intelligence
            try {
                console.log('Enriching wine data with vintage intelligence...');
                const wineWithVintage = {
                    ...wine,
                    ...vintage,
                    year: vintage.year || vintageData.year
                };
                
                const enrichedData = await this.vintageIntelligence.enrichWineData(wineWithVintage);
                console.log('Vintage intelligence enrichment completed');
                
                // The enrichment automatically updates the database via updateVintageData
                return { wine, vintage: { ...vintage, ...enrichedData }, success: true };
                
            } catch (enrichmentError) {
                console.warn('Vintage intelligence enrichment failed:', enrichmentError.message);
                // Continue with standard wine addition even if enrichment fails
                return { wine, vintage, success: true, enrichmentError: enrichmentError.message };
            }
            
        } catch (error) {
            throw error;
        }
    }

    /**
     * Move wine between locations
     */
    async moveWine(vintageId, fromLocation, toLocation, quantity, notes = '') {
        try {
            // Check availability
            const available = await this.checkAvailability(vintageId, fromLocation);
            if (available < quantity) {
                throw new Error(`Insufficient stock. Available: ${available}, Requested: ${quantity}`);
            }
            
            // Remove from source location
            await this.updateStock(vintageId, fromLocation, -quantity);
            await this.recordTransaction({
                vintage_id: vintageId,
                location: fromLocation,
                transaction_type: 'OUT',
                quantity: -quantity,
                notes: `Moved to ${toLocation}. ${notes}`
            });
            
            // Add to destination location
            await this.updateStock(vintageId, toLocation, quantity);
            await this.recordTransaction({
                vintage_id: vintageId,
                location: toLocation,
                transaction_type: 'IN',
                quantity: quantity,
                notes: `Moved from ${fromLocation}. ${notes}`
            });
            
            return { success: true };
            
        } catch (error) {
            throw error;
        }
    }

    /**
     * Reserve wine for service
     */
    async reserveWine(vintageId, location, quantity, notes = '') {
        const available = await this.checkAvailability(vintageId, location);
        if (available < quantity) {
            throw new Error(`Insufficient stock for reservation. Available: ${available}, Requested: ${quantity}`);
        }
        
        await this.db.run(`
            UPDATE Stock 
            SET reserved_quantity = reserved_quantity + ?
            WHERE vintage_id = ? AND location = ?
        `, [quantity, vintageId, location]);
        
        await this.recordTransaction({
            vintage_id: vintageId,
            location: location,
            transaction_type: 'RESERVE',
            quantity: quantity,
            notes: notes
        });
        
        return { success: true };
    }

    /**
     * Consume reserved wine
     */
    async consumeWine(vintageId, location, quantity, notes = '') {
        try {
            // Check reserved quantity
            const stock = await this.db.all(`
                SELECT quantity, reserved_quantity 
                FROM Stock 
                WHERE vintage_id = ? AND location = ?
            `, [vintageId, location]);
            
            if (!stock.length || stock[0].reserved_quantity < quantity) {
                throw new Error('Insufficient reserved quantity');
            }
            
            // Update stock
            await this.db.run(`
                UPDATE Stock 
                SET quantity = quantity - ?, reserved_quantity = reserved_quantity - ?
                WHERE vintage_id = ? AND location = ?
            `, [quantity, quantity, vintageId, location]);
            
            // Record transaction
            await this.recordTransaction({
                vintage_id: vintageId,
                location: location,
                transaction_type: 'OUT',
                quantity: -quantity,
                notes: `Consumed: ${notes}`
            });
            
            return { success: true };
            
        } catch (error) {
            throw error;
        }
    }

    /**
     * Perform inventory adjustment
     */
    async adjustInventory(vintageId, location, newQuantity, reason) {
        const currentStock = await this.db.all(`
            SELECT quantity FROM Stock 
            WHERE vintage_id = ? AND location = ?
        `, [vintageId, location]);
        
        if (!currentStock.length) {
            throw new Error('Stock record not found');
        }
        
        const currentQuantity = currentStock[0].quantity;
        const adjustment = newQuantity - currentQuantity;
        
        if (adjustment !== 0) {
            await this.db.run(`
                UPDATE Stock 
                SET quantity = ?, last_inventory_date = CURRENT_DATE
                WHERE vintage_id = ? AND location = ?
            `, [newQuantity, vintageId, location]);
            
            await this.recordTransaction({
                vintage_id: vintageId,
                location: location,
                transaction_type: 'ADJUST',
                quantity: adjustment,
                notes: `Inventory adjustment: ${reason}`
            });
        }
        
        return { success: true, adjustment };
    }

    /**
     * Get current stock levels
     */
    async getStockLevels(filters = {}) {
        let query = `
            SELECT 
                w.name as wine_name,
                w.producer,
                w.region,
                v.year,
                s.location,
                s.quantity,
                s.reserved_quantity,
                (s.quantity - s.reserved_quantity) as available_quantity,
                s.current_value,
                s.last_inventory_date
            FROM Stock s
            JOIN Vintages v ON s.vintage_id = v.id
            JOIN Wines w ON v.wine_id = w.id
            WHERE s.quantity > 0
        `;
        
        const params = [];
        
        if (filters.location) {
            query += ' AND s.location = ?';
            params.push(filters.location);
        }
        
        if (filters.wine_type) {
            query += ' AND w.wine_type = ?';
            params.push(filters.wine_type);
        }
        
        if (filters.region) {
            query += ' AND w.region = ?';
            params.push(filters.region);
        }
        
        query += ' ORDER BY w.name, v.year';
        
        return await this.db.all(query, params);
    }

    /**
     * Get low stock alerts
     */
    async getLowStockAlerts(threshold = 3) {
        return await this.db.all(`
            SELECT 
                w.name as wine_name,
                w.producer,
                v.year,
                s.location,
                s.quantity,
                s.reserved_quantity,
                (s.quantity - s.reserved_quantity) as available_quantity
            FROM Stock s
            JOIN Vintages v ON s.vintage_id = v.id
            JOIN Wines w ON v.wine_id = w.id
            WHERE (s.quantity - s.reserved_quantity) <= ? AND (s.quantity - s.reserved_quantity) > 0
            ORDER BY available_quantity ASC
        `, [threshold]);
    }

    // Helper methods
    async findOrCreateWine(wineData) {
        const existing = await this.db.all(`
            SELECT * FROM Wines 
            WHERE name = ? AND producer = ? AND region = ?
        `, [wineData.name, wineData.producer, wineData.region]);
        
        if (existing.length > 0) {
            return existing[0];
        }
        
        const result = await this.db.run(`
            INSERT INTO Wines (name, producer, region, country, wine_type, grape_varieties, 
                             alcohol_content, style, tasting_notes, food_pairings, 
                             serving_temp_min, serving_temp_max)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            wineData.name, 
            wineData.producer, 
            wineData.region, 
            wineData.country || 'Unknown',
            wineData.wine_type,
            JSON.stringify(wineData.grape_varieties || []),
            wineData.alcohol_content || null, 
            wineData.style || null, 
            wineData.tasting_notes || null,
            JSON.stringify(wineData.food_pairings || []), 
            wineData.serving_temp_min || null,
            wineData.serving_temp_max || null
        ]);
        
        return { id: result.lastID, ...wineData };
    }

    async findOrCreateVintage(wineId, vintageData) {
        const existing = await this.db.all(`
            SELECT * FROM Vintages 
            WHERE wine_id = ? AND year = ?
        `, [wineId, vintageData.year]);
        
        if (existing.length > 0) {
            return existing[0];
        }
        
        const result = await this.db.run(`
            INSERT INTO Vintages (wine_id, year, harvest_date, bottling_date, release_date,
                                peak_drinking_start, peak_drinking_end, quality_score,
                                weather_score, critic_score, production_notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            wineId, vintageData.year, vintageData.harvest_date, vintageData.bottling_date,
            vintageData.release_date, vintageData.peak_drinking_start, vintageData.peak_drinking_end,
            vintageData.quality_score, vintageData.weather_score, vintageData.critic_score,
            vintageData.production_notes
        ]);
        
        return { id: result.lastID, wine_id: wineId, ...vintageData };
    }

    async addToStock(vintageId, stockData) {
        const existing = await this.db.all(`
            SELECT * FROM Stock 
            WHERE vintage_id = ? AND location = ?
        `, [vintageId, stockData.location]);
        
        // Handle both cost_per_bottle and unit_cost field names
        const costPerBottle = stockData.cost_per_bottle || stockData.unit_cost || 0;
        
        if (existing.length > 0) {
            // Update existing stock
            await this.db.run(`
                UPDATE Stock 
                SET quantity = quantity + ?, 
                    cost_per_bottle = ?, 
                    current_value = current_value + (? * ?),
                    updated_at = CURRENT_TIMESTAMP
                WHERE vintage_id = ? AND location = ?
            `, [
                stockData.quantity, costPerBottle,
                stockData.quantity, costPerBottle,
                vintageId, stockData.location
            ]);
        } else {
            // Create new stock record
            await this.db.run(`
                INSERT INTO Stock (vintage_id, location, quantity, cost_per_bottle, 
                                 current_value, storage_conditions, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                vintageId, stockData.location, stockData.quantity,
                costPerBottle, stockData.quantity * costPerBottle,
                JSON.stringify(stockData.storage_conditions || {}), stockData.notes || ''
            ]);
        }
    }

    async updateStock(vintageId, location, quantityChange) {
        await this.db.run(`
            UPDATE Stock 
            SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP
            WHERE vintage_id = ? AND location = ?
        `, [quantityChange, vintageId, location]);
    }

    async checkAvailability(vintageId, location) {
        const result = await this.db.all(`
            SELECT (quantity - reserved_quantity) as available
            FROM Stock 
            WHERE vintage_id = ? AND location = ?
        `, [vintageId, location]);
        
        return result.length > 0 ? result[0].available : 0;
    }

    async recordTransaction(transactionData) {
        await this.db.run(`
            INSERT INTO Ledger (vintage_id, location, transaction_type, quantity, 
                               unit_cost, total_cost, reference_id, notes, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            transactionData.vintage_id, transactionData.location, transactionData.transaction_type,
            transactionData.quantity, transactionData.unit_cost, transactionData.total_cost,
            transactionData.reference_id, transactionData.notes, transactionData.created_by
        ]);
    }
    
    /**
     * Get current stock levels with filtering
     */
    async getCurrentStock(filters = {}) {
        let query = `
            SELECT w.*, v.year, v.quality_score, s.*,
                   (s.quantity - s.reserved_quantity) as available_quantity
            FROM Stock s
            JOIN Vintages v ON v.id = s.vintage_id
            JOIN Wines w ON w.id = v.wine_id
            WHERE 1=1
        `;
        
        const params = [];
        
        if (filters.location) {
            query += ' AND s.location = ?';
            params.push(filters.location);
        }
        
        if (filters.wine_type) {
            query += ' AND w.wine_type = ?';
            params.push(filters.wine_type);
        }
        
        if (filters.region) {
            query += ' AND w.region LIKE ?';
            params.push(`%${filters.region}%`);
        }
        
        if (filters.available_only) {
            query += ' AND s.quantity > s.reserved_quantity';
        }
        
        query += ' ORDER BY w.name, v.year DESC';
        
        return await this.db.all(query, params);
    }
    
    /**
     * Consume wine with proper validation
     */
    async consumeWine(vintage_id, location, quantity, notes = null, created_by = null) {
        try {
            // Check current stock
            const currentStock = await this.db.get(`
                SELECT quantity, reserved_quantity 
                FROM Stock 
                WHERE vintage_id = ? AND location = ?
            `, [vintage_id, location]);
            
            if (!currentStock) {
                throw new Error('Wine not found in specified location');
            }
            
            const availableQuantity = currentStock.quantity - currentStock.reserved_quantity;
            if (quantity > availableQuantity) {
                throw new Error(`Insufficient stock. Available: ${availableQuantity}, Requested: ${quantity}`);
            }
            
            // Update stock
            await this.db.run(`
                UPDATE Stock 
                SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP
                WHERE vintage_id = ? AND location = ?
            `, [quantity, vintage_id, location]);
            
            // Record in ledger
            await this.recordTransaction({
                vintage_id,
                location,
                transaction_type: 'OUT',
                quantity: -quantity,
                notes,
                created_by
            });
            
            return {
                success: true,
                message: `Consumed ${quantity} bottle(s)`,
                remaining_stock: currentStock.quantity - quantity
            };
            
        } catch (error) {
            throw new Error(`Failed to consume wine: ${error.message}`);
        }
    }
    
    /**
     * Receive wine into inventory
     */
    async receiveWine(vintage_id, location, quantity, unit_cost = null, reference_id = null, notes = null, created_by = null) {
        try {
            // Check if stock record exists
            const existingStock = await this.db.get(`
                SELECT id, quantity 
                FROM Stock 
                WHERE vintage_id = ? AND location = ?
            `, [vintage_id, location]);
            
            let newQuantity;
            
            if (existingStock) {
                // Update existing stock
                newQuantity = existingStock.quantity + quantity;
                await this.db.run(`
                    UPDATE Stock 
                    SET quantity = ?, 
                        cost_per_bottle = COALESCE(?, cost_per_bottle),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE vintage_id = ? AND location = ?
                `, [newQuantity, unit_cost, vintage_id, location]);
            } else {
                // Create new stock record
                newQuantity = quantity;
                await this.db.run(`
                    INSERT INTO Stock (vintage_id, location, quantity, cost_per_bottle, current_value)
                    VALUES (?, ?, ?, ?, ?)
                `, [vintage_id, location, quantity, unit_cost, unit_cost]);
            }
            
            // Record in ledger
            await this.recordTransaction({
                vintage_id,
                location,
                transaction_type: 'IN',
                quantity,
                unit_cost,
                total_cost: unit_cost * quantity,
                reference_id,
                notes,
                created_by
            });
            
            return {
                success: true,
                message: `Received ${quantity} bottle(s)`,
                total_stock: newQuantity
            };
            
        } catch (error) {
            throw new Error(`Failed to receive wine: ${error.message}`);
        }
    }
    
    /**
     * Reserve wine for service
     */
    async reserveWine(vintage_id, location, quantity, notes = null, created_by = null) {
        try {
            // Check current stock
            const currentStock = await this.db.get(`
                SELECT quantity, reserved_quantity 
                FROM Stock 
                WHERE vintage_id = ? AND location = ?
            `, [vintage_id, location]);
            
            if (!currentStock) {
                throw new Error('Wine not found in specified location');
            }
            
            const availableQuantity = currentStock.quantity - currentStock.reserved_quantity;
            if (quantity > availableQuantity) {
                throw new Error(`Insufficient stock to reserve. Available: ${availableQuantity}`);
            }
            
            // Update reserved quantity
            await this.db.run(`
                UPDATE Stock 
                SET reserved_quantity = reserved_quantity + ?, updated_at = CURRENT_TIMESTAMP
                WHERE vintage_id = ? AND location = ?
            `, [quantity, vintage_id, location]);
            
            // Record in ledger
            await this.recordTransaction({
                vintage_id,
                location,
                transaction_type: 'RESERVE',
                quantity,
                notes,
                created_by
            });
            
            return {
                success: true,
                message: `Reserved ${quantity} bottle(s)`,
                reserved_total: currentStock.reserved_quantity + quantity
            };
            
        } catch (error) {
            throw new Error(`Failed to reserve wine: ${error.message}`);
        }
    }
    
    /**
     * Move wine between locations
     */
    async moveWine(vintage_id, from_location, to_location, quantity, notes = null, created_by = null) {
        try {
            // Check source stock
            const sourceStock = await this.db.get(`
                SELECT quantity, reserved_quantity 
                FROM Stock 
                WHERE vintage_id = ? AND location = ?
            `, [vintage_id, from_location]);
            
            if (!sourceStock) {
                throw new Error('Wine not found in source location');
            }
            
            const availableQuantity = sourceStock.quantity - sourceStock.reserved_quantity;
            if (quantity > availableQuantity) {
                throw new Error(`Insufficient stock in source location. Available: ${availableQuantity}`);
            }
            
            // Update source location
            await this.db.run(`
                UPDATE Stock 
                SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP
                WHERE vintage_id = ? AND location = ?
            `, [quantity, vintage_id, from_location]);
            
            // Check if destination stock exists
            const destStock = await this.db.get(`
                SELECT quantity 
                FROM Stock 
                WHERE vintage_id = ? AND location = ?
            `, [vintage_id, to_location]);
            
            if (destStock) {
                // Update destination location
                await this.db.run(`
                    UPDATE Stock 
                    SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP
                    WHERE vintage_id = ? AND location = ?
                `, [quantity, vintage_id, to_location]);
            } else {
                // Create new stock record at destination
                const sourceStockFull = await this.db.get(`
                    SELECT cost_per_bottle, current_value 
                    FROM Stock 
                    WHERE vintage_id = ? AND location = ?
                `, [vintage_id, from_location]);
                
                await this.db.run(`
                    INSERT INTO Stock (vintage_id, location, quantity, cost_per_bottle, current_value)
                    VALUES (?, ?, ?, ?, ?)
                `, [vintage_id, to_location, quantity, sourceStockFull.cost_per_bottle, sourceStockFull.current_value]);
            }
            
            // Record ledger entries
            await this.recordTransaction({
                vintage_id,
                location: from_location,
                transaction_type: 'MOVE',
                quantity: -quantity,
                notes: `Moved to ${to_location}. ${notes || ''}`.trim(),
                created_by
            });
            
            await this.recordTransaction({
                vintage_id,
                location: to_location,
                transaction_type: 'MOVE',
                quantity,
                notes: `Moved from ${from_location}. ${notes || ''}`.trim(),
                created_by
            });
            
            return {
                success: true,
                message: `Moved ${quantity} bottle(s) from ${from_location} to ${to_location}`
            };
            
        } catch (error) {
            throw new Error(`Failed to move wine: ${error.message}`);
        }
    }
    
    /**
     * Get ledger history for a vintage
     */
    async getLedgerHistory(vintage_id, limit = 50, offset = 0) {
        return await this.db.all(`
            SELECT l.*, w.name as wine_name, w.producer, v.year
            FROM Ledger l
            JOIN Vintages v ON v.id = l.vintage_id
            JOIN Wines w ON w.id = v.wine_id
            WHERE l.vintage_id = ?
            ORDER BY l.created_at DESC
            LIMIT ? OFFSET ?
        `, [vintage_id, limit, offset]);
    }
}

module.exports = InventoryManager;
