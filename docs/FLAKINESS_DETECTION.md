# Flakiness Detection System

## Overview

SommOS implements a comprehensive flakiness detection system to identify and track inconsistent test behavior across both Jest unit tests and Playwright E2E tests. This system helps maintain test reliability and catches intermittent failures that might otherwise go unnoticed.

## Features

### ✅ Comprehensive Coverage
- **Jest Unit Tests**: Runs tests 5 times to detect flakiness in unit and integration tests
- **Playwright E2E Tests**: Runs tests 3 times across all browsers (Chromium, Firefox, WebKit)
- **Per-Test Analysis**: Identifies exactly which tests are flaky, not just overall pass/fail rates
- **Browser-Specific Detection**: Tracks which tests are flaky only in specific browsers

### 📊 Detailed Reporting
- **Console Output**: Color-coded summary with top flaky tests
- **Markdown Reports**: Detailed reports with failure patterns and recommendations
- **JSON Data**: Structured data for historical tracking and automation
- **GitHub Step Summary**: Integrated reporting in GitHub Actions UI

### 🔄 Automatic Retry Configuration
- **Jest Auto-Retry**: Failed tests automatically retry up to 2 times in CI
- **Non-Blocking**: Flakiness detection never fails the CI pipeline
- **Configurable**: Retry behavior can be adjusted per environment

### 📈 Historical Tracking
- **Artifact Storage**: Flakiness reports stored for 30 days
- **Trend Analysis**: Compare flakiness across multiple CI runs
- **Threshold Warnings**: Automatic warnings when flakiness exceeds 10%

## How It Works

### GitHub Actions Workflow

The flakiness detection system consists of several jobs:

```
Regular Tests (Jest + Playwright)
          ↓
Flakiness Detection (on push only)
  ├── Jest: 5 parallel runs
  └── Playwright: 3 runs × 3 browsers = 9 runs
          ↓
Analysis Jobs
  ├── Jest Analysis: Aggregate results
  └── Playwright Analysis: Aggregate results
          ↓
Test Summary: Combined report
```

### Detection Process

1. **Multiple Test Runs**: Tests are executed multiple times with identical configuration
2. **JSON Output**: Each run produces structured JSON results
3. **Analysis**: Results are compared to find tests that pass sometimes and fail sometimes
4. **Reporting**: Flaky tests are identified with failure rates and patterns
5. **Artifacts**: Reports are uploaded for review and historical tracking

## Usage

### Local Testing

Run flakiness detection locally before pushing:

```bash
# Run Jest flakiness detection (5 runs)
npm run test:flaky

# Run Playwright flakiness detection (3 runs)
npm run test:e2e:flaky

# Quick check (subset of tests, 3 runs)
npm run test:flaky:quick

# Analyze existing test results
npm run analyze:flakiness -- results/*.json --format jest
```

### CI/CD

Flakiness detection runs automatically:

- **Trigger**: Runs on every `push` to `main` or `develop` branches
- **Pull Requests**: Does NOT run on PRs (to save CI time)
- **Duration**: Approximately 15-20 minutes for full suite
- **Non-Blocking**: Never fails your build, only provides information

### Viewing Reports

#### GitHub Actions UI

1. Go to the Actions tab in your repository
2. Click on a workflow run
3. Scroll to the "Test Suite Summary" job
4. View the "Flakiness Analysis Summary" section

#### Artifacts

1. In the workflow run, scroll to "Artifacts"
2. Download:
   - `jest-flakiness-report` - Jest flakiness details
   - `playwright-flakiness-report` - Playwright flakiness details
3. Open `flakiness-report.md` for full analysis

## Understanding the Reports

### Flakiness Percentage

```
Flakiness = (Failed Runs / Total Runs) × 100
```

- **0%**: Test always passed (stable)
- **1-25%**: Minor flakiness (investigate if frequent)
- **26-50%**: Moderate flakiness (should be fixed)
- **51-99%**: High flakiness (definitely needs fixing)
- **100%**: Test always failed (not flaky, just broken)

### Report Sections

#### Summary
- Total tests analyzed
- Number of flaky tests
- Overall flakiness rate
- Warning thresholds

#### Flaky Tests Table
| Test Name | File | Flakiness | Passed | Failed | Total Runs | Avg Duration |
|-----------|------|-----------|--------|--------|------------|--------------|
| ... | ... | 40% | 3 | 2 | 5 | 245ms |

#### Recommendations
- Fix high-flakiness tests first (>50%)
- Review test isolation
- Check for timing issues
- Consider quarantine for persistent issues

#### Detailed Failure Analysis
- Individual test breakdown
- Failure messages
- Browser-specific patterns (for Playwright)

## Common Causes of Flakiness

### 1. **Timing Issues**
```javascript
// ❌ Bad: Hard-coded timeouts
await page.waitForTimeout(1000);

// ✅ Good: Wait for specific condition
await page.waitForSelector('.loaded');
```

### 2. **Shared State**
```javascript
// ❌ Bad: Tests depend on execution order
let sharedData = null;

// ✅ Good: Each test is isolated
beforeEach(() => {
  testData = createFreshData();
});
```

