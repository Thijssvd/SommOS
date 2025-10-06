# SommOS Package Update Deployment Guide

**Version:** 1.0.0  
**Last Updated:** 2025-10-06  
**Status:** Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Package Updates](#package-updates)
4. [Usage](#usage)
5. [Safety Features](#safety-features)
6. [Deployment Phases](#deployment-phases)
7. [Troubleshooting](#troubleshooting)
8. [Advanced Options](#advanced-options)
9. [Best Practices](#best-practices)

---

## Overview

The SommOS Package Update Deployment Script (`scripts/update-packages.sh`) is a fully automated CLI tool for safely updating npm packages with comprehensive error handling, rollback capability, and detailed reporting.

### Key Features

- ✅ **Automatic Backups**: All package files backed up before changes
- ✅ **Rollback Capability**: Automatic rollback on failures
- ✅ **Pre-flight Checks**: Validates environment before proceeding
- ✅ **Test Verification**: Runs full test suite after updates
- ✅ **Security Audit**: Scans for vulnerabilities post-update
- ✅ **Detailed Reports**: Generates markdown reports with recommendations
- ✅ **Dry Run Mode**: Preview changes without modifications
- ✅ **Zero Downtime**: Safe for production environments

---

## Quick Start

### Safe Update (Recommended)

Execute Priority 1 updates only (safe, tested packages):

```bash
cd /Users/thijs/Documents/SommOS
./scripts/update-packages.sh --priority-1-only
```

### Preview Changes (Dry Run)

See what would be updated without making changes:

```bash
./scripts/update-packages.sh --dry-run --verbose
```

### Full Update (Including Breaking Changes)

Include Priority 2 updates with breaking changes:

```bash
./scripts/update-packages.sh --include-priority-2
```

---

## Package Updates

### Priority 1: Safe Updates (Recommended)

These packages have been analyzed and are safe to update:

| Package | Current | Target | Type | Impact |
|---------|---------|--------|------|--------|
| `@playwright/test` | 1.55.1 | **1.56.0** | devDependency | E2E testing improvements |
| `@types/node` | 24.6.2 | **24.7.0** | devDependency | Type definitions update |
| `openai` | 6.0.1 | **6.1.0** | dependency | AI features enhancement |
| `zod` | 4.1.11 | **4.1.12** | dependency | Schema validation fixes |

**Recommendation:** ✅ Safe to deploy immediately  
**Risk Level:** 🟢 Low  
**Testing Required:** Full test suite (automated)

---

### Priority 2: Breaking Changes (Requires Evaluation)

These packages have major version changes and breaking APIs:

| Package | Current | Target | Type | Breaking Changes |
|---------|---------|--------|------|------------------|
| `web-vitals` | 3.5.2 | **5.1.0** | dependency | • `getFID()` → `getINP()`<br>• FID metric → INP metric<br>• API changes required |

**Recommendation:** ⚠️ Requires code review and testing  
**Risk Level:** 🟡 Medium  
**Testing Required:** Extended testing with manual verification

**Code Changes Required:**

Before upgrading `web-vitals` to v5.1.0, the following code changes are needed:

```javascript
// BEFORE (web-vitals v3.x)
import { getFID } from 'web-vitals';

getFID((metric) => {
    console.log('FID:', metric.value);
});

// AFTER (web-vitals v5.x)
import { getINP } from 'web-vitals';  // Changed: getFID → getINP

getINP((metric) => {  // Changed: FID → INP
    console.log('INP:', metric.value);
});
```

**Files Requiring Updates:**
- `frontend/js/performance-monitor.js` (line 7, 122-134)
- `frontend/js/performance.js` (if applicable)

---

## Usage

### Command Syntax

```bash
./scripts/update-packages.sh [OPTIONS]
```

### Available Options

| Option | Description | Default |
|--------|-------------|---------|
| `--priority-1-only` | Execute only Priority 1 updates | ✅ Yes |
| `--include-priority-2` | Include Priority 2 updates (breaking changes) | ❌ No |
| `--skip-tests` | Skip test suite execution | ❌ No |
| `--dry-run` | Simulate updates without changes | ❌ No |
| `--verbose` | Enable verbose output | ❌ No |
| `--help` | Display help message | - |

### Usage Examples

#### 1. Standard Deployment (Recommended)

```bash
# Priority 1 updates with full testing
./scripts/update-packages.sh --priority-1-only
```

**Expected Duration:** 5-10 minutes (including tests)  
**Changes:** 4 packages updated  
**Safety:** High (automatic rollback on failure)

---

#### 2. Dry Run (Preview Changes)

```bash
# See what would happen without making changes
./scripts/update-packages.sh --dry-run --verbose
```

**Expected Duration:** 30 seconds  
**Changes:** None (simulation only)  
**Output:** Detailed log of planned actions

---

#### 3. Quick Update (Skip Tests)

```bash
# Fast update without running tests (NOT recommended for production)
./scripts/update-packages.sh --priority-1-only --skip-tests
```

⚠️ **Warning:** Only use in development environments

**Expected Duration:** 2-3 minutes  
**Changes:** 4 packages updated  
**Risk:** Higher (no test verification)

---

#### 4. Full Update (Including Breaking Changes)

```bash
# Include Priority 2 updates after code review
./scripts/update-packages.sh --include-priority-2
```

⚠️ **Prerequisites:** 
- Code changes for `web-vitals` API completed
- Manual testing of performance monitoring features
- Backup of database and critical data

**Expected Duration:** 10-15 minutes  
**Changes:** 5 packages updated  
**Risk:** Medium (breaking changes included)

---

## Safety Features

### 1. Automatic Backups

All package files are backed up before any changes:

```
/Users/thijs/Documents/SommOS/logs/backups/
├── package.json.20251006-180000
├── package-lock.json.20251006-180000
├── frontend-package.json.20251006-180000
└── frontend-package-lock.json.20251006-180000
```

### 2. Rollback Mechanism

If any step fails, the script automatically:

1. Restores original `package.json` files
2. Restores original `package-lock.json` files
3. Runs `npm install` to reinstall original packages
4. Generates failure report with recovery instructions

### 3. Pre-flight Checks

Before making changes, the script verifies:

- ✅ Node.js version (v20.x expected)
- ✅ npm availability
- ✅ Git working directory status
- ✅ Required directories exist
- ✅ Sufficient disk space

### 4. Test Verification

After updates, the script runs:

- ✅ Unit tests (`npm test`)
- ✅ E2E tests (`npm run test:e2e`)
- ✅ Security audit (`npm audit`)

### 5. Signal Handling

The script handles interruptions gracefully:

- `Ctrl+C`: Triggers rollback if updates in progress
- `SIGTERM`: Clean shutdown with rollback
- Process crashes: Automatic recovery on next run

---

## Deployment Phases

The script executes in 9 sequential phases:

### Phase 1: Pre-flight Checks (30 seconds)

- Validates Node.js and npm versions
- Checks git status
- Creates log and backup directories
- Initializes deployment log

**Output:**
```
═══════════════════════════════════════════════════════
 Phase 1: Pre-flight Checks
═══════════════════════════════════════════════════════

✅ Project root verified: /Users/thijs/Documents/SommOS
✅ Node.js version check passed
✅ npm check passed
✅ Git working directory is clean
✅ Log directories created
✅ Pre-flight checks completed
```

---

### Phase 2: Backup Current State (10 seconds)

- Creates timestamped backups of all package files
- Stores in `/logs/backups/` directory

**Output:**
```
═══════════════════════════════════════════════════════
 Phase 2: Backup Current State
═══════════════════════════════════════════════════════

✅ Backed up: package.json → package.json.20251006-180000
✅ Backed up: package-lock.json → package-lock.json.20251006-180000
✅ Backed up: frontend/package.json → frontend-package.json.20251006-180000
✅ Backed up: frontend/package-lock.json → frontend-package-lock.json.20251006-180000
✅ All backups created successfully
ℹ️  Backup location: /Users/thijs/Documents/SommOS/logs/backups
```

---

### Phase 3: Check Current Versions (5 seconds)

- Lists current and target versions for all packages

**Output:**
```
═══════════════════════════════════════════════════════
 Phase 3: Current Package Versions
═══════════════════════════════════════════════════════

ℹ️  Priority 1 Packages (Root):
  @playwright/test: 1.55.1 → 1.56.0
  @types/node: 24.6.2 → 24.7.0
  openai: 6.0.1 → 6.1.0
  zod: 4.1.11 → 4.1.12
✅ Version check completed
```

---

### Phase 4: Priority 1 Updates (2-3 minutes)

- Updates each Priority 1 package individually
- Verifies each installation before proceeding

**Output:**
```
═══════════════════════════════════════════════════════
 Phase 4: Priority 1 Updates (Safe)
═══════════════════════════════════════════════════════

✅ ✓ @playwright/test@1.56.0 installed successfully
✅ Verified: @playwright/test@1.56.0
✅ ✓ @types/node@24.7.0 installed successfully
✅ Verified: @types/node@24.7.0
✅ ✓ openai@6.1.0 installed successfully
✅ Verified: openai@6.1.0
✅ ✓ zod@4.1.12 installed successfully
✅ Verified: zod@4.1.12
✅ All Priority 1 updates completed successfully
```

---

### Phase 5: Priority 2 Updates (Optional, 1-2 minutes)

- Only executes if `--include-priority-2` flag is set
- Analyzes compatibility before updating
- Prompts for confirmation

**Output:**
```
═══════════════════════════════════════════════════════
 Phase 5: Priority 2 Updates (Requires Evaluation)
═══════════════════════════════════════════════════════

⚠️  Priority 2 includes breaking changes - use with caution!
Continue with Priority 2 updates? (y/N): y
✅ No obvious compatibility issues detected
✅ ✓ web-vitals@5.1.0 installed successfully
✅ Priority 2 updates completed
```

---

### Phase 6: Security Audit (30 seconds)

- Runs `npm audit` on root and frontend packages
- Reports any vulnerabilities found

**Output:**
```
═══════════════════════════════════════════════════════
 Phase 6: Security Audit
═══════════════════════════════════════════════════════

✅ ✓ Root packages: 0 vulnerabilities
✅ ✓ Frontend packages: 0 vulnerabilities
✅ Security audit passed - no vulnerabilities detected
```

---

### Phase 7: Test Suite Verification (2-5 minutes)

- Runs unit tests (`npm test`)
- Runs E2E tests (`npm run test:e2e`)

**Output:**
```
═══════════════════════════════════════════════════════
 Phase 7: Test Suite Verification
═══════════════════════════════════════════════════════

✅ ✓ Unit tests passed
✅ ✓ E2E tests passed
✅ All tests passed successfully
```

---

### Phase 8: Rollback (Only on Failure)

- Triggered automatically if any phase fails
- Restores all original files and packages

**Output:**
```
═══════════════════════════════════════════════════════
 Phase 8: Rolling Back Updates
═══════════════════════════════════════════════════════

⚠️  Initiating rollback procedure...
✅ Restored: package.json
✅ Restored: package-lock.json
✅ Root packages restored
✅ Frontend packages restored
✅ Rollback completed
ℹ️  Original state restored from backups
```

---

### Phase 9: Generate Report (10 seconds)

- Creates comprehensive markdown report
- Includes status, configuration, and recommendations

**Output:**
```
═══════════════════════════════════════════════════════
 Phase 9: Generating Deployment Report
═══════════════════════════════════════════════════════

✅ Deployment report generated: /Users/thijs/Documents/SommOS/logs/package-update-report-20251006-180000.md
```

---

## Troubleshooting

### Problem: Script Fails with "npm: command not found"

**Cause:** npm is not installed or not in PATH

**Solution:**
```bash
# Verify Node.js installation
node --version

# Install npm if missing
brew install node  # macOS
```

---

### Problem: "Git working directory has uncommitted changes"

**Cause:** Uncommitted files in repository

**Solution:**
```bash
# Option 1: Commit changes
git add .
git commit -m "chore: prepare for package updates"

# Option 2: Stash changes
git stash save "WIP: before package updates"

# Option 3: Force proceed (not recommended)
# The script will prompt you to continue anyway
```

---

### Problem: Tests Fail After Update

**Cause:** Package update introduced breaking changes or incompatibilities

**Solution:**

The script automatically rolls back. To investigate:

```bash
# Check the log file
cat /Users/thijs/Documents/SommOS/logs/package-update-YYYYMMDD-HHMMSS.log

# Review test output (near end of log)
tail -200 /Users/thijs/Documents/SommOS/logs/package-update-YYYYMMDD-HHMMSS.log

# Run tests manually
cd /Users/thijs/Documents/SommOS
npm test -- --verbose
```

---

### Problem: Rollback Fails

**Cause:** Backup files missing or corrupted

**Solution:**

Manual recovery:

```bash
# Navigate to backup directory
cd /Users/thijs/Documents/SommOS/logs/backups

# List available backups
ls -lht | head -20

# Restore manually (use latest backup)
cp package.json.YYYYMMDD-HHMMSS /Users/thijs/Documents/SommOS/package.json
cp package-lock.json.YYYYMMDD-HHMMSS /Users/thijs/Documents/SommOS/package-lock.json

# Reinstall packages
cd /Users/thijs/Documents/SommOS
npm install
```

---

### Problem: "version mismatch" Error

**Cause:** Package installed successfully but version doesn't match expected

**Solution:**
```bash
# Check actual installed version
npm list <package-name> --depth=0

# Clear npm cache and retry
npm cache clean --force
./scripts/update-packages.sh --priority-1-only
```

---

### Problem: Script Hangs During Tests

**Cause:** Test suite waiting for input or infinite loop

**Solution:**
```bash
# Interrupt with Ctrl+C (triggers rollback)
# Then run with skipped tests
./scripts/update-packages.sh --skip-tests

# Investigate test issues separately
npm test -- --verbose
```

---

## Advanced Options

### Custom Log Directory

By default, logs are saved to `/Users/thijs/Documents/SommOS/logs/`. To change:

Edit line 46 in `scripts/update-packages.sh`:

```bash
LOGS_DIR="/custom/path/to/logs"
```

---

### Running on Different Node Versions

The script expects Node.js v20.x but can run on other versions with a warning:

```bash
# Check current version
node --version

# Switch to v20 using nvm (if installed)
nvm use 20

# Or proceed with warning
./scripts/update-packages.sh --priority-1-only
```

---

### Debugging Failed Updates

Enable verbose mode for detailed output:

```bash
./scripts/update-packages.sh --verbose --dry-run
```

Review the detailed log file:

```bash
tail -f /Users/thijs/Documents/SommOS/logs/package-update-YYYYMMDD-HHMMSS.log
```

---

## Best Practices

### 1. Always Test First

```bash
# Run dry-run before actual deployment
./scripts/update-packages.sh --dry-run --verbose
```

### 2. Start with Priority 1 Only

```bash
# Update safe packages first
./scripts/update-packages.sh --priority-1-only

# Test thoroughly before Priority 2
npm test
npm run test:e2e
```

### 3. Commit Before Updating

```bash
# Create checkpoint
git add .
git commit -m "chore: checkpoint before package updates"

# Run updates
./scripts/update-packages.sh --priority-1-only

# If successful, commit updates
git add package*.json
git commit -m "chore: update dependencies"
```

### 4. Review Reports

Always review the generated report:

```bash
# View latest report
cat /Users/thijs/Documents/SommOS/logs/package-update-report-*.md | tail -100
```

### 5. Monitor After Deployment

```bash
# Check application logs
tail -f /Users/thijs/Documents/SommOS/logs/app.log

# Monitor for errors
npm test
```

### 6. Keep Backups

Backups are automatically preserved. To manually create additional backups:

```bash
# Create timestamped backup
cp package.json package.json.backup-$(date +%Y%m%d-%H%M%S)
cp package-lock.json package-lock.json.backup-$(date +%Y%m%d-%H%M%S)
```

---

## Output Files

### Log File

**Location:** `/Users/thijs/Documents/SommOS/logs/package-update-YYYYMMDD-HHMMSS.log`

**Contents:**
- Complete command output
- npm install logs
- Test results
- Error messages and stack traces

**Example:**
```
SommOS Package Update Deployment
=================================
Date: Sun Oct  6 18:00:00 PST 2025
User: thijs
Host: MacBook-Pro.local
Node: v20.19.5
npm: 10.9.2
...
```

---

### Report File

**Location:** `/Users/thijs/Documents/SommOS/logs/package-update-report-YYYYMMDD-HHMMSS.md`

**Contents:**
- Deployment summary
- Package update status
- Test results
- Recommendations
- Backup information

**Example:**
```markdown
# SommOS Package Update Deployment Report

**Date:** Sun Oct  6 18:05:23 PST 2025
**Duration:** 5m 23s
**User:** thijs
**Status:** ✅ SUCCESS
...
```

---

### Backup Files

**Location:** `/Users/thijs/Documents/SommOS/logs/backups/`

**Files:**
- `package.json.YYYYMMDD-HHMMSS`
- `package-lock.json.YYYYMMDD-HHMMSS`
- `frontend-package.json.YYYYMMDD-HHMMSS`
- `frontend-package-lock.json.YYYYMMDD-HHMMSS`

**Retention:** Backups are kept indefinitely. Clean up old backups manually:

```bash
# Remove backups older than 90 days
find /Users/thijs/Documents/SommOS/logs/backups -name "*.json.*" -mtime +90 -delete
```

---

## FAQ

### Q: Can I run this on a production server?

**A:** Yes! The script is designed for production use with:
- Automatic rollback on failures
- Comprehensive testing
- Zero downtime (packages updated, not running services)

---

### Q: What if I need to rollback manually later?

**A:** Use the backup files:

```bash
cd /Users/thijs/Documents/SommOS/logs/backups
ls -lht | head -10  # Find desired backup

# Restore
cp package.json.YYYYMMDD-HHMMSS /Users/thijs/Documents/SommOS/package.json
cp package-lock.json.YYYYMMDD-HHMMSS /Users/thijs/Documents/SommOS/package-lock.json
cd /Users/thijs/Documents/SommOS && npm install
```

---

### Q: How long does the deployment take?

**A:** Typical durations:
- Priority 1 only: 5-10 minutes
- With Priority 2: 10-15 minutes
- With `--skip-tests`: 2-3 minutes
- `--dry-run`: 30 seconds

---

### Q: Can I schedule automated updates?

**A:** Yes, using cron:

```bash
# Add to crontab (every Sunday at 2 AM)
0 2 * * 0 /Users/thijs/Documents/SommOS/scripts/update-packages.sh --priority-1-only --skip-tests >> /Users/thijs/Documents/SommOS/logs/cron-updates.log 2>&1
```

⚠️ **Not recommended** for production without manual review.

---

### Q: What packages are NOT updated?

The following packages are intentionally excluded:

- `node-fetch`: Major version (v3) requires ESM migration (not compatible with current CommonJS backend)
- All packages not listed in Priority 1 or Priority 2

---

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review log files in `/Users/thijs/Documents/SommOS/logs/`
3. Consult the main README: `/Users/thijs/Documents/SommOS/README.md`
4. Open an issue in the project repository

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-10-06 | Initial release with Priority 1 and Priority 2 support |

---

**Document Status:** ✅ Production Ready  
**Last Reviewed:** 2025-10-06  
**Maintainer:** SommOS Team
