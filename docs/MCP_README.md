# MCP Servers for Warp AI - Complete Documentation

## 🎉 Good News!

Your MCP servers are **already configured and ready to use** in Warp AI! This documentation will help you make the most of them.

---

## 📚 Documentation Overview

### 1. **Quick Start** (Start Here!)
- **File:** `MCP_QUICK_REFERENCE.md`
- **Purpose:** Fast reference guide with common prompts and workflows
- **Best for:** Daily development, quick lookups, troubleshooting

### 2. **Full Usage Guide**
- **File:** `MCP_WARP_USAGE_GUIDE.md`
- **Purpose:** Comprehensive guide explaining how MCP servers work
- **Best for:** Understanding capabilities, learning best practices

### 3. **Enhanced Configuration**
- **File:** `MCP_ENHANCED_CONFIG.json`
- **Purpose:** Optional advanced configuration with environment variables
- **Best for:** Customizing MCP servers with project-specific context

### 4. **Implementation & Testing**
- **File:** `MCP_IMPLEMENTATION_GUIDE.md`
- **Purpose:** Step-by-step testing and troubleshooting guide
- **Best for:** Verifying setup, fixing issues, advanced configuration

---

## ⚡ Quick Start (30 seconds)

### Your Current Setup

```
✅ mcp-server-filesystem      → Read/write SommOS files
✅ mcp-server-sequential-thinking → Systematic problem-solving
✅ mcp-server-memory         → Remember context across sessions
✅ mcp-server-github         → Git operations (needs token)
✅ mcp-server-playwright     → Browser automation & testing
```

### Try It Now!

Open Warp AI chat and type:

```
"Show me the package.json file"
```

or

```
"Explain how the wine pairing algorithm works"
```

If Warp AI responds with file contents or code analysis, **you're all set!**

---

## 🎯 Common Use Cases

### Debugging
```
"Debug the CORS error on the pairing endpoint"
"Why isn't the JWT token being set in cookies?"
"Trace the authentication flow from login to API access"
```

### Code Review
```
"Review backend/core/pairing_engine.js for best practices"
"Check all API routes for proper error handling"
"Analyze test coverage for the inventory manager"
```

### Feature Development
```
"Create a new API endpoint for wine recommendations"
"Add input validation to the procurement routes"
"Implement real-time inventory updates via WebSocket"
```

### Testing
```
"Generate test cases for the pairing engine"
"Create integration tests for the authentication flow"
"Add E2E tests for wine search with Playwright"
```

---

## 🔐 Security Guidelines

### ✅ Safe Operations
- Read and edit source code
- Create new files and directories
- Generate configuration templates
- Review documentation

### ❌ Never Do This
- Edit `.env` directly (contains secrets)
- Modify `node_modules/` files
- Edit database files directly (use migrations)
- Commit API keys or secrets to git

---

## 💡 Pro Tips

### Build Project Memory
```
"Remember: SommOS uses DeepSeek as primary AI with OpenAI fallback"
"Remember: All API endpoints need rate limiting and validation"
"Remember: Test coverage must be 80% before merging"
```

### Combine Multiple Servers
```
"Use sequential thinking to plan a wine recommendation feature,
then implement the code, and remember the design decisions"
```

This will:
1. Plan systematically
2. Read existing code patterns
3. Generate implementation
4. Store architectural decisions

---

## 📖 What Each Server Does

### Filesystem Server
- **Purpose:** Read and write project files
- **Path:** `/Users/thijs/Documents/SommOS`
- **Use for:** Reading code, editing files, creating new modules
- **Example:** "Show me the authentication middleware"

### Sequential-Thinking Server
- **Purpose:** Break down complex problems step-by-step
- **Use for:** Debugging, planning features, analyzing architecture
- **Example:** "Use sequential thinking to debug the 500 error"

### Memory Server
- **Purpose:** Remember context across chat sessions
- **Use for:** Storing decisions, patterns, and common solutions
- **Example:** "Remember our API design patterns"

### GitHub Server
- **Purpose:** Git operations (PRs, issues, repos)
- **Requires:** `GITHUB_PERSONAL_ACCESS_TOKEN` environment variable
- **Use for:** Creating issues, reviewing PRs, checking CI status

### Playwright Server
- **Purpose:** Browser automation and E2E testing
- **Use for:** Testing PWA functionality, visual regression tests
- **Example:** "Test the wine search with Playwright"

---

## 🛠️ Troubleshooting

### MCP Servers Not Working?

**Quick Fix:**
1. Quit Warp completely (`Cmd + Q`)
2. Reopen Warp
3. Try again

