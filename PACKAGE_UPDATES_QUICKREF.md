# SommOS Package Updates - Quick Reference

## 🚀 Most Common Commands

```bash
# Safe update (recommended for production)
./scripts/update-packages.sh --priority-1-only

# Preview changes without making modifications
./scripts/update-packages.sh --dry-run --verbose

# View help and all options
./scripts/update-packages.sh --help
```

---

## 📦 What Gets Updated

### Priority 1 (Safe - Recommended) ✅

- `@playwright/test`: 1.55.1 → 1.56.0
- `@types/node`: 24.6.2 → 24.7.0
- `openai`: 6.0.1 → 6.1.0
- `zod`: 4.1.11 → 4.1.12

### Priority 2 (Breaking Changes) ⚠️

- `web-vitals`: 3.5.2 → 5.1.0 (requires code changes)

---

## ⏱️ Typical Duration

| Mode | Time | Description |
|------|------|-------------|
| Priority 1 | 5-10 min | Safe updates with full tests |
| Priority 1 + 2 | 10-15 min | Includes breaking changes |
| With --skip-tests | 2-3 min | Fast but less safe |
| --dry-run | 30 sec | Preview only, no changes |

---

## 🔒 Safety Features

✅ Automatic backups before changes  
✅ Rollback on failures  
✅ Full test suite verification  
✅ Security vulnerability scanning  
✅ Detailed deployment reports  

**Backups:** `/Users/thijs/Documents/SommOS/logs/backups/`  
**Logs:** `/Users/thijs/Documents/SommOS/logs/`

---

## 📝 Output Files

After running, check these files:

1. **Log:** `/Users/thijs/Documents/SommOS/logs/package-update-YYYYMMDD-HHMMSS.log`
2. **Report:** `/Users/thijs/Documents/SommOS/logs/package-update-report-YYYYMMDD-HHMMSS.md`
3. **Backups:** `/Users/thijs/Documents/SommOS/logs/backups/`

---

## 🆘 Troubleshooting

### Script fails? Check

```bash
# View the log file
cat /Users/thijs/Documents/SommOS/logs/package-update-*.log | tail -100

# Verify Node.js version
node --version  # Should be v20.x

# Check npm
npm --version
```

### Need to rollback?

```bash
# Automatic rollback happens on failure
# Manual rollback:
cd /Users/thijs/Documents/SommOS/logs/backups
cp package.json.LATEST /Users/thijs/Documents/SommOS/package.json
cp package-lock.json.LATEST /Users/thijs/Documents/SommOS/package-lock.json
cd /Users/thijs/Documents/SommOS && npm install
```

---

## 📚 Full Documentation

For complete documentation, see:

- **Detailed Guide:** `/Users/thijs/Documents/SommOS/docs/PACKAGE_UPDATES.md`
- **Project README:** `/Users/thijs/Documents/SommOS/README.md`

---

## ✅ Pre-flight Checklist

Before running the script:

- [ ] Git working directory is clean (or committed)
- [ ] Node.js v20.x is installed
- [ ] npm is available
- [ ] Tests are passing: `npm test`
- [ ] Backups of critical data exist

---

## 🎯 Best Practices

1. **Always run dry-run first**

   ```bash
   ./scripts/update-packages.sh --dry-run --verbose
   ```

2. **Start with Priority 1 only**

   ```bash
   ./scripts/update-packages.sh --priority-1-only
   ```

3. **Commit before updating**

   ```bash
   git add . && git commit -m "chore: checkpoint before updates"
   ```

4. **Review the report**

   ```bash
   cat /Users/thijs/Documents/SommOS/logs/package-update-report-*.md
   ```

5. **Monitor after deployment**

   ```bash
   npm test && npm run test:e2e
   ```

---

**Script Version:** 1.0.0  
**Last Updated:** 2025-10-06  
**Status:** Production Ready ✅
