#!/usr/bin/env zsh

set -e

SOMMOS_DIR="/Users/thijs/Documents/SommOS"
LOG_FILE="$SOMMOS_DIR/.agent/logs/startup_$(date +%Y%m%d_%H%M%S).log"

echo "=== Agent-MCP Unified Startup ===" | tee "$LOG_FILE"
echo "Time: $(date)" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Security: Claude CLI is disabled by default. This project uses Windsurf-only.
# To enable legacy Claude-based flows at your own risk, export SOMMOS_ALLOW_CLAUDE=true
if [ "${SOMMOS_ALLOW_CLAUDE:-false}" != "true" ]; then
  echo "[SECURITY] Claude CLI usage is disabled (Windsurf-only setup)." | tee -a "$LOG_FILE"
  echo "[SECURITY] To enable legacy flow, export SOMMOS_ALLOW_CLAUDE=true (not recommended)." | tee -a "$LOG_FILE"
  exit 1
fi

start_agent() {
  local agent_id=$1
  local prompt_file=$2
  
  echo "Starting $agent_id..." | tee -a "$LOG_FILE"
  
  tmux new-session -d -s "$agent_id" -c "$SOMMOS_DIR"
  tmux send-keys -t "$agent_id" "export MCP_AGENT_ID=$agent_id" Enter
  sleep 1
  # Legacy Claude flow (gated)
  tmux send-keys -t "$agent_id" "claude mcp add -t sse AgentMCP http://localhost:8080/sse" Enter
  sleep 2
  tmux send-keys -t "$agent_id" "claude" Enter
  sleep 5
  
  cat "$prompt_file" | while IFS= read -r line; do
    tmux send-keys -t "$agent_id" "$line"
  done
  tmux send-keys -t "$agent_id" Enter
  
  if tmux has-session -t "$agent_id" 2>/dev/null; then
    echo "✓ Started $agent_id" | tee -a "$LOG_FILE"
  else
    echo "✗ Failed to start $agent_id" | tee -a "$LOG_FILE"
  fi
}

start_agent "backend-specialist-sommos" "$SOMMOS_DIR/.agent/prompts/backend_prompt.txt"
sleep 10
start_agent "frontend-specialist-sommos" "$SOMMOS_DIR/.agent/prompts/frontend_prompt.txt"
sleep 10
start_agent "ai-integration-specialist-sommos" "$SOMMOS_DIR/.agent/prompts/ai_prompt.txt"
sleep 10
start_agent "devops-specialist-sommos" "$SOMMOS_DIR/.agent/prompts/devops_prompt.txt"
sleep 10
start_agent "test-specialist-sommos" "$SOMMOS_DIR/.agent/prompts/test_prompt.txt"
sleep 10

echo "" | tee -a "$LOG_FILE"
echo "=== Startup Complete ===" | tee -a "$LOG_FILE"
echo "Run ./monitor_agents_enhanced.sh to verify." | tee -a "$LOG_FILE"
