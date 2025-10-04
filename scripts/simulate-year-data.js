#!/usr/bin/env node

/**
 * SommOS Year-Long Data Simulator
 * 
 * Generates realistic synthetic operational data for a full yacht season (365 days).
 * Simulates guest charters, wine pairings, feedback, consumption, and procurement.
 * 
 * Features:
 * - Deterministic random generation (seed: 42) for reproducibility
 * - Seasonal yacht occupancy patterns
 * - Three guest profiles with distinct preferences
 * - Realistic pairing sessions with multi-aspect feedback
 * - Inventory management: consumption, procurement, restocking
 * - Periodic audits and seasonal bulk orders
 * - Comprehensive reporting and validation
 * 
 * Usage: npm run simulate:year
 * Runtime: 30-90 minutes for full year
 * 
 * Output:
 * - Populated database with learning data
 * - Summary report: data/simulation_report_2024.txt
 * - CSV exports: data/simulation_exports_2024/
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const crypto = require('crypto');

// ============================================================================
// CONFIGURATION
// ============================================================================

const DB_PATH = path.join(__dirname, '../data/sommos.db');
const API_BASE_URL = process.env.API_URL || 'http://localhost:3001/api';
const SIMULATION_START = new Date('2024-01-01');
const SIMULATION_END = new Date('2028-12-31');  // 5-year simulation for better ML training
const RANDOM_SEED = 42;  // Standard seed for reproducibility
const REPORT_DIR = path.join(__dirname, '../data');
const EXPORT_DIR = path.join(__dirname, '../data/simulation_exports_2024');

// Seasonality configuration (occupancy percentages) - IMPROVED v2
const SEASONALITY = {
    winter: { months: [12, 1, 2], occupancy: 0.08 },      // Dec-Feb: Mostly owner (reduced)
    shoulder_spring: { months: [3, 4, 5], occupancy: 0.40 }, // Mar-May
    summer: { months: [6, 7, 8], occupancy: 0.75 },        // Jun-Aug: Peak season (increased)
    shoulder_fall: { months: [9, 10], occupancy: 0.45 },    // Sep-Oct (increased)
    off_season: { months: [11], occupancy: 0.15 }           // Nov: Prep for winter
};

// Procurement thresholds - IMPROVED v2
const STOCK_LOW_THRESHOLD = 8;  // Trigger restock (raised from 5)
const STOCK_CRITICAL_THRESHOLD = 3; // Urgent restock (raised from 2)

// ============================================================================
// SEEDED RANDOM NUMBER GENERATOR
// ============================================================================

class SeededRandom {
    constructor(seed) {
        this.seed = seed;
    }

    // Linear congruential generator
    next() {
        this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
        return this.seed / 0x7fffffff;
    }

    // Random integer between min (inclusive) and max (inclusive)
    int(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }

    // Random float between min and max
    float(min, max) {
        return this.next() * (max - min) + min;
    }

    // Random choice from array
    choice(array) {
        return array[this.int(0, array.length - 1)];
    }

    // Random boolean with probability p
    bool(p = 0.5) {
        return this.next() < p;
    }

    // Shuffle array in-place (Fisher-Yates)
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = this.int(0, i);
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // Normal distribution (Box-Muller transform)
    normal(mean = 0, stdDev = 1) {
        const u1 = this.next();
        const u2 = this.next();
        const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        return z0 * stdDev + mean;
    }
}

// ============================================================================
// GUEST PROFILES
// ============================================================================

const GUEST_PROFILES = {
    owner: {
        id: 'owner',
        name: 'Yacht Owner',
        preferred_types: ['Red', 'Sparkling'],
        preferred_regions: ['Bordeaux', 'Burgundy', 'Champagne'],
        avoided_types: [],
        price_sensitivity: 'low',
        adventurousness: 0.3, // 30% chance to try new things
        rating_bias: 4.5, // Tends to rate highly
        rating_variance: 0.5,
        typical_guest_count: [2, 4],
        occasions: ['dinner', 'celebration', 'casual']
    },
    guest_a: {
        id: 'guest_a',
        name: 'Traditional Guest',
        preferred_types: ['Red', 'White'],
        preferred_regions: ['France', 'Italy'],
        avoided_types: ['Dessert'],
        price_sensitivity: 'medium',
        adventurousness: 0.10, // Conservative (reduced from 0.15)
        rating_bias: 4.0,
        rating_variance: 0.8,
        typical_guest_count: [4, 8],
        occasions: ['dinner', 'lunch', 'cocktail']
    },
    guest_b: {
        id: 'guest_b',
        name: 'Adventurous Guest',
        preferred_types: ['Sparkling', 'White', 'Rosé'],
        preferred_regions: ['Spain', 'Germany', 'Austria', 'New World'],
        avoided_types: [],
        price_sensitivity: 'high',
        adventurousness: 0.7, // Loves trying new wines (increased from 0.6)
        rating_bias: 4.2,
        rating_variance: 1.0,
        typical_guest_count: [6, 12],
        occasions: ['celebration', 'cocktail', 'lunch']
    }
};

// ============================================================================
// DISH MENUS
// ============================================================================

const LUNCH_DISHES = [
    { name: 'Grilled Mediterranean Sea Bass', cuisine: 'Mediterranean', protein: 'fish', intensity: 'light' },
    { name: 'Caesar Salad with Grilled Chicken', cuisine: 'International', protein: 'poultry', intensity: 'light' },
    { name: 'Fresh Tuna Tartare', cuisine: 'Japanese', protein: 'fish', intensity: 'light' },
    { name: 'Caprese Salad with Burrata', cuisine: 'Italian', protein: 'cheese', intensity: 'light' },
    { name: 'Prawn and Avocado Cocktail', cuisine: 'International', protein: 'seafood', intensity: 'medium' },
    { name: 'Lobster Roll', cuisine: 'American', protein: 'seafood', intensity: 'medium' },
    { name: 'Nicoise Salad', cuisine: 'French', protein: 'fish', intensity: 'medium' },
    { name: 'Grilled Octopus with Lemon', cuisine: 'Greek', protein: 'seafood', intensity: 'medium' },
    { name: 'Sushi Platter', cuisine: 'Japanese', protein: 'fish', intensity: 'light' },
    { name: 'Greek Salad with Feta', cuisine: 'Greek', protein: 'cheese', intensity: 'light' },
    { name: 'Linguine with Clams', cuisine: 'Italian', protein: 'seafood', intensity: 'medium' },
    { name: 'Pan-Seared Scallops', cuisine: 'French', protein: 'seafood', intensity: 'medium' },
    { name: 'Chicken Paillard with Arugula', cuisine: 'Italian', protein: 'poultry', intensity: 'light' },
    { name: 'Crab Cakes with Remoulade', cuisine: 'American', protein: 'seafood', intensity: 'medium' },
    { name: 'Smoked Salmon Bagel', cuisine: 'American', protein: 'fish', intensity: 'light' },
    { name: 'Burrata with Heirloom Tomatoes', cuisine: 'Italian', protein: 'cheese', intensity: 'light' },
    { name: 'Grilled Vegetable Antipasti', cuisine: 'Italian', protein: 'vegetable', intensity: 'light' },
    { name: 'Fish Tacos', cuisine: 'Mexican', protein: 'fish', intensity: 'medium' },
    { name: 'Shrimp Scampi', cuisine: 'Italian', protein: 'seafood', intensity: 'medium' },
    { name: 'Cold Poached Salmon', cuisine: 'Scandinavian', protein: 'fish', intensity: 'light' },
    { name: 'Vitello Tonnato', cuisine: 'Italian', protein: 'veal', intensity: 'medium' },
    { name: 'Oysters on the Half Shell', cuisine: 'French', protein: 'seafood', intensity: 'light' },
    { name: 'Gazpacho with Crab', cuisine: 'Spanish', protein: 'seafood', intensity: 'light' },
    { name: 'Poke Bowl', cuisine: 'Hawaiian', protein: 'fish', intensity: 'medium' },
    { name: 'Croque Monsieur', cuisine: 'French', protein: 'pork', intensity: 'medium' },
    { name: 'Margherita Pizza', cuisine: 'Italian', protein: 'cheese', intensity: 'medium' },
    { name: 'Seafood Salad', cuisine: 'Mediterranean', protein: 'seafood', intensity: 'light' },
    { name: 'Quiche Lorraine', cuisine: 'French', protein: 'pork', intensity: 'medium' },
    { name: 'Club Sandwich', cuisine: 'American', protein: 'poultry', intensity: 'medium' },
    { name: 'Pasta Primavera', cuisine: 'Italian', protein: 'vegetable', intensity: 'light' }
];

const DINNER_DISHES = [
    { name: 'Grilled Beef Tenderloin', cuisine: 'French', protein: 'beef', intensity: 'rich' },
    { name: 'Pan-Seared Duck Breast', cuisine: 'French', protein: 'duck', intensity: 'rich' },
    { name: 'Rack of Lamb with Herbs', cuisine: 'Mediterranean', protein: 'lamb', intensity: 'rich' },
    { name: 'Lobster Thermidor', cuisine: 'French', protein: 'seafood', intensity: 'rich' },
    { name: 'Osso Buco', cuisine: 'Italian', protein: 'veal', intensity: 'rich' },
    { name: 'Beef Wellington', cuisine: 'British', protein: 'beef', intensity: 'rich' },
    { name: 'Coq au Vin', cuisine: 'French', protein: 'poultry', intensity: 'rich' },
    { name: 'Risotto with Black Truffle', cuisine: 'Italian', protein: 'truffle', intensity: 'rich' },
    { name: 'Wild Sea Bass en Papillote', cuisine: 'French', protein: 'fish', intensity: 'medium' },
    { name: 'Chateaubriand for Two', cuisine: 'French', protein: 'beef', intensity: 'rich' },
    { name: 'Roasted Turbot with Saffron', cuisine: 'Mediterranean', protein: 'fish', intensity: 'medium' },
    { name: 'Veal Chop Milanese', cuisine: 'Italian', protein: 'veal', intensity: 'rich' },
    { name: 'Braised Short Ribs', cuisine: 'American', protein: 'beef', intensity: 'rich' },
    { name: 'Whole Dover Sole Meunière', cuisine: 'French', protein: 'fish', intensity: 'medium' },
    { name: 'Venison Medallions', cuisine: 'French', protein: 'game', intensity: 'rich' },
    { name: 'Bouillabaisse', cuisine: 'French', protein: 'seafood', intensity: 'rich' },
    { name: 'Bistecca alla Fiorentina', cuisine: 'Italian', protein: 'beef', intensity: 'rich' },
    { name: 'Roast Chicken with Truffles', cuisine: 'French', protein: 'poultry', intensity: 'rich' },
    { name: 'Porcini Mushroom Risotto', cuisine: 'Italian', protein: 'mushroom', intensity: 'medium' },
    { name: 'Grilled Wagyu Steak', cuisine: 'Japanese', protein: 'beef', intensity: 'rich' },
    { name: 'Cassoulet', cuisine: 'French', protein: 'pork', intensity: 'rich' },
    { name: 'Whole Roasted Branzino', cuisine: 'Mediterranean', protein: 'fish', intensity: 'medium' },
    { name: 'Lamb Tagine', cuisine: 'Moroccan', protein: 'lamb', intensity: 'rich' },
    { name: 'Pork Tenderloin with Apples', cuisine: 'French', protein: 'pork', intensity: 'medium' },
    { name: 'Seared Tuna with Sesame Crust', cuisine: 'Asian', protein: 'fish', intensity: 'medium' },
    { name: 'Veal Saltimbocca', cuisine: 'Italian', protein: 'veal', intensity: 'medium' },
    { name: 'Roasted Rack of Venison', cuisine: 'French', protein: 'game', intensity: 'rich' },
    { name: 'Pan-Roasted Halibut', cuisine: 'French', protein: 'fish', intensity: 'medium' },
    { name: 'Braised Lamb Shanks', cuisine: 'Mediterranean', protein: 'lamb', intensity: 'rich' },
    { name: 'Wild Mushroom Tart', cuisine: 'French', protein: 'mushroom', intensity: 'medium' },
    { name: 'Roasted Quail with Figs', cuisine: 'French', protein: 'game', intensity: 'medium' },
    { name: 'Steak au Poivre', cuisine: 'French', protein: 'beef', intensity: 'rich' },
    { name: 'Salmon en Croute', cuisine: 'French', protein: 'fish', intensity: 'medium' },
    { name: 'Tournedos Rossini', cuisine: 'French', protein: 'beef', intensity: 'rich' },
    { name: 'Pheasant with Chestnuts', cuisine: 'French', protein: 'game', intensity: 'rich' }
];

// ============================================================================
// DATABASE HELPERS
// ============================================================================

function openDatabase() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) reject(err);
            else resolve(db);
        });
    });
}

function closeDatabase(db) {
    return new Promise((resolve, reject) => {
        db.close((err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function dbRun(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes, lastID: this.lastID });
        });
    });
}

function dbGet(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAll(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// ============================================================================
// API HELPERS
// ============================================================================

async function callAPI(method, endpoint, data = null, retries = 3) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const config = {
                method,
                url,
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json',
                    // Auth disabled via SOMMOS_AUTH_DISABLED=true env var
                }
            };
            
            if (data) {
                config.data = data;
            }
            
            const response = await axios(config);
            return response.data;
        } catch (error) {
            if (attempt === retries) {
                console.error(`API call failed after ${retries} attempts: ${method} ${endpoint}`);
                console.error(error.message);
                throw error;
            }
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getSeason(date) {
    const month = date.getMonth() + 1; // 0-indexed to 1-indexed
    
    for (const [season, config] of Object.entries(SEASONALITY)) {
        if (config.months.includes(month)) {
            return { name: season, ...config };
        }
    }
    
    return { name: 'unknown', occupancy: 0.3 };
}

function getSeasonName(date) {
    const month = date.getMonth() + 1;
    if ([3, 4, 5].includes(month)) return 'spring';
    if ([6, 7, 8].includes(month)) return 'summer';
    if ([9, 10, 11].includes(month)) return 'autumn';
    return 'winter';
}

function getTimeOfDay(hour) {
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 21) return 'evening';
    return 'night';
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function daysBetween(date1, date2) {
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.round(Math.abs((date1 - date2) / oneDay));
}

// ============================================================================
// SIMULATION STATE
// ============================================================================

const simulationState = {
    currentDate: null,
    dayNumber: 0,
    rng: null,
    db: null,
    stats: {
        totalDays: 0,
        guestDays: 0,
        pairingSessions: 0,
        feedbackRecorded: 0,
        bottlesConsumed: 0,
        procurementOrders: 0,
        deliveriesReceived: 0,
        auditsPerformed: 0,
        byGuestType: {
            owner: 0,
            guest_a: 0,
            guest_b: 0
        },
        byWineType: {},
        bySeason: {}
    },
    pendingDeliveries: [],
    wineIdCache: null,
    supplierCache: null
};

// ============================================================================
// INITIALIZATION FUNCTIONS
// ============================================================================

async function initializeSuppliers(db) {
    console.log('  🏢 Initializing suppliers...');
    
    const suppliers = [
        {
            name: 'Global Wines Co.',
            contact_person: 'Jean-Pierre Dubois',
            email: 'jp@globalwines.com',
            phone: '+33 1 42 96 00 00',
            specialties: JSON.stringify(['French', 'Italian', 'Bordeaux', 'Burgundy']),
            rating: 5,
            delivery_days_min: 5,
            delivery_days_max: 7,
            active: 1
        },
        {
            name: 'Local Vineyard Distributor',
            contact_person: 'Maria Garcia',
            email: 'maria@localvineyard.es',
            phone: '+34 93 412 76 98',
            specialties: JSON.stringify(['Spanish', 'Regional', 'Rioja', 'Priorat']),
            rating: 4,
            delivery_days_min: 3,
            delivery_days_max: 5,
            active: 1
        },
        {
            name: 'Premium Cellar Direct',
            contact_person: 'Charles Montgomery',
            email: 'charles@premiumcellar.com',
            phone: '+44 20 7123 4567',
            specialties: JSON.stringify(['Luxury French', 'Champagne', 'First Growth']),
            rating: 5,
            delivery_days_min: 7,
            delivery_days_max: 10,
            active: 1
        },
        {
            name: 'Continental Importers',
            contact_person: 'Klaus Schmidt',
            email: 'k.schmidt@continental.de',
            phone: '+49 89 123 456',
            specialties: JSON.stringify(['German', 'Austrian', 'Riesling']),
            rating: 3,
            delivery_days_min: 10,
            delivery_days_max: 14,
            active: 1
        },
        {
            name: 'Yacht Provisions Ltd',
            contact_person: 'Captain Sarah Wilson',
            email: 'sarah@yachtprovisions.com',
            phone: '+377 93 30 12 34',
            specialties: JSON.stringify(['All Regions', 'Express Service']),
            rating: 4,
            delivery_days_min: 4,
            delivery_days_max: 6,
            active: 1
        }
    ];
    
    for (const supplier of suppliers) {
        await dbRun(db, `
            INSERT OR IGNORE INTO Suppliers (
                name, contact_person, email, phone, specialties, 
                rating, active, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s','now'))
        `, [
            supplier.name, supplier.contact_person, supplier.email, 
            supplier.phone, supplier.specialties, supplier.rating, supplier.active
        ]);
    }
    
    console.log(`  ✅ Initialized ${suppliers.length} suppliers`);
}

async function loadSuppliers(db) {
    const suppliers = await dbAll(db, 'SELECT * FROM Suppliers WHERE active = 1');
    
    // Parse specialties and add delivery info
    return suppliers.map(s => ({
        ...s,
        specialties: JSON.parse(s.specialties || '[]'),
        delivery_days_min: [5, 3, 7, 10, 4][suppliers.indexOf(s)] || 5,
        delivery_days_max: [7, 5, 10, 14, 6][suppliers.indexOf(s)] || 7
    }));
}

async function loadWineIds(db) {
    const wines = await dbAll(db, `
        SELECT w.id, w.name, w.producer, w.wine_type, w.region, v.id as vintage_id, v.year
        FROM Wines w
        JOIN Vintages v ON w.id = v.wine_id
        WHERE EXISTS (
            SELECT 1 FROM Stock s WHERE s.vintage_id = v.id AND s.quantity > 0
        )
        ORDER BY w.id, v.year DESC
    `);
    
    return wines;
}

// ============================================================================
// PROCUREMENT SIMULATION
// ============================================================================

async function handleProcurement(db, rng, date) {
    // Check stock levels and create orders if needed
    const lowStockItems = await dbAll(db, `
        SELECT s.id, s.vintage_id, s.location, s.quantity,
               w.name, w.producer, w.wine_type, w.region, v.year
        FROM Stock s
        JOIN Vintages v ON s.vintage_id = v.id
        JOIN Wines w ON v.wine_id = w.id
        WHERE s.quantity < ?
    `, [STOCK_LOW_THRESHOLD]);
    
    if (lowStockItems.length === 0) {
        return { ordersCreated: 0, itemsOrdered: 0 };
    }
    
    // Group by wine type for bulk ordering
    const orderItems = [];
    for (const item of lowStockItems) {
        const quantityNeeded = Math.max(12, Math.ceil((STOCK_LOW_THRESHOLD - item.quantity) * 1.5));
        orderItems.push({
            ...item,
            quantity_ordered: quantityNeeded
        });
    }
    
    // Select supplier (prefer high-rated with reasonable delivery)
    const supplier = simulationState.supplierCache[
        rng.int(0, Math.min(2, simulationState.supplierCache.length - 1))
    ];
    
    // Create intake order
    const deliveryDays = rng.int(supplier.delivery_days_min, supplier.delivery_days_max);
    const expectedDelivery = addDays(date, deliveryDays);
    
    const orderResult = await dbRun(db, `
        INSERT INTO InventoryIntakeOrders (
            supplier_id, supplier_name, source_type, reference,
            order_date, expected_delivery, status, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s','now'))
    `, [
        supplier.id,
        supplier.name,
        'manual',
        `RESTOCK-${formatDate(date)}-${rng.int(1000, 9999)}`,
        formatDate(date),
        formatDate(expectedDelivery),
        'ORDERED'
    ]);
    
    const intakeId = orderResult.lastID;
    
    // Add items to order
    for (const item of orderItems) {
        await dbRun(db, `
            INSERT INTO InventoryIntakeItems (
                intake_id, wine_name, producer, region, wine_type,
                vintage_year, quantity_ordered, location, status,
                wine_id, vintage_id, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s','now'))
        `, [
            intakeId, item.name, item.producer, item.region, item.wine_type,
            item.year, item.quantity_ordered, item.location, 'ORDERED',
            null, item.vintage_id
        ]);
    }
    
    // Track for delivery processing
    simulationState.pendingDeliveries.push({
        intakeId,
        expectedDate: expectedDelivery,
        items: orderItems
    });
    
    simulationState.stats.procurementOrders++;
    
    return { ordersCreated: 1, itemsOrdered: orderItems.length };
}

async function processDeliveries(db, date) {
    const dueDeliveries = simulationState.pendingDeliveries.filter(d => 
        d.expectedDate <= date
    );
    
    if (dueDeliveries.length === 0) {
        return { deliveriesProcessed: 0, itemsReceived: 0 };
    }
    
    let totalItems = 0;
    
    for (const delivery of dueDeliveries) {
        // Update order status
        await dbRun(db, `
            UPDATE InventoryIntakeOrders 
            SET status = 'RECEIVED', updated_at = strftime('%s','now')
            WHERE id = ?
        `, [delivery.intakeId]);
        
        // Get items
        const items = await dbAll(db, `
            SELECT * FROM InventoryIntakeItems WHERE intake_id = ?
        `, [delivery.intakeId]);
        
        for (const item of items) {
            // Update item status
            await dbRun(db, `
                UPDATE InventoryIntakeItems
                SET quantity_received = quantity_ordered, status = 'RECEIVED',
                    updated_at = strftime('%s','now')
                WHERE id = ?
            `, [item.id]);
            
            // Update Stock
            await dbRun(db, `
                UPDATE Stock
                SET quantity = quantity + ?, updated_at = strftime('%s','now')
                WHERE vintage_id = ? AND location = ?
            `, [item.quantity_ordered, item.vintage_id, item.location]);
            
            // Create Ledger entry
            await dbRun(db, `
                INSERT INTO Ledger (
                    vintage_id, location, transaction_type, quantity,
                    reference_id, notes, created_by, created_at
                ) VALUES (?, ?, 'IN', ?, ?, ?, ?, ?)
            `, [
                item.vintage_id, item.location, item.quantity_ordered,
                `intake-${delivery.intakeId}`, 
                `Delivery from order #${delivery.intakeId}`,
                'simulator', formatDate(date)
            ]);
            
            // Create consumption event
            await dbRun(db, `
                INSERT INTO LearningConsumptionEvents (
                    vintage_id, wine_type, quantity, location,
                    event_type, metadata, created_at
                ) VALUES (?, ?, ?, ?, 'receive', ?, ?)
            `, [
                item.vintage_id, item.wine_type, item.quantity_ordered,
                item.location, JSON.stringify({ order_id: delivery.intakeId }),
                formatDate(date)
            ]);
            
            totalItems++;
        }
        
        simulationState.stats.deliveriesReceived++;
    }
    
    // Remove processed deliveries
    simulationState.pendingDeliveries = simulationState.pendingDeliveries.filter(d => 
        d.expectedDate > date
    );
    
    return { deliveriesProcessed: dueDeliveries.length, itemsReceived: totalItems };
}

// ============================================================================
// PAIRING AND FEEDBACK SIMULATION
// ============================================================================

async function handlePairingSession(db, rng, date, guestProfile, mealType) {
    // Select dish
    const dishPool = mealType === 'lunch' ? LUNCH_DISHES : DINNER_DISHES;
    const dish = rng.choice(dishPool);
    
    // Generate context
    const guestCount = rng.int(guestProfile.typical_guest_count[0], guestProfile.typical_guest_count[1]);
    const hour = mealType === 'lunch' ? rng.int(12, 14) : rng.int(19, 21);
    const occasion = rng.choice(guestProfile.occasions);
    
    const context = {
        occasion,
        guest_count: guestCount,
        time_of_day: getTimeOfDay(hour),
        season: getSeasonName(date),
        weather_context: rng.bool(0.7) ? 'outdoor' : 'indoor',
        service_date: formatDate(date)
    };
    
    const preferences = {
        preferred_types: guestProfile.preferred_types,
        preferred_regions: guestProfile.preferred_regions,
        avoided_types: guestProfile.avoided_types
    };
    
    // Record session directly in DB (hybrid approach)
    const sessionResult = await dbRun(db, `
        INSERT INTO LearningPairingSessions (
            dish_description, dish_context, preferences, generated_by_ai, created_at
        ) VALUES (?, ?, ?, 1, ?)
    `, [
        dish.name,
        JSON.stringify({ ...dish, ...context }),
        JSON.stringify(preferences),
        formatDate(date)
    ]);
    
    const sessionId = sessionResult.lastID;
    
    // Generate recommendations (3-5 wines)
    const numRecs = rng.int(3, 5);
    const recommendations = [];
    const availableWines = simulationState.wineIdCache.filter(w => {
        // Filter based on guest preferences
        if (guestProfile.avoided_types.includes(w.wine_type)) return false;
        const stockCheck = dbGet(db, 
            'SELECT quantity FROM Stock WHERE vintage_id = ? AND quantity > 0', 
            [w.vintage_id]
        );
        return stockCheck;
    });
    
    // Select wines
    const selectedWines = [];
    for (let i = 0; i < Math.min(numRecs, availableWines.length); i++) {
        let wine;
        if (i === 0 && rng.bool(0.7)) {
            // First rec: favor preferred types/regions
            const preferred = availableWines.filter(w => 
                guestProfile.preferred_types.includes(w.wine_type) ||
                guestProfile.preferred_regions.some(r => w.region.includes(r))
            );
            wine = rng.choice(preferred.length > 0 ? preferred : availableWines);
        } else {
            wine = rng.choice(availableWines);
        }
        
        if (!selectedWines.find(w => w.vintage_id === wine.vintage_id)) {
            selectedWines.push(wine);
        }
    }
    
    // Insert recommendations
    for (let i = 0; i < selectedWines.length; i++) {
        const wine = selectedWines[i];
        const recResult = await dbRun(db, `
            INSERT INTO LearningPairingRecommendations (
                session_id, wine_id, wine_name, producer, wine_type,
                region, score_breakdown, ai_enhanced, ranking, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        `, [
            sessionId, wine.id, wine.name, wine.producer, wine.wine_type,
            wine.region, JSON.stringify({ total: 0.8 - i * 0.1 }),
            i + 1, formatDate(date)
        ]);
        
        recommendations.push({ ...wine, recommendation_id: recResult.lastID, ranking: i + 1 });
    }
    
    // Simulate guest selection
    if (recommendations.length === 0) {
        console.warn(`  ⚠️  No wine recommendations available - skipping session`);
        return null;
    }
    
    let selectedWine;
    if (rng.bool(0.70)) {
        // Top choice (70%)
        selectedWine = recommendations[0];
    } else if (rng.bool(0.67) && recommendations.length > 1) {
        // Second choice exploration (20% of remaining)
        selectedWine = recommendations[1];
    } else {
        // Random override (10%)
        selectedWine = rng.choice(recommendations);
    }
    
    // Generate feedback
    const baseRating = Math.max(1, Math.min(5, Math.round(
        rng.normal(guestProfile.rating_bias, guestProfile.rating_variance)
    )));
    
    // Generate aspect ratings (correlated with overall)
    const aspectRatings = {
        overall_rating: baseRating,
        flavor_harmony_rating: Math.max(1, Math.min(5, baseRating + rng.int(-1, 1))),
        texture_balance_rating: Math.max(1, Math.min(5, baseRating + rng.int(-1, 1))),
        acidity_match_rating: Math.max(1, Math.min(5, baseRating + rng.int(-1, 1))),
        tannin_balance_rating: Math.max(1, Math.min(5, baseRating + rng.int(-1, 0))),
        body_match_rating: Math.max(1, Math.min(5, baseRating + rng.int(-1, 1))),
        regional_tradition_rating: Math.max(1, Math.min(5, baseRating + rng.int(0, 1)))
    };
    
    // Insert enhanced feedback
    await dbRun(db, `
        INSERT INTO LearningPairingFeedbackEnhanced (
            recommendation_id, user_id, session_id,
            overall_rating, flavor_harmony_rating, texture_balance_rating,
            acidity_match_rating, tannin_balance_rating, body_match_rating,
            regional_tradition_rating, occasion, guest_count, time_of_day,
            season, weather_context, selected, time_to_select, viewed_duration,
            would_recommend, price_satisfaction, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
    `, [
        selectedWine.recommendation_id, guestProfile.id, sessionId,
        aspectRatings.overall_rating, aspectRatings.flavor_harmony_rating,
        aspectRatings.texture_balance_rating, aspectRatings.acidity_match_rating,
        aspectRatings.tannin_balance_rating, aspectRatings.body_match_rating,
        aspectRatings.regional_tradition_rating, context.occasion, context.guest_count,
        context.time_of_day, context.season, context.weather_context,
        rng.int(30, 180), rng.int(10, 60),
        baseRating >= 4 ? 1 : 0, rng.int(3, 5),
        formatDate(date)
    ]);
    
    // Also insert basic feedback for compatibility
    await dbRun(db, `
        INSERT INTO LearningPairingFeedback (
            recommendation_id, rating, selected, created_at
        ) VALUES (?, ?, 1, ?)
    `, [selectedWine.recommendation_id, baseRating, formatDate(date)]);
    
    simulationState.stats.pairingSessions++;
    simulationState.stats.feedbackRecorded++;
    simulationState.stats.byGuestType[guestProfile.id]++;
    
    return { sessionId, selectedWine, guestCount };
}

// ============================================================================
// CONSUMPTION TRACKING
// ============================================================================

async function handleConsumption(db, selectedWine, guestCount, date) {
    // Calculate bottles (1 bottle per 2-4 guests, min 1)
    const bottlesConsumed = Math.max(1, Math.ceil(guestCount / simulationState.rng.int(2, 4)));
    
    // Get current stock
    const stock = await dbGet(db, `
        SELECT s.*, w.wine_type
        FROM Stock s
        JOIN Vintages v ON s.vintage_id = v.id
        JOIN Wines w ON v.wine_id = w.id
        WHERE s.vintage_id = ? AND s.quantity >= ?
        LIMIT 1
    `, [selectedWine.vintage_id, bottlesConsumed]);
    
    if (!stock) {
        console.warn(`  ⚠️  Insufficient stock for ${selectedWine.name} - skipping consumption`);
        return { bottlesConsumed: 0 };
    }
    
    // Update stock
    await dbRun(db, `
        UPDATE Stock
        SET quantity = quantity - ?, updated_at = strftime('%s','now')
        WHERE id = ?
    `, [bottlesConsumed, stock.id]);
    
    // Create ledger entry
    await dbRun(db, `
        INSERT INTO Ledger (
            vintage_id, location, transaction_type, quantity,
            reference_id, notes, created_by, created_at
        ) VALUES (?, ?, 'OUT', ?, ?, ?, 'simulator', ?)
    `, [
        selectedWine.vintage_id, stock.location, bottlesConsumed,
        `consumption-${formatDate(date)}`,
        `Guest service - ${guestCount} guests`,
        formatDate(date)
    ]);
    
    // Create consumption event
    await dbRun(db, `
        INSERT INTO LearningConsumptionEvents (
            vintage_id, wine_id, wine_type, quantity, location,
            event_type, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, 'consume', ?, ?)
    `, [
        selectedWine.vintage_id, selectedWine.id, stock.wine_type,
        bottlesConsumed, stock.location,
        JSON.stringify({ guest_count: guestCount }),
        formatDate(date)
    ]);
    
    simulationState.stats.bottlesConsumed += bottlesConsumed;
    simulationState.stats.byWineType[stock.wine_type] = 
        (simulationState.stats.byWineType[stock.wine_type] || 0) + bottlesConsumed;
    
    return { bottlesConsumed };
}

// ============================================================================
// DAILY SIMULATION
// ============================================================================

async function simulateDay(db, rng, date, dayNum) {
    const season = getSeason(date);
    const seasonName = getSeasonName(date);
    
    // Update season stats
    if (!simulationState.stats.bySeason[seasonName]) {
        simulationState.stats.bySeason[seasonName] = { days: 0, guestDays: 0, sessions: 0 };
    }
    simulationState.stats.bySeason[seasonName].days++;
    simulationState.stats.totalDays++;
    
    // Determine if guests are present
    const hasGuests = rng.bool(season.occupancy);
    
    let dayLog = `Day ${dayNum}/365: ${formatDate(date)}`;
    let activities = [];
    
    // Morning: Process deliveries
    const deliveries = await processDeliveries(db, date);
    if (deliveries.deliveriesProcessed > 0) {
        activities.push(`📦 ${deliveries.itemsReceived} items received`);
    }
    
    // Morning: Check stock and create procurement orders
    if (dayNum % 7 === 0 || rng.bool(0.1)) {
        const procurement = await handleProcurement(db, rng, date);
        if (procurement.ordersCreated > 0) {
            activities.push(`🛒 Order placed: ${procurement.itemsOrdered} items`);
        }
    }
    
    // Guest activities
    if (hasGuests) {
        simulationState.stats.guestDays++;
        simulationState.stats.bySeason[seasonName].guestDays++;
        
        // Select guest profile (owner more common in off-season)
        let guestProfile;
        if (season.occupancy < 0.3) {
            guestProfile = GUEST_PROFILES.owner;
        } else {
            const profiles = [GUEST_PROFILES.owner, GUEST_PROFILES.guest_a, GUEST_PROFILES.guest_b];
            guestProfile = rng.choice(profiles);
        }
        
        activities.push(`👥 ${guestProfile.name}`);
        
        // Lunch pairing (60% chance)
        if (rng.bool(0.6)) {
            const lunchSession = await handlePairingSession(db, rng, date, guestProfile, 'lunch');
            await handleConsumption(db, lunchSession.selectedWine, lunchSession.guestCount, date);
            activities.push(`🍽️  Lunch pairing`);
            simulationState.stats.bySeason[seasonName].sessions++;
        }
        
        // Dinner pairing (90% chance)
        if (rng.bool(0.9)) {
            const dinnerSession = await handlePairingSession(db, rng, date, guestProfile, 'dinner');
            await handleConsumption(db, dinnerSession.selectedWine, dinnerSession.guestCount, date);
            activities.push(`🍽️  Dinner pairing`);
            simulationState.stats.bySeason[seasonName].sessions++;
        }
    }
    
    // Periodic events
    if (dayNum % 7 === 0) {
        // Weekly audit
        const numAdjustments = rng.int(2, 3);
        for (let i = 0; i < numAdjustments; i++) {
            const wine = rng.choice(simulationState.wineIdCache);
            const adjustment = rng.bool(0.5) ? 1 : -1;
            
            await dbRun(db, `
                UPDATE Stock
                SET quantity = MAX(0, quantity + ?), updated_at = strftime('%s','now')
                WHERE vintage_id = ?
            `, [adjustment, wine.vintage_id]);
            
            await dbRun(db, `
                INSERT INTO Ledger (
                    vintage_id, location, transaction_type, quantity,
                    notes, created_by, created_at
                ) SELECT ?, location, 'ADJUST', ABS(?), 'Weekly audit adjustment', 'simulator', ?
                FROM Stock WHERE vintage_id = ? LIMIT 1
            `, [wine.vintage_id, adjustment, formatDate(date), wine.vintage_id]);
        }
        simulationState.stats.auditsPerformed++;
        activities.push(`📋 Weekly audit`);
    }
    
    // Log day
    dayLog += ` [${season.name}] ` + (activities.length > 0 ? activities.join(', ') : 'No activity');
    console.log(dayLog);
}

// ============================================================================
// REPORTING AND VALIDATION
// ============================================================================

async function generateSummaryReport(db) {
    const report = [];
    report.push('='.repeat(80));
    report.push('SOMMOS YEAR-LONG SIMULATION SUMMARY REPORT');
    report.push('='.repeat(80));
    report.push(`\nGenerated: ${new Date().toISOString()}`);
    report.push(`Simulation Period: ${formatDate(SIMULATION_START)} to ${formatDate(SIMULATION_END)}`);
    report.push(`Random Seed: ${RANDOM_SEED}`);
    
    // Operational statistics
    report.push('\n' + '-'.repeat(80));
    report.push('OPERATIONAL STATISTICS');
    report.push('-'.repeat(80));
    report.push(`Total Days Simulated: ${simulationState.stats.totalDays}`);
    report.push(`Days with Guests: ${simulationState.stats.guestDays} (${(simulationState.stats.guestDays / simulationState.stats.totalDays * 100).toFixed(1)}%)`);
    report.push(`Pairing Sessions: ${simulationState.stats.pairingSessions}`);
    report.push(`Feedback Records: ${simulationState.stats.feedbackRecorded}`);
    report.push(`Bottles Consumed: ${simulationState.stats.bottlesConsumed}`);
    report.push(`Procurement Orders: ${simulationState.stats.procurementOrders}`);
    report.push(`Deliveries Received: ${simulationState.stats.deliveriesReceived}`);
    report.push(`Audits Performed: ${simulationState.stats.auditsPerformed}`);
    
    // Guest type breakdown
    report.push('\n' + '-'.repeat(80));
    report.push('GUEST TYPE BREAKDOWN');
    report.push('-'.repeat(80));
    for (const [type, count] of Object.entries(simulationState.stats.byGuestType)) {
        const profile = GUEST_PROFILES[type];
        report.push(`${profile.name}: ${count} sessions`);
    }
    
    // Wine type consumption
    report.push('\n' + '-'.repeat(80));
    report.push('WINE TYPE CONSUMPTION');
    report.push('-'.repeat(80));
    for (const [type, count] of Object.entries(simulationState.stats.byWineType)) {
        report.push(`${type}: ${count} bottles`);
    }
    
    // Seasonal breakdown
    report.push('\n' + '-'.repeat(80));
    report.push('SEASONAL BREAKDOWN');
    report.push('-'.repeat(80));
    for (const [season, stats] of Object.entries(simulationState.stats.bySeason)) {
        report.push(`${season.toUpperCase()}:`);
        report.push(`  Days: ${stats.days}`);
        report.push(`  Guest Days: ${stats.guestDays} (${(stats.guestDays / stats.days * 100).toFixed(1)}%)`);
        report.push(`  Pairing Sessions: ${stats.sessions}`);
    }
    
    // Database statistics
    report.push('\n' + '-'.repeat(80));
    report.push('DATABASE STATISTICS');
    report.push('-'.repeat(80));
    
    const dbStats = {
        sessions: await dbGet(db, 'SELECT COUNT(*) as count FROM LearningPairingSessions'),
        recommendations: await dbGet(db, 'SELECT COUNT(*) as count FROM LearningPairingRecommendations'),
        feedback: await dbGet(db, 'SELECT COUNT(*) as count FROM LearningPairingFeedback'),
        enhanced_feedback: await dbGet(db, 'SELECT COUNT(*) as count FROM LearningPairingFeedbackEnhanced'),
        consumption: await dbGet(db, 'SELECT COUNT(*) as count FROM LearningConsumptionEvents'),
        ledger: await dbGet(db, 'SELECT COUNT(*) as count FROM Ledger'),
        intake_orders: await dbGet(db, 'SELECT COUNT(*) as count FROM InventoryIntakeOrders'),
        intake_items: await dbGet(db, 'SELECT COUNT(*) as count FROM InventoryIntakeItems')
    };
    
    report.push(`Pairing Sessions: ${dbStats.sessions.count}`);
    report.push(`Recommendations: ${dbStats.recommendations.count}`);
    report.push(`Basic Feedback: ${dbStats.feedback.count}`);
    report.push(`Enhanced Feedback: ${dbStats.enhanced_feedback.count}`);
    report.push(`Consumption Events: ${dbStats.consumption.count}`);
    report.push(`Ledger Entries: ${dbStats.ledger.count}`);
    report.push(`Intake Orders: ${dbStats.intake_orders.count}`);
    report.push(`Intake Items: ${dbStats.intake_items.count}`);
    
    // Average ratings
    const avgRating = await dbGet(db, `
        SELECT AVG(overall_rating) as avg FROM LearningPairingFeedbackEnhanced
    `);
    report.push(`\nAverage Overall Rating: ${avgRating.avg ? avgRating.avg.toFixed(2) : 'N/A'}/5.0`);
    
    // Top wines
    report.push('\n' + '-'.repeat(80));
    report.push('TOP 10 CONSUMED WINES');
    report.push('-'.repeat(80));
    const topWines = await dbAll(db, `
        SELECT w.name, w.producer, w.wine_type, SUM(l.quantity) as total
        FROM Ledger l
        JOIN Vintages v ON l.vintage_id = v.id
        JOIN Wines w ON v.wine_id = w.id
        WHERE l.transaction_type = 'OUT' AND l.created_by = 'simulator'
        GROUP BY w.id
        ORDER BY total DESC
        LIMIT 10
    `);
    topWines.forEach((wine, i) => {
        report.push(`${i + 1}. ${wine.name} (${wine.producer}) - ${wine.total} bottles`);
    });
    
    report.push('\n' + '='.repeat(80));
    report.push('END OF REPORT');
    report.push('='.repeat(80));
    
    const reportText = report.join('\n');
    const reportPath = path.join(REPORT_DIR, 'simulation_report_2024.txt');
    fs.writeFileSync(reportPath, reportText);
    console.log(`  ✅ Report saved to: ${reportPath}`);
    console.log('\n' + reportText);
}

async function exportCSVReports(db) {
    // Create export directory
    if (!fs.existsSync(EXPORT_DIR)) {
        fs.mkdirSync(EXPORT_DIR, { recursive: true });
    }
    
    // 1. Pairing sessions export
    const sessions = await dbAll(db, `
        SELECT id, dish_description, dish_context, preferences, 
               generated_by_ai, created_at
        FROM LearningPairingSessions
        ORDER BY created_at
    `);
    const sessionsCSV = [
        'id,dish_description,dish_context,preferences,generated_by_ai,created_at',
        ...sessions.map(s => `${s.id},"${s.dish_description}","${s.dish_context}","${s.preferences}",${s.generated_by_ai},${s.created_at}`)
    ].join('\n');
    fs.writeFileSync(path.join(EXPORT_DIR, 'pairing_sessions.csv'), sessionsCSV);
    
    // 2. Enhanced feedback export
    const feedback = await dbAll(db, `
        SELECT * FROM LearningPairingFeedbackEnhanced ORDER BY created_at
    `);
    const feedbackCSV = [
        'id,recommendation_id,user_id,session_id,overall_rating,flavor_harmony_rating,texture_balance_rating,acidity_match_rating,tannin_balance_rating,body_match_rating,regional_tradition_rating,occasion,guest_count,time_of_day,season,weather_context,selected,created_at',
        ...feedback.map(f => `${f.id},${f.recommendation_id},${f.user_id},${f.session_id},${f.overall_rating},${f.flavor_harmony_rating},${f.texture_balance_rating},${f.acidity_match_rating},${f.tannin_balance_rating},${f.body_match_rating},${f.regional_tradition_rating},${f.occasion},${f.guest_count},${f.time_of_day},${f.season},${f.weather_context},${f.selected},${f.created_at}`)
    ].join('\n');
    fs.writeFileSync(path.join(EXPORT_DIR, 'enhanced_feedback.csv'), feedbackCSV);
    
    // 3. Consumption events export
    const consumption = await dbAll(db, `
        SELECT * FROM LearningConsumptionEvents ORDER BY created_at
    `);
    const consumptionCSV = [
        'id,vintage_id,wine_id,wine_type,quantity,location,event_type,metadata,created_at',
        ...consumption.map(c => `${c.id},${c.vintage_id},${c.wine_id},${c.wine_type},${c.quantity},${c.location},${c.event_type},"${c.metadata}",${c.created_at}`)
    ].join('\n');
    fs.writeFileSync(path.join(EXPORT_DIR, 'consumption_events.csv'), consumptionCSV);
    
    // 4. Procurement orders export
    const orders = await dbAll(db, `
        SELECT * FROM InventoryIntakeOrders ORDER BY order_date
    `);
    const ordersCSV = [
        'id,supplier_id,supplier_name,source_type,reference,order_date,expected_delivery,status,created_at',
        ...orders.map(o => `${o.id},${o.supplier_id},"${o.supplier_name}",${o.source_type},${o.reference},${o.order_date},${o.expected_delivery},${o.status},${o.created_at}`)
    ].join('\n');
    fs.writeFileSync(path.join(EXPORT_DIR, 'procurement_orders.csv'), ordersCSV);
    
    // 5. Ledger export
    const ledger = await dbAll(db, `
        SELECT l.*, w.name as wine_name, w.producer
        FROM Ledger l
        JOIN Vintages v ON l.vintage_id = v.id
        JOIN Wines w ON v.wine_id = w.id
        WHERE l.created_by = 'simulator'
        ORDER BY l.created_at
    `);
    const ledgerCSV = [
        'id,vintage_id,wine_name,producer,location,transaction_type,quantity,unit_cost,total_cost,reference_id,notes,created_at',
        ...ledger.map(l => `${l.id},${l.vintage_id},"${l.wine_name}","${l.producer}",${l.location},${l.transaction_type},${l.quantity},${l.unit_cost || ''},${l.total_cost || ''},${l.reference_id || ''},"${l.notes || ''}",${l.created_at}`)
    ].join('\n');
    fs.writeFileSync(path.join(EXPORT_DIR, 'ledger_history.csv'), ledgerCSV);
    
    console.log(`  ✅ Exported 5 CSV files to: ${EXPORT_DIR}`);
}

async function validateDataConsistency(db) {
    const issues = [];
    
    // Check 1: Ledger vs Stock consistency
    const stockCheck = await dbAll(db, `
        SELECT 
            s.vintage_id,
            s.location,
            s.quantity as stock_quantity,
            COALESCE((
                SELECT SUM(CASE 
                    WHEN transaction_type = 'IN' THEN quantity
                    WHEN transaction_type = 'OUT' THEN -quantity
                    WHEN transaction_type = 'ADJUST' THEN quantity
                    ELSE 0 END)
                FROM Ledger
                WHERE vintage_id = s.vintage_id AND location = s.location
            ), 0) as ledger_total
        FROM Stock s
    `);
    
    for (const row of stockCheck) {
        // Allow small discrepancies due to initial seed data
        if (Math.abs(row.stock_quantity - row.ledger_total) > 10) {
            issues.push(`Stock/Ledger mismatch for vintage ${row.vintage_id} at ${row.location}: Stock=${row.stock_quantity}, Ledger=${row.ledger_total}`);
        }
    }
    
    // Check 2: No negative stock
    const negativeStock = await dbAll(db, `
        SELECT * FROM Stock WHERE quantity < 0
    `);
    if (negativeStock.length > 0) {
        issues.push(`Found ${negativeStock.length} wines with negative stock!`);
    }
    
    // Check 3: Reserved quantity not exceeding total
    const invalidReserved = await dbAll(db, `
        SELECT * FROM Stock WHERE reserved_quantity > quantity
    `);
    if (invalidReserved.length > 0) {
        issues.push(`Found ${invalidReserved.length} wines with reserved > quantity!`);
    }
    
    // Check 4: Orphaned feedback (recommendations without sessions)
    const orphanedFeedback = await dbGet(db, `
        SELECT COUNT(*) as count
        FROM LearningPairingFeedback f
        JOIN LearningPairingRecommendations r ON f.recommendation_id = r.id
        WHERE NOT EXISTS (
            SELECT 1 FROM LearningPairingSessions s WHERE s.id = r.session_id
        )
    `);
    if (orphanedFeedback.count > 0) {
        issues.push(`Found ${orphanedFeedback.count} orphaned feedback records!`);
    }
    
    // Report
    console.log('\n' + '='.repeat(80));
    console.log('VALIDATION RESULTS');
    console.log('='.repeat(80));
    
    if (issues.length === 0) {
        console.log('✅ All validation checks passed!');
    } else {
        console.log(`⚠️  Found ${issues.length} issue(s):\n`);
        issues.forEach((issue, i) => {
            console.log(`${i + 1}. ${issue}`);
        });
    }
    
    console.log('='.repeat(80) + '\n');
}

// ============================================================================
// MAIN SIMULATION FUNCTION
// ============================================================================

async function main() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║     SommOS Year-Long Data Simulator                           ║');
    console.log('║     Generating synthetic operational data for 2024             ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    
    // Prerequisites check
    if (!fs.existsSync(DB_PATH)) {
        console.error('❌ Database not found. Run: npm run setup:db && npm run seed');
        process.exit(1);
    }
    
    // Initialize
    console.log('📋 Initializing simulation...');
    simulationState.rng = new SeededRandom(RANDOM_SEED);
    simulationState.db = await openDatabase();
    
    try {
        // Load/initialize data
        await initializeSuppliers(simulationState.db);
        simulationState.supplierCache = await loadSuppliers(simulationState.db);
        simulationState.wineIdCache = await loadWineIds(simulationState.db);
        
        console.log(`  ✅ Loaded ${simulationState.wineIdCache.length} wines in stock`);
        console.log(`  ✅ Loaded ${simulationState.supplierCache.length} active suppliers`);
        console.log(`  ✅ Random seed: ${RANDOM_SEED}\n`);
        
        // Simulation loop
        console.log('🚀 Starting simulation...\n');
        
        let currentDate = new Date(SIMULATION_START);
        let dayNum = 1;
        
        while (currentDate <= SIMULATION_END) {
            simulationState.currentDate = currentDate;
            simulationState.dayNumber = dayNum;
            
            // Simulate the day
            await simulateDay(simulationState.db, simulationState.rng, currentDate, dayNum);
            
            // Advance to next day
            currentDate = addDays(currentDate, 1);
            dayNum++;
            
            // Add small delay for realism (can be adjusted or removed)
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        console.log('\n✅ Simulation complete!\n');
        
        // Generate reports
        console.log('📊 Generating summary report...');
        await generateSummaryReport(simulationState.db);
        
        // Export CSVs
        console.log('📁 Exporting CSV reports...');
        await exportCSVReports(simulationState.db);
        
        // Run validation
        console.log('✓ Running validation checks...');
        await validateDataConsistency(simulationState.db)
        
    } catch (error) {
        console.error('\n❌ Simulation failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await closeDatabase(simulationState.db);
    }
}

// Execute if run directly
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { main };
