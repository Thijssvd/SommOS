# DevOps Specialist Agent - Activation Guide

**Date**: 2025-10-06  
**Project**: SommOS  
**Agent-MCP Server**: http://localhost:8080  
**Admin Token**: `807800461eda4e45a9d56ece19ac409a`

---

## 📋 Overview

This guide walks through activating the DevOps Specialist agent in the Agent-MCP system for SommOS project.

## ✅ Prerequisites

- [x] Agent-MCP server running on port 8080
- [x] SommOS project at `/Users/thijs/Documents/SommOS`
- [x] Admin token available
- [x] Agent configuration files created:
  - `/Users/thijs/Documents/Agent-MCP/create-devops-agent.json`
  - `/Users/thijs/Documents/SommOS/docs/DEVOPS_SPECIALIST_INIT.md`

---

## 🚀 Method 1: Using Agent-MCP Dashboard

### Step 1: Access the Dashboard
```bash
open http://localhost:3847
```

### Step 2: Navigate to Agent Management
1. Click on "Agents" in the sidebar
2. Click "Create New Agent" button

### Step 3: Load Configuration
1. Upload the configuration file: `/Users/thijs/Documents/Agent-MCP/create-devops-agent.json`
2. Or manually enter agent details:
   - **Name**: DevOps Specialist
   - **ID**: `devops-specialist-sommos`
   - **Type**: worker
   - **Role**: devops
   - **Admin Token**: `807800461eda4e45a9d56ece19ac409a`

### Step 4: Verify Creation
- Check the agent appears in the agent list
- Note the worker token generated for the agent

---

## 🚀 Method 2: Using MCP Tools in Claude/Warp

If you have MCP tools available in your AI assistant (Claude Desktop, Warp with MCP), you can create the agent directly:

### Step 1: Call create_agent Tool
```
Use the create_agent MCP tool with the following configuration:

{
  "name": "DevOps Specialist",
  "id": "devops-specialist-sommos",
  "type": "worker",
  "role": "devops",
  "specialization": "Infrastructure, monitoring, CI/CD, and observability",
  "project_path": "/Users/thijs/Documents/SommOS",
  "admin_token": "807800461eda4e45a9d56ece19ac409a",
  "capabilities": [
    "monitoring-dashboards",
    "alerting-configuration",
    "ci-cd-automation",
    "docker-optimization",
    "prometheus-grafana",
    "infrastructure-as-code"
  ]
}
```

### Step 2: Store the Worker Token
The `create_agent` tool will return a worker token. Save this token for initializing the agent.

---

## 🚀 Method 3: Using Agent-MCP Python API

### Step 1: Create Agent via Python
```python
import requests
import json

# Load agent configuration
with open('/Users/thijs/Documents/Agent-MCP/create-devops-agent.json', 'r') as f:
    agent_config = json.load(f)

# Create agent via MCP API
response = requests.post(
    'http://localhost:8080/api/agents/create',
    json={
        'admin_token': '807800461eda4e45a9d56ece19ac409a',
        'agent_config': agent_config['agent']
    },
    headers={'Content-Type': 'application/json'}
)

if response.status_code == 200:
    result = response.json()
    print(f"✅ Agent created successfully!")
    print(f"Worker Token: {result['worker_token']}")
else:
    print(f"❌ Error: {response.text}")
```

---

## 🚀 Method 4: Direct API Call with curl

### Step 1: Create Agent
```bash
curl -X POST http://localhost:8080/api/agents/create \
  -H "Content-Type: application/json" \
  -d '{
    "admin_token": "807800461eda4e45a9d56ece19ac409a",
    "name": "DevOps Specialist",
    "id": "devops-specialist-sommos",
    "type": "worker",
    "role": "devops",
    "description": "Infrastructure, monitoring, CI/CD for SommOS",
    "project_path": "/Users/thijs/Documents/SommOS",
    "capabilities": [
      "monitoring-dashboards",
      "alerting-configuration",
      "ci-cd-automation",
      "docker-optimization"
    ]
  }'
```

### Step 2: Verify Agent Creation
```bash
# List all agents
curl -X GET "http://localhost:8080/api/agents/list?admin_token=807800461eda4e45a9d56ece19ac409a"

# Check specific agent
curl -X GET "http://localhost:8080/api/agents/devops-specialist-sommos?admin_token=807800461eda4e45a9d56ece19ac409a"
```

---

## 🤖 Initializing the DevOps Agent

Once the agent is created in Agent-MCP, you need to initialize it in a new AI assistant conversation (Claude, Warp AI, etc.):

### Initialization Prompt

Copy and paste this into a new AI assistant window:

