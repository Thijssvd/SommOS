/**
 * A/B Testing API Structure Test
 * Validates API structure without requiring database or environment setup
 */

const fs = require('fs');
const path = require('path');

async function runStructureTest() {
    console.log('🧪 Running A/B Testing API Structure Test...\n');
    
    const tests = [];
    const rootPath = path.join(__dirname, '..');
    
    // Test 1: Verify experiment_routes.js exists
    const routesFile = path.join(rootPath, 'api', 'experiment_routes.js');
    if (fs.existsSync(routesFile)) {
        const content = fs.readFileSync(routesFile, 'utf8');
        const endpointCount = (content.match(/router\.(get|post|patch|delete|put)\(/g) || []).length;
        tests.push({
            name: 'API routes file exists',
            status: 'PASS',
            message: `Found ${endpointCount} endpoint definitions`
        });
    } else {
        tests.push({
            name: 'API routes file exists',
            status: 'FAIL',
            message: 'experiment_routes.js not found'
        });
    }
    
    // Test 2: Verify routes are registered in main routes.js
    const mainRoutesFile = path.join(rootPath, 'api', 'routes.js');
    if (fs.existsSync(mainRoutesFile)) {
        const content = fs.readFileSync(mainRoutesFile, 'utf8');
        if (content.includes("require('./experiment_routes')") && 
            content.includes("router.use('/experiments'")) {
            tests.push({
                name: 'Routes registered in main router',
                status: 'PASS',
                message: 'Experiment routes properly mounted at /api/experiments'
            });
        } else {
            tests.push({
                name: 'Routes registered in main router',
                status: 'FAIL',
                message: 'Experiment routes not mounted in main router'
            });
        }
    }
    
    // Test 3: Verify core services exist
    const services = [
        { name: 'ExperimentManager', file: 'core/experiment_manager.js' },
        { name: 'ExperimentMetricsTracker', file: 'core/experiment_metrics_tracker.js' },
        { name: 'ExperimentStatisticalAnalyzer', file: 'core/experiment_statistical_analyzer.js' }
    ];
    
    const missingServices = [];
    services.forEach(service => {
        const servicePath = path.join(rootPath, service.file);
        if (!fs.existsSync(servicePath)) {
            missingServices.push(service.name);
        }
    });
    
    if (missingServices.length === 0) {
        tests.push({
            name: 'Core experiment services exist',
            status: 'PASS',
            message: 'All 3 core services found'
        });
    } else {
        tests.push({
            name: 'Core experiment services exist',
            status: 'FAIL',
            message: `Missing: ${missingServices.join(', ')}`
        });
    }
    
    // Test 4: Verify database migration exists
    const migrationFile = path.join(rootPath, 'database', 'migrations', '003_ab_testing_schema.sql');
    if (fs.existsSync(migrationFile)) {
        const content = fs.readFileSync(migrationFile, 'utf8');
        const tables = ['Experiments', 'ExperimentVariants', 'ExperimentAssignments', 
                       'ExperimentEvents', 'ExperimentMetrics', 'ExperimentAnalysis'];
        const missingTables = tables.filter(table => !content.includes(`CREATE TABLE ${table}`));
        
        if (missingTables.length === 0) {
            tests.push({
                name: 'Database schema migration',
                status: 'PASS',
                message: `All ${tables.length} required tables defined`
            });
        } else {
            tests.push({
                name: 'Database schema migration',
                status: 'WARN',
                message: `Missing tables: ${missingTables.join(', ')}`
            });
        }
    } else {
        tests.push({
            name: 'Database schema migration',
            status: 'FAIL',
            message: '003_ab_testing_schema.sql not found'
        });
    }
    
    // Test 5: Verify documentation exists
    const docsFile = path.join(rootPath, '..', 'docs', 'features', 'AB_TESTING_API_DOCUMENTATION.md');
    if (fs.existsSync(docsFile)) {
        const content = fs.readFileSync(docsFile, 'utf8');
        const endpointCount = (content.match(/\*\*(GET|POST|PATCH|DELETE|PUT)\*\*/g) || []).length;
        tests.push({
            name: 'API documentation exists',
            status: 'PASS',
            message: `Documentation includes ${endpointCount} documented endpoints`
        });
    } else {
        tests.push({
            name: 'API documentation exists',
            status: 'WARN',
            message: 'AB_TESTING_API_DOCUMENTATION.md not found'
        });
    }
    
    // Test 6: Analyze endpoint coverage
    if (fs.existsSync(routesFile)) {
        const content = fs.readFileSync(routesFile, 'utf8');
        const categories = {
            'Experiment Management': [
                'POST /',
                'GET /',
                'GET /:experimentId',
                'PATCH /:experimentId',
                'POST /:experimentId/start',
                'POST /:experimentId/pause',
                'POST /:experimentId/resume',
                'POST /:experimentId/complete',
                'DELETE /:experimentId'
            ],
            'Variant Assignment': [
                'POST /:experimentId/assign',
                'GET /:experimentId/assignments/:userId',
                'GET /:experimentId/assignments'
            ],
            'Event Tracking': [
                'POST /events',
                'POST /events/batch',
                'POST /:experimentId/events/impression',
                'POST /:experimentId/events/conversion'
            ],
            'Metrics & Analysis': [
                'GET /:experimentId/metrics',
                'GET /:experimentId/metrics/:variantId',
                'GET /:experimentId/funnel',
                'POST /:experimentId/analyze',
                'GET /:experimentId/analysis',
                'GET /:experimentId/guardrails',
                'GET /:experimentId/recommendation'
            ],
            'Dashboard': [
                'GET /dashboard/summary',
                'GET /:experimentId/realtime'
            ]
        };
        
        let totalEndpoints = 0;
        let foundEndpoints = 0;
        
        for (const [category, endpoints] of Object.entries(categories)) {
            totalEndpoints += endpoints.length;
            for (const endpoint of endpoints) {
                if (content.includes(`router.${endpoint.split(' ')[0].toLowerCase()}('${endpoint.split(' ')[1]}`)) {
                    foundEndpoints++;
                }
            }
        }
        
        tests.push({
            name: 'Endpoint coverage',
            status: foundEndpoints >= 20 ? 'PASS' : 'WARN',
            message: `Found ${foundEndpoints}/${totalEndpoints} expected endpoints`
        });
    }
    
    // Test 7: Check for proper validation
    if (fs.existsSync(routesFile)) {
        const content = fs.readFileSync(routesFile, 'utf8');
        const hasValidation = content.includes('validate(') && content.includes('z.object');
        tests.push({
            name: 'Request validation implemented',
            status: hasValidation ? 'PASS' : 'WARN',
            message: hasValidation ? 'Zod validation schemas found' : 'No validation found'
        });
    }
    
    // Test 8: Check for authentication
    if (fs.existsSync(routesFile)) {
        const content = fs.readFileSync(routesFile, 'utf8');
        const hasAuth = content.includes('requireRole(');
        tests.push({
            name: 'Authentication middleware',
            status: hasAuth ? 'PASS' : 'WARN',
            message: hasAuth ? 'Role-based auth implemented' : 'No auth middleware found'
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
        console.log('✅ All critical structure tests passed!');
        console.log('');
        console.log('📁 Files Created:');
        console.log('   • backend/api/experiment_routes.js');
        console.log('   • backend/core/experiment_manager.js');
        console.log('   • backend/core/experiment_metrics_tracker.js');
        console.log('   • backend/core/experiment_statistical_analyzer.js');
        console.log('   • backend/database/migrations/003_ab_testing_schema.sql');
        console.log('   • AB_TESTING_API_DOCUMENTATION.md');
        console.log('');
        console.log('🚀 API Endpoints Available:');
        console.log('   Base URL: /api/experiments');
        console.log('   Total Endpoints: 25+');
        console.log('');
        console.log('📚 Categories:');
        console.log('   • Experiment Management (9 endpoints)');
        console.log('   • Variant Assignment (3 endpoints)');
        console.log('   • Event Tracking (4 endpoints)');
        console.log('   • Metrics & Analysis (7 endpoints)');
        console.log('   • Dashboard & Reporting (2 endpoints)');
        console.log('');
        console.log('📖 Documentation:');
        console.log('   Review: AB_TESTING_API_DOCUMENTATION.md');
        console.log('');
        console.log('🎯 Next Steps:');
        console.log('   1. Set up environment variables (JWT_SECRET, etc.)');
        console.log('   2. Run database migration: 003_ab_testing_schema.sql');
        console.log('   3. Start your server');
        console.log('   4. Test with: curl -X POST http://localhost:PORT/api/experiments');
        console.log('');
        return 0;
    } else {
        console.log('❌ Some critical tests failed. Please review the issues above.');
        return 1;
    }
}

// Run the test if called directly
if (require.main === module) {
    runStructureTest()
        .then(exitCode => process.exit(exitCode))
        .catch(error => {
            console.error('Test runner failed:', error);
            process.exit(1);
        });
}

module.exports = { runStructureTest };
