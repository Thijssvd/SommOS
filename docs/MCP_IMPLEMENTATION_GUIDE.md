# MCP Implementation & Testing Guide

## ✅ Current Status

**Good news!** Your MCP servers are already configured and ready to use. This guide will help you:
1. Verify your setup is working
2. Optionally apply enhanced configuration
3. Test each server with practical examples
4. Troubleshoot any issues

---

## 🔍 Step 1: Verify Current Setup

### Check MCP Server Installation

```bash
# Verify all servers are installed
which mcp-server-filesystem
which mcp-server-sequential-thinking
which mcp-server-memory
which mcp-server-github
which mcp-server-playwright
```

**Expected output:**
```
/Users/thijs/.nvm/versions/node/v20.19.5/bin/mcp-server-filesystem
/Users/thijs/.nvm/versions/node/v20.19.5/bin/mcp-server-sequential-thinking
/Users/thijs/.nvm/versions/node/v20.19.5/bin/mcp-server-memory
...
```

### Check Current Configuration

```bash
cat ~/Library/Application\ Support/Warp/mcp_config.json
```

**Your current config should show:**
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "mcp-server-filesystem",
      "args": ["/Users/thijs/Documents/SommOS"],
      "env": {}
    },
    "sequential-thinking": {
      "command": "mcp-server-sequential-thinking",
      "args": [],
      "env": {}
    },
    "memory": {
      "command": "mcp-server-memory",
      "args": [],
      "env": {}
    },
    ...
  }
}
```

✅ **If you see this, you're all set!**

---

## 🧪 Step 2: Test Each Server

### Test 1: Filesystem Server

Open Warp AI chat and try these prompts:

#### Test 1a: Read a File
```
"Show me the package.json file"
```

**Expected:** Warp AI displays the contents of `package.json`

#### Test 1b: List Directory Contents
```
"List all files in the backend/api directory"
```

**Expected:** Warp AI shows files like auth.js, inventory.js, pairing.js, etc.

#### Test 1c: Search for Code
```
"Find all files that import the database connection"
```

**Expected:** Warp AI searches and shows files using `database/connection.js`

### Test 2: Sequential-Thinking Server

#### Test 2a: Debug a Problem
```
"Use sequential thinking to explain how the JWT authentication flow works in SommOS"
```

**Expected:** Warp AI breaks down the process step-by-step:
1. User submits login credentials
2. Backend validates credentials
3. JWT token is generated
4. Token is set in httpOnly cookie
5. Future requests include the token
6. Middleware validates the token

#### Test 2b: Plan a Feature
```
"Use sequential thinking to plan how we would add wine cellar temperature monitoring"
```

**Expected:** Systematic analysis of requirements, database schema, API endpoints, frontend UI, etc.

### Test 3: Memory Server

#### Test 3a: Store Information
```
"Remember: SommOS uses DeepSeek as the primary AI provider with OpenAI as fallback"
```

**Expected:** Warp AI confirms it has stored this information

#### Test 3b: Recall Information (in a new chat)
```
"What AI provider does SommOS use?"
```

**Expected:** Warp AI recalls: "SommOS uses DeepSeek as primary with OpenAI fallback"

### Test 4: Combined Usage

```
"Review the pairing engine code, use sequential thinking to analyze it, and remember any important patterns you find"
```

**Expected:** Warp AI will:
1. [Filesystem] Read `backend/core/pairing_engine.js`
2. [Sequential-Thinking] Analyze the code systematically
3. [Memory] Store important patterns
4. Provide comprehensive analysis

---

## 🚀 Step 3: Optional Enhanced Configuration

Your current setup works great! If you want to add environment variables for better context:

### Backup Current Config

```bash
cp ~/Library/Application\ Support/Warp/mcp_config.json \
   ~/Library/Application\ Support/Warp/mcp_config.json.backup
```

### View Enhanced Config (Optional)

```bash
cat docs/MCP_ENHANCED_CONFIG.json
```

The enhanced config adds:
- `PROJECT_NAME`, `NODE_ENV` for filesystem server
- `THINKING_MODE`, `PROJECT_CONTEXT` for sequential-thinking
- `MEMORY_SCOPE` for memory server

### Apply Enhanced Config (Optional)

**Note:** Only do this if you want the additional environment variables. Your current setup already works!

```bash
# Clean the enhanced config (remove comment fields)
cat docs/MCP_ENHANCED_CONFIG.json | \
  jq 'del(._comment, ._instructions, .mcpServers[].  _notes, .mcpServers[]._use_cases, ._sommos_specific_notes, ._recommended_prompts, ._warp_ai_tips)' > \
  ~/Library/Application\ Support/Warp/mcp_config.json
```

### Restart Warp

```bash
# Quit Warp completely
# Press: Cmd + Q

# Then reopen Warp from Applications
```

### Test After Restart

```
"List files in backend/api"
```

If this works, your config is applied successfully!

---

## 🔧 Step 4: Troubleshooting

### Problem: "Tool unavailable" or MCP servers not responding

**Solution 1: Restart Warp**
```bash
# Completely quit Warp (Cmd + Q)
# Then reopen from Applications
```

**Solution 2: Check server processes**
```bash
ps aux | grep mcp
```

**Solution 3: Verify configuration syntax**
```bash
# Check for JSON syntax errors
cat ~/Library/Application\ Support/Warp/mcp_config.json | jq .
```

If this shows an error, your JSON has a syntax issue.

**Solution 4: Restore backup**
```bash
cp ~/Library/Application\ Support/Warp/mcp_config.json.backup \
   ~/Library/Application\ Support/Warp/mcp_config.json
