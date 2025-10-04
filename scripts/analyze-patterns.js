#!/usr/bin/env node

/**
 * SommOS Pattern Analysis Script
 * 
 * Analyzes simulation data to extract:
 * - Seasonal wine preferences
 * - Guest profile segmentation
 * - Procurement efficiency metrics
 * - Consumption patterns
 * - Rating distributions
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../data/sommos.db');
const REPORT_PATH = path.join(__dirname, '../data/pattern_analysis_report.txt');

// Database helpers
function openDatabase() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
            if (err) reject(err);
            else resolve(db);
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

function dbGet(db, query, params = []) {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function closeDatabase(db) {
    return new Promise((resolve) => {
        db.close(() => resolve());
    });
}

// Analysis functions
async function analyzeSeasonalPreferences(db) {
    console.log('\n📊 Analyzing seasonal wine preferences...');
    
    // Simplified - just get season stats
    const seasonalData = await dbAll(db, `
        SELECT 
            f.season,
            COUNT(*) as session_count,
            AVG(f.overall_rating) as avg_rating
        FROM LearningPairingFeedbackEnhanced f
        GROUP BY f.season
    `);
    
    const wineTypesBySeason = await dbAll(db, `
        SELECT 
            c.wine_type,
            f.season,
            COUNT(*) as consumption_count,
            SUM(c.quantity) as total_bottles,
            AVG(c.quantity) as avg_per_event
        FROM LearningConsumptionEvents c
        JOIN LearningPairingFeedbackEnhanced f ON c.session_id = f.session_id
        WHERE c.event_type = 'consume'
        GROUP BY c.wine_type, f.season
        ORDER BY f.season, total_bottles DESC
    `);
    
    const ratingsBySeason = await dbAll(db, `
        SELECT 
            season,
            COUNT(*) as count,
            AVG(overall_rating) as avg_rating,
            AVG(flavor_harmony_rating) as avg_flavor,
            AVG(texture_balance_rating) as avg_texture,
            AVG(acidity_match_rating) as avg_acidity,
            AVG(tannin_balance_rating) as avg_tannin,
            AVG(body_match_rating) as avg_body,
            AVG(regional_tradition_rating) as avg_regional
        FROM LearningPairingFeedbackEnhanced
        GROUP BY season
        ORDER BY 
            CASE season
                WHEN 'winter' THEN 1
                WHEN 'spring' THEN 2
                WHEN 'summer' THEN 3
                WHEN 'autumn' THEN 4
            END
    `);
    
    return { seasonalData, wineTypesBySeason, ratingsBySeason };
}

async function analyzeGuestProfiles(db) {
    console.log('👥 Analyzing guest profile segmentation...');
    
    const profileStats = await dbAll(db, `
        SELECT 
            user_id,
            COUNT(*) as session_count,
            AVG(overall_rating) as avg_rating,
            AVG(flavor_harmony_rating) as avg_flavor,
            AVG(would_recommend) as recommend_rate,
            AVG(price_satisfaction) as avg_price_satisfaction,
            AVG(time_to_select) as avg_decision_time,
            COUNT(DISTINCT season) as seasons_active,
            COUNT(DISTINCT occasion) as occasion_variety
        FROM LearningPairingFeedbackEnhanced
        GROUP BY user_id
        ORDER BY session_count DESC
    `);
    
    const winePreferencesByGuest = await dbAll(db, `
        SELECT 
            f.user_id,
            c.wine_type,
            COUNT(*) as selections,
            SUM(c.quantity) as total_bottles,
            AVG(f.overall_rating) as avg_rating
        FROM LearningConsumptionEvents c
        JOIN LearningPairingFeedbackEnhanced f ON c.session_id = f.session_id
        WHERE c.event_type = 'consume'
        GROUP BY f.user_id, c.wine_type
        ORDER BY f.user_id, selections DESC
    `);
    
    const occasionPreferences = await dbAll(db, `
        SELECT 
            user_id,
            occasion,
            COUNT(*) as count,
            AVG(overall_rating) as avg_rating
        FROM LearningPairingFeedbackEnhanced
        GROUP BY user_id, occasion
        ORDER BY user_id, count DESC
    `);
    
    return { profileStats, winePreferencesByGuest, occasionPreferences };
}

async function analyzeProcurementEfficiency(db) {
    console.log('📦 Analyzing procurement efficiency...');
    
    const orderMetrics = await dbAll(db, `
        SELECT 
            COUNT(*) as total_orders,
            COUNT(CASE WHEN status = 'RECEIVED' THEN 1 END) as delivered_orders,
            AVG(JULIANDAY(expected_delivery) - JULIANDAY(order_date)) as avg_delivery_days
        FROM InventoryIntakeOrders
        WHERE order_date >= '2024-01-01'
    `);
    
    const itemMetrics = await dbAll(db, `
        SELECT 
            wine_type,
            COUNT(*) as order_count,
            SUM(quantity_ordered) as total_ordered,
            AVG(quantity_ordered) as avg_per_order
        FROM InventoryIntakeItems
        WHERE status = 'RECEIVED'
        GROUP BY wine_type
        ORDER BY total_ordered DESC
    `);
    
    const stockLevels = await dbAll(db, `
        SELECT 
            w.wine_type,
            COUNT(DISTINCT s.vintage_id) as unique_vintages,
            SUM(s.quantity) as total_bottles,
            AVG(s.quantity) as avg_per_vintage,
            MIN(s.quantity) as min_stock,
            MAX(s.quantity) as max_stock
        FROM Stock s
        JOIN Vintages v ON s.vintage_id = v.id
        JOIN Wines w ON v.wine_id = w.id
        GROUP BY w.wine_type
        ORDER BY total_bottles DESC
    `);
    
    const consumptionRate = await dbAll(db, `
        SELECT 
            wine_type,
            COUNT(*) as consumption_events,
            SUM(quantity) as total_consumed,
            AVG(quantity) as avg_per_event,
            MIN(DATE(created_at)) as first_consumption,
            MAX(DATE(created_at)) as last_consumption
        FROM LearningConsumptionEvents
        WHERE event_type = 'consume'
        GROUP BY wine_type
        ORDER BY total_consumed DESC
    `);
    
    return { orderMetrics, itemMetrics, stockLevels, consumptionRate };
}

async function analyzeRatingDistributions(db) {
    console.log('⭐ Analyzing rating distributions...');
    
    const overallDistribution = await dbAll(db, `
        SELECT 
            overall_rating,
            COUNT(*) as count,
            ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM LearningPairingFeedbackEnhanced), 2) as percentage
        FROM LearningPairingFeedbackEnhanced
        GROUP BY overall_rating
        ORDER BY overall_rating DESC
    `);
    
    const aspectCorrelations = await dbGet(db, `
        SELECT 
            AVG(overall_rating) as avg_overall,
            AVG(flavor_harmony_rating) as avg_flavor,
            AVG(texture_balance_rating) as avg_texture,
            AVG(acidity_match_rating) as avg_acidity,
            AVG(tannin_balance_rating) as avg_tannin,
            AVG(body_match_rating) as avg_body,
            AVG(regional_tradition_rating) as avg_regional
        FROM LearningPairingFeedbackEnhanced
    `);
    
    const topRatedPairings = await dbAll(db, `
        SELECT 
            s.dish_description,
            c.wine_type,
            f.overall_rating,
            f.flavor_harmony_rating,
            f.occasion,
            f.season,
            f.guest_count
        FROM LearningPairingFeedbackEnhanced f
        JOIN LearningPairingSessions s ON f.session_id = s.id
        JOIN LearningConsumptionEvents c ON c.session_id = s.id
        WHERE f.overall_rating >= 5 AND c.event_type = 'consume'
        ORDER BY f.overall_rating DESC, f.flavor_harmony_rating DESC
        LIMIT 20
    `);
    
    return { overallDistribution, aspectCorrelations, topRatedPairings };
}

async function analyzeCuisineWinePairings(db) {
    console.log('🍽️ Analyzing cuisine-wine pairing patterns...');
    
    const cuisinePairings = await dbAll(db, `
        SELECT 
            JSON_EXTRACT(s.dish_context, '$.cuisine') as cuisine,
            c.wine_type,
            COUNT(*) as pairing_count,
            AVG(f.overall_rating) as avg_rating,
            AVG(f.flavor_harmony_rating) as avg_flavor_harmony
        FROM LearningPairingSessions s
        JOIN LearningPairingFeedbackEnhanced f ON s.id = f.session_id
        JOIN LearningConsumptionEvents c ON c.session_id = s.id
        WHERE c.event_type = 'consume' AND cuisine IS NOT NULL
        GROUP BY cuisine, c.wine_type
        HAVING pairing_count >= 2
        ORDER BY cuisine, avg_rating DESC
    `);
    
    const proteinPairings = await dbAll(db, `
        SELECT 
            JSON_EXTRACT(s.dish_context, '$.protein') as protein,
            c.wine_type,
            COUNT(*) as pairing_count,
            AVG(f.overall_rating) as avg_rating
        FROM LearningPairingSessions s
        JOIN LearningPairingFeedbackEnhanced f ON s.id = f.session_id
        JOIN LearningConsumptionEvents c ON c.session_id = s.id
        WHERE c.event_type = 'consume' AND protein IS NOT NULL
        GROUP BY protein, c.wine_type
        HAVING pairing_count >= 2
        ORDER BY protein, avg_rating DESC
    `);
    
    return { cuisinePairings, proteinPairings };
}

// Report generation
function generateReport(analyses) {
    let report = '';
    
    report += '================================================================================\n';
    report += 'SOMMOS PATTERN ANALYSIS REPORT\n';
    report += '================================================================================\n\n';
    report += `Generated: ${new Date().toISOString()}\n`;
    report += `Database: ${DB_PATH}\n\n`;
    
    // Seasonal Preferences
    report += '--------------------------------------------------------------------------------\n';
    report += 'SEASONAL WINE PREFERENCES\n';
    report += '--------------------------------------------------------------------------------\n\n';
    
    report += '📊 Ratings by Season:\n';
    analyses.ratings.ratingsBySeason.forEach(s => {
        report += `\n${s.season.toUpperCase()}:\n`;
        report += `  Sessions: ${s.count}\n`;
        report += `  Average Overall: ${s.avg_rating.toFixed(2)}/5.0\n`;
        report += `  Flavor Harmony: ${s.avg_flavor.toFixed(2)}/5.0\n`;
        report += `  Texture Balance: ${s.avg_texture.toFixed(2)}/5.0\n`;
        report += `  Acidity Match: ${s.avg_acidity.toFixed(2)}/5.0\n`;
        report += `  Tannin Balance: ${s.avg_tannin.toFixed(2)}/5.0\n`;
        report += `  Body Match: ${s.avg_body.toFixed(2)}/5.0\n`;
        report += `  Regional Tradition: ${s.avg_regional.toFixed(2)}/5.0\n`;
    });
    
    report += '\n🍷 Wine Type Consumption by Season:\n';
    const seasons = ['winter', 'spring', 'summer', 'autumn'];
    seasons.forEach(season => {
        const seasonWines = analyses.seasonal.wineTypesBySeason.filter(w => w.season === season);
        if (seasonWines.length > 0) {
            report += `\n${season.toUpperCase()}:\n`;
            seasonWines.forEach(w => {
                report += `  ${w.wine_type}: ${w.consumption_count} events, ${w.total_bottles} bottles (avg ${w.avg_per_event.toFixed(1)}/event)\n`;
            });
        }
    });
    
    // Guest Profiles
    report += '\n\n--------------------------------------------------------------------------------\n';
    report += 'GUEST PROFILE SEGMENTATION\n';
    report += '--------------------------------------------------------------------------------\n\n';
    
    analyses.guests.profileStats.forEach(g => {
        report += `${g.user_id.toUpperCase()}:\n`;
        report += `  Sessions: ${g.session_count}\n`;
        report += `  Average Rating: ${g.avg_rating.toFixed(2)}/5.0\n`;
        report += `  Flavor Preference: ${g.avg_flavor.toFixed(2)}/5.0\n`;
        report += `  Recommendation Rate: ${(g.recommend_rate * 100).toFixed(1)}%\n`;
        report += `  Price Satisfaction: ${g.avg_price_satisfaction.toFixed(2)}/5.0\n`;
        report += `  Decision Time: ${Math.round(g.avg_decision_time)}s\n`;
        report += `  Seasons Active: ${g.seasons_active}/4\n`;
        report += `  Occasion Variety: ${g.occasion_variety}\n`;
        
        // Wine preferences
        const guestWines = analyses.guests.winePreferencesByGuest.filter(w => w.user_id === g.user_id);
        if (guestWines.length > 0) {
            report += `  Wine Preferences:\n`;
            guestWines.forEach(w => {
                report += `    ${w.wine_type}: ${w.selections} selections, ${w.total_bottles} bottles, ${w.avg_rating.toFixed(2)}/5.0 avg\n`;
            });
        }
        
        // Occasion preferences
        const occasions = analyses.guests.occasionPreferences.filter(o => o.user_id === g.user_id);
        if (occasions.length > 0) {
            report += `  Occasions:\n`;
            occasions.forEach(o => {
                report += `    ${o.occasion}: ${o.count} times, ${o.avg_rating.toFixed(2)}/5.0 avg\n`;
            });
        }
        
        report += '\n';
    });
    
    // Procurement Efficiency
    report += '--------------------------------------------------------------------------------\n';
    report += 'PROCUREMENT EFFICIENCY METRICS\n';
    report += '--------------------------------------------------------------------------------\n\n';
    
    const om = analyses.procurement.orderMetrics[0];
    report += 'Order Performance:\n';
    report += `  Total Orders: ${om.total_orders}\n`;
    report += `  Delivered: ${om.delivered_orders} (${((om.delivered_orders/om.total_orders)*100).toFixed(1)}%)\n`;
    report += `  Average Delivery Time: ${om.avg_delivery_days.toFixed(1)} days\n\n`;
    
    report += 'Items Ordered by Wine Type:\n';
    analyses.procurement.itemMetrics.forEach(i => {
        report += `  ${i.wine_type}: ${i.order_count} orders, ${i.total_ordered} bottles (avg ${i.avg_per_order.toFixed(1)}/order)\n`;
    });
    
    report += '\nCurrent Stock Levels:\n';
    analyses.procurement.stockLevels.forEach(s => {
        report += `  ${s.wine_type}: ${s.total_bottles} bottles across ${s.unique_vintages} vintages\n`;
        report += `    Range: ${s.min_stock} - ${s.max_stock} bottles, avg ${s.avg_per_vintage.toFixed(1)}/vintage\n`;
    });
    
    report += '\nConsumption Rates:\n';
    analyses.procurement.consumptionRate.forEach(c => {
        const days = (new Date(c.last_consumption) - new Date(c.first_consumption)) / (1000 * 60 * 60 * 24);
        const rate = days > 0 ? (c.total_consumed / days).toFixed(2) : 'N/A';
        report += `  ${c.wine_type}: ${c.total_consumed} bottles in ${c.consumption_events} events\n`;
        report += `    Period: ${c.first_consumption} to ${c.last_consumption}\n`;
        report += `    Rate: ${rate} bottles/day, ${c.avg_per_event.toFixed(1)} bottles/event\n`;
    });
    
    // Rating Distributions
    report += '\n\n--------------------------------------------------------------------------------\n';
    report += 'RATING DISTRIBUTIONS\n';
    report += '--------------------------------------------------------------------------------\n\n';
    
    report += 'Overall Rating Distribution:\n';
    analyses.ratings.overallDistribution.forEach(r => {
        const bar = '█'.repeat(Math.round(r.percentage / 2));
        report += `  ${r.overall_rating} stars: ${r.count.toString().padStart(3)} (${r.percentage.toString().padStart(5)}%) ${bar}\n`;
    });
    
    const ac = analyses.ratings.aspectCorrelations;
    report += '\nAverage Ratings by Aspect:\n';
    report += `  Overall:           ${ac.avg_overall.toFixed(2)}/5.0\n`;
    report += `  Flavor Harmony:    ${ac.avg_flavor.toFixed(2)}/5.0\n`;
    report += `  Texture Balance:   ${ac.avg_texture.toFixed(2)}/5.0\n`;
    report += `  Acidity Match:     ${ac.avg_acidity.toFixed(2)}/5.0\n`;
    report += `  Tannin Balance:    ${ac.avg_tannin.toFixed(2)}/5.0\n`;
    report += `  Body Match:        ${ac.avg_body.toFixed(2)}/5.0\n`;
    report += `  Regional Tradition: ${ac.avg_regional.toFixed(2)}/5.0\n`;
    
    report += '\nTop 10 Perfect Pairings (5.0 stars):\n';
    analyses.ratings.topRatedPairings.slice(0, 10).forEach((p, i) => {
        const dish = JSON.parse(p.dish_description);
        report += `  ${i+1}. ${dish.name} + ${p.wine_type}\n`;
        report += `     Occasion: ${p.occasion}, Season: ${p.season}, Guests: ${p.guest_count}\n`;
        report += `     Flavor: ${p.flavor_harmony_rating}/5.0\n`;
    });
    
    // Cuisine Pairings
    report += '\n\n--------------------------------------------------------------------------------\n';
    report += 'CUISINE-WINE PAIRING PATTERNS\n';
    report += '--------------------------------------------------------------------------------\n\n';
    
    const cuisines = [...new Set(analyses.pairings.cuisinePairings.map(c => c.cuisine))];
    cuisines.forEach(cuisine => {
        const pairings = analyses.pairings.cuisinePairings.filter(p => p.cuisine === cuisine);
        if (pairings.length > 0) {
            report += `${cuisine}:\n`;
            pairings.forEach(p => {
                report += `  ${p.wine_type}: ${p.pairing_count}× (${p.avg_rating.toFixed(2)}/5.0 overall, ${p.avg_flavor_harmony.toFixed(2)}/5.0 flavor)\n`;
            });
            report += '\n';
        }
    });
    
    report += 'Protein-Wine Pairing Patterns:\n\n';
    const proteins = [...new Set(analyses.pairings.proteinPairings.map(p => p.protein))];
    proteins.forEach(protein => {
        const pairings = analyses.pairings.proteinPairings.filter(p => p.protein === protein);
        if (pairings.length > 0) {
            report += `${protein}:\n`;
            pairings.forEach(p => {
                report += `  ${p.wine_type}: ${p.pairing_count}× (${p.avg_rating.toFixed(2)}/5.0)\n`;
            });
            report += '\n';
        }
    });
    
    report += '\n================================================================================\n';
    report += 'END OF REPORT\n';
    report += '================================================================================\n';
    
    return report;
}

// Main execution
async function main() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║     SommOS Pattern Analysis                                    ║');
    console.log('║     Extracting insights from simulation data                   ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    
    const db = await openDatabase();
    
    try {
        // Run all analyses
        const seasonal = await analyzeSeasonalPreferences(db);
        const guests = await analyzeGuestProfiles(db);
        const procurement = await analyzeProcurementEfficiency(db);
        const ratings = await analyzeRatingDistributions(db);
        const pairings = await analyzeCuisineWinePairings(db);
        
        // Generate report
        console.log('\n📝 Generating comprehensive report...');
        const report = generateReport({ seasonal, guests, procurement, ratings, pairings });
        
        // Save report
        fs.writeFileSync(REPORT_PATH, report);
        console.log(`\n✅ Analysis complete! Report saved to: ${REPORT_PATH}\n`);
        
        // Print summary
        console.log('📊 Summary Statistics:');
        console.log(`  Seasons Analyzed: 4`);
        console.log(`  Guest Profiles: ${guests.profileStats.length}`);
        console.log(`  Wine Types: ${procurement.stockLevels.length}`);
        console.log(`  Perfect Pairings: ${ratings.topRatedPairings.length}`);
        console.log(`  Cuisine Types: ${[...new Set(pairings.cuisinePairings.map(c => c.cuisine))].length}`);
        
    } catch (error) {
        console.error('\n❌ Analysis failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await closeDatabase(db);
    }
}

// Execute
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { main };
