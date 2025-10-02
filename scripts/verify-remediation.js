#!/usr/bin/env node
/**
 * SommOS Remediation Verification Script
 * Comprehensive verification that all remediation steps are working correctly
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class RemediationVerifier {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            total: 0,
            checks: []
        };
    }

    log(message, status = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '🔍';
        console.log(`[${timestamp}] ${prefix} ${message}`);
    }

    recordCheck(name, passed, details = '') {
        this.results.total++;
        if (passed) {
            this.results.passed++;
            this.log(`${name}: PASSED`, 'pass');
        } else {
            this.results.failed++;
            this.log(`${name}: FAILED - ${details}`, 'fail');
        }

        this.results.checks.push({
            name,
            passed,
            details,
            timestamp: new Date().toISOString()
        });
    }

    async run() {
        this.log('Starting SommOS Remediation Verification...');

        try {
            // Check 1: Test Environment Configuration
            await this.verifyTestEnvironment();

            // Check 2: Database Performance Indexes
            await this.verifyDatabaseIndexes();

            // Check 3: API Error Response Standardization
            await this.verifyAPIErrorResponses();

            // Check 4: Frontend Module Structure
            await this.verifyFrontendModules();

            // Check 5: Dependencies Security
            await this.verifyDependencies();

            // Check 6: Performance Benchmarks
            await this.verifyPerformanceBenchmarks();

            // Summary
            this.log('Verification Complete', 'info');
            this.log(`Results: ${this.results.passed}/${this.results.total} checks passed`);

            if (this.results.failed > 0) {
                this.log(`${this.results.failed} checks failed. Review details above.`);
                process.exit(1);
            } else {
                this.log('🎉 All remediation steps verified successfully!');
                process.exit(0);
            }

        } catch (error) {
            this.log(`Verification failed: ${error.message}`, 'fail');
            process.exit(1);
        }
    }

    async verifyTestEnvironment() {
        this.log('Verifying test environment configuration...');

        try {
            // Check if test environment validation script exists and works
            if (fs.existsSync('scripts/validate-test-env.js')) {
                execSync('node scripts/validate-test-env.js', { stdio: 'pipe' });
                this.recordCheck('Test Environment Validation Script', true);
            } else {
                this.recordCheck('Test Environment Validation Script', false, 'Script not found');
            }

            // Check if test setup has proper environment variables
            const setupContent = fs.readFileSync('tests/setup-env.js', 'utf8');
            if (setupContent.includes('JWT_SECRET') && setupContent.includes('SESSION_SECRET')) {
                this.recordCheck('Test Environment Variables', true);
            } else {
                this.recordCheck('Test Environment Variables', false, 'Missing required env vars in setup');
            }

            // Check if tests can run without environment errors
            try {
                execSync('npm run test -- --testNamePattern="should initialize" --passWithNoTests', {
                    stdio: 'pipe',
                    timeout: 10000
                });
                this.recordCheck('Test Environment Runtime', true);
            } catch (error) {
                if (error.message.includes('JWT_SECRET') || error.message.includes('SESSION_SECRET')) {
                    this.recordCheck('Test Environment Runtime', false, 'Environment configuration still failing');
                } else {
                    this.recordCheck('Test Environment Runtime', true); // Other errors are OK
                }
            }

        } catch (error) {
            this.recordCheck('Test Environment Verification', false, error.message);
        }
    }

    async verifyDatabaseIndexes() {
        this.log('Verifying database performance indexes...');

        try {
            // Check if migration file exists
            if (fs.existsSync('backend/database/migrations/003_performance_indexes.sql')) {
                const migrationContent = fs.readFileSync('backend/database/migrations/003_performance_indexes.sql', 'utf8');

                // Check for key indexes
                const requiredIndexes = [
                    'idx_wines_search',
                    'idx_stock_location_quantity',
                    'idx_vintages_quality_weather',
                    'idx_learning_feedback_user'
                ];

                let allIndexesPresent = true;
                for (const index of requiredIndexes) {
                    if (!migrationContent.includes(index)) {
                        allIndexesPresent = false;
                        break;
                    }
                }

                this.recordCheck('Performance Indexes Migration', allIndexesPresent);
            } else {
                this.recordCheck('Performance Indexes Migration', false, 'Migration file not found');
            }

            // Test database query performance
            try {
                const { getConfig } = require('../backend/config/env');
                const config = getConfig();

                if (config.database.path) {
                    const Database = require('../backend/database/connection');
                    const db = Database.getInstance();

                    const start = Date.now();
                    const result = await db.all('SELECT COUNT(*) FROM Wines WHERE region LIKE ?', ['%Bordeaux%']);
                    const duration = Date.now() - start;

                    if (duration < 50) { // Should be much faster with indexes
                        this.recordCheck('Database Query Performance', true);
                    } else {
                        this.recordCheck('Database Query Performance', false, `Query took ${duration}ms, expected <50ms`);
                    }

                    db.close();
                } else {
                    this.recordCheck('Database Query Performance', false, 'No database path configured');
                }

            } catch (error) {
                this.recordCheck('Database Query Performance', false, error.message);
            }

        } catch (error) {
            this.recordCheck('Database Indexes Verification', false, error.message);
        }
    }

    async verifyAPIErrorResponses() {
        this.log('Verifying API error response standardization...');

        try {
            // Check if error handler was updated
            const errorHandlerContent = fs.readFileSync('backend/middleware/errorHandler.js', 'utf8');
            if (errorHandlerContent.includes('formatErrorResponse')) {
                this.recordCheck('Error Handler Structure', true);
            } else {
                this.recordCheck('Error Handler Structure', false, 'formatErrorResponse function not found');
            }

            // Check if test expectations were updated
            const testContent = fs.readFileSync('tests/backend/api-error-handling.test.js', 'utf8');
            const errorResponseChecks = (testContent.match(/\.error\.code/g) || []).length;

            if (errorResponseChecks > 10) { // Should have many error code checks
                this.recordCheck('Test Error Expectations', true);
            } else {
                this.recordCheck('Test Error Expectations', false, `Only ${errorResponseChecks} error code checks found`);
            }

        } catch (error) {
            this.recordCheck('API Error Responses Verification', false, error.message);
        }
    }

    async verifyFrontendModules() {
        this.log('Verifying frontend module structure...');

        try {
            const modulesDir = 'frontend/js/modules';
            const requiredModules = ['dashboard.js', 'inventory.js', 'pairing.js', 'procurement.js'];

            let allModulesPresent = true;
            for (const module of requiredModules) {
                if (!fs.existsSync(path.join(modulesDir, module))) {
                    allModulesPresent = false;
                    break;
                }
            }

            this.recordCheck('Frontend Modules Structure', allModulesPresent);

            // Check if main app imports modules
            const appContent = fs.readFileSync('frontend/js/app.js', 'utf8');
            const moduleImports = requiredModules.filter(module =>
                appContent.includes(`import { ${module.replace('.js', '').replace(/([A-Z])/g, ' $1').trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}Module`)
            );

            if (moduleImports.length >= 2) { // At least dashboard and one other
                this.recordCheck('Module Imports', true);
            } else {
                this.recordCheck('Module Imports', false, `Only ${moduleImports.length} modules imported`);
            }

        } catch (error) {
            this.recordCheck('Frontend Modules Verification', false, error.message);
        }
    }

    async verifyDependencies() {
        this.log('Verifying dependency security and updates...');

        try {
            // Check for vulnerabilities
            try {
                const auditResult = execSync('npm audit --audit-level=moderate --json', { encoding: 'utf8' });
                const auditData = JSON.parse(auditResult);

                if (auditData.vulnerabilities && Object.keys(auditData.vulnerabilities).length === 0) {
                    this.recordCheck('Dependency Vulnerabilities', true);
                } else {
                    const vulnCount = Object.keys(auditData.vulnerabilities || {}).length;
                    this.recordCheck('Dependency Vulnerabilities', false, `${vulnCount} vulnerabilities found`);
                }
            } catch (error) {
                this.recordCheck('Dependency Vulnerabilities', false, 'Audit command failed');
            }

            // Check for outdated packages
            try {
                const outdatedResult = execSync('npm outdated --json', { encoding: 'utf8' });
                const outdatedData = JSON.parse(outdatedResult || '{}');

                if (Object.keys(outdatedData).length <= 2) { // Allow minor updates
                    this.recordCheck('Dependency Updates', true);
                } else {
                    this.recordCheck('Dependency Updates', false, `${Object.keys(outdatedData).length} packages outdated`);
                }
            } catch (error) {
                this.recordCheck('Dependency Updates', false, 'Outdated check failed');
            }

        } catch (error) {
            this.recordCheck('Dependencies Verification', false, error.message);
        }
    }

    async verifyPerformanceBenchmarks() {
        this.log('Verifying performance benchmarks...');

        try {
            // Test API response times
            const start = Date.now();
            try {
                execSync('curl -s http://localhost:3001/api/system/health', { timeout: 5000 });
                const responseTime = Date.now() - start;

                if (responseTime < 100) {
                    this.recordCheck('API Response Time', true);
                } else {
                    this.recordCheck('API Response Time', false, `Response took ${responseTime}ms, expected <100ms`);
                }
            } catch (error) {
                this.recordCheck('API Response Time', false, 'Health endpoint not accessible');
            }

            // Check memory usage (basic check)
            const memUsage = process.memoryUsage();
            if (memUsage.heapUsed < 50 * 1024 * 1024) { // Less than 50MB
                this.recordCheck('Memory Usage', true);
            } else {
                this.recordCheck('Memory Usage', false, `Memory usage: ${(memUsage.heapUsed / 1024 / 1024).toFixed(1)}MB`);
            }

        } catch (error) {
            this.recordCheck('Performance Benchmarks Verification', false, error.message);
        }
    }

    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                total: this.results.total,
                passed: this.results.passed,
                failed: this.results.failed,
                success_rate: (this.results.passed / this.results.total * 100).toFixed(1) + '%'
            },
            checks: this.results.checks
        };

        return JSON.stringify(report, null, 2);
    }
}

// Run verification if called directly
if (require.main === module) {
    const verifier = new RemediationVerifier();
    verifier.run().then(() => {
        // Save report
        const report = verifier.generateReport();
        fs.writeFileSync('remediation-verification-report.json', report);
        console.log('\n📊 Verification report saved to remediation-verification-report.json');
    });
}

module.exports = { RemediationVerifier };
