# SommOS Memory Auto-Update System

## Overview

Your SommOS project now has **automatic memory management** set up in Warp AI. The AI will proactively maintain and update the knowledge graph as you work, keeping project context always current.

## How It Works

### Automatic Updates

Warp AI will **automatically update memories** when it detects:

✅ **Bug fixes** → Adds solution to troubleshooting knowledge  
✅ **New features** → Updates architecture and API patterns  
✅ **Configuration changes** → Updates environment and security configs  
✅ **New commands** → Updates development workflows  
✅ **Database changes** → Updates database patterns  
✅ **Dependencies added** → Updates architecture notes  
✅ **Best practices discovered** → Stores for future reference

### Update Triggers

The AI monitors for these specific events:

| Event | Memory Update |
|-------|---------------|
| `npm install <package>` | Check if Architecture needs update |
| Edit `.env` file | Update Environment Configuration |
| Add npm script | Update Development Workflows |
| Create API endpoint | Update API Patterns |
| Run migration | Check Database Patterns |
| Fix bug | Add to Common Issues |
| User says "remember this" | Immediately store observation |
| User corrects info | Delete old, add corrected info |

### Proactive Behavior

At the end of work sessions, Warp AI will:

1. **Review** what was learned or changed
2. **Search** for relevant memory entities
3. **Identify** outdated information
4. **Update** memories with new learnings
5. **Confirm** updates with you

Example:
```
AI: "I noticed we changed the API timeout from 10s to 30s. 
     Should I update the 'SommOS API Patterns' memory?"
```

## Current Memory Structure

### 18 Knowledge Entities:

1. **SommOS Architecture** - Tech stack, ports, structure
2. **SommOS Wine Domain** - Business rules, wine types
3. **SommOS Database Patterns** - Schema, conventions
4. **SommOS API Patterns** - Response formats, timeouts
5. **SommOS Development Workflows** - Commands, testing
6. **SommOS Code Conventions** - Naming, async patterns
7. **SommOS Security** - JWT, CSP, CORS
8. **SommOS Testing** - Jest, Playwright, E2E
9. **SommOS AI Integration** - DeepSeek/OpenAI fallback
10. **SommOS PWA Features** - Service worker, offline
11. **SommOS Documentation Standards** - User preferences
12. **SommOS Common Issues** - Troubleshooting solutions
13. **SommOS Procurement Logic** - Business logic
14. **SommOS Environment Configuration** - Env vars, keys
15. **SommOS Memory Auto-Update Policy** - Update rules ⭐
16. **SommOS Memory Update Triggers** - When to update ⭐
17. **SommOS Memory Maintenance Workflow** - How to update ⭐
18. **SommOS Project Context** - Your environment ⭐

⭐ = New policy entities that govern automatic updates

## Manual Memory Commands

You can also manually manage memories:

### Ask AI to Remember Something
```
"Remember: [your observation]"
"Don't forget that [pattern/solution]"
"Store this for future sessions: [information]"
```

### Query Memories
```
"What do you know about authentication?"
"Show me database patterns"
"List all wine domain rules"
```

### Correct Memories
```
"That's wrong - the port is actually 3001, not 3000"
"Update the memory: we now use DeepSeek instead of OpenAI"
"The database should have 994 wines, not 4970"
```

### View Knowledge Graph
```
"Show me the entire knowledge graph"
"What memories exist for SommOS?"
"Display all relationships"
```

## Benefits

✅ **Always Current** - Memories stay synchronized with reality  
✅ **No Repetition** - AI remembers previous conversations  
✅ **Proactive Learning** - AI suggests updates, doesn't wait to be asked  
✅ **Context Retention** - Full project context across sessions  
✅ **Faster Development** - No need to re-explain patterns  
✅ **Better Troubleshooting** - Solutions stored for reuse

## Examples in Action

### Scenario 1: Fixing a Bug
```
You: "The pairing endpoint is timing out"
AI: [Debugs and finds 10s timeout is too short]
AI: "Fixed! Changed timeout to 30s in api.js"
AI: "I'll update the 'SommOS API Patterns' memory with this timeout change."
✓ Memory updated automatically
```

### Scenario 2: Adding New Feature
```
You: "Add a new endpoint for wine recommendations"
AI: [Implements /api/wines/recommend]
AI: "Created new endpoint. Should I remember this API pattern?"
You: "Yes"
✓ Memory updated with new endpoint pattern
```

### Scenario 3: Configuration Change
```
You: "We're switching from OpenAI to DeepSeek"
AI: [Updates code and .env]
AI: "Updated AI provider. I'll update these memories:
     - SommOS AI Integration
     - SommOS Environment Configuration"
✓ Memories updated automatically
```

### Scenario 4: Discovering Best Practice
```
AI: "I noticed you always run 'npm run setup:db:clean' 
     instead of 'npm run setup:db'. Should I remember 
     this as the preferred database reset method?"
You: "Yes, that prevents duplicate wines"
✓ Memory updated with best practice
```

## Memory Hygiene

The AI will automatically:

- **Split** entities with too many observations (>10)
- **Remove** outdated or incorrect information
- **Merge** duplicate observations
- **Verify** memories match actual codebase
- **Maintain** consistent naming and formatting

## Viewing Memories

### In Warp AI Chat
Just ask naturally:
```
"What do you remember about SommOS?"
"Show me the authentication patterns"
"What are the common database issues?"
```

### Using MCP Tools Directly
```javascript
// Search for specific memories
search_nodes({ query: "database" })

// View specific entity
open_nodes({ names: ["SommOS Database Patterns"] })

// Read entire graph
read_graph()
```

## Tips for Best Results

1. **Be explicit** when you want something remembered:
   - "Remember this solution"
   - "Don't forget this pattern"
   - "Store this for next time"

2. **Correct quickly** when AI has outdated info:
   - "That's no longer true..."
   - "We changed that to..."
   - "Update the memory with..."

3. **Review periodically** - Ask "What do you know about X?"
   to verify memories are current

4. **Trust the system** - AI will proactively suggest updates
   when it detects changes

## Troubleshooting

### Memory Not Updating?
```
"Check if memory update policy is active"
"Verify SommOS Memory Auto-Update Policy entity exists"
```

### Incorrect Information Stored?
```
"Delete the observation about [incorrect info]"
"Correct this memory: [provide correct info]"
```

### Too Many Memories?
```
"Clean up duplicate observations"
"Consolidate related memories"
```

## Status Check

To verify the system is working:

```
"Is memory auto-update active for SommOS?"
"Show me the memory management policy"
"When was the last memory update?"
```

## What Gets Stored

### ✅ Always Store:
- Bug fixes and solutions
- New patterns and conventions
- Configuration changes
- API endpoint changes
- Database schema changes
- User preferences and workflows
- Best practices discovered

### ❌ Don't Store:
- Temporary file paths (unless project-specific)
- Sensitive information (API keys, passwords)
- One-time errors without general solutions
- Obvious information already in docs
- User's personal information

## Next Steps

The system is now **fully active**. Just work normally on SommOS and:

1. Warp AI will **observe** your work
2. AI will **detect** patterns and changes
3. AI will **suggest** memory updates
4. You **approve** (or AI auto-updates obvious changes)
5. Knowledge graph **stays current**

---

**Status**: ✅ Active and Running  
**Last Updated**: 2025-10-04  
**Total Memories**: 18 entities, 100+ observations  
**Auto-Update**: Enabled  

Your SommOS project now has a living, self-maintaining knowledge base! 🧠✨
