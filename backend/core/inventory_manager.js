/**
 * SommOS Inventory Manager
 * Core business logic for wine inventory management
 */

const Database = require('../database/connection');
const VintageIntelligenceService = require('./vintage_intelligence');
const InventoryIntakeProcessor = require('./inventory_intake_processor');

class InventoryManager {
    constructor(database, learningEngine = null) {
        this.db = database || Database.getInstance();
        this.learningEngine = learningEngine;
        this.vintageIntelligence = new VintageIntelligenceService(this.db);
        this.intakeProcessor = new InventoryIntakeProcessor();
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
                    wine_id: wine.id,
                    vintage_id: vintage.id,
                    id: wine.id,
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
     * Create a new intake order from various capture sources (manual/pdf/excel/scan)
     */
    async createInventoryIntake(intakeRequest = {}) {
        try {
            const normalized = this.intakeProcessor.process(intakeRequest);

            if (!normalized.items.length) {
                throw new Error('Inventory intake must include at least one wine entry');
            }

            const orderDate = normalized.order_date || new Date().toISOString().slice(0, 10);

            const orderResult = await this.db.run(`
                INSERT INTO InventoryIntakeOrders (
                    supplier_id, supplier_name, source_type, reference,
                    order_date, expected_delivery, status, raw_payload, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, 'ORDERED', ?, ?)
            `, [
                normalized.supplier?.id || null,
                normalized.supplier?.name || null,
                normalized.source_type,
                normalized.reference || null,
                orderDate,
                normalized.expected_delivery || null,
                this.safeStringify(normalized.raw_payload || intakeRequest),
                this.safeStringify(normalized.metadata || {})
            ]);

            const intakeId = orderResult.lastID;
            const itemsSummary = [];

            for (const item of normalized.items) {
                const quantityOrdered = this.toInteger(item.stock?.quantity, 0);
                const unitCost = this.toNumber(item.stock?.unit_cost, null);
                const location = item.stock?.location || 'receiving';
                const grapeVarieties = this.normalizeGrapeVarieties(item.wine?.grape_varieties);

                await this.db.run(`
                    INSERT INTO InventoryIntakeItems (
                        intake_id, external_reference, wine_name, producer, region, country,
                        wine_type, grape_varieties, vintage_year, quantity_ordered,
                        unit_cost, location, status, notes, wine_payload, vintage_payload, stock_payload
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ORDERED', ?, ?, ?, ?)
                `, [
                    intakeId,
                    item.external_reference || null,
                    item.wine?.name || 'Unknown Wine',
                    item.wine?.producer || 'Unknown Producer',
                    item.wine?.region || 'Unknown Region',
                    item.wine?.country || 'Unknown',
                    item.wine?.wine_type || 'Red',
                    JSON.stringify(grapeVarieties),
                    this.toInteger(item.vintage?.year, null),
                    quantityOrdered,
                    unitCost,
                    location,
                    item.stock?.notes || null,
                    this.safeStringify(item.wine || {}),
                    this.safeStringify(item.vintage || {}),
                    this.safeStringify(item.stock || {})
                ]);

                itemsSummary.push({
                    external_reference: item.external_reference || null,
                    wine_name: item.wine?.name || 'Unknown Wine',
                    producer: item.wine?.producer || 'Unknown Producer',
                    vintage_year: this.toInteger(item.vintage?.year, null),
                    quantity_ordered: quantityOrdered,
                    unit_cost: unitCost,
                    location
                });
            }

            const outstandingQuantity = itemsSummary.reduce((sum, item) => sum + (item.quantity_ordered || 0), 0);

            return {
                success: true,
                intake_id: intakeId,
                status: 'ORDERED',
                order_reference: normalized.reference || null,
                source_type: normalized.source_type,
                supplier: normalized.supplier || {},
                total_items: itemsSummary.length,
                outstanding_quantity: outstandingQuantity,
                items: itemsSummary
            };
        } catch (error) {
            throw new Error(`Failed to create inventory intake: ${error.message}`);
        }
    }

    /**
     * Receive bottles against an intake order and move them into stock
     */
    async receiveInventoryIntake(intakeId, receipts = [], options = {}) {
        try {
            if (!intakeId) {
                throw new Error('intakeId is required to receive inventory');
            }

            if (!Array.isArray(receipts) || receipts.length === 0) {
                throw new Error('Receipts array is required to record received bottles');
            }

            const order = await this.db.get(`
                SELECT * FROM InventoryIntakeOrders WHERE id = ?
            `, [intakeId]);

            if (!order) {
                throw new Error(`Inventory intake order ${intakeId} not found`);
            }

            const items = await this.db.all(`
                SELECT * FROM InventoryIntakeItems WHERE intake_id = ?
            `, [intakeId]);

            if (!items.length) {
                throw new Error('No items registered for this intake order');
            }

            const receiptSummaries = [];

            for (const receipt of receipts) {
                const item = this.matchIntakeItem(items, receipt);
                if (!item) {
                    throw new Error('Unable to match receipt to an intake line item');
                }

                const remaining = item.quantity_ordered - item.quantity_received;
                if (remaining <= 0) {
                    receiptSummaries.push({
                        item_id: item.id,
                        wine_name: item.wine_name,
                        status: item.status,
                        message: 'Item already fully received'
                    });
                    continue;
                }

                const quantityToReceive = Math.min(
                    this.toInteger(receipt.quantity, remaining) || remaining,
                    remaining
                );

                if (quantityToReceive <= 0) {
                    throw new Error('Receipt quantity must be greater than zero');
                }

                const winePayload = this.safeParseJSON(item.wine_payload, {
                    name: item.wine_name,
                    producer: item.producer,
                    region: item.region,
                    country: item.country,
                    wine_type: item.wine_type,
                    grape_varieties: this.safeParseJSON(item.grape_varieties, [])
                });

                const vintagePayload = this.safeParseJSON(item.vintage_payload, {
                    year: item.vintage_year
                });

                const stockPayload = this.safeParseJSON(item.stock_payload, {});

                const wineData = {
                    name: winePayload.name || item.wine_name,
                    producer: winePayload.producer || item.producer,
                    region: winePayload.region || item.region,
                    country: winePayload.country || item.country || 'Unknown',
                    wine_type: winePayload.wine_type || item.wine_type || 'Red',
                    grape_varieties: this.normalizeGrapeVarieties(winePayload.grape_varieties),
                    alcohol_content: winePayload.alcohol_content || null,
                    style: winePayload.style || null,
                    tasting_notes: winePayload.tasting_notes || null,
                    food_pairings: winePayload.food_pairings || null,
                    serving_temp_min: winePayload.serving_temp_min || null,
                    serving_temp_max: winePayload.serving_temp_max || null
                };

                const vintageData = {
                    year: this.toInteger(receipt.year || vintagePayload.year || item.vintage_year, null),
                    harvest_date: vintagePayload.harvest_date || null,
                    bottling_date: vintagePayload.bottling_date || null,
                    release_date: vintagePayload.release_date || null,
                    peak_drinking_start: vintagePayload.peak_drinking_start || null,
                    peak_drinking_end: vintagePayload.peak_drinking_end || null,
                    quality_score: vintagePayload.quality_score || null,
                    weather_score: vintagePayload.weather_score || null,
                    critic_score: vintagePayload.critic_score || null,
                    production_notes: vintagePayload.production_notes || null
                };

                const costPerBottle = this.toNumber(
                    receipt.unit_cost ?? receipt.cost_per_bottle ?? stockPayload.unit_cost ?? item.unit_cost,
                    0
                );

                const notesFragments = [stockPayload.notes, receipt.notes, options.notes]
                    .filter(Boolean)
                    .join(' | ') || null;

                const stockData = {
                    location: receipt.location || stockPayload.location || item.location || 'main-cellar',
                    quantity: quantityToReceive,
                    cost_per_bottle: costPerBottle,
                    unit_cost: costPerBottle,
                    reference_id: receipt.reference_id || order.reference || stockPayload.reference_id || null,
                    notes: notesFragments,
                    storage_conditions: stockPayload.storage_conditions || null,
                    created_by: receipt.created_by || options.created_by || 'Inventory Intake'
                };

                const addition = await this.addWineToInventory(wineData, vintageData, stockData);

                const updatedQuantity = item.quantity_received + quantityToReceive;
                const newStatus = updatedQuantity >= item.quantity_ordered ? 'RECEIVED' : 'PARTIAL';

                await this.db.run(`
                    UPDATE InventoryIntakeItems
                    SET quantity_received = ?, status = ?, updated_at = CURRENT_TIMESTAMP,
                        wine_id = COALESCE(wine_id, ?), vintage_id = COALESCE(vintage_id, ?)
                    WHERE id = ?
                `, [
                    updatedQuantity,
                    newStatus,
                    addition.wine?.id || null,
                    addition.vintage?.id || null,
                    item.id
                ]);

                // Ensure in-memory item reflects the latest totals so subsequent
                // receipts within the same request accumulate correctly.
                item.quantity_received = updatedQuantity;
                item.status = newStatus;

                receiptSummaries.push({
                    item_id: item.id,
                    wine_name: item.wine_name,
                    vintage_year: item.vintage_year,
                    received_quantity: quantityToReceive,
                    status: newStatus,
                    remaining: Math.max(item.quantity_ordered - updatedQuantity, 0)
                });
            }

            const updatedItems = await this.db.all(`
                SELECT quantity_ordered, quantity_received
                FROM InventoryIntakeItems
                WHERE intake_id = ?
            `, [intakeId]);

            const outstandingBottles = updatedItems.reduce(
                (sum, row) => sum + Math.max(row.quantity_ordered - row.quantity_received, 0),
                0
            );

            const allReceived = updatedItems.every(row => row.quantity_received >= row.quantity_ordered);
            const anyReceived = updatedItems.some(row => row.quantity_received > 0);

            const orderStatus = allReceived ? 'RECEIVED' : (anyReceived ? 'PARTIALLY_RECEIVED' : 'ORDERED');

            await this.db.run(`
                UPDATE InventoryIntakeOrders
                SET status = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [orderStatus, intakeId]);

            return {
                success: true,
                intake_id: intakeId,
                status: orderStatus,
                outstanding_bottles: outstandingBottles,
                all_received: allReceived,
                receipts: receiptSummaries
            };
        } catch (error) {
            throw new Error(`Failed to receive inventory intake: ${error.message}`);
        }
    }

    /**
     * Get intake order status with outstanding quantity verification
     */
    async getInventoryIntakeStatus(intakeId) {
        try {
            if (!intakeId) {
                throw new Error('intakeId is required');
            }

            const order = await this.db.get(`
                SELECT * FROM InventoryIntakeOrders WHERE id = ?
            `, [intakeId]);

            if (!order) {
                throw new Error(`Inventory intake order ${intakeId} not found`);
            }

            const items = await this.db.all(`
                SELECT * FROM InventoryIntakeItems WHERE intake_id = ? ORDER BY id
            `, [intakeId]);

            const itemSummaries = items.map(item => {
                const outstanding = Math.max(item.quantity_ordered - item.quantity_received, 0);
                return {
                    item_id: item.id,
                    wine_name: item.wine_name,
                    producer: item.producer,
                    vintage_year: item.vintage_year,
                    quantity_ordered: item.quantity_ordered,
                    quantity_received: item.quantity_received,
                    outstanding_quantity: outstanding,
                    status: item.status,
                    location: item.location,
                    external_reference: item.external_reference
                };
            });

            const outstandingBottles = itemSummaries.reduce((sum, item) => sum + item.outstanding_quantity, 0);
            const allReceived = outstandingBottles === 0;

            return {
                success: true,
                intake_id: intakeId,
                supplier: {
                    id: order.supplier_id,
                    name: order.supplier_name
                },
                reference: order.reference,
                status: order.status,
                source_type: order.source_type,
                order_date: order.order_date,
                expected_delivery: order.expected_delivery,
                outstanding_bottles: outstandingBottles,
                all_received,
                items: itemSummaries
            };
        } catch (error) {
            throw new Error(`Failed to retrieve intake status: ${error.message}`);
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

    matchIntakeItem(items = [], receipt = {}) {
        if (!items.length) {
            return null;
        }

        const outstandingItems = items.filter(item => item.quantity_received < item.quantity_ordered);
        const candidates = outstandingItems.length ? outstandingItems : items;

        if (receipt.item_id || receipt.id) {
            const targetId = receipt.item_id || receipt.id;
            const match = candidates.find(item => item.id === targetId);
            if (match) return match;
        }

        if (receipt.external_reference || receipt.reference) {
            const reference = receipt.external_reference || receipt.reference;
            const match = candidates.find(item => item.external_reference && item.external_reference === reference);
            if (match) return match;
        }

        if (receipt.line || receipt.line_number) {
            const lineNumber = this.toInteger(receipt.line || receipt.line_number, null);
            if (lineNumber !== null) {
                const match = candidates.find(item => {
                    const payload = this.safeParseJSON(item.stock_payload, {});
                    return payload.line === lineNumber;
                });
                if (match) return match;
            }
        }

        if (receipt.wine_name) {
            const targetName = String(receipt.wine_name).toLowerCase().trim();
            const targetYear = this.toInteger(receipt.year || receipt.vintage_year, null);
            const match = candidates.find(item => {
                const sameName = item.wine_name && item.wine_name.toLowerCase() === targetName;
                if (!sameName) return false;
                if (targetYear === null) return true;
                return this.toInteger(item.vintage_year, null) === targetYear;
            });
            if (match) return match;
        }

        return candidates[0] || null;
    }

    normalizeGrapeVarieties(value) {
        if (value === null || value === undefined) {
            return [];
        }

        if (Array.isArray(value)) {
            return value;
        }

        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) {
                return [];
            }

            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                    return parsed;
                }
            } catch (error) {
                // Not JSON formatted, fall back to delimiter split
            }

            return trimmed
                .split(/[,;]+/)
                .map(entry => entry.trim())
                .filter(Boolean);
        }

        return [value].filter(Boolean);
    }

    safeStringify(value) {
        if (value === null || value === undefined) {
            return null;
        }

        if (typeof value === 'string') {
            return value;
        }

        try {
            return JSON.stringify(value);
        } catch (error) {
            return JSON.stringify({ value: String(value), error: error.message });
        }
    }

    safeParseJSON(value, fallback) {
        if (value === null || value === undefined || value === '') {
            return fallback;
        }

        if (typeof value === 'object') {
            return value;
        }

        try {
            return JSON.parse(value);
        } catch (error) {
            return fallback;
        }
    }

    toInteger(value, fallback = 0) {
        if (value === null || value === undefined || value === '') {
            return fallback;
        }

        const intVal = parseInt(value, 10);
        return Number.isNaN(intVal) ? fallback : intVal;
    }

    toNumber(value, fallback = 0) {
        if (value === null || value === undefined || value === '') {
            return fallback;
        }

        const numVal = parseFloat(value);
        return Number.isNaN(numVal) ? fallback : numVal;
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

    async captureLearningConsumption(event) {
        if (!this.learningEngine) {
            return;
        }

        try {
            await this.learningEngine.recordConsumptionEvent({
                vintage_id: event.vintage_id,
                quantity: Math.abs(event.quantity),
                location: event.location,
                event_type: event.event_type,
                metadata: event.metadata || {}
            });
        } catch (error) {
            console.warn('Unable to record learning signal for inventory movement:', error.message);
        }
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

            await this.captureLearningConsumption({
                vintage_id,
                quantity,
                location,
                event_type: 'consume',
                metadata: { notes, created_by }
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

            await this.captureLearningConsumption({
                vintage_id,
                quantity,
                location,
                event_type: 'receive',
                metadata: { reference_id, notes, created_by }
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
