// SommOS API Routes
// Express.js routes for the SommOS yacht wine management system

const express = require('express');
const router = express.Router();
const PairingEngine = require('../core/pairing_engine');
const InventoryManager = require('../core/inventory_manager');
const ProcurementEngine = require('../core/procurement_engine');
const VintageIntelligenceService = require('../core/vintage_intelligence');
const Database = require('../database/connection');

// Initialize engines
const pairingEngine = new PairingEngine();
const inventoryManager = new InventoryManager();
const procurementEngine = new ProcurementEngine();
const vintageIntelligenceService = new VintageIntelligenceService();

// Middleware for error handling
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Middleware for request validation
const validateRequest = (schema) => (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({
            success: false,
            error: error.details[0].message
        });
    }
    next();
};

// ============================================================================
// PAIRING ENDPOINTS
// ============================================================================

// POST /api/pairing/recommend
// Generate wine pairing recommendations
router.post('/pairing/recommend', asyncHandler(async (req, res) => {
    const { dish, context, guestPreferences, options } = req.body;
    
    if (!dish) {
        return res.status(400).json({
            success: false,
            error: 'Dish information is required'
        });
    }

    try {
        const recommendations = await pairingEngine.generatePairings(
            dish, 
            context || {}, 
            guestPreferences || {},
            options || {}
        );

        res.json({
            success: true,
            data: recommendations
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));

// POST /api/pairing/quick
// Quick pairing for immediate service
router.post('/pairing/quick', asyncHandler(async (req, res) => {
    const { dish, context, ownerLikes } = req.body;
    
    try {
        const quickPairings = await pairingEngine.quickPairing(dish, context, ownerLikes);
        
        res.json({
            success: true,
            data: quickPairings
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));

// ============================================================================
// INVENTORY ENDPOINTS
// ============================================================================

// GET /api/inventory/stock
// Get current stock levels
router.get('/inventory/stock', asyncHandler(async (req, res) => {
    const { location, wine_type, region, available_only } = req.query;
    
    try {
        const stock = await inventoryManager.getCurrentStock({
            location,
            wine_type,
            region,
            available_only: available_only === 'true'
        });

        res.json({
            success: true,
            data: stock
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));

// POST /api/inventory/consume
// Record wine consumption
router.post('/inventory/consume', asyncHandler(async (req, res) => {
    const { vintage_id, location, quantity, notes, created_by } = req.body;
    
    if (!vintage_id || !location || !quantity) {
        return res.status(400).json({
            success: false,
            error: 'vintage_id, location, and quantity are required'
        });
    }

    try {
        const result = await inventoryManager.consumeWine(
            vintage_id, 
            location, 
            quantity, 
            notes, 
            created_by
        );

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));

// POST /api/inventory/receive
// Record wine receipt/delivery
router.post('/inventory/receive', asyncHandler(async (req, res) => {
    const { vintage_id, location, quantity, unit_cost, reference_id, notes, created_by } = req.body;
    
    if (!vintage_id || !location || !quantity) {
        return res.status(400).json({
            success: false,
            error: 'vintage_id, location, and quantity are required'
        });
    }

    try {
        const result = await inventoryManager.receiveWine(
            vintage_id, 
            location, 
            quantity, 
            unit_cost, 
            reference_id, 
            notes, 
            created_by
        );

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));

// POST /api/inventory/move
// Move wine between locations
router.post('/inventory/move', asyncHandler(async (req, res) => {
    const { vintage_id, from_location, to_location, quantity, notes, created_by } = req.body;
    
    if (!vintage_id || !from_location || !to_location || !quantity) {
        return res.status(400).json({
            success: false,
            error: 'vintage_id, from_location, to_location, and quantity are required'
        });
    }

    try {
        const result = await inventoryManager.moveWine(
            vintage_id, 
            from_location, 
            to_location, 
            quantity, 
            notes, 
            created_by
        );

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));

// POST /api/inventory/reserve
// Reserve wine for future service
router.post('/inventory/reserve', asyncHandler(async (req, res) => {
    const { vintage_id, location, quantity, notes, created_by } = req.body;
    
    try {
        const result = await inventoryManager.reserveWine(
            vintage_id, 
            location, 
            quantity, 
            notes, 
            created_by
        );

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));

// GET /api/inventory/ledger/:vintage_id
// Get transaction history for a vintage
router.get('/inventory/ledger/:vintage_id', asyncHandler(async (req, res) => {
    const { vintage_id } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    try {
        const ledger = await inventoryManager.getLedgerHistory(
            vintage_id, 
            parseInt(limit), 
            parseInt(offset)
        );

        res.json({
            success: true,
            data: ledger
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));

// ============================================================================
// PROCUREMENT ENDPOINTS
// ============================================================================

// GET /api/procurement/opportunities
// Get procurement opportunities
router.get('/procurement/opportunities', asyncHandler(async (req, res) => {
    const { region, wine_type, max_price, min_score } = req.query;
    
    try {
        const opportunities = await procurementEngine.analyzeProcurementOpportunities({
            region,
            wine_type,
            max_price: max_price ? parseFloat(max_price) : undefined,
            min_score: min_score ? parseInt(min_score) : undefined
        });

        res.json({
            success: true,
            data: opportunities
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));

// POST /api/procurement/analyze
// Analyze specific procurement decision
router.post('/procurement/analyze', asyncHandler(async (req, res) => {
    const { vintage_id, supplier_id, quantity, context } = req.body;
    
    if (!vintage_id || !supplier_id) {
        return res.status(400).json({
            success: false,
            error: 'vintage_id and supplier_id are required'
        });
    }

    try {
        const analysis = await procurementEngine.analyzePurchaseDecision(
            vintage_id, 
            supplier_id, 
            quantity || 12, 
            context || {}
        );

        res.json({
            success: true,
            data: analysis
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));

// POST /api/procurement/order
// Generate purchase order
router.post('/procurement/order', asyncHandler(async (req, res) => {
    const { items, supplier_id, delivery_date, notes } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Items array is required'
        });
    }

    try {
        const order = await procurementEngine.generatePurchaseOrder(
            items, 
            supplier_id, 
            delivery_date, 
            notes
        );

        res.json({
            success: true,
            data: order
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));

// ============================================================================
// WINE CATALOG ENDPOINTS
// ============================================================================

// GET /api/wines
// Get wine catalog
router.get('/wines', asyncHandler(async (req, res) => {
    const { region, wine_type, producer, search, limit = 50, offset = 0 } = req.query;
    
    try {
        const db = Database.getInstance();
        let query = `
            SELECT w.*, v.year, v.quality_score, v.peak_drinking_start, v.peak_drinking_end,
                   COALESCE(SUM(s.quantity), 0) as total_stock
            FROM Wines w
            LEFT JOIN Vintages v ON w.id = v.wine_id
            LEFT JOIN Stock s ON v.id = s.vintage_id
            WHERE 1=1
        `;
        
        const params = [];
        
        if (region) {
            query += ' AND w.region LIKE ?';
            params.push(`%${region}%`);
        }
        
        if (wine_type) {
            query += ' AND w.wine_type = ?';
            params.push(wine_type);
        }
        
        if (producer) {
            query += ' AND w.producer LIKE ?';
            params.push(`%${producer}%`);
        }
        
        if (search) {
            query += ' AND (w.name LIKE ? OR w.producer LIKE ? OR w.region LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        
        query += ' GROUP BY w.id, v.id ORDER BY w.name LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const wines = await db.all(query, params);

        res.json({
            success: true,
            data: wines
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));

// POST /api/wines
// Add new wine to inventory with vintage intelligence
router.post('/wines', asyncHandler(async (req, res) => {
    const { wine, vintage, stock } = req.body;
    
    if (!wine || !vintage || !stock) {
        return res.status(400).json({
            success: false,
            error: 'Wine, vintage, and stock information are required'
        });
    }
    
    try {
        const result = await inventoryManager.addWineToInventory(wine, vintage, stock);
        
        res.status(201).json({
            success: true,
            data: result,
            message: 'Wine added to inventory with vintage intelligence analysis'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));

// GET /api/wines/:id
// Get specific wine details
router.get('/wines/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    try {
        const db = Database.getInstance();
        
        // Get wine details
        const wine = await db.get('SELECT * FROM Wines WHERE id = ?', [id]);
        if (!wine) {
            return res.status(404).json({
                success: false,
                error: 'Wine not found'
            });
        }
        
        // Get vintages
        const vintages = await db.all(`
            SELECT v.*, COALESCE(SUM(s.quantity), 0) as total_stock
            FROM Vintages v
            LEFT JOIN Stock s ON v.id = s.vintage_id
            WHERE v.wine_id = ?
            GROUP BY v.id
            ORDER BY v.year DESC
        `, [id]);
        
        // Get aliases
        const aliases = await db.all('SELECT * FROM Aliases WHERE wine_id = ?', [id]);
        
        res.json({
            success: true,
            data: {
                ...wine,
                vintages,
                aliases
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));

// ============================================================================
// VINTAGE INTELLIGENCE ENDPOINTS
// ============================================================================

// GET /api/vintage/analysis/:wine_id
// Get vintage analysis for specific wine
router.get('/vintage/analysis/:wine_id', asyncHandler(async (req, res) => {
    const { wine_id } = req.params;
    
    try {
        const db = Database.getInstance();
        
        // Get wine and vintage details
        const wine = await db.get(`
            SELECT w.*, v.* 
            FROM Wines w
            JOIN Vintages v ON w.id = v.wine_id
            WHERE w.id = ?
        `, [wine_id]);
        
        if (!wine) {
            return res.status(404).json({
                success: false,
                error: 'Wine not found'
            });
        }
        
        // Get weather context for this wine
        const weatherAnalysis = await vintageIntelligenceService.getWeatherContextForPairing(wine);
        
        // Parse production notes if available
        let vintageSummary = null;
        let procurementRec = null;
        
        if (wine.production_notes) {
            try {
                // Check if it's valid JSON first
                if (typeof wine.production_notes === 'string' && wine.production_notes.trim().startsWith('{')) {
                    const notes = JSON.parse(wine.production_notes);
                    vintageSummary = notes.vintageSummary;
                    procurementRec = notes.procurementRec;
                } else {
                    // Treat as plain text
                    vintageSummary = wine.production_notes;
                }
            } catch (parseError) {
                // Fallback to treating as plain text
                vintageSummary = wine.production_notes;
                console.warn('Production notes treated as plain text:', parseError.message);
            }
        }
        
        res.json({
            success: true,
            data: {
                wine: {
                    name: wine.name,
                    producer: wine.producer,
                    region: wine.region,
                    year: wine.year,
                    wine_type: wine.wine_type
                },
                weatherAnalysis,
                vintageSummary,
                procurementRec,
                qualityScore: wine.quality_score,
                weatherScore: wine.weather_score
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));

// POST /api/vintage/enrich
// Manually trigger vintage enrichment for a specific wine
router.post('/vintage/enrich', asyncHandler(async (req, res) => {
    const { wine_id } = req.body;
    
    if (!wine_id) {
        return res.status(400).json({
            success: false,
            error: 'wine_id is required'
        });
    }
    
    try {
        const db = Database.getInstance();
        
        // Get wine details
        const wine = await db.get(`
            SELECT w.*, v.* 
            FROM Wines w
            LEFT JOIN Vintages v ON w.id = v.wine_id
            WHERE w.id = ?
        `, [wine_id]);
        
        if (!wine) {
            return res.status(404).json({
                success: false,
                error: 'Wine not found'
            });
        }
        
        // Enrich the wine data
        const enrichedData = await vintageIntelligenceService.enrichWineData(wine);
        
        res.json({
            success: true,
            data: enrichedData,
            message: 'Wine enriched with vintage intelligence'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));

// GET /api/vintage/procurement-recommendations
// Get procurement recommendations for current inventory
router.get('/vintage/procurement-recommendations', asyncHandler(async (req, res) => {
    try {
        const recommendations = await vintageIntelligenceService.getInventoryProcurementRecommendations();
        
        res.json({
            success: true,
            data: recommendations
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));

// POST /api/vintage/batch-enrich
// Batch enrich multiple wines with vintage intelligence
router.post('/vintage/batch-enrich', asyncHandler(async (req, res) => {
    const { filters = {}, limit = 50 } = req.body;
    
    try {
        const db = Database.getInstance();
        
        // Build query with filters
        let query = `
            SELECT w.*, v.* 
            FROM Wines w
            LEFT JOIN Vintages v ON w.id = v.wine_id
            WHERE 1=1
        `;
        
        const params = [];
        
        if (filters.region) {
            query += ' AND w.region LIKE ?';
            params.push(`%${filters.region}%`);
        }
        
        if (filters.wine_type) {
            query += ' AND w.wine_type = ?';
            params.push(filters.wine_type);
        }
        
        if (filters.year_from) {
            query += ' AND v.year >= ?';
            params.push(filters.year_from);
        }
        
        if (filters.year_to) {
            query += ' AND v.year <= ?';
            params.push(filters.year_to);
        }
        
        query += ' ORDER BY w.name LIMIT ?';
        params.push(limit);
        
        const wines = await db.all(query, params);
        
        if (wines.length === 0) {
            return res.json({
                success: true,
                data: [],
                message: 'No wines found matching criteria'
            });
        }
        
        // Process wines in batches
        const results = await vintageIntelligenceService.batchEnrichWines(wines);
        
        res.json({
            success: true,
            data: results,
            message: `Processed ${results.length} wines for vintage intelligence`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));

// GET /api/vintage/pairing-insight
// Get weather-based pairing insights for a wine and dish context
router.post('/vintage/pairing-insight', asyncHandler(async (req, res) => {
    const { wine_id, dish_context } = req.body;
    
    if (!wine_id || !dish_context) {
        return res.status(400).json({
            success: false,
            error: 'wine_id and dish_context are required'
        });
    }
    
    try {
        const db = Database.getInstance();
        
        // Get wine details
        const wine = await db.get(`
            SELECT w.*, v.* 
            FROM Wines w
            LEFT JOIN Vintages v ON w.id = v.wine_id
            WHERE w.id = ?
        `, [wine_id]);
        
        if (!wine) {
            return res.status(404).json({
                success: false,
                error: 'Wine not found'
            });
        }
        
        // Get weather context
        const weatherAnalysis = await vintageIntelligenceService.getWeatherContextForPairing(wine);
        
        // Generate pairing insight
        const insight = vintageIntelligenceService.generateWeatherPairingInsight(weatherAnalysis, dish_context);
        
        res.json({
            success: true,
            data: {
                wine: {
                    name: wine.name,
                    producer: wine.producer,
                    year: wine.year
                },
                weatherAnalysis,
                pairingInsight: insight,
                dishContext: dish_context
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));

// ============================================================================
// SYSTEM ENDPOINTS
// ============================================================================

// GET /api/system/health
// System health check
router.get('/system/health', asyncHandler(async (req, res) => {
    try {
        const db = Database.getInstance();
        
        // Test database connection
        await db.get('SELECT 1');
        
        // Get basic stats
        const stats = await db.all(`
            SELECT 
                (SELECT COUNT(*) FROM Wines) as total_wines,
                (SELECT COUNT(*) FROM Vintages) as total_vintages,
                (SELECT COALESCE(SUM(quantity), 0) FROM Stock) as total_bottles,
                (SELECT COUNT(*) FROM Suppliers WHERE active = 1) as active_suppliers
        `);

        res.json({
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString(),
            data: stats[0]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            status: 'unhealthy',
            error: error.message
        });
    }
}));

// Error handling middleware
router.use((error, req, res, next) => {
    console.error('API Error:', error);
    
    res.status(error.status || 500).json({
        success: false,
        error: error.message || 'Internal server error'
    });
});

module.exports = router;