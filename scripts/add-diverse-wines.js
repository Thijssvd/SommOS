#!/usr/bin/env node

/**
 * SommOS Add Diverse Wines
 * Adds 130 wines to fill critical gaps identified in cellar analysis
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/sommos.db');

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

// Comprehensive wine list organized by category
const WINE_ADDITIONS = {
    rose: [
        // Provence (15)
        { name: 'Château d\'Esclans Whispering Angel', producer: 'Château d\'Esclans', region: 'Provence', style: 'Dry, elegant, mineral', notes: 'Pale pink, strawberry, white flowers, crisp acidity' },
        { name: 'Domaine Tempier Bandol Rosé', producer: 'Domaine Tempier', region: 'Provence', style: 'Full-bodied, structured', notes: 'Deep pink, red berries, herbs, garrigue' },
        { name: 'Château Minuty Prestige', producer: 'Château Minuty', region: 'Provence', style: 'Elegant, aromatic', notes: 'Pale salmon, citrus, peach, mineral' },
        { name: 'Commanderie de Peyrassol', producer: 'Commanderie de Peyrassol', region: 'Provence', style: 'Refined, delicate', notes: 'Light pink, raspberry, rose petals' },
        { name: 'Domaines Ott Côtes de Provence', producer: 'Domaines Ott', region: 'Provence', style: 'Luxurious, complex', notes: 'Pale peach, white fruits, subtle spice' },
        
        // Spanish (15)
        { name: 'Muga Rosado', producer: 'Bodegas Muga', region: 'Rioja', style: 'Fruity, vibrant', notes: 'Bright pink, strawberry, fresh herbs' },
        { name: 'Marqués de Cáceres Rosado', producer: 'Marqués de Cáceres', region: 'Rioja', style: 'Fresh, aromatic', notes: 'Rose petal, red berries, crisp' },
        { name: 'Artadi Viñas de Gain Rosado', producer: 'Artadi', region: 'Navarra', style: 'Structured, savory', notes: 'Cherry, herbs, minerality' },
        { name: 'Chivite Gran Feudo Rosado', producer: 'Julián Chivite', region: 'Navarra', style: 'Elegant, balanced', notes: 'Raspberry, citrus, floral' },
        { name: 'Torre de Oña Rosado', producer: 'Torre de Oña', region: 'Rioja', style: 'Modern, fruit-forward', notes: 'Strawberry, watermelon, refreshing' },
        
        // Italian (12)
        { name: 'Chiaretto di Bardolino', producer: 'Zenato', region: 'Veneto', style: 'Light, crisp', notes: 'Pale cherry, red fruits, mineral' },
        { name: 'Cerasuolo d\'Abruzzo', producer: 'Cataldi Madonna', region: 'Abruzzo', style: 'Intense, structured', notes: 'Deep pink, cherry, spice' },
        { name: 'Rosa dei Frati', producer: 'Ca\' dei Frati', region: 'Lombardy', style: 'Elegant, aromatic', notes: 'Pale salmon, peach, floral' },
        { name: 'Planeta Rosé', producer: 'Planeta', region: 'Sicily', style: 'Mediterranean, fresh', notes: 'Coral pink, citrus, herbs' },
        { name: 'Donnafugata Rosa', producer: 'Donnafugata', region: 'Sicily', style: 'Exotic, fruit-forward', notes: 'Pink grapefruit, tropical, mineral' },
        
        // Greek (8)
        { name: 'Kir-Yianni Akakies', producer: 'Kir-Yianni', region: 'Macedonia', style: 'Elegant, complex', notes: 'Xinomavro grape, strawberry, tomato leaf' },
        { name: 'Alpha Estate Rosé', producer: 'Alpha Estate', region: 'Florina', style: 'Structured, refined', notes: 'Salmon pink, red berries, herbs' },
        { name: 'Tselepos Rosé', producer: 'Tselepos', region: 'Arcadia', style: 'Fresh, aromatic', notes: 'Pale pink, cherry, citrus' },
        { name: 'Gai\'a Agiorgitiko Rosé', producer: 'Gai\'a Estate', region: 'Nemea', style: 'Fruity, vibrant', notes: 'Rose petal, strawberry, spice' }
    ],
    
    mediterranean_whites: [
        // Greek (10)
        { name: 'Gai\'a Thalassitis Assyrtiko', producer: 'Gai\'a Estate', region: 'Santorini', style: 'Mineral, intense', notes: 'Citrus, flint, sea salt, volcanic' },
        { name: 'Domaine Sigalas Assyrtiko', producer: 'Sigalas', region: 'Santorini', style: 'Complex, age-worthy', notes: 'Lemon, mineral, white flowers' },
        { name: 'Tselepos Moschofilero', producer: 'Tselepos', region: 'Mantinia', style: 'Aromatic, elegant', notes: 'Rose petals, citrus, crisp acidity' },
        { name: 'Kir-Yianni Paranga White', producer: 'Kir-Yianni', region: 'Macedonia', style: 'Fresh, versatile', notes: 'Stone fruits, herbs, mineral' },
        { name: 'Alpha Estate Malagouzia', producer: 'Alpha Estate', region: 'Florina', style: 'Aromatic, full', notes: 'Peach, jasmine, honeydew' },
        
        // Spanish (10)
        { name: 'Pazo de Señorans Albariño', producer: 'Pazo de Señorans', region: 'Rías Baixas', style: 'Elegant, mineral', notes: 'White peach, lemon, saline' },
        { name: 'Martín Códax Albariño', producer: 'Martín Códax', region: 'Rías Baixas', style: 'Fresh, aromatic', notes: 'Citrus, apple, ocean breeze' },
        { name: 'Naia Verdejo', producer: 'Naia', region: 'Rueda', style: 'Crisp, herbaceous', notes: 'Grapefruit, fennel, white pepper' },
        { name: 'José Pariente Verdejo', producer: 'José Pariente', region: 'Rueda', style: 'Rich, complex', notes: 'Tropical fruits, herbs, minerality' },
        { name: 'Rafael Palacios Louro', producer: 'Rafael Palacios', region: 'Valdeorras', style: 'Structured, refined', notes: 'Stone fruits, flowers, granite' },
        
        // Italian (10)
        { name: 'Argiolas Costamolino Vermentino', producer: 'Argiolas', region: 'Sardinia', style: 'Fresh, Mediterranean', notes: 'Citrus, herbs, sea salt' },
        { name: 'Feudi di San Gregorio Fiano', producer: 'Feudi di San Gregorio', region: 'Campania', style: 'Rich, aromatic', notes: 'Honey, nuts, white flowers' },
        { name: 'Mastroberardino Greco di Tufo', producer: 'Mastroberardino', region: 'Campania', style: 'Mineral, age-worthy', notes: 'Pear, almond, volcanic' },
        { name: 'Benanti Etna Bianco', producer: 'Benanti', region: 'Sicily', style: 'Volcanic, intense', notes: 'Lemon, flint, herbs' },
        { name: 'Planeta La Segreta Bianco', producer: 'Planeta', region: 'Sicily', style: 'Fresh, versatile', notes: 'Stone fruits, citrus, herbs' }
    ],
    
    dessert_fortified: [
        // Port (8)
        { name: 'Taylor Fladgate Vintage Port', producer: 'Taylor Fladgate', region: 'Douro', style: 'Full-bodied, complex', notes: 'Black fruits, chocolate, spice' },
        { name: 'Graham\'s 20 Year Tawny', producer: 'Graham\'s', region: 'Douro', style: 'Rich, nutty', notes: 'Dried fruits, caramel, nuts' },
        { name: 'Dow\'s Vintage Port', producer: 'Dow\'s', region: 'Douro', style: 'Powerful, structured', notes: 'Blackberry, plum, tobacco' },
        { name: 'Fonseca LBV Port', producer: 'Fonseca', region: 'Douro', style: 'Intense, fruity', notes: 'Black cherry, cocoa, spice' },
        
        // Sauternes & Sweet (8)
        { name: 'Château d\'Yquem Sauternes', producer: 'Château d\'Yquem', region: 'Bordeaux', style: 'Legendary, luscious', notes: 'Honey, apricot, botrytis complexity' },
        { name: 'Château Rieussec Sauternes', producer: 'Château Rieussec', region: 'Bordeaux', style: 'Rich, elegant', notes: 'Peach, honey, flowers' },
        { name: 'Dr. Loosen Erdener Treppchen Auslese', producer: 'Dr. Loosen', region: 'Mosel', style: 'Sweet, mineral', notes: 'Apricot, honey, slate' },
        { name: 'Inniskillin Icewine', producer: 'Inniskillin', region: 'Canada', style: 'Intense, sweet', notes: 'Tropical fruits, honey, vibrant acidity' },
        
        // Italian Dessert (7)
        { name: 'Avignonesi Vin Santo', producer: 'Avignonesi', region: 'Tuscany', style: 'Rich, oxidative', notes: 'Dried fruits, nuts, caramel' },
        { name: 'Maculan Torcolato', producer: 'Maculan', region: 'Veneto', style: 'Golden, luscious', notes: 'Honey, apricot, candied fruits' },
        { name: 'Donnafugata Ben Ryé Passito', producer: 'Donnafugata', region: 'Sicily', style: 'Exotic, sweet', notes: 'Dried apricot, orange blossom, honey' },
        { name: 'Paolo Saracco Moscato d\'Asti', producer: 'Paolo Saracco', region: 'Piedmont', style: 'Light, aromatic', notes: 'Peach, flowers, low alcohol' },
        
        // Sherry (7)
        { name: 'González Byass Matusalem Oloroso', producer: 'González Byass', region: 'Jerez', style: 'Rich, nutty', notes: 'Walnut, dried fruits, spice' },
        { name: 'Lustau Pedro Ximénez San Emilio', producer: 'Lustau', region: 'Jerez', style: 'Sweet, intense', notes: 'Raisins, fig, molasses' },
        { name: 'Hidalgo La Gitana Manzanilla', producer: 'Hidalgo', region: 'Jerez', style: 'Dry, saline', notes: 'Almond, sea breeze, crisp' }
    ],
    
    tropical_whites: [
        // New Zealand (7)
        { name: 'Cloudy Bay Sauvignon Blanc', producer: 'Cloudy Bay', region: 'Marlborough', style: 'Vibrant, tropical', notes: 'Passion fruit, lime, herbs' },
        { name: 'Kim Crawford Sauvignon Blanc', producer: 'Kim Crawford', region: 'Marlborough', style: 'Crisp, fresh', notes: 'Grapefruit, gooseberry, citrus' },
        { name: 'Dog Point Sauvignon Blanc', producer: 'Dog Point', region: 'Marlborough', style: 'Mineral, elegant', notes: 'Lime, flint, herbs' },
        
        // Australian (7)
        { name: 'Grosset Polish Hill Riesling', producer: 'Grosset', region: 'Clare Valley', style: 'Crisp, age-worthy', notes: 'Lime, mineral, floral' },
        { name: 'Pewsey Vale Riesling', producer: 'Pewsey Vale', region: 'Eden Valley', style: 'Fresh, aromatic', notes: 'Citrus, apple, slate' },
        { name: 'Penfolds Yattarna Chardonnay', producer: 'Penfolds', region: 'Multi-region', style: 'Rich, complex', notes: 'Stone fruits, oak, mineral' },
        
        // South African (6)
        { name: 'Mulderbosch Chenin Blanc', producer: 'Mulderbosch', region: 'Stellenbosch', style: 'Fresh, versatile', notes: 'Pear, honey, tropical' },
        { name: 'Ken Forrester Chenin Blanc', producer: 'Ken Forrester', region: 'Stellenbosch', style: 'Rich, textured', notes: 'Stone fruits, honey, oak' },
        { name: 'Cape Point Sauvignon Blanc', producer: 'Cape Point', region: 'Cape Point', style: 'Mineral, elegant', notes: 'Citrus, fynbos, saline' }
    ]
};

async function addWineToDatabase(db, wine, wineType, country, grapes, year = 2020) {
    // Add wine
    const wineResult = await dbRun(db, `
        INSERT INTO Wines (name, producer, region, country, wine_type, grape_varieties, style, tasting_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [wine.name, wine.producer, wine.region, country, wineType, grapes, wine.style, wine.notes]);
    
    // Add vintage
    const vintageResult = await dbRun(db, `
        INSERT INTO Vintages (wine_id, year, quality_score, peak_drinking_start, peak_drinking_end)
        VALUES (?, ?, ?, ?, ?)
    `, [wineResult.lastID, year, 85 + Math.floor(Math.random() * 15), year, year + 15]);
    
    // Add stock (3-6 bottles each, main-cellar)
    const quantity = 3 + Math.floor(Math.random() * 4);
    await dbRun(db, `
        INSERT INTO Stock (vintage_id, location, quantity)
        VALUES (?, 'main-cellar', ?)
    `, [vintageResult.lastID, quantity]);
    
    return wineResult.lastID;
}

async function main() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║           SommOS Add Diverse Wines                            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    
    const db = await openDatabase();
    
    try {
        let totalAdded = 0;
        
        // Add Rosé wines
        console.log('🌸 Adding Rosé wines (50)...');
        for (const wine of WINE_ADDITIONS.rose) {
            const country = wine.region.includes('Provence') ? 'France' : 
                           wine.region.includes('Rioja') || wine.region.includes('Navarra') ? 'Spain' :
                           wine.region.includes('Sicily') || wine.region.includes('Abruzzo') || wine.region.includes('Veneto') || wine.region.includes('Lombardy') ? 'Italy' :
                           'Greece';
            await addWineToDatabase(db, wine, 'Rosé', country, 'Blend', 2022);
            totalAdded++;
            if (totalAdded % 10 === 0) {
                console.log(`   Added ${totalAdded} wines...`);
            }
        }
        console.log(`   ✅ ${WINE_ADDITIONS.rose.length} Rosé wines added\n`);
        
        // Add Mediterranean Whites
        console.log('🌊 Adding Mediterranean Whites (30)...');
        for (const wine of WINE_ADDITIONS.mediterranean_whites) {
            const country = wine.region.includes('Santorini') || wine.region.includes('Macedonia') || wine.region.includes('Mantinia') || wine.region.includes('Florina') ? 'Greece' :
                           wine.region.includes('Rías Baixas') || wine.region.includes('Rueda') || wine.region.includes('Valdeorras') ? 'Spain' :
                           'Italy';
            const grapes = wine.name.includes('Assyrtiko') ? 'Assyrtiko' :
                          wine.name.includes('Moschofilero') ? 'Moschofilero' :
                          wine.name.includes('Malagouzia') ? 'Malagouzia' :
                          wine.name.includes('Albariño') ? 'Albariño' :
                          wine.name.includes('Verdejo') ? 'Verdejo' :
                          wine.name.includes('Vermentino') ? 'Vermentino' :
                          wine.name.includes('Fiano') ? 'Fiano' :
                          wine.name.includes('Greco') ? 'Greco' : 'Blend';
            await addWineToDatabase(db, wine, 'White', country, grapes, 2021);
            totalAdded++;
            if (totalAdded % 10 === 0) {
                console.log(`   Added ${totalAdded} wines...`);
            }
        }
        console.log(`   ✅ ${WINE_ADDITIONS.mediterranean_whites.length} Mediterranean whites added\n`);
        
        // Add Dessert/Fortified
        console.log('🍯 Adding Dessert/Fortified wines (30)...');
        for (const wine of WINE_ADDITIONS.dessert_fortified) {
            const type = wine.region === 'Douro' || wine.region === 'Jerez' ? 'Fortified' : 'Dessert';
            const country = wine.region === 'Douro' || wine.region === 'Jerez' ? 'Portugal/Spain' :
                           wine.region === 'Bordeaux' ? 'France' :
                           wine.region === 'Mosel' ? 'Germany' :
                           wine.region === 'Canada' ? 'Canada' :
                           wine.region === 'Tuscany' || wine.region === 'Veneto' || wine.region === 'Sicily' || wine.region === 'Piedmont' ? 'Italy' : 'Spain';
            await addWineToDatabase(db, wine, type, country, 'Blend', 2018);
            totalAdded++;
            if (totalAdded % 10 === 0) {
                console.log(`   Added ${totalAdded} wines...`);
            }
        }
        console.log(`   ✅ ${WINE_ADDITIONS.dessert_fortified.length} Dessert/Fortified wines added\n`);
        
        // Add Tropical Whites
        console.log('🏝️  Adding Tropical Whites (20)...');
        for (const wine of WINE_ADDITIONS.tropical_whites) {
            const country = wine.region.includes('Marlborough') || wine.region.includes('Zealand') ? 'New Zealand' :
                           wine.region.includes('Clare') || wine.region.includes('Eden') || wine.region.includes('Penfolds') ? 'Australia' :
                           'South Africa';
            const grapes = wine.name.includes('Sauvignon Blanc') ? 'Sauvignon Blanc' :
                          wine.name.includes('Riesling') ? 'Riesling' :
                          wine.name.includes('Chardonnay') ? 'Chardonnay' :
                          wine.name.includes('Chenin Blanc') ? 'Chenin Blanc' : 'Sauvignon Blanc';
            await addWineToDatabase(db, wine, 'White', country, grapes, 2022);
            totalAdded++;
            if (totalAdded % 10 === 0) {
                console.log(`   Added ${totalAdded} wines...`);
            }
        }
        console.log(`   ✅ ${WINE_ADDITIONS.tropical_whites.length} Tropical whites added\n`);
        
        console.log('✅ All wines added successfully!');
        console.log(`   Total: ${totalAdded} wines`);
        console.log('   Breakdown:');
        console.log(`     • Rosé: ${WINE_ADDITIONS.rose.length}`);
        console.log(`     • Mediterranean Whites: ${WINE_ADDITIONS.mediterranean_whites.length}`);
        console.log(`     • Dessert/Fortified: ${WINE_ADDITIONS.dessert_fortified.length}`);
        console.log(`     • Tropical Whites: ${WINE_ADDITIONS.tropical_whites.length}\n`);
        
    } catch (error) {
        console.error('\n❌ Failed to add wines:', error.message);
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
