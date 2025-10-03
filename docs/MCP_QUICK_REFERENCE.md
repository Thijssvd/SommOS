# MCP Quick Reference - SommOS

## 🚀 Getting Started

Your MCP servers are already configured! Just **chat naturally** with Warp AI, and it will automatically use the right tools.

### Current Setup
```bash
✅ Filesystem Server  → Read/write project files
✅ Sequential-Thinking → Break down complex problems
✅ Memory Server      → Remember context across sessions
✅ GitHub Server      → Git operations (requires token)
✅ Playwright Server  → Browser automation & testing
```

---

## 📋 Common Prompts by Task

### 🐛 Debugging

```
"Debug the CORS error on the pairing endpoint"
"Why is the JWT token not being set in cookies?"
"Trace the authentication flow from login to protected route"
"The wine search returns empty results - help me debug"
"Find why the offline sync isn't working"
```

### 📝 Code Review

```
"Review backend/core/pairing_engine.js for best practices"
"Check all API routes for proper error handling"
"Analyze the authentication middleware for security issues"
"Review test coverage for the inventory manager"
"Find performance bottlenecks in the database queries"
```

### ⚡ Feature Development

```
"Create a new API endpoint for wine recommendations"
"Add input validation to the procurement routes"
"Implement real-time updates via WebSocket"
"Add temperature monitoring to the cellar management"
"Create an export feature for tasting notes"
```

### 🧪 Testing

```
"Generate test cases for the pairing engine"
"Create integration tests for the authentication flow"
"Add E2E tests for wine search with Playwright"
"Review test coverage and suggest missing tests"
"Write a test for the offline sync functionality"
```

### 📚 Documentation

```
"Generate API documentation for all wine-related endpoints"
"Document the database migration workflow"
"Explain how the offline-first architecture works"
"Create a deployment guide for production"
"Document the authentication system"
```

### 🔧 Refactoring

```
"Split the pairing engine into smaller, testable modules"
"Refactor the inventory manager to use async/await"
"Extract common validation logic into middleware"
"Optimize the database queries in the search function"
"Reorganize the frontend module structure"
```

---

## 💡 Pro Tips

### Combine Multiple Servers

```
"Use sequential thinking to plan a wine recommendation feature,
then implement the code, and remember the design decisions"
```

This will:
1. [Sequential-Thinking] Plan systematically
2. [Memory] Recall existing patterns
3. [Filesystem] Read relevant code
4. [Filesystem] Write new implementation
5. [Memory] Store the decisions

### Build Project Memory

**Store important context:**
```
"Remember: We use DeepSeek as primary AI with OpenAI fallback"
"Remember: All API endpoints need rate limiting"
"Remember: Database changes require migrations, never direct edits"
"Remember: Test coverage must be 80% before merging"
```

**Recall when needed:**
```
"What's our API authentication strategy?"
"How do we handle database migrations?"
"What are our code review standards?"
```

### Effective Prompts

✅ **Good - Specific:**
- "Review the JWT handling in backend/middleware/auth.js"
- "Debug the 500 error in POST /api/pairing/quick"
- "Optimize the wine search query in backend/core/inventory_manager.js"

❌ **Bad - Too Vague:**
- "Fix the code"
- "Make it better"
- "Check everything"

---

## 🔐 Security Checklist

### Safe Operations
- ✅ Read and edit source code files
- ✅ Create new files and directories
- ✅ Generate configuration templates
- ✅ Read `.env.example` or `.env.template`
- ✅ Review documentation and markdown files

### Dangerous Operations
- ❌ Never edit `.env` directly (contains secrets)
- ❌ Don't modify `node_modules/` files
- ❌ Don't edit database files directly (use migrations)
- ❌ Never commit API keys or secrets to git
- ❌ Don't expose credentials in logs or code

---

## 🛠️ Troubleshooting

### MCP Servers Not Working

**Problem:** Warp AI doesn't use MCP tools or says "tool unavailable"

**Solutions:**
1. **Restart Warp:** `Cmd + Q`, then reopen
2. **Check installation:**
   ```bash
   which mcp-server-filesystem
   which mcp-server-sequential-thinking
   which mcp-server-memory
   ```
3. **Verify config:**
   ```bash
   cat ~/Library/Application\ Support/Warp/mcp_config.json
   ```
4. **Check logs:** Look for errors in Warp console

### Wrong Project Directory

**Problem:** Can't access SommOS files

**Check path in config:**
```bash
cat ~/Library/Application\ Support/Warp/mcp_config.json | grep -A 3 filesystem
```