**Verify Setup:**
```bash
# Check installations
which mcp-server-filesystem mcp-server-sequential-thinking mcp-server-memory

# View configuration
cat ~/Library/Application\ Support/Warp/mcp_config.json

# Validate JSON syntax
cat ~/Library/Application\ Support/Warp/mcp_config.json | jq .
```

**Still not working?** See `MCP_IMPLEMENTATION_GUIDE.md` for detailed troubleshooting.

---

## 📊 SommOS Project Context

Your MCP servers are pre-configured with knowledge of:

- **Architecture:** Offline-first PWA with Express backend
- **Database:** SQLite at `./data/sommos.db`
- **AI Providers:** DeepSeek (primary), OpenAI (fallback)
- **Authentication:** JWT with httpOnly cookies
- **Testing:** Jest with 80% coverage requirement
- **Deployment:** Docker + nginx

### Project Structure
```
SommOS/
├── backend/        # Express API (auth, inventory, pairing)
├── frontend/       # Vanilla JS PWA with service worker
├── tests/          # Jest test suites
├── scripts/        # Utilities (migration, seeding)
├── docs/           # Documentation (including this file)
└── data/           # SQLite database
```

---

## 🚀 Next Steps

1. **✅ Start Using:** Your setup is ready - just chat naturally with Warp AI

2. **📝 Read the Guides:**
   - Quick reference: `MCP_QUICK_REFERENCE.md`
   - Full guide: `MCP_WARP_USAGE_GUIDE.md`
   - Implementation: `MCP_IMPLEMENTATION_GUIDE.md`

3. **💾 Build Memory:**
   Store important context as you work:
   ```
   "Remember: [architectural decision]"
   "Remember: [coding pattern]"
   "Remember: [debugging solution]"
   ```

4. **🔧 Optional Enhancement:**
   See `MCP_ENHANCED_CONFIG.json` for advanced configuration with environment variables

---

## 📋 Recommended Workflow

### For New Features
1. **Plan:** "Use sequential thinking to plan [feature]"
2. **Review:** "Check existing patterns in backend/api/"
3. **Implement:** "Create the endpoint following our patterns"
4. **Test:** "Generate test cases"
5. **Remember:** "Remember the architecture for future reference"

### For Bug Fixes
1. **Debug:** "Use sequential thinking to debug [issue]"
2. **Analyze:** "Review the relevant files"
3. **Fix:** "Implement the fix"
4. **Test:** "Verify the fix works"
5. **Remember:** "Remember this solution for future issues"

### For Code Reviews
1. **Review:** "Review [file] for best practices"
2. **Compare:** "Check against our coding standards"
3. **Suggest:** "Provide improvements"
4. **Remember:** "Store the review findings"

---

## 🎓 Learning Resources

- **MCP Protocol:** https://modelcontextprotocol.io
- **Warp MCP Docs:** https://docs.warp.dev/features/ai/mcp-servers
- **SommOS Workflow:** `PROJECT_WORKFLOW.md`
- **API Documentation:** `API_KEYS.md`, `DEPLOYMENT.md`

---

## 💬 Example Chat Session

```
You: "I need to add email validation to user registration"

Warp AI:
1. Reads backend/api/auth.js
2. Checks existing validation patterns
3. Adds email validation
4. Updates tests
5. Shows you the complete implementation

You: "Remember that we use validator.js for email validation"

Warp AI: "Stored! I'll use validator.js for future email validation."
```

---

## 📈 Success Metrics

You'll know MCP is working well when:

✅ Warp AI can read and suggest edits to your code  
✅ You get step-by-step analysis of complex problems  
✅ Warp AI remembers context across sessions  
✅ Debugging is faster and more systematic  
✅ Code reviews are thorough and consistent

---

## 🎉 You're Ready!

Your MCP servers are configured and optimized for SommOS development. Just start chatting naturally with Warp AI, and it will automatically use the right tools for your requests.

**Happy coding! 🍷**

---

## 📝 Documentation Summary

| File | Purpose | When to Use |
|------|---------|-------------|
| `MCP_README.md` (this file) | Overview and quick start | Starting point, overview |
| `MCP_QUICK_REFERENCE.md` | Fast lookup guide | Daily development |
| `MCP_WARP_USAGE_GUIDE.md` | Complete explanation | Learning, deep dive |
| `MCP_ENHANCED_CONFIG.json` | Advanced config | Customization |
| `MCP_IMPLEMENTATION_GUIDE.md` | Testing & troubleshooting | Setup verification, issues |

---

**Created:** October 3, 2025  
**Version:** 1.0  
**Status:** ✅ Ready to Use
