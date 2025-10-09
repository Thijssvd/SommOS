#!/usr/bin/env zsh

EXIT_CODE=0

echo "=== Agent-MCP Health Check ==="
echo ""

if ! lsof -i :8080 >/dev/null 2>&1; then
  echo "❌ MCP Server not running on port 8080"
  EXIT_CODE=1
else
  echo "✅ MCP Server running"
fi

if ! lsof -i :3847 >/dev/null 2>&1; then
  echo "⚠️  Dashboard not running on port 3847"
else
  echo "✅ Dashboard running"
fi

if [ ! -f "/Users/thijs/Documents/SommOS/.agent/mcp_state.db" ]; then
  echo "❌ Database file not found"
  EXIT_CODE=1
else
  echo "✅ Database accessible"
fi

echo ""
if [ "${SOMMOS_ALLOW_CLAUDE:-false}" = "true" ]; then
  echo "Checking agent sessions (tmux)..."

  AGENTS=(
    "backend-specialist-sommos"
    "frontend-specialist-sommos"
    "ai-integration-specialist-sommos"
    "devops-specialist-sommos"
    "test-specialist-sommos"
  )

  for agent in "${AGENTS[@]}"; do
    if ! tmux has-session -t "$agent" 2>/dev/null; then
      echo "❌ Missing session: $agent"
      EXIT_CODE=1
    else
      echo "✅ Session active: $agent"
    fi
  done
else
  echo "Tmux/Claude flow disabled (Windsurf-only). Skipping tmux session checks."
fi

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ All agents healthy"
else
  echo "❌ Health check failed (see errors above)"
fi

exit $EXIT_CODE
