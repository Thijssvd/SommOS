#!/usr/bin/env zsh

# Agent-MCP System Monitor

AGENT_DIR="/Users/thijs/Documents/SommOS/.agent"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║           Agent-MCP System Status Monitor                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# MCP Server
echo "🖥️  MCP Server:"
if lsof -i :8080 >/dev/null 2>&1; then
    echo "   Status: ✅ Running on port 8080"
    echo "   URL: http://localhost:8080"
else
    echo "   Status: ❌ Not running"
fi
echo ""

# Dashboard
echo "📊 Dashboard:"
if lsof -i :3847 >/dev/null 2>&1; then
    echo "   Status: ✅ Running on port 3847"
    echo "   URL: http://localhost:3847"
else
    echo "   Status: ❌ Not running"
fi
echo ""

# Database
echo "💾 Database:"
if [ -f "${AGENT_DIR}/mcp_state.db" ]; then
    AGENT_COUNT=$(sqlite3 "${AGENT_DIR}/mcp_state.db" "SELECT COUNT(*) FROM agents;" 2>/dev/null || echo "0")
    ACTIVE_COUNT=$(sqlite3 "${AGENT_DIR}/mcp_state.db" "SELECT COUNT(*) FROM agents WHERE status='active';" 2>/dev/null || echo "0")
    echo "   Total Agents: ${AGENT_COUNT}"
    echo "   Active Agents: ${ACTIVE_COUNT}"
    
    if [ "$AGENT_COUNT" -gt 0 ]; then
        echo ""
        echo "   Agents:"
        sqlite3 "${AGENT_DIR}/mcp_state.db" \
            "SELECT '   - ' || agent_id || ' (' || status || ')' FROM agents;" 2>/dev/null
    fi
else
    echo "   Status: ❌ Database not found"
fi
echo ""

# Tasks
echo "📋 Tasks:"
if [ -f "${AGENT_DIR}/tasks.db" ]; then
    PENDING_TASKS=$(sqlite3 "${AGENT_DIR}/tasks.db" "SELECT COUNT(*) FROM tasks WHERE status='pending';" 2>/dev/null || echo "0")
    TOTAL_TASKS=$(sqlite3 "${AGENT_DIR}/tasks.db" "SELECT COUNT(*) FROM tasks;" 2>/dev/null || echo "0")
    echo "   Total Tasks: ${TOTAL_TASKS}"
    echo "   Pending: ${PENDING_TASKS}"
else
    echo "   Status: ⚠️  Task database not initialized"
fi
echo ""

# Admin Token
if [ -f "${AGENT_DIR}/admin_token.txt" ]; then
    TOKEN=$(cat "${AGENT_DIR}/admin_token.txt")
    echo "🔑 Admin Token: ${TOKEN:0:16}...${TOKEN: -4}"
fi
echo ""

echo "╔════════════════════════════════════════════════════════════╗"
echo "║ Quick Actions:                                              ║"
echo "║   • View logs:    tail -f ${AGENT_DIR}/logs/*.log  ║"
echo "║   • Stop server:  pkill -f agent_mcp.cli                   ║"
echo "║   • Dashboard:    open http://localhost:3847                ║"
echo "╚════════════════════════════════════════════════════════════╝"