```

### Problem: Can't access SommOS files

**Check filesystem server path:**
```bash
cat ~/Library/Application\ Support/Warp/mcp_config.json | grep -A 5 filesystem
```

**Verify path exists:**
```bash
ls -la /Users/thijs/Documents/SommOS
```

**Fix:** Update the path in mcp_config.json if needed.

### Problem: Memory not persisting

**Solution:** Be explicit when storing:
```
"Remember this for future reference: [your information]"
```

**Check memory storage location:**
```bash
# Memory server typically stores in home directory
ls -la ~/.mcp-memory 2>/dev/null || echo "Memory directory not found"
```

### Problem: Performance is slow

**Possible causes:**
1. Too many files in project (node_modules, etc.)
2. Large database files being scanned

**Solutions:**
- Filesystem server automatically excludes common directories
- Keep your working directory clean
- Use `.gitignore` patterns

---

## 📊 Step 5: Validate Full Integration

### Complete Integration Test

Run this comprehensive prompt in Warp AI:

```
"I need to add a new wine recommendation API endpoint. 
First, use sequential thinking to plan the implementation.
Then, review existing API patterns in backend/api/.
Finally, remember the architectural decisions we make."
```

**Expected workflow:**
1. ✅ Sequential-thinking plans the feature
2. ✅ Filesystem reads existing API files
3. ✅ Analysis of patterns and structure
4. ✅ Implementation suggestions
5. ✅ Memory stores the architectural decisions

If all steps work, your MCP setup is fully operational!

---

## 🎯 Step 6: Build Your Project Memory

Now that everything works, start building context:

```
"Remember: SommOS is a yacht wine management PWA with offline-first architecture"

"Remember: We use SQLite for the database and migrations for schema changes"

"Remember: All API endpoints require authentication except /auth/login and /auth/register"

"Remember: Testing requires 80% code coverage before deployment"

"Remember: CORS is configured to allow localhost:5173 (frontend) to access localhost:3001 (backend)"

"Remember: We follow the pattern: API endpoint → Service layer → Database layer"
```

---

## 📋 Quick Command Reference

### Configuration Management
```bash
# Backup config
cp ~/Library/Application\ Support/Warp/mcp_config.json \
   ~/Library/Application\ Support/Warp/mcp_config.json.backup

# View config
cat ~/Library/Application\ Support/Warp/mcp_config.json

# Validate JSON syntax
cat ~/Library/Application\ Support/Warp/mcp_config.json | jq .

# Restore backup
cp ~/Library/Application\ Support/Warp/mcp_config.json.backup \
   ~/Library/Application\ Support/Warp/mcp_config.json
```

### Server Verification
```bash
# Check installations
which mcp-server-filesystem mcp-server-sequential-thinking mcp-server-memory

# Check running processes
ps aux | grep mcp

# Check npm global packages
npm list -g | grep mcp
```

### Warp Operations
```bash
# Restart is just: Cmd + Q, then reopen

# Check Warp version (from Warp menu)
# Warp → About Warp
```

---

## ✨ Next Steps

1. **✅ Your setup is ready!** Start using Warp AI naturally
2. **📝 Read the guides:**
   - Full guide: `docs/MCP_WARP_USAGE_GUIDE.md`
   - Quick reference: `docs/MCP_QUICK_REFERENCE.md`
   - Enhanced config: `docs/MCP_ENHANCED_CONFIG.json`

3. **💬 Start chatting:**
   - "Review the authentication middleware"
   - "Debug the CORS error on the pairing endpoint"
   - "Plan a new feature for wine recommendations"

4. **💾 Build memory:**
   - Store architectural decisions
   - Remember coding patterns
   - Track common solutions

---

## 🆘 Getting Help

### If Something Doesn't Work

1. **Check the logs:** Look for error messages in Warp
2. **Verify installation:** Run the verification commands above
3. **Restart Warp:** Most issues resolve with a restart
4. **Check documentation:**
   - MCP Docs: https://modelcontextprotocol.io
   - Warp Docs: https://docs.warp.dev/features/ai/mcp-servers

### Test Prompts That Should Always Work

```
"What files are in the current directory?"
"Explain the structure of this project"
"Help me debug an issue"
```

If these basic prompts don't work, check your Warp AI configuration.

---

## 📈 Success Indicators

You'll know your MCP setup is working well when:

✅ **Filesystem:** Warp AI can read and suggest edits to your code
✅ **Sequential-Thinking:** You get step-by-step analysis of complex problems
✅ **Memory:** Warp AI remembers context across chat sessions
✅ **Integration:** All three work together seamlessly

---

## 🎓 Advanced Tips

### Optimize Your Workflow

**For debugging:**
```
"Use sequential thinking to debug [issue], check the relevant files, and remember the solution"
```

**For features:**
```
"Plan [feature] with sequential thinking, implement it following our patterns, and remember the architecture"
```

**For reviews:**
```
"Review [file], compare it against our standards from memory, and suggest improvements"
```

### Create Project-Specific Memories

```
"Remember: Wine pairing algorithm is in backend/core/pairing_engine.js"
"Remember: Database schema is defined in backend/database/schema.sql"
"Remember: Frontend modules are in frontend/js/modules/"
"Remember: Tests are in tests/ with subdirectories for different test types"
```

---

**Configuration Complete! 🎉**

Your MCP servers are ready to supercharge your SommOS development workflow.

---

**Last Updated:** October 3, 2025  
**Version:** 1.0
