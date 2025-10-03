#!/usr/bin/env node
/**
 * Seed Guest Invite Tokens for E2E Tests
 * 
 * This script inserts the guest invite tokens YACHT2025 and VIP2025
 * into the database, which are required by the E2E tests.
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Determine database path
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'sommos.db');

// Check if database exists
if (!fs.existsSync(DB_PATH)) {
  console.error(`❌ Database not found at ${DB_PATH}`);
  console.error('Run `npm run setup:db` first');
  process.exit(1);
}

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(DB_PATH);

/**
 * Hash a token using SHA256
 * @param {string} token - The plaintext token
 * @returns {string} The hashed token
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Insert guest invite tokens
 */
async function seedGuestInvites() {
  return new Promise((resolve, reject) => {
    // Guest invite tokens from test credentials
    const invites = [
      {
        email: 'guest@yacht.com',
        role: 'guest',
        token: 'YACHT2025',
        pin: null,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year from now
      },
      {
        email: 'guest-with-pin@yacht.com',
        role: 'guest',
        token: 'VIP2025',
        pin: '123456',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year from now
      }
    ];

    console.log('🔐 Seeding guest invite tokens...');

    db.serialize(() => {
      // Start transaction
      db.run('BEGIN TRANSACTION');

      // Delete existing test invites (if any)
      const deleteStmt = db.prepare('DELETE FROM Invites WHERE email IN (?, ?)');
      deleteStmt.run('guest@yacht.com', 'guest-with-pin@yacht.com');
      deleteStmt.finalize();

      // Insert new invites
      const insertStmt = db.prepare(`
        INSERT INTO Invites (email, role, token_hash, pin_hash, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

      invites.forEach((invite) => {
        const tokenHash = hashToken(invite.token);
        const pinHash = invite.pin ? hashToken(invite.pin) : null;

        console.log(`  📝 Creating invite for ${invite.email}`);
        console.log(`     Token: ${invite.token}`);
        if (invite.pin) {
          console.log(`     PIN: ${invite.pin}`);
        }
        console.log(`     Expires: ${invite.expiresAt}`);

        insertStmt.run(
          invite.email,
          invite.role,
          tokenHash,
          pinHash,
          invite.expiresAt
        );
      });

      insertStmt.finalize();

      // Commit transaction
      db.run('COMMIT', (err) => {
        if (err) {
          console.error('❌ Error committing transaction:', err);
          db.run('ROLLBACK');
          reject(err);
        } else {
          console.log('✅ Guest invite tokens seeded successfully!');
          resolve();
        }
      });
    });
  });
}

// Run the seeding
seedGuestInvites()
  .then(() => {
    db.close();
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed to seed guest invites:', error);
    db.close();
    process.exit(1);
  });
