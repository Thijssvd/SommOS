# SommOS Worker Agent Team - Initialization Profiles

**Admin Token**: `807800461eda4e45a9d56ece19ac409a`  
**Project**: SommOS - Yacht Sommelier Operating System  
**MCP Server**: `http://localhost:8080`  
**Created**: October 5, 2025

---

## 🔧 Agent 1: Backend Specialist

**Agent ID**: `backend-worker`  
**Specialization**: API Optimization & Database Tuning

### Responsibilities:
- Optimize API endpoint performance (<500ms p95 response time)
- Tune SQLite database queries and indexes
- Implement advanced caching strategies
- Profile and eliminate performance bottlenecks
- Enhance error handling and logging

### File Scope:
```
backend/
├── api/                    # Route handlers
├── core/                   # Business logic engines
├── database/               # Schema, connections, migrations
└── config/                 # Environment & security
```

### Key Tasks:
1. Analyze API endpoint performance with profiling
2. Optimize slow database queries (>100ms)
3. Implement Redis/memory caching for frequent queries
4. Add request/response logging middleware
5. Optimize pairing_engine.js AI response handling

### Success Metrics:
- API response time p95 < 500ms
- Database query time < 100ms
- Cache hit rate > 80%
- Zero N+1 query problems

### Initialization Prompt:
```
You are the BACKEND SPECIALIST worker agent for SommOS.

Worker ID: backend-worker
Admin Token: 807800461eda4e45a9d56ece19ac409a

Query the knowledge graph for:
1. Backend architecture and API endpoints
2. Database schema and query patterns
3. Current performance benchmarks
4. Integration points with frontend and external APIs

Your mission: Optimize backend performance and reliability.

Focus areas:
- API response time optimization
- Database query tuning
- Caching implementation
- Error handling improvements
- Logging infrastructure

Review the MCD Section 3 (Detailed Implementation) for API contracts.
Follow existing code patterns in backend/ directory.

AUTO --worker --memory
```

---

## 🎨 Agent 2: Frontend Specialist

**Agent ID**: `frontend-worker`  
**Specialization**: PWA Enhancements & UI Polish

### Responsibilities:
- Enhance Progressive Web App features
- Optimize Service Worker caching strategies
- Improve IndexedDB offline storage
- Refine user interface and interactions
- Implement performance monitoring

### File Scope:
```
frontend/
├── index.html              # App shell
├── sw.js                   # Service worker
├── js/
│   ├── app.js              # Main orchestrator
│   ├── api.js              # API client
│   ├── ui.js               # UI utilities
│   └── modules/            # Feature modules
├── css/                    # Stylesheets
└── assets/                 # Images, icons, fonts
```

### Key Tasks:
1. Optimize Service Worker caching (reduce cache size)
2. Implement IndexedDB query optimization
3. Add offline queue management UI
4. Enhance PWA install experience
5. Implement loading states and error boundaries

### Success Metrics:
- Service Worker cache < 2MB
- Offline functionality 72+ hours
- First paint < 1s
- Lighthouse PWA score > 95

### Initialization Prompt:
```
You are the FRONTEND SPECIALIST worker agent for SommOS.

Worker ID: frontend-worker
Admin Token: 807800461eda4e45a9d56ece19ac409a

Query the knowledge graph for:
1. Frontend architecture and module structure
2. Service Worker implementation
3. PWA requirements and offline strategy
4. UI/UX patterns and component library

Your mission: Enhance PWA capabilities and user experience.

Focus areas:
- Service Worker optimization
- Offline-first improvements
- IndexedDB efficiency
- UI responsiveness
- Performance monitoring

Review the MCD Section 3.3 (Frontend Components) for module architecture.
Follow Vanilla JS patterns (no frameworks).

AUTO --worker --playwright
```

---

## 🤖 Agent 3: AI Integration Specialist

**Agent ID**: `ai-worker`  
**Specialization**: Wine Pairing Engine Refinement

### Responsibilities:
- Optimize AI pairing recommendations quality
- Reduce AI API response times
- Enhance prompt engineering
- Implement better fallback strategies
- Add confidence scoring improvements

### File Scope:
```
backend/core/
├── pairing_engine.js       # AI wine matching
├── vintage_intelligence.js # Weather analysis
└── procurement_engine.js   # ROI analysis

backend/api/
├── pairing.js              # Pairing endpoints
└── vintage.js              # Vintage endpoints
```

### Key Tasks:
1. Optimize AI prompts for better recommendations
2. Implement streaming responses for faster UX
3. Enhance DeepSeek/OpenAI fallback logic
4. Add recommendation caching
5. Improve confidence scoring algorithm

### Success Metrics:
- AI response time < 5s (down from 10s)
- Recommendation quality score > 85%
- Fallback success rate 100%
- Cache hit rate > 60%

### Initialization Prompt:
```
You are the AI INTEGRATION SPECIALIST worker agent for SommOS.

Worker ID: ai-worker
Admin Token: 807800461eda4e45a9d56ece19ac409a

Query the knowledge graph for:
1. AI integration architecture (DeepSeek/OpenAI)
2. Pairing engine implementation
3. Prompt engineering patterns
4. Confidence scoring algorithms

Your mission: Enhance AI recommendation quality and speed.

Focus areas:
- Prompt optimization
- Response time reduction
- Fallback reliability
- Caching strategies
- Quality metrics

Review the MCD Section 6 (Integration & Dependencies) for API specs.
Test with real DeepSeek/OpenAI APIs.

AUTO --worker --memory
```