### 3. **Race Conditions**
```javascript
// ❌ Bad: Assuming immediate updates
updateDatabase();
const result = queryDatabase();

// ✅ Good: Wait for operations to complete
await updateDatabase();
const result = await queryDatabase();
```

### 4. **External Dependencies**
```javascript
// ❌ Bad: Depending on external services
const data = await fetch('https://api.example.com');

// ✅ Good: Mock external dependencies
jest.mock('axios');
```

### 5. **Browser-Specific Issues**
- Webkit may handle animations differently
- Firefox may have different timing for network requests
- Check browser-specific failure patterns in reports

## Configuration

### Jest Auto-Retry

Configured in `jest.config.js`:

```javascript
...(process.env.CI && {
  retryTimes: 2,
  retryImmediately: false
})
```

To adjust:
- Change `retryTimes` for different retry count
- Set `retryImmediately: true` for faster retries (not recommended)
- Remove condition to enable retries locally

### Flakiness Detection Frequency

In `.github/workflows/tests.yml`:

```yaml
# Current: 5 runs for Jest
strategy:
  matrix:
    run: [1, 2, 3, 4, 5]

# Increase for more confidence:
strategy:
  matrix:
    run: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
```

### Analysis Thresholds

Edit `scripts/analyze-flakiness.js` to adjust:

```javascript
// Line 477: High flakiness warning threshold
if (analysis.summary.flakinessRate > 10) {
  // Change 10 to your desired threshold
}
```

## Best Practices

### 1. **Fix Flaky Tests Promptly**
- Address tests with >25% flakiness within 1 sprint
- Quarantine tests with >50% flakiness until fixed
- Document known flaky tests in test comments

### 2. **Monitor Trends**
- Review flakiness reports weekly
- Track if flakiness is increasing or decreasing
- Investigate new flaky tests immediately

### 3. **Test Isolation**
- Each test should be independent
- Use `beforeEach`/`afterEach` for setup/teardown
- Avoid global state and shared resources

### 4. **Use Proper Assertions**
```javascript
// ❌ Bad: Generic assertions
expect(result).toBeTruthy();

// ✅ Good: Specific assertions
expect(result.status).toBe('success');
expect(result.data).toHaveLength(5);
```

### 5. **Handle Async Properly**
```javascript
// ❌ Bad: Missing await
test('should update user', () => {
  updateUser(123);
  expect(getUser(123).name).toBe('Updated');
});

// ✅ Good: Proper async handling
test('should update user', async () => {
  await updateUser(123);
  const user = await getUser(123);
  expect(user.name).toBe('Updated');
});
```

## Troubleshooting

### High Flakiness Rate

**If overall flakiness >10%:**

1. Check for common patterns in flaky tests
2. Review recent code changes
3. Check CI environment stability
4. Consider increasing test timeouts temporarily

### Analysis Script Errors

**If `analyze-flakiness.js` fails:**

```bash
# Run with verbose logging
node scripts/analyze-flakiness.js results/*.json --verbose

# Check for malformed JSON
for file in results/*.json; do
  echo "Checking $file"
  jq empty "$file" || echo "Invalid JSON: $file"
done
```

### Missing Reports

**If flakiness reports aren't generated:**

1. Check that flakiness detection jobs ran (push events only)
2. Verify JSON output files were created
3. Check GitHub Actions logs for error messages
4. Ensure Node.js and dependencies are installed

### Browser-Specific Failures

**If tests only fail in specific browsers:**

1. Review Playwright project configuration
2. Check for browser-specific code/APIs
3. Add browser-specific waits or conditions
4. Consider using `test.skip()` for known incompatibilities

## Performance Impact

### CI Time
- **Regular Tests**: ~5-10 minutes
- **Flakiness Detection**: +15-20 minutes
- **Total Impact**: ~25-30 minutes per push

### Resource Usage
- **Matrix Jobs**: 5 Jest + 9 Playwright = 14 parallel jobs
- **Storage**: ~50MB per run (30-day retention)
- **Compute**: Similar to running tests 5-9x normally

### Optimization Tips
1. Run flakiness detection on `main` branch only
2. Reduce matrix size for faster feedback (3 runs instead of 5)
3. Skip flakiness detection for documentation-only changes
4. Use `paths` filter in workflow to skip irrelevant changes

## Future Enhancements

### Planned Features
- [ ] Historical trend analysis (track flakiness over time)
- [ ] Automatic issue creation for consistently flaky tests
- [ ] Flaky test quarantine system
- [ ] Integration with test reporting dashboards
- [ ] Machine learning to predict flaky tests
- [ ] Per-developer flakiness metrics

### Contributing
To improve the flakiness detection system:
1. Test the analysis script with edge cases
2. Add support for additional test frameworks
3. Improve report visualization
4. Add statistical analysis features

## Resources

### Documentation
- [Jest Configuration](https://jestjs.io/docs/configuration)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [GitHub Actions Artifacts](https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts)

### Tools
- `scripts/analyze-flakiness.js` - Main analysis tool
- `.github/workflows/tests.yml` - CI configuration
- `jest.config.js` - Jest retry configuration

### Support
- Open an issue for flakiness detection problems
- Check existing reports for similar patterns
- Consult with team on persistent flaky tests

---

**Last Updated**: 2025-10-04  
**Version**: 1.0.0  
**Maintained By**: SommOS Team
