# Agent Activation Guide

## Current Agent Status

### Status Hierarchy

```
created → initialized → active → (terminated)
   ↓           ↓           ↓
  📝          ⚙️          ✅
```

### Your Agents Right Now:

| Agent | Current Status | Needs Action |
|-------|---------------|--------------|
| test-specialist-sommos | **created** | ✅ YES - needs initialization → activation |
| backend-specialist-sommos | **created** | ✅ YES - needs initialization → activation |
| frontend-specialist-sommos | **created** | ✅ YES - needs initialization → activation |
| ai-integration-specialist-sommos | **initialized** | ✅ YES - needs activation only |
| devops-specialist-sommos | **initialized** | ✅ YES - needs activation only |

**All 5 agents need to reach "active" status to actually work!**

---

## What Each Status Means

### 1. **created** (3 agents)
- ✅ Agent registered in database
- ✅ Token generated
- ✅ Basic configuration set
- ❌ NOT yet initialized with context
- ❌ NOT ready to work

**What's missing:**
- Agent initialization context
- Capability configuration details
- Task assignment setup

### 2. **initialized** (2 agents)
- ✅ Agent registered
- ✅ Agent configured with capabilities
- ✅ Context loaded
- ❌ NOT yet active/working
- ❌ Cannot accept tasks yet

**What's missing:**
- Activation command
- Connection to MCP server
- Task queue access

### 3. **active** (0 agents - your goal!)
- ✅ Agent fully operational
- ✅ Connected to MCP server
- ✅ Can accept and execute tasks
- ✅ Can communicate with other agents
- ✅ Has access to knowledge graph

---

## How to Activate Agents

### Option 1: Through Dashboard (Recommended)

The dashboard at http://localhost:3847 should have an interface to:

1. **Navigate to "Agents" tab**
2. **Click on an agent** (e.g., "test-specialist-sommos")
3. **Look for "Activate" or "Initialize" button**
4. **Enter admin token when prompted**: `807800461eda4e45a9d56ece19ac409a`
5. **Confirm activation**
6. **Repeat for all 5 agents**

**Expected result:** Agent status changes to "active"

### Option 2: Through Initialization Prompts (Manual)

If the dashboard doesn't have activation buttons, you can initialize agents manually using the initialization prompts from:

**For "created" agents (need initialization first):**

1. **Test Specialist:**
   - Prompt file: `/Users/thijs/Documents/SommOS/AGENT_INIT_CONTEXT.md`
   - Use this in a new AI assistant window with admin token

2. **Backend Specialist:**
   - Prompt file: `/Users/thijs/Documents/SommOS/.agent/WORKER_AGENTS_INIT.md`
   - Section: Backend Specialist

3. **Frontend Specialist:**
   - Prompt file: `/Users/thijs/Documents/SommOS/FRONTEND_AGENT_ACTIVATED.md`
   - Or use dashboard

**For "initialized" agents (just need activation):**

4. **AI Integration Specialist:**
   - Should be ready to activate via dashboard
   - Use admin token: `807800461eda4e45a9d56ece19ac409a`

5. **DevOps Specialist:**
   - Should be ready to activate via dashboard
   - Use admin token: `807800461eda4e45a9d56ece19ac409a`

### Option 3: Check MCP Server API

The MCP server might have an API endpoint to activate agents:

```bash
# Check available endpoints
curl -s http://localhost:8080/api/agents | jq .

# Try to activate an agent (example - may not work yet)
curl -X POST http://localhost:8080/api/agents/test-specialist-sommos/activate \
  -H "Authorization: Bearer 807800461eda4e45a9d56ece19ac409a"
```

---

## Quick Diagnostic Commands

### Check Current Agent Status
```bash
sqlite3 /Users/thijs/Documents/SommOS/.agent/mcp_state.db \
  "SELECT agent_id, status, updated_at FROM agents ORDER BY agent_id;"
```

