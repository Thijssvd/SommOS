#!/usr/bin/env node
/**
 * SommOS Remediation Rollback Script
 * Safely reverts all remediation changes if issues occur
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class RemediationRollback {
    constructor() {
        this.rollbackSteps = [
            {
                name: 'Test Environment Configuration',
                description: 'Revert test environment setup changes',
                files: ['tests/setup-env.js', 'scripts/validate-test-env.js'],
                commands: [
                    'git checkout tests/setup-env.js',
                    'git checkout scripts/validate-test-env.js'
                ]
            },
            {
                name: 'Database Performance Indexes',
                description: 'Remove performance indexes and revert query optimizations',
                files: ['backend/database/migrations/003_performance_indexes.sql'],
                commands: [
                    'sqlite3 backend/database/sommos.db "DROP INDEX IF EXISTS idx_wines_search; DROP INDEX IF EXISTS idx_wines_type_producer; DROP INDEX IF EXISTS idx_vintages_wine_year; DROP INDEX IF EXISTS idx_vintages_quality_weather; DROP INDEX IF EXISTS idx_stock_location_quantity; DROP INDEX IF EXISTS idx_stock_vintage_location; DROP INDEX IF EXISTS idx_stock_available; DROP INDEX IF EXISTS idx_intake_orders_status; DROP INDEX IF EXISTS idx_intake_items_intake_status; DROP INDEX IF EXISTS idx_learning_feedback_user; DROP INDEX IF EXISTS idx_learning_feedback_recommendation; DROP INDEX IF EXISTS idx_learning_feedback_context; DROP INDEX IF EXISTS idx_wine_features_wine_id; DROP INDEX IF EXISTS idx_wine_features_region; DROP INDEX IF EXISTS idx_wine_features_style; DROP INDEX IF EXISTS idx_dish_features_hash; DROP INDEX IF EXISTS idx_dish_features_cuisine; DROP INDEX IF EXISTS idx_dish_features_preparation; DROP INDEX IF EXISTS idx_pricebook_composite; DROP INDEX IF EXISTS idx_suppliers_active; DROP INDEX IF EXISTS idx_weather_region_year; DROP INDEX IF EXISTS idx_weather_cache_key; DROP INDEX IF EXISTS idx_wine_vintage_stock; DROP INDEX IF EXISTS idx_vintage_wine_stock; DROP INDEX IF EXISTS idx_stock_vintage_location; DROP INDEX IF EXISTS idx_inventory_analysis; DROP INDEX IF EXISTS idx_wine_vintage_quality; DROP INDEX IF EXISTS idx_wine_search_composite;"',
                    'git checkout backend/api/routes.js'
                ]
            },
            {
                name: 'API Error Response Standardization',
                description: 'Revert API error response format changes',
                files: ['backend/middleware/errorHandler.js', 'tests/backend/api-error-handling.test.js'],
                commands: [
                    'git checkout backend/middleware/errorHandler.js',
                    'git checkout tests/backend/api-error-handling.test.js'
                ]
            },
            {
                name: 'Frontend Module Structure',
                description: 'Revert frontend module structure changes',
                files: ['frontend/js/modules/', 'frontend/js/app.js'],
                commands: [
                    'rm -rf frontend/js/modules/',
                    'git checkout frontend/js/app.js'
                ]
            },
            {
                name: 'Dependencies',
                description: 'Revert dependency updates',
                files: ['package.json', 'package-lock.json'],
                commands: [
                    'git checkout package.json',
                    'git checkout package-lock.json',
                    'npm install'
                ]
            }
        ];
    }

    log(message, status = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = status === 'warn' ? '⚠️' : status === 'error' ? '❌' : '🔄';
        console.log(`[${timestamp}] ${prefix} ${message}`);
    }

    async run() {
        this.log('Starting SommOS Remediation Rollback...');
        this.log('⚠️  WARNING: This will revert all remediation changes!');
        this.log('⚠️  Make sure you have backups before proceeding.');

        // Confirmation prompt
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        await new Promise((resolve) => {
            rl.question('Do you want to proceed with rollback? (yes/no): ', (answer) => {
                rl.close();
                if (answer.toLowerCase() !== 'yes') {
                    this.log('Rollback cancelled by user');
                    process.exit(0);
                }
                resolve();
            });
        });

        try {
            // Execute rollback steps
            for (const step of this.rollbackSteps) {
                this.log(`Rolling back: ${step.name}`);
                await this.executeStep(step);
            }

            this.log('✅ Rollback completed successfully!');
            this.log('🔧 You may need to restart services and run tests to verify rollback');

        } catch (error) {
            this.log(`❌ Rollback failed: ${error.message}`, 'error');
            this.log('⚠️  System may be in an inconsistent state. Manual intervention may be required.');
            process.exit(1);
        }
    }

    async executeStep(step) {
        try {
            // Execute file restoration commands
            for (const command of step.commands) {
                if (command.startsWith('git checkout')) {
                    execSync(command, { stdio: 'pipe' });
                } else if (command.startsWith('rm -rf')) {
                    execSync(command, { stdio: 'pipe' });
                } else if (command.startsWith('sqlite3')) {
                    execSync(command, { stdio: 'pipe' });
                } else if (command.startsWith('npm')) {
                    execSync(command, { stdio: 'pipe' });
                }
            }

            this.log(`✅ ${step.name}: Successfully rolled back`);

        } catch (error) {
            this.log(`❌ ${step.name}: Rollback failed - ${error.message}`, 'error');
            throw error;
        }
    }

    async verifyRollback() {
        this.log('Verifying rollback completeness...');

        try {
            // Check if critical files were restored
            const criticalFiles = [
                'tests/setup-env.js',
                'backend/middleware/errorHandler.js',
                'tests/backend/api-error-handling.test.js',
                'frontend/js/app.js'
            ];

            for (const file of criticalFiles) {
                if (fs.existsSync(file)) {
                    this.log(`✅ ${file}: File exists`);
                } else {
                    this.log(`❌ ${file}: File missing after rollback`, 'error');
                }
            }

            // Check if modules directory was removed
            if (!fs.existsSync('frontend/js/modules')) {
                this.log('✅ Frontend modules: Successfully removed');
            } else {
                this.log('❌ Frontend modules: Directory still exists', 'error');
            }

            // Check database indexes were removed
            try {
                const Database = require('../backend/database/connection');
                const db = Database.getInstance();

                const indexes = await db.all("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'");
                const performanceIndexes = indexes.filter(idx => idx.name.includes('wines_search') || idx.name.includes('stock_location') || idx.name.includes('learning_feedback'));

                if (performanceIndexes.length === 0) {
                    this.log('✅ Database indexes: Successfully removed');
                } else {
                    this.log(`⚠️  Database indexes: ${performanceIndexes.length} indexes still exist`, 'warn');
                }

                db.close();
            } catch (error) {
                this.log('❌ Database verification: Failed to check indexes', 'error');
            }

        } catch (error) {
            this.log(`❌ Rollback verification failed: ${error.message}`, 'error');
        }
    }
}

// Run rollback if called directly
if (require.main === module) {
    const rollback = new RemediationRollback();
    rollback.run().then(() => {
        return rollback.verifyRollback();
    }).then(() => {
        console.log('\n🎯 Rollback verification complete');
    });
}

module.exports = { RemediationRollback };
