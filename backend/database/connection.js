const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor(customPath = null) {
        this.db = null;
        this.dbPath = customPath || path.join(__dirname, '../../data/sommos.db');
    }

    static getInstance(customPath = null) {
        // Use DATABASE_PATH from environment if available and no custom path is provided
        const pathToUse = customPath || process.env.DATABASE_PATH || null;
        
        if (!Database.instance || customPath || process.env.DATABASE_PATH) {
            Database.instance = new Database(pathToUse);
        }
        return Database.instance;
    }

    static resetInstance() {
        if (Database.instance) {
            Database.instance.close();
            Database.instance = null;
        }
    }

    async initialize() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    resolve();
                }
            });
        });
    }

    async ensureInitialized() {
        if (!this.db) {
            await this.initialize();
        }
    }

    async exec(query) {
        await this.ensureInitialized();
        return new Promise((resolve, reject) => {
            this.db.exec(query, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async get(query, params = []) {
        await this.ensureInitialized();
        return new Promise((resolve, reject) => {
            this.db.get(query, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async all(query, params = []) {
        await this.ensureInitialized();
        return new Promise((resolve, reject) => {
            this.db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async run(query, params = []) {
        await this.ensureInitialized();
        return new Promise((resolve, reject) => {
            this.db.run(query, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ 
                        changes: this.changes, 
                        lastID: this.lastID 
                    });
                }
            });
        });
    }

    async query(query, params = []) {
        return this.all(query, params);
    }

    async close() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err.message);
                    } else {
                        console.log('Database connection closed');
                    }
                    this.db = null;
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = Database;