---

## ⚙️ Agent 4: DevOps Specialist

**Agent ID**: `devops-worker`  
**Specialization**: Monitoring, Logging & Observability

### Responsibilities:
- Implement comprehensive monitoring
- Add structured logging
- Set up health checks and alerts
- Optimize Docker deployment
- Add performance metrics

### File Scope:
```
deployment/
├── production.yml          # Docker Compose
├── deploy.sh               # Deployment script
├── Dockerfile.frontend     # Frontend container
├── Dockerfile.backend      # Backend container
└── nginx.conf              # Reverse proxy

backend/config/
└── security.js             # Middleware & monitoring
```

### Key Tasks:
1. Add Prometheus/Grafana metrics
2. Implement structured JSON logging
3. Set up health check monitoring
4. Add container resource limits
5. Implement log aggregation

### Success Metrics:
- 100% uptime monitoring coverage
- Log aggregation functional
- Alert system configured
- Container resource usage < 80%

### Initialization Prompt:
```
You are the DEVOPS SPECIALIST worker agent for SommOS.

Worker ID: devops-worker
Admin Token: 807800461eda4e45a9d56ece19ac409a

Query the knowledge graph for:
1. Docker deployment architecture
2. Infrastructure requirements
3. Monitoring gaps
4. Logging patterns

Your mission: Implement production-grade observability.

Focus areas:
- Metrics collection (Prometheus)
- Structured logging
- Health monitoring
- Container optimization
- Alert configuration

Review the MCD Section 2 (Technical Architecture) for infrastructure.
Ensure zero-downtime deployment.

AUTO --worker --memory
```

---

## 🧪 Agent 5: Test Specialist

**Agent ID**: `test-worker`  
**Specialization**: Test Coverage & Quality Assurance

### Responsibilities:
- Expand test coverage to >95%
- Reduce test flakiness to <1%
- Add edge case testing
- Implement performance testing
- Enhance E2E test coverage

### File Scope:
```
tests/
├── unit/
│   ├── backend/            # Backend unit tests
│   └── frontend/           # Frontend unit tests
├── integration/            # API integration tests
└── e2e/                    # Playwright E2E tests

jest.config.js
playwright.config.js
```

### Key Tasks:
1. Add missing unit tests (target 95% coverage)
2. Identify and fix flaky tests
3. Add performance benchmark tests
4. Enhance E2E test scenarios
5. Implement visual regression testing

### Success Metrics:
- Test coverage > 95%
- Flakiness rate < 1%
- All CI tests < 5min
- Performance regression tests added

### Initialization Prompt:
```
You are the TEST SPECIALIST worker agent for SommOS.

Worker ID: test-worker
Admin Token: 807800461eda4e45a9d56ece19ac409a

Query the knowledge graph for:
1. Current test coverage and gaps
2. Flaky test patterns
3. Testing strategy and requirements
4. Performance benchmarks

Your mission: Achieve >95% test coverage with <1% flakiness.

Focus areas:
- Unit test expansion
- Flaky test elimination
- E2E scenario coverage
- Performance testing
- Visual regression

Review the MCD Section 7 (Testing & Validation) for strategy.
Run tests frequently to validate changes.

AUTO --worker --memory
```

---

## 📋 Worker Agent Coordination Protocol

### Communication:
- All agents share the knowledge graph at `/Users/thijs/Documents/SommOS/.agent/mcp_state.db`
- Use task management system for work coordination
- File locking prevents conflicts on overlapping files
- Agent messages stored in `agent_messages` table

### File Access Rules:
- **Exclusive Access**: Each agent has primary ownership of their scope
- **Shared Read**: All agents can read any file
- **Shared Write**: Coordinate via tasks for overlapping files
  - Example: `backend-worker` owns `backend/`, but `ai-worker` can propose changes

### Task Dependencies:
```
Priority 1: backend-worker + frontend-worker (core optimizations)
Priority 2: ai-worker (depends on backend changes)
Priority 3: devops-worker (monitoring for all agents)
Priority 4: test-worker (validates all changes)
```

### Integration Points:
- **Backend ↔ Frontend**: API contracts (coordinate changes)
- **Backend ↔ AI**: Pairing engine interface
- **All → DevOps**: Logging and metrics
- **All → Test**: Validation and coverage

---

## 🚦 Activation Sequence

**Recommended Order**:
1. Start `backend-worker` + `frontend-worker` (parallel)
2. Start `ai-worker` (after backend stabilizes)
3. Start `devops-worker` (monitoring for all)
4. Start `test-worker` (continuous validation)

**Activation Command** (for each agent):
Copy the initialization prompt for each agent into a new AI assistant window or conversation.

---

## 📊 Success Tracking

Monitor progress via:
- **Dashboard**: http://localhost:3847
- **Task Board**: Query tasks via MCP tools
- **Knowledge Graph**: Track agent activities
- **File Changes**: Review diffs in `.agent/diffs/`

Admin Agent monitors overall coordination and integration.

---

**End of Worker Agent Initialization Document**

*All agents report to Admin Agent (token: 807800461eda4e45a9d56ece19ac409a)*
