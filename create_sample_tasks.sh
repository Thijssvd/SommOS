#!/usr/bin/env zsh

set -euo pipefail

SOMMOS_DIR="/Users/thijs/Documents/SommOS"
DB_PATH="$SOMMOS_DIR/.agent/mcp_state.db"

usage() {
  echo "Usage: $0 <count> [title_prefix]"
  echo "  <count>        Number of tasks to create (e.g., 5)"
  echo "  [title_prefix] Optional prefix for task titles (default: 'Sample Task')"
}

if [ $# -lt 1 ]; then
  usage
  exit 1
fi

COUNT="$1"
TITLE_PREFIX="${2:-Sample Task}"

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "❌ sqlite3 command not found. Please install sqlite3."
  exit 1
fi

if [ ! -f "$DB_PATH" ]; then
  echo "❌ Database not found at $DB_PATH"
  exit 1
fi

# Generate a short random ID suffix (12 hex chars)
gen_id() {
  if command -v openssl >/dev/null 2>&1; then
    echo "task_$(openssl rand -hex 6)"
  elif command -v uuidgen >/dev/null 2>&1; then
    echo "task_$(uuidgen | tr -d '-' | cut -c1-12)"
  else
    # Fallback: time-based suffix
    echo "task_$(date +%s | tail -c 12)"
  fi
}

# Escape single quotes for SQL literals
escape_sql() {
  local s="$1"
  echo "${s//\'/''}"
}

CREATED=0
for i in $(seq 1 "$COUNT"); do
  TASK_ID="$(gen_id)"
  NOW="$(date +"%Y-%m-%dT%H:%M:%S")"
  TITLE_RAW="$TITLE_PREFIX $i"
  DESC_RAW="Auto-generated dev task #$i for agent bootstrap"

  TITLE="$(escape_sql "$TITLE_RAW")"
  DESC="$(escape_sql "$DESC_RAW")"

  SQL="INSERT INTO tasks (
    task_id,
    title,
    description,
    created_by,
    status,
    priority,
    created_at,
    updated_at,
    assigned_to,
    parent_task,
    child_tasks,
    depends_on_tasks,
    notes
  ) VALUES (
    '$TASK_ID',
    '$TITLE',
    '$DESC',
    'admin',
    'created',
    'medium',
    '$NOW',
    '$NOW',
    NULL,
    NULL,
    '[]',
    '[]',
    '[]'
  );"

  if sqlite3 "$DB_PATH" "$SQL" 2>/dev/null; then
    echo "✅ Created task: $TASK_ID — $TITLE_RAW"
    CREATED=$((CREATED+1))
  else
    echo "⚠️  Skipped (insert failed): $TASK_ID — $TITLE_RAW"
  fi

done

echo ""
echo "Done. Created $CREATED/$COUNT tasks in $DB_PATH"
