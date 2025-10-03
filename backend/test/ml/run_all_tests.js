/**
 * Master Test Runner for ML Components
 * Runs all test suites for ML model manager, engines, and integration tests
 */

const path = require('path');

// Test suite modules
const mlModelManagerTests = require('./ml_model_manager.test');
const collaborativeFilteringTests = require('./collaborative_filtering_engine.test');
const contentBasedTests = require('./content_based_engine.test');
const integrationTests = require('./integration.test');

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function printHeader(title) {
    console.log('\n' + colors.bright + colors.cyan + '='.repeat(80) + colors.reset);
    console.log(colors.bright + colors.cyan + title.padStart((80 + title.length) / 2) + colors.reset);
    console.log(colors.bright + colors.cyan + '='.repeat(80) + colors.reset + '\n');
}

function printSeparator() {
    console.log(colors.blue + '-'.repeat(80) + colors.reset);
}

function printSuccess(message) {
    console.log(colors.green + '✓ ' + message + colors.reset);
}

function printError(message) {
    console.log(colors.red + '✗ ' + message + colors.reset);
}

function printWarning(message) {
    console.log(colors.yellow + '⚠ ' + message + colors.reset);
}

async function runAllTests() {
    printHeader('SommOS ML Test Suite Runner');
    
    const results = {
        total: 0,
        passed: 0,
        failed: 0,
        suites: []
    };
    
    const testSuites = [
        {
            name: 'ML Model Manager Tests',
            runner: mlModelManagerTests.runTests,
            description: 'Tests for model training, evaluation, versioning, and A/B testing'
        },
        {
            name: 'Collaborative Filtering Engine Tests',
            runner: collaborativeFilteringTests.runTests,
            description: 'Tests for user-based and item-based recommendations with cold-start handling'
        },
        {
            name: 'Content-Based Engine Tests',
            runner: contentBasedTests.runTests,
            description: 'Tests for feature extraction, similarity calculation, and content-based recommendations'
        },
        {
            name: 'ML Integration Tests',
            runner: integrationTests.runTests,
            description: 'Tests for complete ML workflow including training, blending, and fallback'
        }
    ];
    
    const startTime = Date.now();
    
    for (const suite of testSuites) {
        console.log(colors.bright + '\nRunning: ' + suite.name + colors.reset);
        console.log(colors.cyan + suite.description + colors.reset);
        printSeparator();
        
        const suiteStartTime = Date.now();
        
        try {
            const exitCode = await suite.runner();
            const suiteTime = Date.now() - suiteStartTime;
            
            if (exitCode === 0) {
                results.passed++;
                results.suites.push({
                    name: suite.name,
                    status: 'PASSED',
                    time: suiteTime
                });
                printSuccess(`${suite.name} completed successfully in ${suiteTime}ms`);
            } else {
                results.failed++;
                results.suites.push({
                    name: suite.name,
                    status: 'FAILED',
                    time: suiteTime
                });
                printError(`${suite.name} failed with exit code ${exitCode}`);
            }
        } catch (error) {
            results.failed++;
            const suiteTime = Date.now() - suiteStartTime;
            results.suites.push({
                name: suite.name,
                status: 'ERROR',
                time: suiteTime,
                error: error.message
            });
            printError(`${suite.name} threw an error: ${error.message}`);
            console.error(error.stack);
        }
        
        results.total++;
        printSeparator();
    }
    
    const totalTime = Date.now() - startTime;
    
    // Print summary
    printHeader('Test Summary');
    
    console.log(colors.bright + 'Test Suites:' + colors.reset);
    for (const suite of results.suites) {
        const statusColor = suite.status === 'PASSED' ? colors.green : colors.red;
        console.log(`  ${statusColor}${suite.status.padEnd(10)}${colors.reset} ${suite.name} (${suite.time}ms)`);
        if (suite.error) {
            console.log(`    ${colors.red}Error: ${suite.error}${colors.reset}`);
        }
    }
    
    console.log('\n' + colors.bright + 'Overall Results:' + colors.reset);
    console.log(`  Total Suites: ${results.total}`);
    console.log(`  ${colors.green}Passed: ${results.passed}${colors.reset}`);
    console.log(`  ${colors.red}Failed: ${results.failed}${colors.reset}`);
    console.log(`  Total Time: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
    
    printSeparator();
    
    if (results.failed === 0) {
        printSuccess('All test suites passed! 🎉');
        console.log('\n' + colors.green + colors.bright + 
            '  All ML components are working correctly!' + colors.reset);
        return 0;
    } else {
        printError(`${results.failed} test suite(s) failed.`);
        console.log('\n' + colors.red + colors.bright + 
            '  Please review the failed tests above.' + colors.reset);
        return 1;
    }
}

// Run all tests if executed directly
if (require.main === module) {
    console.log(colors.cyan + 'Starting ML Test Suite...' + colors.reset);
    console.log(colors.cyan + `Working Directory: ${process.cwd()}` + colors.reset);
    console.log(colors.cyan + `Node Version: ${process.version}` + colors.reset);
    
    runAllTests().then(exitCode => {
        console.log('\n' + colors.cyan + 'Test run completed.' + colors.reset);
        process.exit(exitCode);
    }).catch(error => {
        console.error('\n' + colors.red + colors.bright + 'Fatal error running tests:' + colors.reset);
        console.error(error);
        process.exit(1);
    });
}

module.exports = { runAllTests };
