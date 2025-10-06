# Agent-MCP Recovery Procedures

## Quick Diagnostics

### Check MCP Server
```bash
curl -I http://localhost:8080
ps aux | grep agent_mcp.cli
```

### Check All Agents
```bash
./health_check_agents.sh
```

### Check Dashboard
```bash
curl -I http://localhost:3847
```

---

## Common Issues

### Issue: Agent Not Responding
1. Check session: `tmux has-session -t [agent-id]`
2. Attach and observe: `tmux attach-session -t [agent-id]`
3. Restart: `./restart_agent.sh [agent-id]`

### Issue: Database Locked
```bash
# Identify processes
lsof /Users/thijs/Documents/SommOS/.agent/mcp_state.db

# Graceful shutdown
pkill -SIGTERM -f agent_mcp.cli

# Restart MCP server (see QUICK_START_AGENTS.md)
```

### Issue: All Agents Down
```bash
# Full restart
./start_all_agents.sh

# Verify
./health_check_agents.sh
```

---

## Restore from Backup

```bash
# List backups
ls -lt /Users/thijs/Documents/SommOS/.agent/backups/

# Stop services
for agent in backend-specialist-sommos frontend-specialist-sommos ai-integration-specialist-sommos devops-specialist-sommos test-specialist-sommos; do
  tmux kill-session -t "$agent" 2>/dev/null || true
done

# Restore files
BACKUP_DIR="[path-to-backup]"
cp "$BACKUP_DIR/mcp_state.db" /Users/thijs/Documents/SommOS/.agent/
cp "$BACKUP_DIR/config.json" /Users/thijs/Documents/SommOS/.agent/

# Restart system
./start_all_agents.sh
```

---

Last Updated: $(date)
