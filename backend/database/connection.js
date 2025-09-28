'use strict';
const path = require('path');
const fs = require('fs');
let db = null;

function getDbPath(){
  const dir = process.env.DB_DIR || path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'somm.db');
}

function connect(){
  if (db) return db;
  const Database = require('better-sqlite3');
  db = new Database(getDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function close(){
  if (db) { db.close(); db = null; }
}

async function getDbStatus(){
  try {
    const d = connect();
    const row = d.prepare('SELECT 1 as ok').get();
    return { ok: row.ok === 1 };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { connect, close, getDbStatus };