```
You are the DEVOPS SPECIALIST worker agent for SommOS.

Worker ID: devops-worker
Worker Token: [INSERT_TOKEN_FROM_AGENT_CREATION]
Admin Token: 807800461eda4e45a9d56ece19ac409a
MCP Server: http://localhost:8080
Project Path: /Users/thijs/Documents/SommOS

=== AGENT CONTEXT ===

Query the project knowledge graph to understand:
1. Current infrastructure (Prometheus, Grafana already running)
2. Completed DevOps work (see docs/DEVOPS_INTEGRATION_SUMMARY.md)
3. SommOS architecture and deployment requirements
4. Integration points with other specialist agents

=== YOUR MISSION ===

Build production-grade observability and automation for SommOS.

Phase 1 (COMPLETED):
✅ Prometheus metrics integration (/metrics endpoint)
✅ Grafana dashboard with 9 panels
✅ Multi-stage Docker build optimization
✅ Comprehensive documentation

Phase 2 (CURRENT FOCUS):
🎯 Set up AlertManager for Prometheus alerts
🎯 Create GitHub Actions CI/CD pipeline
🎯 Enhance Grafana dashboards (AI metrics, cache analysis)
🎯 Implement structured JSON logging with Winston
🎯 Configure Docker resource limits and health monitoring

=== REFERENCE FILES ===

Critical Documentation:
- docs/DEVOPS_SPECIALIST_INIT.md (your detailed instructions)
- docs/DEVOPS_INTEGRATION_SUMMARY.md (completed work)
- monitoring/README.md (monitoring setup guide)
- docs/PROMETHEUS_METRICS.md (metrics reference)
- SOMMOS_MCD.md (project architecture)

Current Infrastructure:
- SommOS Backend: http://localhost:3000 (with /metrics endpoint)
- Prometheus: http://localhost:9090 (15s scrape interval)
- Grafana: http://localhost:3002 (admin/admin)
- Agent-MCP Dashboard: http://localhost:3847

=== CONSTRAINTS ===

- Yacht-specific deployment (offline-first, limited resources)
- Zero-downtime deployments required
- Comprehensive observability essential
- Follow existing SommOS code patterns

=== COORDINATION ===

Collaborate with other agents:
- Backend Specialist: Performance metrics validation
- Frontend Specialist: Service Worker metrics
- AI Integration Specialist: AI provider tracking
- Test Specialist: CI/CD test execution

=== INITIALIZATION ===

First Actions:
1. Read docs/DEVOPS_SPECIALIST_INIT.md for complete context
2. Review docs/DEVOPS_INTEGRATION_SUMMARY.md for Phase 1 work
3. Query knowledge graph for current infrastructure state
4. Start with Task 1: AlertManager setup (highest priority)

AUTO --worker --memory
```

---

## 📊 Monitoring Agent Activity

### Via Agent-MCP Dashboard
```bash
# Open dashboard
open http://localhost:3847

# Navigate to:
# - Agents tab: See DevOps agent status
# - Tasks tab: Track assigned tasks
# - Memory Bank: View stored context
# - Activity Timeline: Monitor agent actions
```

### Via API Calls
```bash
# Check agent status
curl "http://localhost:8080/api/agents/devops-specialist-sommos/status?admin_token=807800461eda4e45a9d56ece19ac409a"

# View agent tasks
curl "http://localhost:8080/api/tasks?agent_id=devops-specialist-sommos&admin_token=807800461eda4e45a9d56ece19ac409a"

# Check agent messages
curl "http://localhost:8080/api/messages?agent_id=devops-specialist-sommos&admin_token=807800461eda4e45a9d56ece19ac409a"
```

---

## 📝 Assigning Initial Tasks

### Method 1: Via Dashboard
1. Go to Tasks tab
2. Click "Create Task"
3. Assign to `devops-specialist-sommos`
4. Use tasks from `DEVOPS_SPECIALIST_INIT.md`

### Method 2: Via MCP Tools
```
Use the assign_task MCP tool:

{
  "agent_id": "devops-specialist-sommos",
  "task": "Set up AlertManager for Prometheus alerts",
  "priority": "high",
  "description": "Deploy AlertManager container, configure critical alert rules, set up notification channels",
  "files": [
    "monitoring/alertmanager.yml",
    "monitoring/alert-rules.yml",
    "monitoring/docker-compose.monitoring.yml"
  ],
  "admin_token": "807800461eda4e45a9d56ece19ac409a"
}
```

### Method 3: Via API
```bash
curl -X POST http://localhost:8080/api/tasks/assign \
  -H "Content-Type: application/json" \
  -d '{
    "admin_token": "807800461eda4e45a9d56ece19ac409a",
    "agent_id": "devops-specialist-sommos",
    "task": {
      "title": "Set up AlertManager for Prometheus alerts",
      "priority": 1,
      "description": "Deploy AlertManager container and configure critical alert rules",
      "files": ["monitoring/alertmanager.yml", "monitoring/alert-rules.yml"]
    }
  }'
```

