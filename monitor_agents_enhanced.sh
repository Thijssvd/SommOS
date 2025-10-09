#!/usr/bin/env zsh

AGENT_DIR="/Users/thijs/Documents/SommOS/.agent"
DB_PATH="$AGENT_DIR/mcp_state.db"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "╔════════════════════════════════════════════════════════════╗"
echo "║       Agent-MCP Monitoring Dashboard                       ║"
echo "║       $TIMESTAMP                         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

echo "🖥️  Core Services:"
if lsof -i :8080 >/dev/null 2>&1; then
    echo -e "   MCP Server: ${GREEN}✅ Running${NC} (port 8080)"
else
    echo -e "   MCP Server: ${RED}❌ Down${NC}"
fi

if lsof -i :3847 >/dev/null 2>&1; then
    echo -e "   Dashboard:  ${GREEN}✅ Running${NC} (port 3847)"
else
    echo -e "   Dashboard:  ${YELLOW}⚠ Not Running${NC}"
fi

if [ -f "$DB_PATH" ]; then
    echo -e "   Database:   ${GREEN}✅ Accessible${NC}"
else
    echo -e "   Database:   ${RED}❌ Missing${NC}"
fi

echo ""
echo "🤖 Agent Status (Database):"
sqlite3 "$DB_PATH" "SELECT agent_id, status, substr(updated_at, 1, 19) as last_update FROM agents WHERE agent_id != 'Admin' ORDER BY agent_id;" 2>/dev/null | column -t -s '|'

echo ""
if [ "${SOMMOS_ALLOW_CLAUDE:-false}" = "true" ]; then
  echo "📺 Tmux Sessions:"
  for agent in backend-specialist-sommos frontend-specialist-sommos ai-integration-specialist-sommos devops-specialist-sommos test-specialist-sommos; do
    if tmux has-session -t "$agent" 2>/dev/null; then
      echo -e "   ${GREEN}✅${NC} $agent"
    else
      echo -e "   ${RED}❌${NC} $agent"
    fi
  done

  echo ""
  SESSION_COUNT=$(tmux list-sessions 2>/dev/null | grep -c "specialist.*sommos" || echo "0")
  if [ "$SESSION_COUNT" -eq 5 ]; then
    echo -e "📊 Session Status: ${GREEN}$SESSION_COUNT/5 active${NC}"
  else
    echo -e "📊 Session Status: ${YELLOW}$SESSION_COUNT/5 active${NC} (⚠️ Some agents may be down)"
  fi
else
  echo "📺 Tmux Sessions: (skipped)"
  echo -e "   ${YELLOW}ℹ${NC} Tmux/Claude flow disabled (Windsurf-only). Use DB status above and Dashboard UI."
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║ Quick Actions:                                              ║"
echo "║   • Health check:   ./health_check_agents.sh                ║"
echo "║   • Restart agent:  ./restart_agent.sh [agent-id]          ║"
echo "║   • View logs:      tail -f .agent/logs/mcp_server.log     ║"
echo "╚════════════════════════════════════════════════════════════╝"
