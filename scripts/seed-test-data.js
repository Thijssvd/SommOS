#!/usr/bin/env node

/**
 * Seed Test Data Script
 * Resets the database to a known, deterministic state for E2E testing
 * 
 * Usage: npm run seed:test
 */

const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '../data/sommos.db');
const SALT_ROUNDS = 10;

// Helper functions
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

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Seed functions
async function seedRoles(db) {
  console.log('  📋 Seeding roles...');
  
  await run(db, `INSERT OR IGNORE INTO Roles (name, description) VALUES (?, ?)`, 
    ['admin', 'Administrator with full access']);
  await run(db, `INSERT OR IGNORE INTO Roles (name, description) VALUES (?, ?)`, 
    ['crew', 'Crew member with operational access']);
  await run(db, `INSERT OR IGNORE INTO Roles (name, description) VALUES (?, ?)`, 
    ['guest', 'Guest with limited read access']);
  
  console.log('  ✅ Roles seeded');
}

async function seedUsers(db) {
  console.log('  👥 Seeding test users...');
  
  const users = [
    { email: 'admin@sommos.local', password: 'admin123', role: 'admin' },
    { email: 'crew@sommos.local', password: 'crew123', role: 'crew' },
    { email: 'guest@sommos.local', password: 'guest123', role: 'guest' },
  ];
  
  for (const user of users) {
    const passwordHash = await hashPassword(user.password);
    
    await run(
      db,
      `INSERT OR REPLACE INTO Users (email, password_hash, role)
       VALUES (?, ?, ?)`,
      [user.email, passwordHash, user.role]
    );
    
    const userRow = await get(db, `SELECT id FROM Users WHERE email = ?`, [user.email]);
    const roleRow = await get(db, `SELECT id FROM Roles WHERE name = ?`, [user.role]);
    
    if (userRow && roleRow) {
      await run(db, `INSERT OR IGNORE INTO UserRoles (user_id, role_id) VALUES (?, ?)`, 
        [userRow.id, roleRow.id]);
    }
    
    console.log(`    ✓ ${user.email} (${user.role})`);
  }
  
  console.log('  ✅ Test users seeded');
}

async function seedGuestCodes(db) {
  console.log('  🎫 Seeding guest event codes...');
  
  // Guest code without PIN: YACHT2024
  const code1 = {
    token: 'YACHT2024',
    email: 'guest-yacht@sommos.local',
    role: 'guest',
    pin: null,
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  };
  
  const tokenHash1 = hashToken(code1.token);
  await run(db, 'DELETE FROM Invites WHERE token_hash = ?', [tokenHash1]);
  await run(
    db,
    `INSERT INTO Invites (email, role, token_hash, pin_hash, expires_at) 
     VALUES (?, ?, ?, ?, ?)`,
    [code1.email, code1.role, tokenHash1, null, code1.expiresAt]
  );
  console.log(`    ✓ ${code1.token} (no PIN)`);
  
  // Guest code with PIN: GUEST2024 / 123456
  const code2 = {
    token: 'GUEST2024',
    email: 'guest-vip@sommos.local',
    role: 'guest',
    pin: '123456',
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  };
  
  const tokenHash2 = hashToken(code2.token);
  const pinHash2 = await hashPassword(code2.pin);
  await run(db, 'DELETE FROM Invites WHERE token_hash = ?', [tokenHash2]);
  await run(
    db,
    `INSERT INTO Invites (email, role, token_hash, pin_hash, expires_at) 
     VALUES (?, ?, ?, ?, ?)`,
    [code2.email, code2.role, tokenHash2, pinHash2, code2.expiresAt]
  );
  console.log(`    ✓ ${code2.token} (PIN: ${code2.pin})`);
  
  console.log('  ✅ Guest event codes seeded');
}

