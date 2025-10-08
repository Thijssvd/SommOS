# Quick Start: Testing SommOS Without Agent-MCP Dashboard

Since the Agent-MCP dashboard deploy button has an API issue, let's start testing directly!

## 🎯 **Direct Approach: Manual Testing Setup**

You don't actually need the Agent-MCP dashboard to be fully functional to start testing. Here's what we'll do:

### **Step 1: Install Test Dependencies**

```bash
cd /Users/thijs/Documents/SommOS

# Install Jest and testing tools
npm install --save-dev jest @jest/globals supertest @types/jest

# Install Playwright for E2E tests
npm install --save-dev @playwright/test

# Initialize Playwright
npx playwright install
```

### **Step 2: Create Jest Configuration**

Create `jest.config.js`:
```javascript
module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'backend/**/*.js',
    'frontend/js/**/*.js',
    '!**/*.test.js',
    '!**/node_modules/**'
  ],
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js'
  ],
  coverageThresholds: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

### **Step 3: Create Test Directory Structure**

```bash
cd /Users/thijs/Documents/SommOS

mkdir -p tests/{unit,integration,e2e,fixtures}
mkdir -p tests/unit/backend/core
mkdir -p tests/integration/api
```

### **Step 4: Create Your First Test**

File: `tests/unit/backend/core/ai_metrics_tracker.test.js`

```javascript
const aiMetricsTracker = require('../../../../backend/core/ai_metrics_tracker');

describe('AI Metrics Tracker', () => {
  beforeEach(() => {
    aiMetricsTracker.reset();
  });

  describe('Percentile Calculations', () => {
    test('should calculate p50 correctly', () => {
      // Record some response times
      const context = aiMetricsTracker.startRequest('deepseek');
      aiMetricsTracker.recordSuccess(context, [{ confidence_score: 0.8 }]);
      
      // Add more response times
      for (let i = 0; i < 100; i++) {
        const ctx = aiMetricsTracker.startRequest('deepseek');
        // Simulate response time by waiting
        ctx.startTime = Date.now() - (100 + i);
        aiMetricsTracker.recordSuccess(ctx, [{ confidence_score: 0.75 }]);
      }

      const percentiles = aiMetricsTracker.getResponseTimePercentiles();
      
      expect(percentiles).toHaveProperty('p50');
      expect(percentiles).toHaveProperty('p95');
      expect(percentiles).toHaveProperty('p99');
      expect(percentiles.p50).toBeGreaterThan(0);
    });

    test('should handle empty metrics gracefully', () => {
      const percentiles = aiMetricsTracker.getResponseTimePercentiles();
      
      expect(percentiles.p50).toBe(0);
      expect(percentiles.p95).toBe(0);
      expect(percentiles.p99).toBe(0);
    });
  });

  describe('Confidence Distribution', () => {
    test('should track high confidence scores', () => {
      const context = aiMetricsTracker.startRequest('deepseek');
      aiMetricsTracker.recordSuccess(context, [
        { confidence_score: 0.9 },
        { confidence_score: 0.85 },
        { confidence_score: 0.75 }
      ]);

      const distribution = aiMetricsTracker.getConfidenceDistribution();
      
      expect(distribution).toHaveProperty('high');
      expect(distribution).toHaveProperty('medium');
      expect(distribution).toHaveProperty('low');
    });
  });

  describe('Provider Stats', () => {
    test('should track provider-specific metrics', () => {
      const deepseekCtx = aiMetricsTracker.startRequest('deepseek');
      aiMetricsTracker.recordSuccess(deepseekCtx, [{ confidence_score: 0.8 }]);

      const openaiCtx = aiMetricsTracker.startRequest('openai');
      aiMetricsTracker.recordSuccess(openaiCtx, [{ confidence_score: 0.75 }]);

      const summary = aiMetricsTracker.getSummary();
      
      expect(summary.providers.deepseek.requests).toBeGreaterThan(0);
      expect(summary.providers.openai.requests).toBeGreaterThan(0);
    });
  });
});
```

### **Step 5: Run Your First Test**

```bash
cd /Users/thijs/Documents/SommOS

# Run tests
npx jest tests/unit/backend/core/ai_metrics_tracker.test.js

# Run with coverage
npx jest --coverage
```

### **Step 6: Add Test Scripts to package.json**

Add these to your `package.json` scripts:

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:e2e": "playwright test",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch"
  }
}
```

## 🔧 **Fixing the Agent-MCP Dashboard Issue**

The dashboard has a 405 error because the backend doesn't support the REST API method it's trying to use. Here are the options:

### **Option A: Update Agent-MCP** (if there's a newer version)
```bash
cd /Users/thijs/Documents/Agent-MCP
git pull origin main
uv sync
```

### **Option B: Use MCP Tools in Windsurf**

In Windsurf, the Agent-MCP SSE server is already configured. You can:

1. Use the Agent-MCP tools (e.g., `create_agent`) directly from Windsurf
2. Skip the dashboard for creation and use it only for monitoring

### **Option C: Work Without the Agent Dashboard**

You don't actually need the agent dashboard to write tests! Just:
1. Follow the manual steps above
2. Write tests directly
3. Use the dashboard only for monitoring (not creation)

## ✅ **Next Actions**

Choose your path:

**Path 1: Just Start Testing** (Recommended)
```bash
cd /Users/thijs/Documents/SommOS
npm install --save-dev jest @jest/globals supertest
# Create the test file above
npx jest
```

**Path 2: Fix Dashboard First**
- Check Agent-MCP GitHub for issues
- Update to latest version
- Report the 405 error as a bug

**Path 3: Use MCP via Windsurf**
- Use the Agent-MCP tools in Windsurf to create agents
- Monitor via the Agent-MCP Dashboard

## 📚 **Resources Created for You**

- Test Specialist prompt: `.agent/prompts/test-specialist-init.md`
- Agent creation plan: `AGENT_CREATION_PLAN.md`
- This quick start: `START_TESTING.md`

---

**Recommendation**: Go with Path 1 and start testing manually. The Agent-MCP dashboard is nice to have but not required for our immediate goal of getting tests written!
