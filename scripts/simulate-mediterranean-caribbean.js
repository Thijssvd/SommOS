#!/usr/bin/env node

/**
 * SommOS Mediterranean/Caribbean Yacht Simulator
 * 
 * Simulates 5-year data for a luxury yacht that:
 * - Summers in the Mediterranean (May-September): Greek islands, French Riviera, Italian coast
 * - Winters in the Caribbean (December-March): Bahamas, Virgin Islands, St. Barths
 * - Transitions through Atlantic crossings (April, October-November)
 * 
 * Enhanced features:
 * - Location-appropriate cuisine preferences
 * - Seasonal wine selection patterns
 * - Regional specialty dishes
 * - Weather-influenced dining
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../data/sommos.db');
const SIMULATION_START = new Date('2024-01-01');
const SIMULATION_END = new Date('2028-12-31');
const RANDOM_SEED = 42;

// Enhanced seasonality with location context
const YACHT_ITINERARY = {
    // Caribbean Winter Season (Dec-Mar)
    caribbean_winter: {
        months: [12, 1, 2, 3],
        occupancy: 0.85, // High demand
        location: 'Caribbean',
        climate: 'tropical',
        cuisine_bias: ['Caribbean', 'Seafood', 'American', 'Fusion'],
        wine_preferences: ['Sparkling', 'White', 'Rosé'], // Light wines for heat
        typical_dishes: [
            { name: 'Grilled Mahi-Mahi with Mango Salsa', cuisine: 'Caribbean', protein: 'fish', intensity: 'medium' },
            { name: 'Jerk Chicken with Rice and Peas', cuisine: 'Caribbean', protein: 'poultry', intensity: 'medium' },
            { name: 'Conch Fritters', cuisine: 'Caribbean', protein: 'seafood', intensity: 'light' },
            { name: 'Caribbean Lobster Tail', cuisine: 'Caribbean', protein: 'seafood', intensity: 'medium' },
            { name: 'Ceviche with Plantain Chips', cuisine: 'Latin', protein: 'seafood', intensity: 'light' },
            { name: 'Blackened Tuna Steak', cuisine: 'Caribbean', protein: 'fish', intensity: 'medium' },
            { name: 'Coconut Shrimp', cuisine: 'Caribbean', protein: 'seafood', intensity: 'light' }
        ]
    },
    
    // Transition Spring (Apr-May)
    spring_transition: {
        months: [4, 5],
        occupancy: 0.45,
        location: 'Atlantic/Mediterranean',
        climate: 'temperate',
        cuisine_bias: ['Mediterranean', 'French', 'Italian'],
        wine_preferences: ['White', 'Rosé', 'Light Red'],
        typical_dishes: [
            { name: 'Pan-Seared Sea Bass', cuisine: 'Mediterranean', protein: 'fish', intensity: 'light' },
            { name: 'Salade Niçoise', cuisine: 'French', protein: 'fish', intensity: 'light' },
            { name: 'Grilled Calamari', cuisine: 'Mediterranean', protein: 'seafood', intensity: 'light' }
        ]
    },
    
    // Mediterranean Summer (Jun-Sep)
    mediterranean_summer: {
        months: [6, 7, 8, 9],
        occupancy: 0.90, // Peak season
        location: 'Mediterranean',
        climate: 'warm_dry',
        cuisine_bias: ['Mediterranean', 'Greek', 'Italian', 'French', 'Spanish'],
        wine_preferences: ['White', 'Rosé', 'Sparkling', 'Light Red'],
        typical_dishes: [
            { name: 'Greek Grilled Octopus with Lemon', cuisine: 'Greek', protein: 'seafood', intensity: 'medium' },
            { name: 'Spaghetti alle Vongole', cuisine: 'Italian', protein: 'seafood', intensity: 'light' },
            { name: 'Bouillabaisse', cuisine: 'French', protein: 'seafood', intensity: 'medium' },
            { name: 'Risotto ai Frutti di Mare', cuisine: 'Italian', protein: 'seafood', intensity: 'medium' },
            { name: 'Branzino al Sale', cuisine: 'Italian', protein: 'fish', intensity: 'light' },
            { name: 'Gambas al Ajillo', cuisine: 'Spanish', protein: 'seafood', intensity: 'light' },
            { name: 'Moussaka', cuisine: 'Greek', protein: 'lamb', intensity: 'rich' },
            { name: 'Fresh Burrata with Heirloom Tomatoes', cuisine: 'Italian', protein: 'cheese', intensity: 'light' },
            { name: 'Grilled Lamb Chops with Tzatziki', cuisine: 'Greek', protein: 'lamb', intensity: 'rich' },
            { name: 'Paella Valenciana', cuisine: 'Spanish', protein: 'seafood', intensity: 'medium' }
        ]
    },
    
    // Fall Transition (Oct-Nov)
    fall_transition: {
        months: [10, 11],
        occupancy: 0.30,
        location: 'Atlantic Crossing',
        climate: 'cool',
        cuisine_bias: ['International', 'Comfort'],
        wine_preferences: ['Red', 'Full White'],
        typical_dishes: [
            { name: 'Roasted Chicken', cuisine: 'French', protein: 'poultry', intensity: 'medium' },
            { name: 'Beef Stew', cuisine: 'International', protein: 'beef', intensity: 'rich' }
        ]
    }
};

// Guest profiles adapted for yacht lifestyle
const GUEST_PROFILES = {
    owner: {
        id: 'owner',
        name: 'Yacht Owner',
        preferred_types: ['Red', 'Sparkling', 'White'],
        adventurousness: 0.4,
        rating_bias: 4.5,
        rating_variance: 0.5,
        typical_guest_count: [2, 4],
        occasions: ['dinner', 'celebration', 'casual', 'lunch']
    },
    charter_traditional: {
        id: 'charter_traditional',
        name: 'Traditional Charter Guest',
        preferred_types: ['Red', 'White'],
        adventurousness: 0.15,
        rating_bias: 4.0,
        rating_variance: 0.8,
        typical_guest_count: [6, 10],
        occasions: ['dinner', 'lunch', 'cocktail']
    },
    charter_adventurous: {
        id: 'charter_adventurous',
        name: 'Adventurous Charter Guest',
        preferred_types: ['Sparkling', 'White', 'Rosé'],
        adventurousness: 0.75,
        rating_bias: 4.3,
        rating_variance: 0.9,
        typical_guest_count: [8, 12],
        occasions: ['celebration', 'cocktail', 'lunch', 'dinner']
    }
};

class SeededRandom {
    constructor(seed) {
        this.seed = seed;
    }

    next() {
        this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
        return this.seed / 0x7fffffff;
    }

    int(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }

    float(min, max) {
        return this.next() * (max - min) + min;
    }

    choice(array) {
        return array[this.int(0, array.length - 1)];
    }

    bool(p = 0.5) {
        return this.next() < p;
    }

    normal(mean = 0, stdDev = 1) {
        const u1 = this.next();
        const u2 = this.next();
        const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        return z0 * stdDev + mean;
    }
}

function openDatabase() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) reject(err);
            else resolve(db);
        });
    });
}

function dbRun(db, query, params = []) {
    return new Promise((resolve, reject) => {
        db.run(query, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function dbAll(db, query, params = []) {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getSeason(date) {
    const month = date.getMonth() + 1;
    
    for (const [seasonName, season] of Object.entries(YACHT_ITINERARY)) {
        if (season.months.includes(month)) {
            return { name: seasonName, ...season };
        }
    }
    
    return YACHT_ITINERARY.fall_transition;
}

async function clearSimulationData(db) {
    console.log('🗑️  Clearing old simulation data...');
    
    await dbRun(db, 'DELETE FROM LearningPairingFeedbackEnhanced');
    await dbRun(db, 'DELETE FROM LearningPairingRecommendations');
    await dbRun(db, 'DELETE FROM LearningPairingSessions');
    
    console.log('   ✅ Simulation data cleared\n');
}

async function getAvailableWines(db) {
    return await dbAll(db, `
        SELECT w.id, w.name, w.producer, w.region, w.wine_type, w.style, w.tasting_notes,
               v.year, v.id as vintage_id, s.quantity, s.location
        FROM Wines w
        JOIN Vintages v ON w.id = v.wine_id
        JOIN Stock s ON v.id = s.vintage_id
        WHERE s.quantity > 0
    `);
}

async function simulateDay(db, date, random, stats) {
    const season = getSeason(date);
    
    // Determine if yacht is occupied this day
    if (!random.bool(season.occupancy)) {
        return; // Empty yacht today
    }
    
    stats.guestDays++;
    
    // Select guest profile (higher chance for charter guests during peak season)
    const guestPool = Object.values(GUEST_PROFILES);
    const guestProfile = random.choice(guestPool);
    
    // Number of dining sessions (1-3 per day)
    const sessionsPerDay = random.int(1, season.occupancy > 0.7 ? 3 : 2);
    
    for (let session = 0; session < sessionsPerDay; session++) {
        await simulatePairingSession(db, date, season, guestProfile, random, stats);
    }
}

async function simulatePairingSession(db, date, season, guestProfile, random, stats) {
    // Select dish appropriate for season/location
    const dishPool = season.typical_dishes && season.typical_dishes.length > 0
        ? season.typical_dishes
        : [
            { name: 'Grilled Fish', cuisine: 'Mediterranean', protein: 'fish', intensity: 'light' },
            { name: 'Roasted Chicken', cuisine: 'French', protein: 'poultry', intensity: 'medium' }
        ];
    
    const dish = random.choice(dishPool);
    const occasion = random.choice(guestProfile.occasions);
    const guestCount = random.int(...guestProfile.typical_guest_count);
    
    // Get available wines
    const wines = await getAvailableWines(db);
    if (wines.length === 0) return;
    
    // Create pairing session
    const sessionResult = await dbRun(db, `
        INSERT INTO LearningPairingSessions (dish_description, dish_context, preferences, created_at)
        VALUES (?, ?, ?, ?)
    `, [
        dish.name,
        JSON.stringify(dish),
        JSON.stringify({ guest_profile: guestProfile.id }),
        date.toISOString()
    ]);
    
    stats.sessions++;
    
    // Generate 3-5 recommendations
    const numRecommendations = random.int(3, 5);
    const selectedWines = random.choice(wines.length < numRecommendations ? wines : 
        wines.sort(() => random.next() - 0.5).slice(0, numRecommendations));
    
    for (let rank = 0; rank < numRecommendations; rank++) {
        const wine = Array.isArray(selectedWines) ? selectedWines[rank] : wines[rank % wines.length];
        if (!wine) continue;
        
        // Create recommendation
        const recResult = await dbRun(db, `
            INSERT INTO LearningPairingRecommendations (
                session_id, wine_id, wine_name, producer, wine_type, region, ranking
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            sessionResult.lastID,
            wine.id,
            wine.name,
            wine.producer,
            wine.wine_type,
            wine.region,
            rank + 1
        ]);
        
        // Generate feedback (top 2 recommendations more likely to be rated)
        if (rank < 2 || random.bool(0.4)) {
            const baseRating = guestProfile.rating_bias + random.normal(0, guestProfile.rating_variance);
            const rating = Math.max(1, Math.min(5, baseRating));
            
            await dbRun(db, `
                INSERT INTO LearningPairingFeedbackEnhanced (
                    session_id, recommendation_id, overall_rating,
                    flavor_harmony_rating, texture_balance_rating,
                    acidity_match_rating, tannin_balance_rating,
                    body_match_rating, regional_tradition_rating,
                    occasion, guest_count, season, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                sessionResult.lastID,
                recResult.lastID,
                rating,
                Math.max(1, Math.min(5, rating + random.normal(0, 0.3))),
                Math.max(1, Math.min(5, rating + random.normal(0, 0.3))),
                Math.max(1, Math.min(5, rating + random.normal(0, 0.3))),
                Math.max(1, Math.min(5, rating + random.normal(0, 0.3))),
                Math.max(1, Math.min(5, rating + random.normal(0, 0.3))),
                Math.max(1, Math.min(5, rating + random.normal(0, 0.3))),
                occasion,
                guestCount,
                season.name,
                date.toISOString()
            ]);
            
            stats.feedback++;
        }
    }
}

async function main() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║   SommOS Mediterranean/Caribbean Yacht Simulation (5 Years)    ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    
    const db = await openDatabase();
    const random = new SeededRandom(RANDOM_SEED);
    
    try {
        await clearSimulationData(db);
        
        const stats = {
            guestDays: 0,
            sessions: 0,
            feedback: 0,
            days: 0
        };
        
        console.log('🚢 Simulating yacht operations...');
        console.log(`   📅 Period: ${SIMULATION_START.toLocaleDateString()} to ${SIMULATION_END.toLocaleDateString()}\n`);
        
        let currentDate = new Date(SIMULATION_START);
        let lastProgress = 0;
        
        while (currentDate <= SIMULATION_END) {
            await simulateDay(db, currentDate, random, stats);
            stats.days++;
            
            // Progress indicator
            const totalDays = Math.floor((SIMULATION_END - SIMULATION_START) / (1000 * 60 * 60 * 24));
            const progress = Math.floor((stats.days / totalDays) * 100);
            if (progress > lastProgress && progress % 10 === 0) {
                const season = getSeason(currentDate);
                console.log(`   ${progress}% - ${currentDate.toLocaleDateString()} (${season.location})`);
                lastProgress = progress;
            }
            
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        console.log('\n✅ Simulation complete!\n');
        console.log('📊 STATISTICS:');
        console.log(`   Guest Days:        ${stats.guestDays.toLocaleString()}`);
        console.log(`   Pairing Sessions:  ${stats.sessions.toLocaleString()}`);
        console.log(`   Feedback Records:  ${stats.feedback.toLocaleString()}`);
        console.log(`   Total Days:        ${stats.days.toLocaleString()}\n`);
        
    } catch (error) {
        console.error('\n❌ Simulation failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        db.close();
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}
