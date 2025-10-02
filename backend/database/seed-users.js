const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const DB_PATH = path.join(__dirname, '../../data/sommos.db');
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);

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

async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function ensureRole(db, name, description = null) {
  await run(db, `INSERT OR IGNORE INTO Roles (name, description) VALUES (?, ?)`, [name, description]);
  const row = await get(db, `SELECT id FROM Roles WHERE name = ?`, [name]);
  return row && row.id;
}

async function ensureUser(db, email, password, roleName) {
  const passwordHash = password ? await hashPassword(password) : null;
  await run(
    db,
    `INSERT OR IGNORE INTO Users (email, password_hash, role)
     VALUES (?, ?, ?)`,
    [email, passwordHash, roleName]
  );
  const user = await get(db, `SELECT id FROM Users WHERE email = ?`, [email]);
  const role = await get(db, `SELECT id FROM Roles WHERE name = ?`, [roleName]);
  if (user && role) {
    await run(db, `INSERT OR IGNORE INTO UserRoles (user_id, role_id) VALUES (?, ?)`, [user.id, role.id]);
  }
}

async function seedUsers() {
  console.log('🌱 Seeding users (admin, crew, guest) ...');
  const db = new sqlite3.Database(DB_PATH);

  const ADMIN_EMAIL = process.env.SOMMOS_ADMIN_EMAIL || 'admin@sommos.local';
  const ADMIN_PASSWORD = process.env.SOMMOS_ADMIN_PASSWORD || 'admin123';
  const CREW_EMAIL = process.env.SOMMOS_CREW_EMAIL || 'crew@sommos.local';
  const CREW_PASSWORD = process.env.SOMMOS_CREW_PASSWORD || 'crew123';
  const GUEST_EMAIL = process.env.SOMMOS_GUEST_EMAIL || 'guest@sommos.local';
  const GUEST_PASSWORD = process.env.SOMMOS_GUEST_PASSWORD || 'guest123';

  if (!process.env.SOMMOS_ADMIN_PASSWORD) {
    console.warn('⚠️  Using default admin password for development. Set SOMMOS_ADMIN_PASSWORD to override.');
  }

  try {
    await run(db, 'BEGIN TRANSACTION');

    // Ensure roles exist
    await ensureRole(db, 'admin', 'Administrator with full access');
    await ensureRole(db, 'crew', 'Crew member with operational access');
    await ensureRole(db, 'guest', 'Guest with limited read access');

    // Ensure users exist
    await ensureUser(db, ADMIN_EMAIL, ADMIN_PASSWORD, 'admin');
    await ensureUser(db, CREW_EMAIL, CREW_PASSWORD, 'crew');
    await ensureUser(db, GUEST_EMAIL, GUEST_PASSWORD, 'guest');

    await run(db, 'COMMIT');
    console.log('✅ User seed complete');
  } catch (err) {
    console.error('❌ User seed error:', err.message);
    try { await run(db, 'ROLLBACK'); } catch (_) {}
    process.exit(1);
  } finally {
    db.close();
  }
}

if (require.main === module) {
  seedUsers();
}

module.exports = { seedUsers };


