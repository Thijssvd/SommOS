#!/usr/bin/env node

/**
 * Flakiness Analysis Script
 * 
 * Analyzes test results from multiple runs to identify flaky tests.
 * Supports both Jest and Playwright JSON result formats.
 * 
 * Usage:
 *   node analyze-flakiness.js <result-files...> [--format jest|playwright|auto] [--output dir] [--verbose]
 * 
 * Example:
 *   node analyze-flakiness.js jest-run*.json --format jest --output reports/
 */

const fs = require('fs');
const path = require('path');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m'
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    files: [],
    format: 'auto',
    output: './flakiness-reports',
    verbose: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--format' && i + 1 < args.length) {
      config.format = args[++i];
    } else if (arg === '--output' && i + 1 < args.length) {
      config.output = args[++i];
    } else if (arg === '--verbose' || arg === '-v') {
      config.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (!arg.startsWith('--')) {
      config.files.push(arg);
    }
  }

  return config;
}

function printHelp() {
  console.log(`
${colors.bold}Flakiness Analysis Tool${colors.reset}

Analyzes test results from multiple runs to identify flaky tests.

${colors.bold}Usage:${colors.reset}
  node analyze-flakiness.js <result-files...> [options]

${colors.bold}Options:${colors.reset}
  --format <type>     Format of input files (jest|playwright|auto) [default: auto]
  --output <dir>      Directory for output reports [default: ./flakiness-reports]
  --verbose, -v       Enable verbose logging
  --help, -h          Show this help message

${colors.bold}Examples:${colors.reset}
  node analyze-flakiness.js jest-run*.json
  node analyze-flakiness.js playwright-*.json --format playwright --output reports/
  node analyze-flakiness.js results/*.json --verbose
`);
}

// Auto-detect test result format
function detectFormat(data) {
  if (data.numTotalTests !== undefined || data.testResults !== undefined) {
    return 'jest';
  } else if (data.suites !== undefined || data.specs !== undefined) {
    return 'playwright';
  }
  return null;
}

// Parse Jest result file
function parseJestResults(filePath, verbose) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    const tests = [];
    
    if (data.testResults) {
      for (const testFile of data.testResults) {
        if (testFile.assertionResults) {
          for (const assertion of testFile.assertionResults) {
            tests.push({
              name: assertion.fullName || assertion.title,
              file: testFile.name || testFile.testFilePath,
              status: assertion.status,
              duration: assertion.duration || 0,
              failureMessages: assertion.failureMessages || [],
              ancestorTitles: assertion.ancestorTitles || []
            });
          }
        }
      }
    }
    
    if (verbose) {
      console.log(`${colors.gray}Parsed ${tests.length} tests from ${path.basename(filePath)}${colors.reset}`);
    }
    
    return { tests, format: 'jest' };
  } catch (error) {
    console.error(`${colors.red}Error parsing Jest results from ${filePath}: ${error.message}${colors.reset}`);
    return { tests: [], format: 'jest', error: error.message };
  }
}

// Parse Playwright result file
function parsePlaywrightResults(filePath, verbose) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    const tests = [];
    
    if (data.suites) {
      function extractTests(suite) {
        if (suite.specs) {
          for (const spec of suite.specs) {
            tests.push({
              name: spec.title,
              file: spec.file || suite.file,
              status: spec.ok ? 'passed' : 'failed',
              duration: spec.tests?.[0]?.results?.[0]?.duration || 0,
              failureMessages: spec.tests?.[0]?.results?.[0]?.error?.message ? 
                [spec.tests[0].results[0].error.message] : [],
              browser: spec.tests?.[0]?.projectName || 'unknown',
              ancestorTitles: suite.title ? [suite.title] : []
            });
          }
        }
        
        if (suite.suites) {
          for (const subSuite of suite.suites) {
            extractTests(subSuite);
          }
        }
      }
      
      for (const suite of data.suites) {
        extractTests(suite);
      }
    }
    
    if (verbose) {
      console.log(`${colors.gray}Parsed ${tests.length} tests from ${path.basename(filePath)}${colors.reset}`);
    }
    
    return { tests, format: 'playwright' };
  } catch (error) {
    console.error(`${colors.red}Error parsing Playwright results from ${filePath}: ${error.message}${colors.reset}`);
    return { tests: [], format: 'playwright', error: error.message };
  }
}

