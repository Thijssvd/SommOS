const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '../../data/sommos.db');
const SALT_ROUNDS = 10;

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) return reject(err);
      resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function seedGuestCodes() {
  console.log('🌱 Seeding guest event codes for E2E tests...');
  const db = new sqlite3.Database(DB_PATH);

  try {
    await run(db, 'BEGIN TRANSACTION');

    // Guest event code without PIN: YACHT2024
    const guestToken1 = 'YACHT2024';
    const guestTokenHash1 = hashToken(guestToken1);
    const guestExpiresAt1 = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 year

    await run(db, 'DELETE FROM Invites WHERE token_hash = ?', [guestTokenHash1]);
    await run(
      db,
      `INSERT INTO Invites (email, role, token_hash, pin_hash, expires_at) 
       VALUES (?, ?, ?, ?, ?)`,
      ['guest-yacht@sommos.local', 'guest', guestTokenHash1, null, guestExpiresAt1]
    );

    console.log(`✅ Created guest event code: ${guestToken1} (no PIN)`);

    // Guest event code with PIN: GUEST2024 / 123456
    const guestToken2 = 'GUEST2024';
    const guestTokenHash2 = hashToken(guestToken2);
    const guestPin = '123456';
    const guestPinHash = await bcrypt.hash(guestPin, SALT_ROUNDS);
    const guestExpiresAt2 = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 year

    await run(db, 'DELETE FROM Invites WHERE token_hash = ?', [guestTokenHash2]);
    await run(
      db,
      `INSERT INTO Invites (email, role, token_hash, pin_hash, expires_at) 
       VALUES (?, ?, ?, ?, ?)`,
      ['guest-vip@sommos.local', 'guest', guestTokenHash2, guestPinHash, guestExpiresAt2]
    );

    console.log(`✅ Created guest event code: ${guestToken2} (PIN: ${guestPin})`);

    await run(db, 'COMMIT');
    console.log('✅ Guest event codes seeded successfully');
  } catch (err) {
    console.error('❌ Guest code seed error:', err.message);
    try { await run(db, 'ROLLBACK'); } catch (_) {}
    process.exit(1);
  } finally {
    db.close();
  }
}

if (require.main === module) {
  seedGuestCodes();
}

module.exports = { seedGuestCodes };
