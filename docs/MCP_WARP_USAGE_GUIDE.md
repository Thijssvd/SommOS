# MCP Servers Usage Guide for Warp AI - SommOS

## Overview

Model Context Protocol (MCP) servers extend Warp AI capabilities by providing specialized tools for development workflows. This guide covers the three MCP servers configured for your SommOS project:

1. **Filesystem Server** - Read and write project files
2. **Sequential-Thinking Server** - Systematic problem-solving and debugging
3. **Memory Server** - Maintain context across sessions

## How MCP Servers Work in Warp AI

When you chat with Warp AI, the assistant can **automatically invoke MCP server tools** based on your requests. You don't need to manually call tools—just describe what you want in natural language.

### Example Workflow

**You say:**
> "Review the pairing engine code and explain how it works"

**Warp AI:**

1. Uses **filesystem server** to read `backend/core/pairing_engine.js`
2. Uses **sequential-thinking server** to break down the algorithm step-by-step
3. Uses **memory server** to remember this analysis for future questions
4. Provides you with a comprehensive explanation

---

## 1. Filesystem Server

The filesystem server allows Warp AI to read and write files in your project directory.

### Current Configuration

```json
"filesystem": {
  "command": "mcp-server-filesystem",
  "args": ["/Users/thijs/Documents/SommOS"],
  "env": {}
}
```

### What It Can Do

#### Read Files

**Natural prompt:** "Show me the authentication middleware"

Warp AI will automatically read `backend/middleware/auth.js`

#### Write/Edit Files

**Natural prompt:** "Add input validation to the pairing endpoint"

Warp AI will:

1. Read `backend/api/pairing.js`
2. Understand the current code
3. Generate the validation logic
4. Write the changes back to the file

#### Navigate Project Structure

**Natural prompt:** "List all the database migration files"

Warp AI will explore `backend/database/migrations/`

#### Search for Code Patterns

**Natural prompt:** "Find all files that use the DeepSeek API"

Warp AI will search across the project for `DEEPSEEK_API_KEY` references

### Best Practices for SommOS

✅ **Do:**

- Ask to read specific files: "Check the wine inventory schema"
- Request code reviews: "Review error handling in the API routes"
- Ask for file creation: "Create a new migration for guest access"
- Request refactoring: "Split the pairing engine into smaller modules"

❌ **Don't:**

- Try to edit `.env` files (security risk)
- Modify files in `node_modules/`
- Change database files directly
- Edit generated files in `dist/` or `build/`

---

## 2. Sequential-Thinking Server

The sequential-thinking server helps Warp AI break down complex problems into manageable steps.

### Current Configuration

```json
"sequential-thinking": {
  "command": "mcp-server-sequential-thinking",
  "args": [],
  "env": {}
}
```

### What It Can Do

#### Debug Complex Issues

**Natural prompt:** "The wine pairing API returns 500 errors when the dish name is empty. Help me debug this."

Warp AI will:

1. Analyze the request flow from frontend to backend
2. Check validation middleware
3. Examine the pairing engine logic
4. Test error handling
5. Identify the root cause
6. Suggest a fix

#### Analyze Architecture

**Natural prompt:** "Explain how offline sync works in SommOS"

Warp AI will systematically trace:

1. Service worker registration
2. Cache strategies
3. IndexedDB usage
4. Sync manager implementation
5. Conflict resolution

#### Plan Features

**Natural prompt:** "How should we implement wine cellar temperature monitoring?"

Warp AI will think through:

1. Data model requirements
2. API endpoints needed
3. Database schema changes
4. Frontend UI components
5. Real-time update strategy
6. Testing approach

### Best Practices for SommOS

✅ **Use for:**

- Debugging authentication flows
- Analyzing database query performance
- Planning new features
- Understanding complex algorithms (weather analysis, pairing engine)
- Troubleshooting deployment issues

❌ **Avoid for:**

- Simple questions that don't need step-by-step analysis
- Questions already answered in documentation

---

## 3. Memory Server

The memory server allows Warp AI to remember context across different chat sessions.

### Current Configuration

```json
"memory": {
  "command": "mcp-server-memory",
  "args": [],
  "env": {}
}
```

### What It Can Do

#### Remember Architectural Decisions

**Natural prompt:** "Remember that we use DeepSeek as the primary AI provider with OpenAI as fallback"

Warp AI will store this and reference it in future conversations.

#### Track Project Conventions

**Natural prompt:** "Remember that all API endpoints should include rate limiting and request validation"

Future code generation will follow this pattern.

#### Maintain Testing Context

**Natural prompt:** "Remember that we need to maintain 80% test coverage and all tests must pass before deployment"

Warp AI will reference this when suggesting changes.

#### Store Debugging Solutions

**Natural prompt:** "Remember that CORS issues between ports 3000 and 3001 require explicit origin configuration in backend/config/security.js"

Next time similar issues arise, Warp AI will recall the solution.

### Best Practices for SommOS

✅ **Store:**

- API endpoint documentation
- Common debugging solutions
- Deployment procedures
- Testing strategies
- Code review checklists
- Performance optimization notes

❌ **Don't store:**

- Sensitive credentials or API keys
- Temporary debugging notes
- User-specific data
- Frequently changing information

---

## Practical SommOS Examples