// Analyze flakiness across multiple runs
function analyzeFlakiness(allRuns, verbose) {
  const testMap = new Map();
  
  // Aggregate test results
  for (const run of allRuns) {
    for (const test of run.tests) {
      const key = `${test.file}::${test.name}`;
      
      if (!testMap.has(key)) {
        testMap.set(key, {
          name: test.name,
          file: test.file,
          ancestorTitles: test.ancestorTitles,
          browser: test.browser,
          runs: [],
          totalRuns: 0,
          passedRuns: 0,
          failedRuns: 0,
          failureMessages: [],
          durations: []
        });
      }
      
      const testData = testMap.get(key);
      testData.runs.push(test.status);
      testData.totalRuns++;
      testData.durations.push(test.duration);
      
      if (test.status === 'passed') {
        testData.passedRuns++;
      } else if (test.status === 'failed') {
        testData.failedRuns++;
        testData.failureMessages.push(...test.failureMessages);
      }
    }
  }
  
  // Calculate flakiness metrics
  const flakyTests = [];
  const stableTests = [];
  
  for (const [key, test] of testMap) {
    const flakiness = (test.failedRuns / test.totalRuns) * 100;
    const avgDuration = test.durations.reduce((a, b) => a + b, 0) / test.durations.length;
    
    const testResult = {
      ...test,
      flakiness,
      avgDuration,
      isFlaky: test.passedRuns > 0 && test.failedRuns > 0
    };
    
    if (testResult.isFlaky) {
      flakyTests.push(testResult);
    } else {
      stableTests.push(testResult);
    }
  }
  
  // Sort by flakiness (most flaky first)
  flakyTests.sort((a, b) => b.flakiness - a.flakiness);
  
  const summary = {
    totalTests: testMap.size,
    flakyTests: flakyTests.length,
    stableTests: stableTests.length,
    flakinessRate: (flakyTests.length / testMap.size) * 100,
    totalRuns: allRuns.length
  };
  
  if (verbose) {
    console.log(`${colors.gray}Analyzed ${summary.totalTests} unique tests across ${summary.totalRuns} runs${colors.reset}`);
  }
  
  return { flakyTests, stableTests, summary };
}

// Generate console output
function printConsoleReport(analysis) {
  console.log(`\n${colors.bold}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}           FLAKINESS ANALYSIS REPORT${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}\n`);
  
  const { summary, flakyTests, stableTests } = analysis;
  
  // Summary
  console.log(`${colors.bold}Summary:${colors.reset}`);
  console.log(`  Total Tests:    ${summary.totalTests}`);
  console.log(`  Total Runs:     ${summary.totalRuns}`);
  console.log(`  Stable Tests:   ${colors.green}${summary.stableTests}${colors.reset} (${((summary.stableTests / summary.totalTests) * 100).toFixed(1)}%)`);
  console.log(`  Flaky Tests:    ${summary.flakyTests > 0 ? colors.red : colors.green}${summary.flakyTests}${colors.reset} (${summary.flakinessRate.toFixed(1)}%)`);
  
  if (summary.flakinessRate > 10) {
    console.log(`\n  ${colors.red}⚠️  WARNING: High flakiness rate detected! (>${colors.bold}10%${colors.reset}${colors.red})${colors.reset}`);
  } else if (summary.flakinessRate > 5) {
    console.log(`\n  ${colors.yellow}⚠️  Moderate flakiness detected (>5%)${colors.reset}`);
  } else if (summary.flakinessRate === 0) {
    console.log(`\n  ${colors.green}✅ No flaky tests detected!${colors.reset}`);
  } else {
    console.log(`\n  ${colors.green}✅ Flakiness within acceptable range (<5%)${colors.reset}`);
  }
  
  // Top flaky tests
  if (flakyTests.length > 0) {
    console.log(`\n${colors.bold}Top Flaky Tests:${colors.reset}`);
    const topTests = flakyTests.slice(0, 10);
    
    for (const test of topTests) {
      const color = test.flakiness > 50 ? colors.red : test.flakiness > 25 ? colors.yellow : colors.cyan;
      console.log(`\n  ${color}${test.flakiness.toFixed(1)}%${colors.reset} - ${colors.bold}${test.name}${colors.reset}`);
      console.log(`    File: ${colors.gray}${path.basename(test.file)}${colors.reset}`);
      console.log(`    Runs: ${test.passedRuns} passed, ${test.failedRuns} failed out of ${test.totalRuns}`);
      console.log(`    Avg Duration: ${test.avgDuration.toFixed(0)}ms`);
      
      if (test.browser) {
        console.log(`    Browser: ${test.browser}`);
      }
    }
    
    if (flakyTests.length > 10) {
      console.log(`\n  ${colors.gray}... and ${flakyTests.length - 10} more flaky tests${colors.reset}`);
    }
  }
  
  console.log(`\n${colors.bold}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}\n`);
}

