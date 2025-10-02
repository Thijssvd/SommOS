const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/sommos.db');

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) return reject(err);
      resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

async function seedLookups() {
  console.log('🌱 Seeding lookup data (regions, appellations, grapes) ...');
  const db = new sqlite3.Database(DB_PATH);

  const regions = [
    { name: 'Bordeaux', country: 'France' },
    { name: 'Burgundy', country: 'France' },
    { name: 'Champagne', country: 'France' },
    { name: 'Tuscany', country: 'Italy' },
    { name: 'Piedmont', country: 'Italy' },
    { name: 'Rioja', country: 'Spain' },
    { name: 'Napa Valley', country: 'United States' },
    { name: 'Mosel', country: 'Germany' }
  ];

  const appellationsByRegion = {
    'Bordeaux|France': ['Pauillac', 'Margaux', 'Saint-Émilion', 'Pomerol', 'Graves'],
    'Burgundy|France': ['Côte de Nuits', 'Côte de Beaune', 'Chablis'],
    'Champagne|France': ['Champagne'],
    'Tuscany|Italy': ['Chianti Classico', 'Brunello di Montalcino', 'Bolgheri'],
    'Piedmont|Italy': ['Barolo', 'Barbaresco'],
    'Rioja|Spain': ['Rioja DOCa'],
    'Napa Valley|United States': ['Rutherford', 'Stags Leap District', 'Oakville'],
    'Mosel|Germany': ['Mosel']
  };

  const grapes = [
    { name: 'Cabernet Sauvignon', color: 'Red' },
    { name: 'Merlot', color: 'Red' },
    { name: 'Cabernet Franc', color: 'Red' },
    { name: 'Pinot Noir', color: 'Red' },
    { name: 'Syrah', color: 'Red' },
    { name: 'Sangiovese', color: 'Red' },
    { name: 'Nebbiolo', color: 'Red' },
    { name: 'Tempranillo', color: 'Red' },
    { name: 'Chardonnay', color: 'White' },
    { name: 'Sauvignon Blanc', color: 'White' },
    { name: 'Riesling', color: 'White' }
  ];

  try {
    await run(db, 'BEGIN TRANSACTION');

    // Seed regions
    for (const region of regions) {
      await run(
        db,
        `INSERT OR IGNORE INTO Regions (name, country, region_type, created_by, updated_at)
         VALUES (?, ?, 'region', 'seed', strftime('%s','now'))`,
        [region.name, region.country]
      );
    }

    // Seed appellations
    for (const key of Object.keys(appellationsByRegion)) {
      const [name, country] = key.split('|');
      const regionRow = await get(db, `SELECT id FROM Regions WHERE name = ? AND country = ?`, [name, country]);
      if (!regionRow) continue;
      for (const app of appellationsByRegion[key]) {
        await run(
          db,
          `INSERT OR IGNORE INTO Appellations (name, region_id, created_by, updated_at)
           VALUES (?, ?, 'seed', strftime('%s','now'))`,
          [app, regionRow.id]
        );
      }
    }

    // Seed grapes
    for (const grape of grapes) {
      await run(
        db,
        `INSERT OR IGNORE INTO Grapes (name, color, created_by, updated_at)
         VALUES (?, ?, 'seed', strftime('%s','now'))`,
        [grape.name, grape.color]
      );
    }

    await run(db, 'COMMIT');
    console.log('✅ Lookup seed complete');
  } catch (err) {
    console.error('❌ Lookup seed error:', err.message);
    try { await run(db, 'ROLLBACK'); } catch (_) {}
    process.exit(1);
  } finally {
    db.close();
  }
}

if (require.main === module) {
  seedLookups();
}

module.exports = { seedLookups };