---

## 🎯 Priority Task Order

Based on `DEVOPS_SPECIALIST_INIT.md`, assign tasks in this order:

### Task 1: AlertManager Setup (Priority: CRITICAL)
```
Title: Set up AlertManager for Prometheus alerts
Estimated Time: 2-3 hours
Files: monitoring/alertmanager.yml, monitoring/alert-rules.yml
```

### Task 2: CI/CD Pipeline (Priority: HIGH)
```
Title: Create GitHub Actions CI/CD pipeline
Estimated Time: 4-5 hours
Files: .github/workflows/ci.yml, .github/workflows/docker-build.yml
```

### Task 3: Grafana Dashboards (Priority: MEDIUM)
```
Title: Enhance Grafana dashboards with AI metrics
Estimated Time: 3-4 hours
Files: monitoring/grafana/dashboards/ai-performance.json
```

### Task 4: Structured Logging (Priority: MEDIUM)
```
Title: Implement structured JSON logging with Winston
Estimated Time: 2-3 hours
Files: backend/core/logger.js, backend/server.js
```

### Task 5: Docker Resources (Priority: LOW)
```
Title: Set up Docker resource limits and health monitoring
Estimated Time: 2 hours
Files: docker-compose.yml, monitoring/docker-compose.monitoring.yml
```

---

## ✅ Verification Checklist

After agent activation, verify:

- [ ] Agent appears in Agent-MCP dashboard agent list
- [ ] Agent status shows as "active" or "initialized"
- [ ] Worker token generated and stored
- [ ] Initial tasks assigned to agent
- [ ] Agent can access knowledge graph
- [ ] Agent can read project files
- [ ] Agent coordination with other agents functional

---

## 🔍 Troubleshooting

### Agent Creation Failed
```bash
# Check Agent-MCP server logs
tail -f /tmp/agent-mcp.log

# Verify server is running
curl http://localhost:8080/health

# Check admin token is correct
# Token: 807800461eda4e45a9d56ece19ac409a
```

### Agent Not Appearing in Dashboard
```bash
# Refresh dashboard
open http://localhost:3847

# Query agents via API
curl "http://localhost:8080/api/agents/list?admin_token=807800461eda4e45a9d56ece19ac409a"
```

### Agent Cannot Access Files
```bash
# Verify project path is correct
ls -la /Users/thijs/Documents/SommOS

# Check file permissions
ls -la /Users/thijs/Documents/SommOS/docs/DEVOPS_SPECIALIST_INIT.md
```

### Knowledge Graph Queries Failing
```bash
# Check if knowledge graph database exists
ls -la /Users/thijs/Documents/SommOS/.agent/mcp_state.db

# Verify MCP server can access it
sqlite3 /Users/thijs/Documents/SommOS/.agent/mcp_state.db ".tables"
```

---

## 📚 Additional Resources

### Configuration Files
- `/Users/thijs/Documents/Agent-MCP/create-devops-agent.json` - Agent configuration
- `/Users/thijs/Documents/SommOS/docs/DEVOPS_SPECIALIST_INIT.md` - Complete initialization guide
- `/Users/thijs/Documents/SommOS/.agent/WORKER_AGENTS_INIT.md` - All worker agent profiles

### Documentation
- `/Users/thijs/Documents/Agent-MCP/agent-mcp-thijsinfo.md` - Complete Agent-MCP guide
- `/Users/thijs/Documents/Agent-MCP/README.md` - Agent-MCP documentation
- `/Users/thijs/Documents/SommOS/SOMMOS_MCD.md` - SommOS project architecture

### Monitoring
- Agent-MCP Dashboard: http://localhost:3847
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3002
- SommOS Backend: http://localhost:3000

---

## 🎉 Next Steps

After successful activation:

1. **Agent reads initialization document**
   - `/Users/thijs/Documents/SommOS/docs/DEVOPS_SPECIALIST_INIT.md`

2. **Agent reviews completed work**
   - `/Users/thijs/Documents/SommOS/docs/DEVOPS_INTEGRATION_SUMMARY.md`

3. **Agent starts with Task 1**
   - Set up AlertManager for Prometheus alerts

4. **Monitor progress via dashboard**
   - http://localhost:3847

5. **Coordinate with other agents**
   - Test Specialist for CI/CD integration
   - Backend Specialist for metrics validation

---

**Status**: ✅ Configuration Complete - Ready for Activation  
**Last Updated**: 2025-10-06  
**Admin Token**: `807800461eda4e45a9d56ece19ac409a`
