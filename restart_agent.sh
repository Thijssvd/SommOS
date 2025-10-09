#!/usr/bin/env zsh

if [ $# -lt 1 ]; then
  echo "Usage: $0 <agent-id> [task_id]"
  echo ""
  echo "Valid agent IDs:"
  echo "  - backend-specialist-sommos"
  echo "  - frontend-specialist-sommos"
  echo "  - ai-integration-specialist-sommos"
  echo "  - devops-specialist-sommos"
  echo "  - test-specialist-sommos"
  exit 1
fi

AGENT_ID=$1
TASK_ID_OVERRIDE=$2
SOMMOS_DIR="/Users/thijs/Documents/SommOS"

# Security: Claude CLI is disabled by default. This project uses Windsurf-only.
# If you really need the legacy Claude-based flow, export SOMMOS_ALLOW_CLAUDE=true
if [ "${SOMMOS_ALLOW_CLAUDE:-false}" != "true" ]; then
  echo "[SECURITY] Claude CLI disabled (Windsurf-only). Using MCP HTTP API for restart."
fi

case "$AGENT_ID" in
  backend-specialist-sommos)
    PROMPT_FILE="$SOMMOS_DIR/.agent/prompts/backend_prompt.txt"
    ;;
  frontend-specialist-sommos)
    PROMPT_FILE="$SOMMOS_DIR/.agent/prompts/frontend_prompt.txt"
    ;;
  ai-integration-specialist-sommos)
    PROMPT_FILE="$SOMMOS_DIR/.agent/prompts/ai_prompt.txt"
    ;;
  devops-specialist-sommos)
    PROMPT_FILE="$SOMMOS_DIR/.agent/prompts/devops_prompt.txt"
    ;;
  test-specialist-sommos)
    PROMPT_FILE="$SOMMOS_DIR/.agent/prompts/test_prompt.txt"
    ;;
  *)
    echo "❌ Unknown agent ID: $AGENT_ID"
    exit 1
    ;;
esac

echo "=== Restarting $AGENT_ID via MCP API ==="
echo ""

# Get live admin token from API; fallback to file
ADMIN_TOKEN=""
if command -v jq >/dev/null 2>&1; then
  ADMIN_TOKEN=$(curl -s http://localhost:8080/api/tokens | jq -r '.admin_token' 2>/dev/null)
fi
if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" = "null" ]; then
  ADMIN_TOKEN_FILE="$SOMMOS_DIR/.agent/admin_token.txt"
  ADMIN_TOKEN=$(cat "$ADMIN_TOKEN_FILE" 2>/dev/null)
fi
if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" = "null" ]; then
  echo "❌ Admin token not available (API and file fallback failed)"
  exit 1
fi

# Terminate existing agent via API (ok if not found)
TERMINATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "http://localhost:8080/api/terminate-agent" \
  -H "Content-Type: application/json" \
  -d '{"token": "'"$ADMIN_TOKEN"'", "agent_id": "'"$AGENT_ID"'"}')
TERMINATE_CODE=$(echo "$TERMINATE_RESPONSE" | tail -n1)
if [ "$TERMINATE_CODE" = "200" ] || [ "$TERMINATE_CODE" = "404" ]; then
  echo "✓ Terminate step (HTTP $TERMINATE_CODE)"
else
  echo "⚠️  Terminate step returned HTTP $TERMINATE_CODE (continuing)"
fi

sleep 1

# Resolve task_id: use override or pick first available created/unassigned
TASK_ID="$TASK_ID_OVERRIDE"
if [ -z "$TASK_ID" ]; then
  if command -v sqlite3 >/dev/null 2>&1; then
    TASK_ID=$(sqlite3 "$SOMMOS_DIR/.agent/mcp_state.db" "SELECT task_id FROM tasks WHERE (status='created' OR status='unassigned') AND (assigned_to IS NULL OR assigned_to='') ORDER BY created_at DESC LIMIT 1;")
  fi
fi

if [ -z "$TASK_ID" ]; then
  echo "❌ No available task found to assign to $AGENT_ID. Create a task first."
  exit 1
fi

# Create agent via API (with task_ids)
PAYLOAD='{"token": '"'"$ADMIN_TOKEN"'"', "agent_id": '"'"$AGENT_ID"'"', "task_ids": [ '"'"$TASK_ID"'"' ]}'
CREATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "http://localhost:8080/api/create-agent" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")
CREATE_CODE=$(echo "$CREATE_RESPONSE" | tail -n1)
if [ "$CREATE_CODE" = "200" ] || [ "$CREATE_CODE" = "201" ]; then
  echo "✅ $AGENT_ID restarted successfully via MCP API"
  exit 0
elif [ "$CREATE_CODE" = "409" ]; then
  echo "✅ $AGENT_ID already exists (HTTP 409) — proceeding"
  exit 0
else
  echo "❌ Failed to create $AGENT_ID via MCP API (HTTP $CREATE_CODE)"
  exit 1
fi
