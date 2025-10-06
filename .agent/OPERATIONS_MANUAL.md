# Agent-MCP Operations Manual

## Quick Reference

### Daily Operations

**Health Check:**
```bash
./health_check_agents.sh
```

**Continuous Monitoring:**
```bash
./watch_agents.sh
```

---

### Agent Management

#### List All Agents
```bash
sqlite3 /Users/thijs/Documents/SommOS/.agent/mcp_state.db \
  "SELECT agent_id, status FROM agents WHERE agent_id != 'Admin';"
```

#### Restart Specific Agent
```bash
./restart_agent.sh [agent-id]
```

Valid agent IDs:
- backend-specialist-sommos
- frontend-specialist-sommos
- ai-integration-specialist-sommos
- devops-specialist-sommos
- test-specialist-sommos

#### Attach to Agent Session
```bash
tmux attach-session -t [agent-id]
# Detach: Ctrl+B, then D
```

---

### Monitoring

**Quick Status:**
```bash
./monitor_agents_enhanced.sh
```

**Health Check:**
```bash
./health_check_agents.sh
```

**View Logs:**
```bash
tail -f /Users/thijs/Documents/SommOS/.agent/logs/mcp_server.log
```

---

### Maintenance

**Daily Checks (5 min):**
1. Run health check
2. Check dashboard: http://localhost:3847
3. Review logs

**Weekly Maintenance (30 min):**
1. Full system verification
2. Backup state: `./backup_agent_state.sh`
3. Review agent performance
4. Rotate logs

---

### Emergency Procedures

**Stop All Agents:**
```bash
for agent in backend-specialist-sommos frontend-specialist-sommos ai-integration-specialist-sommos devops-specialist-sommos test-specialist-sommos; do
  tmux kill-session -t "$agent" 2>/dev/null || true
done
```

**Restart All Agents:**
```bash
./start_all_agents.sh
```

---

### Contact Information

- Dashboard: http://localhost:3847
- MCP Server API: http://localhost:8080/api
- Admin Token: /Users/thijs/Documents/SommOS/.agent/admin_token.txt

---

Last Updated: $(date)
