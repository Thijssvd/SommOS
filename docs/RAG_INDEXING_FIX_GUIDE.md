# RAG Indexing Fix Guide for Agent-MCP + SommOS

**Date**: 2025-10-06  
**Issue**: RAG system unable to index markdown files  
**Root Cause**: DeepSeek API does not support embedding models  
**Status**: Configuration update required

---

## Problem Summary

The Agent-MCP server successfully restarted and attempted to index markdown files from the SommOS project into the RAG (knowledge graph) system. However, all embedding API calls failed with **404 errors**:

```
OpenAI embedding API error in batch starting at X: Error code: 404 - 
{'error_msg': 'Not Found. Please check the configuration.'}
```

**Root Cause Analysis:**
- Agent-MCP was configured to use DeepSeek API (`https://api.deepseek.com`)
- DeepSeek provides **chat/reasoning models only** (deepseek-chat, deepseek-reasoner)
- DeepSeek does **NOT provide embedding models** (no text-embedding-3-large or similar)
- The RAG indexing system requires embeddings to create vector representations of markdown content
- Without embeddings, the knowledge graph cannot be populated

---

## Solution: Use OpenAI API for Embeddings

### Option 1: Add OpenAI API Key (Recommended)

#### Step 1: Get an OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-proj-...` or `sk-...`)
5. **Important**: Copy it immediately - you won't be able to see it again!

#### Step 2: Update the `.env` File

The `.env` file has been updated to separate OpenAI (for embeddings) and DeepSeek (for chat):

```bash
# Current configuration in /Users/thijs/Documents/SommOS/Agent-MCP/.env:

# OpenAI API Key - required for embeddings (RAG system)
# Get your key from: https://platform.openai.com/api-keys
OPENAI_API_KEY=<YOUR_OPENAI_API_KEY_HERE>

# DeepSeek API Key - for chat/reasoning models  
DEEPSEEK_API_KEY=sk-bcf85de8c7604adebf8f4b9b5bc4d798

# DeepSeek API Base URL (OpenAI-compatible) - for chat models only
# Note: DeepSeek does NOT support embedding models
# OPENAI_BASE_URL=https://api.deepseek.com
```

**Action Required:**
Replace `<YOUR_OPENAI_API_KEY_HERE>` with your actual OpenAI API key.

#### Step 3: Restart the Agent-MCP Server

```bash
# Stop the current server
pkill -f agent_mcp.cli

# Start the server with the new configuration
cd /Users/thijs/Documents/SommOS/Agent-MCP
uv run -m agent_mcp.cli --port 8080 --project-dir /Users/thijs/Documents/SommOS &

# Wait 20 seconds for indexing to complete
sleep 20

# Verify RAG chunks were created
sqlite3 /Users/thijs/Documents/SommOS/.agent/mcp_state.db \
  "SELECT COUNT(*) FROM rag_chunks;"
```

Expected result: Count should be > 0 (likely 100-500+ chunks depending on SommOS documentation)

---

### Option 2: Disable RAG System Temporarily (Not Recommended)

If you want to proceed without the knowledge graph, you can start the server with the `--no-index` flag:

```bash
cd /Users/thijs/Documents/SommOS/Agent-MCP
uv run -m agent_mcp.cli --port 8080 --project-dir /Users/thijs/Documents/SommOS --no-index &
```

**Limitations:**
- ❌ Agents cannot query project context via `ask_project_rag`
- ❌ No semantic search capabilities
- ❌ Agents will not have access to documentation and MCD content
- ⚠️ This significantly reduces agent effectiveness

---

## Verification Steps

After adding the OpenAI API key and restarting:

### 1. Check for Indexing Errors

Monitor the server output for about 20 seconds. You should see:

✅ **Success messages:**
```
Starting RAG index update cycle (simple mode: markdown, context only)...
Found X markdown files to consider for indexing...
Successfully inserted Y new chunks/embeddings.
```

❌ **No more 404 errors** like before

### 2. Verify Database Population

```bash
# Check RAG chunks
sqlite3 /Users/thijs/Documents/SommOS/.agent/mcp_state.db \
  "SELECT COUNT(*) FROM rag_chunks;"

# Should return a number > 0

# Check embeddings (requires vec0 module)
sqlite3 /Users/thijs/Documents/SommOS/.agent/mcp_state.db \
  "SELECT COUNT(*) FROM rag_embeddings_info;"

# Should return a number > 0
```

### 3. Check Markdown Files Were Found

```bash
# List markdown files in SommOS
find /Users/thijs/Documents/SommOS -name "*.md" -type f | head -10

# Count total markdown files
find /Users/thijs/Documents/SommOS -name "*.md" -type f | wc -l
```

