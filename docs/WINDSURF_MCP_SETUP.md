# Windsurf MCP Setup for SommOS Agent-MCP Server

## Overview

This guide configures the agent-mcp-sommos server to work with Windsurf IDE, enabling multi-agent orchestration, task management, and project intelligence directly in your editor.

## Prerequisites

- Windsurf IDE installed
- Agent-MCP installed at `/Users/thijs/Documents/SommOS/Agent-MCP`
- Python environment with `uv` package manager
- SommOS project at `/Users/thijs/Documents/SommOS`

## Configuration

### Step 1: Create MCP Configuration Directory

```bash
mkdir -p ~/.config/windsurf
```

### Step 2: Create MCP Servers Configuration

Create or edit `~/.config/windsurf/mcp_servers.json`:

```json
{
  "mcpServers": {
    "agent-mcp-sommos": {
      "command": "uv",
      "args": [
        "--project",
        "/Users/thijs/Documents/SommOS/Agent-MCP",
        "run",
        "-m",
        "agent_mcp.cli",
        "--port",
        "8080",
        "--transport",
        "sse",
        "--project-dir",
        "/Users/thijs/Documents/SommOS",
        "--no-tui"
      ],
      "env": {
        "OPENAI_API_KEY": "your-openai-key-here",
        "DEEPSEEK_API_KEY": "your-deepseek-key-here",
        "OPENAI_BASE_URL": "https://api.openai.com"
      }
    },
    "shell": {
      "command": "node",
      "args": [
        "/Users/thijs/Documents/SommOS/mcp-shell-server/index.js"
      ],
      "env": {
        "SOMMOS_DIR": "/Users/thijs/Documents/SommOS"
      }
    }
  }
}
```

### Step 3: Update Windsurf Settings

The MCP port is already configured in your Windsurf settings at:
`~/Library/Application Support/Windsurf/User/settings.json`

```json
{
  "interactiveMcp.mcpHttpPort": 8080
}
```

### Dashboard Access (Standard Port)

For this project, the Agent-MCP Dashboard runs at <http://localhost:3847>.

The port is configurable. To run the dashboard on a specific port from `agent_mcp/dashboard/`:

```bash
PORT=3847 npm run dev
# or
npm run dev -- -p 3847
```

## Available Tools

Once configured, you'll have access to these agent-mcp-sommos tools in Windsurf:

### Agent Management
- `mcp0_create_agent` - Create new AI agents
- `mcp0_terminate_agent` - Stop running agents
- `mcp0_relaunch_agent` - Restart agents
- `mcp0_view_status` - Check agent status
- `mcp0_get_agent_tokens` - List agent credentials

### Task Management
- `mcp0_assign_task` - Create and assign tasks
- `mcp0_create_self_task` - Agents create subtasks
- `mcp0_view_tasks` - View task lists with filtering
- `mcp0_update_task_status` - Update task progress
- `mcp0_search_tasks` - Full-text task search
- `mcp0_delete_task` - Remove tasks (admin only)
- `mcp0_bulk_task_operations` - Batch task updates

### Project Intelligence (RAG)
- `mcp0_ask_project_rag` - Query project knowledge
- `mcp0_view_project_context` - View stored context
- `mcp0_update_project_context` - Add/update context
- `mcp0_bulk_update_project_context` - Batch context updates
- `mcp0_delete_project_context` - Remove context entries
- `mcp0_validate_context_consistency` - Check context health

### Communication
- `mcp0_send_agent_message` - Inter-agent messaging
- `mcp0_get_agent_messages` - Read messages
- `mcp0_broadcast_admin_message` - Admin broadcasts
- `mcp0_request_assistance` - Request help on tasks

### File Coordination
- `mcp0_check_file_status` - Check file locks
- `mcp0_update_file_status` - Claim/release files
- `mcp0_view_file_metadata` - View file metadata
- `mcp0_update_file_metadata` - Update file metadata (admin)

### System Operations
- `mcp0_backup_project_context` - Backup project data
- `mcp0_view_audit_log` - View system audit log
- `mcp0_get_system_prompt` - Get agent prompts
- `mcp0_test` - Test MCP connection

## Usage in Windsurf

### Example 1: Check Agent Status
```
Ask Cascade: "What agents are currently running in SommOS?"
```
This will call `mcp0_view_status` automatically.

### Example 2: Create a Task
```
Ask Cascade: "Create a task to fix the authentication bug in the backend"
```
This will use `mcp0_assign_task` to create and track the task.

### Example 3: Query Project Knowledge
```
Ask Cascade: "What's the database schema for the Wines table?"
```
This will use `mcp0_ask_project_rag` to search project documentation.

### Example 4: View Tasks
```
Ask Cascade: "Show me all pending tasks assigned to the backend agent"
```
This will call `mcp0_view_tasks` with appropriate filters.

## Authentication

The agent-mcp-sommos server requires authentication tokens for most operations:

- **Admin Token**: Required for creating agents, deleting tasks, system operations
- **Agent Token**: Required for task updates, file operations, messaging

Tokens are managed by the Agent-MCP system and passed automatically by Windsurf.

## Troubleshooting

### MCP Server Not Connecting

1. **Check if server is running:**
   ```bash
   lsof -i :8080
   ```

2. **Manually start the server:**
   ```bash
   cd /Users/thijs/Documents/SommOS/Agent-MCP
   uv run -m agent_mcp.cli --port 8080 --transport sse --project-dir /Users/thijs/Documents/SommOS --no-tui
   ```

3. **Check Windsurf logs:**
   - Open Windsurf
   - Go to: Help → Toggle Developer Tools → Console
   - Look for MCP connection errors

### Tools Not Available

1. **Restart Windsurf completely** (Cmd+Q, then reopen)
2. **Verify configuration file exists:**
   ```bash
   cat ~/.config/windsurf/mcp_servers.json
   ```
3. **Check API keys are set** in the configuration

### SSE Stream Errors

If you see "SSE stream terminated" errors:
1. Restart Windsurf (not just reload)
2. Kill and restart the MCP server:
   ```bash
   pkill -f agent_mcp.cli
   cd /Users/thijs/Documents/SommOS/Agent-MCP
   uv run -m agent_mcp.cli --port 8080 --transport sse --project-dir /Users/thijs/Documents/SommOS --no-tui &
   ```

## Testing the Setup

### Test 1: Simple Connection Test
```bash
# In Windsurf terminal or Cascade chat:
"Test the MCP connection"
```

### Test 2: View Project Status
```bash
"Show me the current agent status"
```

### Test 3: Query Project Knowledge
```bash
"What are the main backend components in SommOS?"
```

## Benefits for SommOS Development

With agent-mcp-sommos integrated into Windsurf, you can:

1. **Multi-Agent Workflows**: Coordinate multiple AI agents working on different parts of SommOS
2. **Task Tracking**: Create, assign, and track development tasks directly in your IDE
3. **Project Intelligence**: Query SommOS documentation and codebase using RAG
4. **File Coordination**: Prevent conflicts when multiple agents edit files
5. **Audit Trail**: Track all agent actions and decisions
6. **Inter-Agent Communication**: Agents can collaborate and share context

## Next Steps

1. ✅ Create the configuration file
2. ✅ Add your API keys to the config
3. ✅ Restart Windsurf
4. ✅ Test the connection with a simple query
5. 📚 Explore the available tools in Cascade

---

**Configuration Date**: October 7, 2025  
**Windsurf Version**: 1.99+  
**Agent-MCP Version**: Latest  
**SommOS Project**: /Users/thijs/Documents/SommOS
