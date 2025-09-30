/**
 * Database Migration Script
 * Applies database schema changes for enhanced learning features
 */

const fs = require('fs');
const path = require('path');
const Database = require('./connection');

class DatabaseMigrator {
    constructor() {
        this.db = Database.getInstance();
        this.migrationsPath = path.join(__dirname, 'migrations');
    }

    async runMigrations() {
        try {
            console.log('Starting database migrations...');
            
            // Check if migrations table exists
            await this.ensureMigrationsTable();
            
            // Get list of migration files
            const migrationFiles = this.getMigrationFiles();
            
            // Get applied migrations
            const appliedMigrations = await this.getAppliedMigrations();
            
            // Apply pending migrations
            for (const migrationFile of migrationFiles) {
                if (!appliedMigrations.includes(migrationFile)) {
                    await this.applyMigration(migrationFile);
                }
            }
            
            console.log('Database migrations completed successfully');
        } catch (error) {
            console.error('Migration failed:', error.message);
            throw error;
        }
    }

    async ensureMigrationsTable() {
        await this.db.run(`
            CREATE TABLE IF NOT EXISTS migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL UNIQUE,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }

    getMigrationFiles() {
        if (!fs.existsSync(this.migrationsPath)) {
            return [];
        }

        return fs.readdirSync(this.migrationsPath)
            .filter(file => file.endsWith('.sql'))
            .sort();
    }

    async getAppliedMigrations() {
        const rows = await this.db.all('SELECT filename FROM migrations ORDER BY filename');
        return rows.map(row => row.filename);
    }

    async applyMigration(filename) {
        console.log(`Applying migration: ${filename}`);
        
        const migrationPath = path.join(this.migrationsPath, filename);
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        // Split migration into individual statements
        const statements = migrationSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0);
        
        // Execute each statement
        for (const statement of statements) {
            if (statement.trim()) {
                await this.db.run(statement);
            }
        }
        
        // Record migration as applied
        await this.db.run(
            'INSERT INTO migrations (filename) VALUES (?)',
            [filename]
        );
        
        console.log(`Migration ${filename} applied successfully`);
    }

    async rollbackMigration(filename) {
        console.log(`Rolling back migration: ${filename}`);
        
        // This is a simplified rollback - in production you'd want more sophisticated rollback logic
        await this.db.run(
            'DELETE FROM migrations WHERE filename = ?',
            [filename]
        );
        
        console.log(`Migration ${filename} rolled back`);
    }

    async getMigrationStatus() {
        const appliedMigrations = await this.getAppliedMigrations();
        const availableMigrations = this.getMigrationFiles();
        
        return {
            applied: appliedMigrations,
            available: availableMigrations,
            pending: availableMigrations.filter(m => !appliedMigrations.includes(m))
        };
    }
}

// CLI interface
if (require.main === module) {
    const migrator = new DatabaseMigrator();
    const command = process.argv[2];
    
    switch (command) {
        case 'migrate':
            migrator.runMigrations()
                .then(() => process.exit(0))
                .catch(error => {
                    console.error('Migration failed:', error);
                    process.exit(1);
                });
            break;
            
        case 'status':
            migrator.getMigrationStatus()
                .then(status => {
                    console.log('Migration Status:');
                    console.log(`Applied: ${status.applied.length}`);
                    console.log(`Available: ${status.available.length}`);
                    console.log(`Pending: ${status.pending.length}`);
                    
                    if (status.pending.length > 0) {
                        console.log('\nPending migrations:');
                        status.pending.forEach(m => console.log(`  - ${m}`));
                    }
                })
                .catch(error => {
                    console.error('Failed to get migration status:', error);
                    process.exit(1);
                });
            break;
            
        case 'rollback':
            const filename = process.argv[3];
            if (!filename) {
                console.error('Please specify migration filename to rollback');
                process.exit(1);
            }
            
            migrator.rollbackMigration(filename)
                .then(() => process.exit(0))
                .catch(error => {
                    console.error('Rollback failed:', error);
                    process.exit(1);
                });
            break;
            
        default:
            console.log('Usage: node migrate.js [migrate|status|rollback] [filename]');
            process.exit(1);
    }
}

module.exports = DatabaseMigrator;