// Generate markdown report
function generateMarkdownReport(analysis) {
  const { summary, flakyTests, stableTests } = analysis;
  const timestamp = new Date().toISOString();
  
  let markdown = `# Flakiness Analysis Report\n\n`;
  markdown += `**Generated:** ${timestamp}\n\n`;
  markdown += `## Summary\n\n`;
  markdown += `| Metric | Value |\n`;
  markdown += `|--------|-------|\n`;
  markdown += `| Total Tests | ${summary.totalTests} |\n`;
  markdown += `| Total Runs | ${summary.totalRuns} |\n`;
  markdown += `| Stable Tests | ${summary.stableTests} (${((summary.stableTests / summary.totalTests) * 100).toFixed(1)}%) |\n`;
  markdown += `| Flaky Tests | ${summary.flakyTests} (${summary.flakinessRate.toFixed(1)}%) |\n\n`;
  
  if (summary.flakinessRate > 10) {
    markdown += `> ⚠️ **WARNING:** High flakiness rate detected! Consider investigating and fixing flaky tests.\n\n`;
  } else if (summary.flakinessRate > 5) {
    markdown += `> ⚠️ **Note:** Moderate flakiness detected. Monitor these tests closely.\n\n`;
  } else if (summary.flakinessRate === 0) {
    markdown += `> ✅ **Excellent:** No flaky tests detected!\n\n`;
  }
  
  if (flakyTests.length > 0) {
    markdown += `## Flaky Tests\n\n`;
    markdown += `| Test Name | File | Flakiness | Passed | Failed | Total Runs | Avg Duration |\n`;
    markdown += `|-----------|------|-----------|--------|--------|------------|-------------|\n`;
    
    for (const test of flakyTests) {
      const fileName = path.basename(test.file);
      markdown += `| ${test.name} | ${fileName} | ${test.flakiness.toFixed(1)}% | ${test.passedRuns} | ${test.failedRuns} | ${test.totalRuns} | ${test.avgDuration.toFixed(0)}ms |\n`;
    }
    
    markdown += `\n### Recommendations\n\n`;
    markdown += `1. **Fix High-Flakiness Tests (>50%):** Priority should be given to tests failing more than half the time\n`;
    markdown += `2. **Review Test Isolation:** Flaky tests often indicate shared state or race conditions\n`;
    markdown += `3. **Check Timing Issues:** Tests with high average duration may have timeout issues\n`;
    markdown += `4. **Consider Quarantine:** Temporarily skip consistently flaky tests while investigating\n\n`;
    
    markdown += `### Detailed Failure Analysis\n\n`;
    
    for (const test of flakyTests.slice(0, 10)) {
      markdown += `#### ${test.name}\n\n`;
      markdown += `- **File:** ${test.file}\n`;
      markdown += `- **Flakiness:** ${test.flakiness.toFixed(1)}%\n`;
      markdown += `- **Runs:** ${test.passedRuns} passed, ${test.failedRuns} failed (${test.totalRuns} total)\n`;
      markdown += `- **Average Duration:** ${test.avgDuration.toFixed(0)}ms\n`;
      
      if (test.browser) {
        markdown += `- **Browser:** ${test.browser}\n`;
      }
      
      if (test.failureMessages.length > 0) {
        markdown += `\n**Failure Messages:**\n\n`;
        const uniqueMessages = [...new Set(test.failureMessages.slice(0, 3))];
        for (const msg of uniqueMessages) {
          markdown += `\`\`\`\n${msg.substring(0, 200)}${msg.length > 200 ? '...' : ''}\n\`\`\`\n\n`;
        }
      }
    }
  } else {
    markdown += `## No Flaky Tests Detected\n\n`;
    markdown += `All ${summary.totalTests} tests produced consistent results across ${summary.totalRuns} runs.\n\n`;
  }
  
  return markdown;
}