### Check Agent Capabilities
```bash
sqlite3 /Users/thijs/Documents/SommOS/.agent/mcp_state.db \
  "SELECT agent_id, capabilities FROM agents;"
```

### Check Agent Tokens
```bash
sqlite3 /Users/thijs/Documents/SommOS/.agent/mcp_state.db \
  "SELECT agent_id, token FROM agents;"
```

### Watch for Status Changes
```bash
watch -n 2 "sqlite3 /Users/thijs/Documents/SommOS/.agent/mcp_state.db \
  'SELECT agent_id, status FROM agents;'"
```

---

## What Happens When Agents Activate?

Once an agent moves to **"active"** status:

1. **Connects to MCP Server**
   - Establishes WebSocket connection
   - Registers with task queue
   - Subscribes to relevant events

2. **Loads Project Context**
   - Queries knowledge graph
   - Loads SommOS documentation
   - Understands project architecture

3. **Ready for Tasks**
   - Can receive task assignments
   - Can query other agents
   - Can access file system
   - Can update progress

4. **Appears in Dashboard**
   - Shows as "active" with green indicator
   - Displays current task (if any)
   - Shows activity timeline
   - Real-time status updates

---

## Expected Timeline

| Step | Time | Action |
|------|------|--------|
| Initialize "created" agents | 5 min | Use initialization prompts or dashboard |
| Activate all 5 agents | 5 min | Click activate in dashboard with token |
| Verify activation | 2 min | Check dashboard shows all agents active |
| Assign first test task | 3 min | Test agent with simple task |
| **Total** | **~15 min** | From current state to working system |

---

## Troubleshooting

### Agents Won't Activate

**Check MCP Server Logs:**
```bash
tail -50 /Users/thijs/Documents/SommOS/.agent/logs/mcp_server.log
```

**Common Issues:**
1. **Admin token incorrect** - Verify: `cat /Users/thijs/Documents/SommOS/.agent/admin_token.txt`
2. **Server not responding** - Restart: `pkill -f agent_mcp.cli && cd /Users/thijs/Documents/Agent-MCP && uv run -m agent_mcp.cli --port 8080 --project-dir /Users/thijs/Documents/SommOS --no-tui &`
3. **Database locked** - Wait a moment and retry
4. **Dashboard disconnected** - Refresh browser at http://localhost:3847

### Agents Stuck in "initialized"

If agents are stuck in "initialized" state:

1. **Check if activation endpoint exists:**
   ```bash
   curl -s http://localhost:8080/health | jq .
   ```

2. **Try manual status update (temporary):**
   ```bash
   sqlite3 /Users/thijs/Documents/SommOS/.agent/mcp_state.db \
     "UPDATE agents SET status='active', updated_at=datetime('now') WHERE agent_id='test-specialist-sommos';"
   ```

3. **Restart MCP server to reload agents:**
   ```bash
   pkill -f agent_mcp.cli
   cd /Users/thijs/Documents/Agent-MCP
   uv run -m agent_mcp.cli --port 8080 --project-dir /Users/thijs/Documents/SommOS --no-tui &
   ```

---

## Summary

**YES, your 3 "created" agents need to be initialized AND activated.**

**Your 2 "initialized" agents need to be activated.**

**None of your agents are currently working - all need to reach "active" status.**

### Quick Action Plan:

1. ✅ **Check Dashboard** - Open http://localhost:3847
2. ✅ **Look for Activation Interface** - Find agent activation buttons
3. ✅ **Use Admin Token** - `807800461eda4e45a9d56ece19ac409a`
4. ✅ **Activate All 5 Agents** - One by one
5. ✅ **Verify Status** - Run `./monitor_agents.sh` to see "active" status
6. ✅ **Test With Simple Task** - Assign task to test-specialist-sommos

---

**Admin Token**: `807800461eda4e45a9d56ece19ac409a`  
**Dashboard**: http://localhost:3847  
**Monitor**: `./monitor_agents.sh`

The dashboard is your best option for activation - it should have a visual interface for this!
