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
  echo "[INFO] Using MCP HTTP API to register agents (no tmux/Claude sessions)." | tee -a "$LOG_FILE"
fi

# Wait for MCP server readiness
echo "[INFO] Waiting for MCP server to be ready..." | tee -a "$LOG_FILE"
READY=0
for i in {1..30}; do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/tokens || echo "000")
  if [ "$code" = "200" ]; then READY=1; break; fi
  sleep 1
done
if [ "$READY" -ne 1 ]; then
  echo "✗ MCP server did not become ready within timeout" | tee -a "$LOG_FILE"
  exit 1
fi

start_agent() {
  local agent_id=$1
  local prompt_file=$2
  local task_id=$3
  
  echo "Starting $agent_id (Windsurf via MCP API)..." | tee -a "$LOG_FILE"
  # Prefer live admin token from MCP API; fallback to file
  local admin_token=""
  if command -v jq >/dev/null 2>&1; then
    admin_token=$(curl -s http://localhost:8080/api/tokens | jq -r '.admin_token' 2>/dev/null)
  fi
  if [ -z "$admin_token" ] || [ "$admin_token" = "null" ]; then
    admin_token=$(cat "$SOMMOS_DIR/.agent/admin_token.txt" 2>/dev/null)
  fi
  if [ -z "$admin_token" ] || [ "$admin_token" = "null" ]; then
    echo "✗ Admin token not available (API and file fallback failed)" | tee -a "$LOG_FILE"
    return 1
  fi
  # Find an available task if not provided
  local task_id=""
  if command -v sqlite3 >/dev/null 2>&1; then
    task_id=$(sqlite3 "$SOMMOS_DIR/.agent/mcp_state.db" "SELECT task_id FROM tasks WHERE (status='created' OR status='unassigned') AND (assigned_to IS NULL OR assigned_to='') ORDER BY created_at DESC LIMIT 1;")
  fi
  if [ -z "$task_id" ]; then
    echo "✗ No available task found for $agent_id; skipping" | tee -a "$LOG_FILE"
    return 1
  fi
  local payload='{"token": '\"'$admin_token'\"', "agent_id": '\"'$agent_id'\"', "task_ids": [ '\"'$task_id'\"' ]}'
  local response=$(curl -s -w "\n%{http_code}" -X POST "http://localhost:8080/api/create-agent" \
    -H "Content-Type: application/json" \
    -d "$payload")
  local http_code=$(echo "$response" | tail -n1)
  if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
    echo "✓ Registered $agent_id via MCP API (HTTP $http_code)" | tee -a "$LOG_FILE"
  elif [ "$http_code" = "409" ]; then
    echo "✓ $agent_id already exists (HTTP 409) — continuing" | tee -a "$LOG_FILE"
  elif [ "$http_code" = "401" ]; then
    echo "[WARN] 401 Unauthorized for $agent_id — refreshing admin token and retrying once" | tee -a "$LOG_FILE"
    # Refresh token and retry once
    if command -v jq >/dev/null 2>&1; then
      admin_token=$(curl -s http://localhost:8080/api/tokens | jq -r '.admin_token' 2>/dev/null)
    fi
    if [ -z "$admin_token" ] || [ "$admin_token" = "null" ]; then
      admin_token=$(cat "$SOMMOS_DIR/.agent/admin_token.txt" 2>/dev/null)
    fi
    if [ -z "$admin_token" ] || [ "$admin_token" = "null" ]; then
      echo "✗ Admin token still unavailable after refresh; skipping $agent_id" | tee -a "$LOG_FILE"
      return 1
    fi
    payload='{"token": '\"'$admin_token'\"', "agent_id": '\"'$agent_id'\"', "task_ids": [ '\"'$task_id'\"' ]}'
    response=$(curl -s -w "\n%{http_code}" -X POST "http://localhost:8080/api/create-agent" \
      -H "Content-Type: application/json" \
      -d "$payload")
    http_code=$(echo "$response" | tail -n1)
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ] || [ "$http_code" = "409" ]; then
      echo "✓ Retry succeeded for $agent_id (HTTP $http_code)" | tee -a "$LOG_FILE"
    else
      echo "✗ Retry failed for $agent_id (HTTP $http_code). Response: $(echo "$response" | head -n1)" | tee -a "$LOG_FILE"
      return 1
    fi
  else
    echo "✗ Failed to register $agent_id via MCP API (HTTP $http_code). Response: $(echo "$response" | head -n1)" | tee -a "$LOG_FILE"
    return 1
  fi
}

# Start each agent, selecting tasks dynamically
start_agent "backend-specialist-sommos" "$SOMMOS_DIR/.agent/prompts/backend_prompt.txt"
sleep 3
start_agent "frontend-specialist-sommos" "$SOMMOS_DIR/.agent/prompts/frontend_prompt.txt"
sleep 3
start_agent "ai-integration-specialist-sommos" "$SOMMOS_DIR/.agent/prompts/ai_prompt.txt"
sleep 3
start_agent "devops-specialist-sommos" "$SOMMOS_DIR/.agent/prompts/devops_prompt.txt"
sleep 3
start_agent "test-specialist-sommos" "$SOMMOS_DIR/.agent/prompts/test_prompt.txt"
sleep 3

echo "" | tee -a "$LOG_FILE"
echo "=== Startup Complete ===" | tee -a "$LOG_FILE"
echo "Run ./monitor_agents_enhanced.sh to verify." | tee -a "$LOG_FILE"