Expected: Multiple markdown files (README.md, documentation, etc.)

### 4. Test RAG Query (After Indexing)

Once indexing is complete, you can test the knowledge graph via the dashboard or API:

```bash
# Via curl (example)
curl -X POST http://localhost:8080/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is SommOS?", "limit": 5}'
```

---

## Cost Considerations

### OpenAI Embeddings Pricing (as of 2025)

- **Model**: text-embedding-3-large (1536 dimensions - simple mode)
- **Pricing**: ~$0.00013 per 1K tokens
- **Initial indexing**: Depends on markdown content size
  - ~50 markdown files = ~100K tokens = ~$0.013
  - ~100 markdown files = ~200K tokens = ~$0.026
- **Incremental updates**: Only new/changed files are re-indexed
- **Frequency**: Every 5 minutes (only if files changed)

**Estimated monthly cost**: $0.05 - $0.50 depending on documentation size and update frequency

### DeepSeek Chat Model Pricing

- Still works for agent reasoning/chat
- Not affected by this change
- Much cheaper than OpenAI for chat tasks

---

## Technical Details

### Why Embeddings Are Required

The RAG (Retrieval-Augmented Generation) system works as follows:

1. **Indexing Phase** (requires embeddings):
   - Markdown files are split into chunks
   - Each chunk is converted to a vector embedding (1536-dimensional array)
   - Embeddings are stored in SQLite database with sqlite-vec extension
   
2. **Query Phase** (requires embeddings):
   - User query is converted to embedding
   - Semantic search finds similar chunks via vector similarity
   - Retrieved context is provided to agents

3. **Why DeepSeek Doesn't Work**:
   - DeepSeek only provides chat/reasoning APIs
   - No `/v1/embeddings` endpoint
   - Cannot generate vector representations
   - Must use OpenAI, Azure OpenAI, or compatible provider

### Supported Embedding Providers

Agent-MCP supports OpenAI-compatible embedding APIs:

1. **OpenAI** (recommended)
   - Models: text-embedding-3-large, text-embedding-3-small
   - Endpoint: https://api.openai.com/v1
   - Best quality and compatibility

2. **Azure OpenAI** (enterprise)
   - Same models, different endpoint
   - Requires Azure subscription

3. **Self-hosted alternatives** (advanced)
   - Llama.cpp with embedding models
   - Requires significant setup

---

## Current System Status

### ✅ What's Working

- Agent-MCP server running (PID: 4341)
- Port 8080 listening
- Dashboard accessible at http://localhost:3847
- SommOS backend healthy (port 3001)
- Test Specialist agent created
- 10 tasks defined (3 assigned)
- Project context loaded (4 entries)
- Admin Token: `<use token from .agent/admin_token.txt>`

### ❌ What's Blocked

- **RAG indexing** - Waiting for OpenAI API key
- **Knowledge graph queries** - No indexed content
- **Agent context retrieval** - Cannot use `ask_project_rag`
- **Semantic search** - No embeddings available

### ⏳ Next Steps After Fix

Once OpenAI API key is added and indexing completes:

1. ✅ RAG system will be fully functional
2. ✅ Agents can query project knowledge graph
3. ✅ Test Specialist can access SommOS documentation
4. ✅ Proceed with agent initialization and task execution
5. ✅ Complete remaining tasks from TEST_SPECIALIST_INIT.md

---

## Alternative: Try a Free Embedding Service

If OpenAI cost is a concern, you can try these alternatives:

### Hugging Face Inference API (Free tier available)

```bash
# In .env file:
OPENAI_API_KEY=your-huggingface-api-key
OPENAI_BASE_URL=https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2

# Note: Requires code changes to handle Hugging Face API format
```

### Cohere (Free tier: 100 API calls/month)

```bash
# Cohere provides embeddings
# Requires integration code changes
```

---

## Summary

**The Issue:**
- DeepSeek API cannot provide embeddings → RAG system cannot index content

**The Fix:**
1. Get OpenAI API key from https://platform.openai.com/api-keys
2. Add it to `/Users/thijs/Documents/SommOS/Agent-MCP/.env`
3. Restart Agent-MCP server
4. Wait for automatic indexing (20 seconds)
5. Verify chunks in database

**Cost Impact:**
- ~$0.05-$0.50/month for embeddings
- DeepSeek still used for agent chat (cost savings maintained)

**Timeline:**
- 5 minutes to get API key
- 2 minutes to update config and restart
- 20-30 seconds for initial indexing
- System fully operational after that

---

**Next Action**: Get your OpenAI API key and update the `.env` file, then restart the server.
