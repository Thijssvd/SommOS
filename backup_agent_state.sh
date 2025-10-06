#!/usr/bin/env zsh

BACKUP_DIR="/Users/thijs/Documents/SommOS/.agent/backups/backup_$(date +%Y%m%d_%H%M%S)"

echo "=== Agent State Backup ==="
echo "Creating backup directory: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

echo "Backing up database..."
cp /Users/thijs/Documents/SommOS/.agent/mcp_state.db "$BACKUP_DIR/"

echo "Backing up task database..."
cp /Users/thijs/Documents/SommOS/.agent/tasks.db "$BACKUP_DIR/" 2>/dev/null || echo "tasks.db not found (skipped)"

echo "Backing up configuration..."
cp /Users/thijs/Documents/SommOS/.agent/config.json "$BACKUP_DIR/"

echo "Backing up admin token..."
cp /Users/thijs/Documents/SommOS/.agent/admin_token.txt "$BACKUP_DIR/"

echo "Backing up prompts..."
cp -r /Users/thijs/Documents/SommOS/.agent/prompts "$BACKUP_DIR/" 2>/dev/null || echo "prompts not found (skipped)"

cat > "$BACKUP_DIR/MANIFEST.txt" << EOF
Backup created: $(date)
Backup location: $BACKUP_DIR

Files backed up:
- mcp_state.db (Agent states)
- tasks.db (Task queue)
- config.json (System configuration)
- admin_token.txt (Admin authentication)
- prompts/ (Agent initialization prompts)

To restore:
1. Stop all agents and MCP server
2. Copy files back to /Users/thijs/Documents/SommOS/.agent/
3. Restart MCP server
4. Start agents using start_all_agents.sh
EOF

echo ""
echo "✅ Backup created successfully"
echo "Location: $BACKUP_DIR"
echo "Files: $(ls -1 "$BACKUP_DIR" | wc -l | xargs)"