Should show: `"/Users/thijs/Documents/SommOS"`

### Memory Not Persisting

**Problem:** Warp AI forgets context

**Solution:** Explicitly ask to remember:
```
"Remember this solution for future debugging sessions"
```

---

## 📖 SommOS Development Workflows

### Workflow 1: New Feature
```
1. "Plan a wine recommendation feature using sequential thinking"
2. "Review existing recommendation patterns in the codebase"
3. "Create the API endpoint in backend/api/recommendations.js"
4. "Generate test cases for the new endpoint"
5. "Remember the feature architecture for future reference"
```

### Workflow 2: Bug Fix
```
1. "Debug the CORS error on /api/pairing/quick"
2. "Review backend/config/security.js for CORS configuration"
3. "Fix the CORS middleware to allow frontend origin"
4. "Test the fix with curl commands"
5. "Remember this CORS solution for future issues"
```

### Workflow 3: Code Review
```
1. "Review backend/core/pairing_engine.js for optimization"
2. "Analyze test coverage for the pairing engine"
3. "Suggest improvements with code examples"
4. "Create a checklist of changes needed"
5. "Remember the review findings"
```

### Workflow 4: Database Migration
```
1. "Create a new migration to add guest access support"
2. "Review existing migrations for naming patterns"
3. "Generate the migration file with proper schema changes"
4. "Add rollback logic to the migration"
5. "Document the migration in the migration log"
```

---

## 🎯 SommOS-Specific Commands

### Development
```bash
npm run dev              # Start dev server (backend + frontend)
npm test                 # Run all tests
npm run migrate          # Run database migrations
npm run seed             # Seed database with sample data
```

### Testing
```bash
npm test -- --coverage   # Run tests with coverage report
npm run test:weather     # Test Open-Meteo API integration
```

### Database
```bash
npm run migrate:status   # Check migration status
npm run setup:db         # Initialize database
npm run summary          # Show database summary
npm run import:cellar    # Import cellar data
```

### Deployment
```bash
./deployment/deploy.sh            # Deploy to production
./start-production-local.sh       # Test prod build locally
npm run verify:env                # Verify environment config
```

---

## 🔄 Quick Config Update

### Apply Enhanced Configuration

```bash
# 1. Backup current config
cp ~/Library/Application\ Support/Warp/mcp_config.json \
   ~/Library/Application\ Support/Warp/mcp_config.json.backup

# 2. View the enhanced config (optional)
cat docs/MCP_ENHANCED_CONFIG.json

# 3. Your current config is already working!
# Only update if you want the enhanced environment variables

# 4. Restart Warp to apply any changes
# Cmd + Q, then reopen Warp
```

### Roll Back if Needed

```bash
# Restore backup
cp ~/Library/Application\ Support/Warp/mcp_config.json.backup \
   ~/Library/Application\ Support/Warp/mcp_config.json

# Restart Warp
```

---

## 📊 SommOS Project Structure

```
SommOS/
├── backend/              # Express API server
│   ├── api/             # REST endpoints (auth, inventory, pairing)
│   ├── core/            # Business logic (engines, services)
│   ├── database/        # Schema, migrations, seeds
│   ├── middleware/      # Auth, validation, security
│   └── config/          # Environment & security config
├── frontend/            # Vanilla JS PWA
│   ├── js/modules/      # Application modules
│   ├── css/             # Stylesheets
│   └── sw.js            # Service worker
├── tests/               # Jest test suites
│   ├── api/             # API endpoint tests
│   ├── integration/     # Integration tests
│   └── performance/     # Performance tests
├── scripts/             # Utility scripts
├── docs/                # Documentation
└── data/                # SQLite database (./data/sommos.db)
```

---

## 🎓 Learning More

- **Full Guide:** `docs/MCP_WARP_USAGE_GUIDE.md`
- **Enhanced Config:** `docs/MCP_ENHANCED_CONFIG.json`
- **Project Workflow:** `docs/PROJECT_WORKFLOW.md`
- **MCP Docs:** https://modelcontextprotocol.io
- **Warp Docs:** https://docs.warp.dev/features/ai/mcp-servers

---

## 💬 Example Session

```
You: "I need to add email validation to user registration"

Warp AI will:
1. Read backend/api/auth.js
2. Check existing validation patterns
3. Add email validation using validator library
4. Update tests to cover email validation
5. Show you the changes

You: "Remember that we always use validator.js for email validation"

Warp AI: Stored! I'll use validator.js for future email validation needs.
```

---

**Last Updated:** October 3, 2025  
**Version:** 1.0