async function seedWines(db) {
  console.log('  🍷 Seeding test wines...');
  
  const wines = [
    {
      producer: 'Château Margaux',
      wine_name: 'Grand Vin',
      vintage: 2015,
      type: 'Red',
      region: 'Bordeaux',
      country: 'France',
      grapes: 'Cabernet Sauvignon, Merlot',
      quantity: 12,
      location: 'main-cellar',
      unit_price: 850.00
    },
    {
      producer: 'Domaine Leflaive',
      wine_name: 'Puligny-Montrachet',
      vintage: 2018,
      type: 'White',
      region: 'Burgundy',
      country: 'France',
      grapes: 'Chardonnay',
      quantity: 6,
      location: 'service-bar',
      unit_price: 220.00
    },
    {
      producer: 'Dom Pérignon',
      wine_name: 'Brut',
      vintage: 2012,
      type: 'Sparkling',
      region: 'Champagne',
      country: 'France',
      grapes: 'Chardonnay, Pinot Noir',
      quantity: 24,
      location: 'service-bar',
      unit_price: 195.00
    },
    {
      producer: 'Gaja',
      wine_name: 'Barolo Sperss',
      vintage: 2016,
      type: 'Red',
      region: 'Piedmont',
      country: 'Italy',
      grapes: 'Nebbiolo',
      quantity: 8,
      location: 'private-reserve',
      unit_price: 425.00
    },
    {
      producer: 'Kistler',
      wine_name: 'Les Noisetiers',
      vintage: 2019,
      type: 'White',
      region: 'Sonoma Coast',
      country: 'USA',
      grapes: 'Chardonnay',
      quantity: 10,
      location: 'main-cellar',
      unit_price: 135.00
    },
    {
      producer: 'Taylor Fladgate',
      wine_name: 'Vintage Port',
      vintage: 2000,
      type: 'Fortified',
      region: 'Douro',
      country: 'Portugal',
      grapes: 'Touriga Nacional, Touriga Franca',
      quantity: 4,
      location: 'private-reserve',
      unit_price: 285.00
    },
    {
      producer: 'Opus One',
      wine_name: 'Proprietary Red',
      vintage: 2017,
      type: 'Red',
      region: 'Napa Valley',
      country: 'USA',
      grapes: 'Cabernet Sauvignon, Merlot',
      quantity: 15,
      location: 'main-cellar',
      unit_price: 385.00
    },
    {
      producer: 'Penfolds',
      wine_name: 'Grange',
      vintage: 2016,
      type: 'Red',
      region: 'South Australia',
      country: 'Australia',
      grapes: 'Shiraz',
      quantity: 9,
      location: 'main-cellar',
      unit_price: 695.00
    },
    {
      producer: 'Antinori',
      wine_name: 'Tignanello',
      vintage: 2018,
      type: 'Red',
      region: 'Tuscany',
      country: 'Italy',
      grapes: 'Sangiovese, Cabernet Sauvignon',
      quantity: 18,
      location: 'main-cellar',
      unit_price: 145.00
    },
    {
      producer: 'Veuve Clicquot',
      wine_name: 'La Grande Dame',
      vintage: 2012,
      type: 'Sparkling',
      region: 'Champagne',
      country: 'France',
      grapes: 'Pinot Noir, Chardonnay',
      quantity: 20,
      location: 'service-bar',
      unit_price: 175.00
    },
  ];
  
  for (const wine of wines) {
    // Check if wine exists
    const existing = await get(
      db,
      `SELECT id FROM Wines WHERE producer = ? AND name = ?`,
      [wine.producer, wine.wine_name]
    );
    
    let wineId;
    if (existing) {
      wineId = existing.id;
    } else {
      const result = await run(
        db,
        `INSERT INTO Wines (producer, name, wine_type, region, country, grape_varieties)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [wine.producer, wine.wine_name, wine.type, wine.region, wine.country, wine.grapes]
      );
      wineId = result.lastID;
    }
    
    // Check if vintage exists
    const existingVintage = await get(
      db,
      `SELECT id FROM Vintages WHERE wine_id = ? AND year = ?`,
      [wineId, wine.vintage]
    );
    
    let vintageId;
    if (existingVintage) {
      vintageId = existingVintage.id;
    } else {
      const vintageResult = await run(
        db,
        `INSERT INTO Vintages (wine_id, year)
         VALUES (?, ?)`,
        [wineId, wine.vintage]
      );
      vintageId = vintageResult.lastID;
    }
    
    // Update or insert stock
    const existingStock = await get(
      db,
      `SELECT id, quantity FROM Stock WHERE vintage_id = ? AND location = ?`,
      [vintageId, wine.location]
    );
    
    if (existingStock) {
      await run(
        db,
        `UPDATE Stock SET quantity = ? WHERE id = ?`,
        [wine.quantity, existingStock.id]
      );
    } else {
      await run(
        db,
        `INSERT INTO Stock (vintage_id, location, quantity)
         VALUES (?, ?, ?)`,
        [vintageId, wine.location, wine.quantity]
      );
    }
    
    // Update price book (requires supplier_id, so skip for now or use a default)
    // Price book requires supplier_id, so we'll skip this for test data
    // Or insert a default supplier first if needed
    
    console.log(`    ✓ ${wine.producer} ${wine.wine_name} ${wine.vintage}`);
  }
  
  console.log('  ✅ Test wines seeded');
}

// Main seed function
async function seedTestData() {
  console.log('\n🌱 Seeding test data for E2E tests...\n');
  
  const db = new sqlite3.Database(DB_PATH);
  
  try {
    await run(db, 'BEGIN TRANSACTION');
    
    await seedRoles(db);
    await seedUsers(db);
    await seedGuestCodes(db);
    await seedWines(db);
    
    await run(db, 'COMMIT');
    
    console.log('\n✅ Test data seeding complete!\n');
    console.log('📊 Test Accounts:');
    console.log('   Admin:  admin@sommos.local / admin123');
    console.log('   Crew:   crew@sommos.local / crew123');
    console.log('   Guest:  guest@sommos.local / guest123');
    console.log('\n🎫 Guest Event Codes:');
    console.log('   No PIN:   YACHT2024');
    console.log('   With PIN: GUEST2024 (PIN: 123456)');
    console.log('\n🍷 Test Wines: 10 bottles seeded\n');
    
  } catch (err) {
    console.error('\n❌ Test data seed error:', err.message);
    console.error(err);
    try { await run(db, 'ROLLBACK'); } catch (_) {}
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run if called directly
if (require.main === module) {
  seedTestData().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { seedTestData };
