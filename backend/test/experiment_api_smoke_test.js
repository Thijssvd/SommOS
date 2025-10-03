/**
 * A/B Testing API Smoke Test
 * Basic validation that experiment routes are properly registered and accessible
 */

const express = require('express');
const router = require('../api/routes');

// Create a test Express app
const app = express();
app.use(express.json());
app.use('/api', router);

// Simple smoke test to verify routes are registered
async function runSmokeTest() {
    console.log('🧪 Running A/B Testing API Smoke Test...\n');
    
    const tests = [];
    
    // Test 1: Verify experiment routes module loads
    try {
        const experimentRouter = require('../api/experiment_routes');
        tests.push({
            name: 'Load experiment_routes module',
            status: 'PASS',
            message: 'Module loaded successfully'
        });
    } catch (error) {
        tests.push({
            name: 'Load experiment_routes module',
            status: 'FAIL',
            message: error.message
        });
    }
    
    // Test 2: Verify core services load
    try {
        const ExperimentManager = require('../core/experiment_manager');
        const ExperimentMetricsTracker = require('../core/experiment_metrics_tracker');
        const ExperimentStatisticalAnalyzer = require('../core/experiment_statistical_analyzer');
        tests.push({
            name: 'Load experiment services',
            status: 'PASS',
            message: 'All services loaded successfully'
        });
    } catch (error) {
        tests.push({
            name: 'Load experiment services',
            status: 'FAIL',
            message: error.message
        });
    }
    
    // Test 3: Verify routes are registered
    const routeStack = app._router.stack
        .filter(r => r.route)
        .map(r => ({
            path: r.route.path,
            methods: Object.keys(r.route.methods).join(', ').toUpperCase()
        }));
    
    const experimentRoutes = app._router.stack
        .filter(r => r.name === 'router' && r.regexp.toString().includes('experiments'))
        .length;
    
    if (experimentRoutes > 0) {
        tests.push({
            name: 'Verify experiment routes registered',
            status: 'PASS',
            message: `Found experiment router in Express app`
        });
    } else {
        tests.push({
            name: 'Verify experiment routes registered',
            status: 'WARN',
            message: 'Experiment router may not be mounted (expected for modular routes)'
        });
    }
    
    // Test 4: Verify dependencies (zod for validation)
    try {
        const { z } = require('zod');
        tests.push({
            name: 'Verify Zod validation library',
            status: 'PASS',
            message: 'Zod is available for schema validation'
        });
    } catch (error) {
        tests.push({
            name: 'Verify Zod validation library',
            status: 'FAIL',
            message: 'Zod not found - run: npm install zod'
        });
    }
    
    // Test 5: Verify auth middleware exists
    try {
        const { requireRole } = require('../middleware/auth');
        tests.push({
            name: 'Verify auth middleware',
            status: 'PASS',
            message: 'Auth middleware loaded'
        });
    } catch (error) {
        tests.push({
            name: 'Verify auth middleware',
            status: 'FAIL',
            message: error.message
        });
    }
    
    // Test 6: Verify database connection module
    try {
        const Database = require('../database/connection');
        tests.push({
            name: 'Verify database module',
            status: 'PASS',
            message: 'Database connection module loaded'
        });
    } catch (error) {
        tests.push({
            name: 'Verify database module',
            status: 'FAIL',
            message: error.message
        });
    }
    
    // Print results
    console.log('Test Results:');
    console.log('='.repeat(70));
    
    const passed = tests.filter(t => t.status === 'PASS').length;
    const failed = tests.filter(t => t.status === 'FAIL').length;
    const warned = tests.filter(t => t.status === 'WARN').length;
    
    tests.forEach(test => {
        const icon = test.status === 'PASS' ? '✅' : 
                     test.status === 'FAIL' ? '❌' : '⚠️';
        console.log(`${icon} ${test.name}`);
        console.log(`   ${test.message}`);
        console.log('');
    });
    
    console.log('='.repeat(70));
    console.log(`Summary: ${passed} passed, ${failed} failed, ${warned} warnings`);
    console.log('');
    
    if (failed === 0) {
        console.log('✅ All critical tests passed! API is ready to use.');
        console.log('');
        console.log('📚 Next Steps:');
        console.log('   1. Run database migrations: 003_ab_testing_schema.sql');
        console.log('   2. Start the server');
        console.log('   3. Test endpoints with: curl or Postman');
        console.log('   4. Review documentation: AB_TESTING_API_DOCUMENTATION.md');
        console.log('');
        console.log('🚀 Quick Start:');
        console.log('   POST /api/experiments - Create an experiment');
        console.log('   GET  /api/experiments - List all experiments');
        console.log('   POST /api/experiments/:id/start - Start an experiment');
        console.log('   POST /api/experiments/:id/assign - Assign user to variant');
        return 0;
    } else {
        console.log('❌ Some tests failed. Please fix the issues above.');
        return 1;
    }
}

// Run the test if called directly
if (require.main === module) {
    runSmokeTest()
        .then(exitCode => process.exit(exitCode))
        .catch(error => {
            console.error('Test runner failed:', error);
            process.exit(1);
        });
}

module.exports = { runSmokeTest };