// Generate structured JSON data
function generateStructuredData(analysis) {
  const { summary, flakyTests, stableTests } = analysis;
  
  return {
    timestamp: new Date().toISOString(),
    summary,
    flakyTests: flakyTests.map(test => ({
      name: test.name,
      file: test.file,
      flakiness: test.flakiness,
      passedRuns: test.passedRuns,
      failedRuns: test.failedRuns,
      totalRuns: test.totalRuns,
      avgDuration: test.avgDuration,
      browser: test.browser
    })),
    metadata: {
      version: '1.0.0',
      generatedBy: 'analyze-flakiness.js'
    }
  };
}

// Main execution
async function main() {
  const config = parseArgs();
  
  if (config.files.length === 0) {
    console.error(`${colors.red}Error: No result files specified${colors.reset}`);
    console.log('Use --help for usage information');
    process.exit(1);
  }
  
  console.log(`${colors.cyan}Analyzing flakiness across ${config.files.length} result files...${colors.reset}\n`);
  
  // Parse all result files
  const allRuns = [];
  let detectedFormat = config.format;
  
  for (const file of config.files) {
    if (!fs.existsSync(file)) {
      console.error(`${colors.yellow}Warning: File not found: ${file}${colors.reset}`);
      continue;
    }
    
    let result;
    
    if (config.format === 'auto') {
      // Try to detect format
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const data = JSON.parse(content);
        detectedFormat = detectFormat(data);
        
        if (!detectedFormat) {
          console.error(`${colors.yellow}Warning: Could not detect format for ${file}, skipping${colors.reset}`);
          continue;
        }
      } catch (error) {
        console.error(`${colors.yellow}Warning: Could not read ${file}: ${error.message}${colors.reset}`);
        continue;
      }
    }
    
    if (detectedFormat === 'jest' || config.format === 'jest') {
      result = parseJestResults(file, config.verbose);
    } else if (detectedFormat === 'playwright' || config.format === 'playwright') {
      result = parsePlaywrightResults(file, config.verbose);
    }
    
    if (result && result.tests.length > 0) {
      allRuns.push(result);
    }
  }
  
  if (allRuns.length === 0) {
    console.error(`${colors.red}Error: No valid test results found${colors.reset}`);
    process.exit(1);
  }
  
  // Analyze flakiness
  const analysis = analyzeFlakiness(allRuns, config.verbose);
  
  // Print console report
  printConsoleReport(analysis);
  
  // Generate reports
  if (!fs.existsSync(config.output)) {
    fs.mkdirSync(config.output, { recursive: true });
  }
  
  const markdownReport = generateMarkdownReport(analysis);
  const markdownPath = path.join(config.output, 'flakiness-report.md');
  fs.writeFileSync(markdownPath, markdownReport);
  console.log(`${colors.green}✓${colors.reset} Markdown report saved to: ${markdownPath}`);
  
  const structuredData = generateStructuredData(analysis);
  const dataPath = path.join(config.output, 'flakiness-data.json');
  fs.writeFileSync(dataPath, JSON.stringify(structuredData, null, 2));
  console.log(`${colors.green}✓${colors.reset} Structured data saved to: ${dataPath}`);
  
  // Exit with appropriate code
  if (analysis.summary.flakinessRate > 10) {
    console.log(`\n${colors.yellow}Exiting with warning code (flakiness > 10%)${colors.reset}`);
    process.exit(0); // Don't fail CI, just warn
  }
  
  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
    if (parseArgs().verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  });
}

module.exports = { parseJestResults, parsePlaywrightResults, analyzeFlakiness };
