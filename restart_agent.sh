#!/usr/bin/env zsh

if [ $# -eq 0 ]; then
  echo "Usage: $0 <agent-id>"
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
SOMMOS_DIR="/Users/thijs/Documents/SommOS"

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

echo "=== Restarting $AGENT_ID ==="
echo ""

if tmux has-session -t "$AGENT_ID" 2>/dev/null; then
  echo "Terminating existing session..."
  tmux kill-session -t "$AGENT_ID"
  sleep 2
fi

echo "Starting new session..."
tmux new-session -d -s "$AGENT_ID" -c "$SOMMOS_DIR"
tmux send-keys -t "$AGENT_ID" "export MCP_AGENT_ID=$AGENT_ID" Enter
sleep 1
tmux send-keys -t "$AGENT_ID" "claude mcp add -t sse AgentMCP http://localhost:8080/sse" Enter
sleep 2
tmux send-keys -t "$AGENT_ID" "claude --dangerously-skip-permissions" Enter
sleep 5

cat "$PROMPT_FILE" | while IFS= read -r line; do
  tmux send-keys -t "$AGENT_ID" "$line"
done
tmux send-keys -t "$AGENT_ID" Enter

sleep 5

if tmux has-session -t "$AGENT_ID" 2>/dev/null; then
  echo "✅ $AGENT_ID restarted successfully"
else
  echo "❌ Failed to restart $AGENT_ID"
  exit 1
fi