### Example 1: Debugging Authentication

```
You: "The JWT token isn't being set in cookies after login"

Warp AI will:
1. [Filesystem] Read backend/core/auth_service.js
2. [Sequential-thinking] Analyze the authentication flow
3. [Filesystem] Check backend/middleware/auth.js
4. [Filesystem] Review backend/config/security.js cookie settings
5. [Memory] Recall previous auth-related fixes
6. Provide diagnosis and solution
```

### Example 2: Adding a New Feature

```
You: "Add a wine tasting notes export feature"

Warp AI will:
1. [Sequential-thinking] Plan the feature architecture
2. [Memory] Recall API design patterns used in SommOS
3. [Filesystem] Create new API endpoint in backend/api/
4. [Filesystem] Add frontend UI components
5. [Filesystem] Generate test cases
6. Provide implementation plan
```

### Example 3: Performance Optimization

```
You: "The wine search is slow with large inventories"

Warp AI will:
1. [Filesystem] Read database query implementations
2. [Sequential-thinking] Analyze query patterns
3. [Memory] Recall database optimization strategies
4. [Filesystem] Review database indexes in schema
5. Suggest optimizations with code changes
```

### Example 4: Code Review

```
You: "Review the procurement engine for best practices"

Warp AI will:
1. [Filesystem] Read backend/core/procurement_engine.js
2. [Sequential-thinking] Analyze code structure and patterns
3. [Memory] Compare against stored coding standards
4. Provide detailed feedback with suggestions
```

---

## Security Considerations

### What's Protected

The current configuration **automatically protects**:

- Filesystem access is restricted to `/Users/thijs/Documents/SommOS`
- Cannot access parent directories or system files
- Cannot modify system configurations

### Additional Safety Measures

1. **Sensitive Files**: Never ask Warp AI to include credentials in code
2. **API Keys**: Store in `.env` and reference via environment variables
3. **Database**: Use migrations, never direct database file edits
4. **Git History**: Be cautious about committing AI-generated secrets

---

## Troubleshooting

### MCP Servers Not Responding

**Symptom**: Warp AI says "tool unavailable" or doesn't use MCP tools

**Solutions**:

1. Restart Warp: `Cmd + Q` and reopen
2. Check server installation:

   ```bash
   which mcp-server-filesystem
   which mcp-server-sequential-thinking
   which mcp-server-memory
   ```

3. Verify configuration:

   ```bash
   cat ~/Library/Application\ Support/Warp/mcp_config.json
   ```

### Filesystem Server Path Issues

**Symptom**: Can't access project files

**Solution**: Verify base path in config matches your project:

```json
"args": ["/Users/thijs/Documents/SommOS"]
```

### Memory Not Persisting

**Symptom**: Warp AI forgets context between sessions

**Solution**: Explicitly ask to remember:

```
"Remember this solution for future reference"
```

---

## Quick Reference Commands

### Useful Prompts for SommOS

**Code Analysis:**

- "Explain how the wine pairing algorithm works"
- "Review the authentication flow for security issues"
- "Analyze database schema for optimization opportunities"

**Feature Development:**

- "Create a new API endpoint for wine recommendations"
- "Add input validation to the procurement routes"
- "Implement real-time inventory updates via WebSocket"

**Debugging:**

- "Debug the CORS error on the pairing endpoint"
- "Fix the JWT token refresh logic"
- "Troubleshoot the offline sync not triggering"

**Testing:**

- "Generate test cases for the inventory manager"
- "Review test coverage for API routes"
- "Create integration tests for the pairing engine"

**Documentation:**

- "Generate API documentation for wine routes"
- "Document the database migration process"
- "Explain the deployment workflow"

---

## Advanced Usage

### Combining Multiple Servers

**Complex prompt example:**

```
"I need to add a wine recommendation feature based on past orders. 
Use sequential thinking to plan the architecture, then implement 
the code, and remember the design decisions for future reference."
```

Warp AI will:

1. [Sequential-thinking] Plan the feature systematically
2. [Memory] Recall existing architecture patterns
3. [Filesystem] Read relevant existing code
4. [Filesystem] Create new implementation files
5. [Memory] Store the architectural decisions

### Project-Specific Workflows

**SommOS Development Workflow:**

1. Planning: Use sequential-thinking for architecture
2. Implementation: Use filesystem for code changes
3. Testing: Use sequential-thinking for test strategies
4. Review: Use memory to maintain quality standards
5. Documentation: Use filesystem to update docs
6. Deployment: Use sequential-thinking for deployment steps

---

## Next Steps

1. ✅ **You're already configured!** All three servers are set up
2. 📝 Start using natural language prompts in Warp AI chat
3. 💾 Build up project memory by telling Warp AI to "remember" important decisions
4. 🔧 See the enhanced configuration in `MCP_ENHANCED_CONFIG.json` for advanced options

---

## Additional Resources

- **MCP Documentation**: <https://modelcontextprotocol.io>
- **Warp MCP Guide**: <https://docs.warp.dev/features/ai/mcp-servers>
- **SommOS Architecture**: `docs/PROJECT_WORKFLOW.md`
- **Enhanced MCP Config**: `docs/MCP_ENHANCED_CONFIG.json`

---

**Last Updated**: October 3, 2025
