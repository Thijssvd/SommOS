# SommOS IDE Extension Analysis & Recommendations

**Analysis Date**: January 8, 2025  
**Project**: SommOS - Yacht Sommelier Operating System  
**IDE**: Windsurf (VS Code based)

---

## 📊 Current Extension Analysis

### Currently Installed Extensions

#### From `vscode-extensions.json`

1. **dbaeumer.vscode-eslint** ✅ KEEP
   - **Purpose**: JavaScript linting
   - **Relevance**: Critical for code quality in Node.js/Express backend
   - **Status**: Essential

2. **esbenp.prettier-vscode** ✅ KEEP
   - **Purpose**: Code formatting
   - **Relevance**: Project uses Prettier (`.prettierrc.json` configured)
   - **Status**: Essential

3. **alexcvzz.vscode-sqlite** ✅ KEEP
   - **Purpose**: SQLite database management
   - **Relevance**: SommOS uses SQLite as primary database (12 tables)
   - **Status**: Essential

4. **ms-azuretools.vscode-docker** ✅ KEEP
   - **Purpose**: Docker support
   - **Relevance**: Project uses Docker for deployment (`compose.yaml`, Dockerfile)
   - **Status**: Essential

5. **orta.vscode-jest** ✅ KEEP
   - **Purpose**: Jest test runner integration
   - **Relevance**: 600+ Jest tests in project
   - **Status**: Essential

6. **ms-playwright.playwright** ✅ KEEP
   - **Purpose**: Playwright E2E test support
   - **Relevance**: Critical E2E workflows tested with Playwright
   - **Status**: Essential

#### From `settings.json` (Implicitly Installed)

7. **redhat.vscode-yaml** ✅ KEEP
   - **Purpose**: YAML language support
   - **Relevance**: Docker Compose files, GitHub Actions workflows
   - **Status**: Essential

8. **cweijan.vscode-database-client2** ⚠️ REVIEW
   - **Purpose**: Database client interface
   - **Relevance**: Useful but redundant with SQLite extension
   - **Status**: Optional (consider consolidating)

9. **snyk.snyk-vulnerability-scanner** ✅ KEEP
   - **Purpose**: Security vulnerability scanning
   - **Relevance**: Production-ready app requires security scanning
   - **Status**: Highly Recommended

10. **eamodio.gitlens** ✅ KEEP
    - **Purpose**: Enhanced Git integration
    - **Relevance**: Multi-agent collaboration, code history tracking
    - **Status**: Highly Recommended

---

## 🎯 Recommended Extensions to ADD

### Critical for SommOS Development

#### 1. REST Client Testing

**Extension**: `humao.rest-client`  
**Why**: Test REST API endpoints directly in IDE without Postman

- SommOS has 20+ API endpoints (`/api/auth`, `/api/inventory`, `/api/pairing`, etc.)
- Quick testing during development
- Can save request collections as `.http` files in project

**Alternative**: `rangav.vscode-thunder-client` (GUI-based)

#### 2. Node.js Development

**Extension**: `dbaeumer.vscode-node-debug2` (usually bundled)  
**Why**: Enhanced Node.js debugging

- Backend debugging for Express server
- Breakpoints in backend routes
- Variable inspection during development

**Check**: May already be included in Windsurf

#### 3. Environment Variables

**Extension**: `mikestead.dotenv`  
**Why**: Syntax highlighting for `.env` files

- Project uses `.env.example`, `.env.secrets-template`
- Better visibility of environment configuration
- Helps prevent configuration errors

#### 4. TODO Highlights

**Extension**: `wayou.vscode-todo-highlight`  
**Why**: Highlight TODO, FIXME comments

- Helps track technical debt
- Useful for agent task management
- Quick navigation to pending work

#### 5. Path Intellisense

**Extension**: `christian-kohler.path-intellisense`  
**Why**: Autocomplete for file paths

- Large project with many modules (`backend/api/`, `frontend/js/modules/`)
- Reduces import errors
- Speeds up development

### Highly Recommended for Quality

#### 6. Error Lens

**Extension**: `usernamehw.errorlens`  
**Why**: Inline error and warning display

- Shows ESLint errors directly in code
- Improves code quality awareness
- Faster debugging

#### 7. Better Comments

**Extension**: `aaron-bond.better-comments`  
**Why**: Color-coded comment categories

- Distinguish TODO, FIXME, NOTE, etc.
- Better documentation visibility
- Helps with agent coordination

#### 8. Import Cost

**Extension**: `wix.vscode-import-cost`  
**Why**: Display import size inline

- PWA optimization (target <200KB bundle)
- Monitor bundle size impact
- Prevent bloat in frontend code

#### 9. Code Spell Checker

**Extension**: `streetsidesoftware.code-spell-checker`  
**Why**: Catch typos in code and comments

- Professional documentation quality
- Prevent embarrassing typos in production
- Supports wine terminology with custom dictionary

### Nice to Have

#### 10. Markdown All in One

**Extension**: `yzhang.markdown-all-in-one`  
**Why**: Enhanced Markdown editing

- Project has extensive docs (`SOMMOS_MCD.md`, `README.md`, etc.)
- TOC generation
- Link checking

#### 11. Live Server (Development)

**Extension**: `ritwickdey.liveserver`  
**Why**: Quick static file serving

- Test frontend without full backend
- Rapid prototyping
- Alternative to Vite dev server

**Note**: May be redundant since Vite handles this

#### 12. GitLens++ Features

**Extension**: Already installed, ensure features enabled

- Blame annotations
- Code authorship tracking
- Commit history in editor

---

## ❌ Extensions to AVOID

### Not Relevant for SommOS

#### 1. React/Vue/Angular Extensions

**Why**: Project uses Vanilla JavaScript (no framework)

- `vscode-react`
- `vetur` (Vue)
- `angular.ng-template`

#### 2. TypeScript Extensions (Beyond Basic)

**Why**: Project is pure JavaScript (ES6+), not TypeScript

- Advanced TypeScript tools not needed
- Basic TypeScript support already in VS Code

**Exception**: Keep if considering TypeScript migration

#### 3. Python Extensions

**Why**: No Python code in SommOS (only Agent-MCP uses Python)

- `ms-python.python`
- `ms-python.vscode-pylance`

**Exception**: Keep if working on Agent-MCP tooling

#### 4. Heavy Framework Extensions

**Why**: Bloat without benefit

- JetBrains tools (redundant with native IDE features)
- Full-stack framework extensions
- GraphQL tools (project uses REST)

---

## 🔧 Configuration Recommendations

### Suggested `.vscode/settings.json` Additions

```json
{
  // ESLint
  "eslint.validate": ["javascript", "javascriptreact"],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },

  // Prettier
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },

  // Files
  "files.exclude": {
    "**/.agent": true,
    "**/node_modules": true,
    "**/coverage": true,
    "**/.DS_Store": true
  },

  // Search
  "search.exclude": {
    "**/node_modules": true,
    "**/coverage": true,
    "**/playwright-report": true,
    "**/test-results": true,
    "**/.agent": true
  },

  // Jest
  "jest.autoRun": "off",
  "jest.showCoverageOnLoad": false,

  // Docker
  "docker.dockerComposeBuild": true,
  "docker.dockerComposeDetached": true,

  // Database
  "sqltools.connections": [
    {
      "name": "SommOS SQLite",
      "driver": "SQLite",
      "database": "${workspaceFolder}/SommOS/data/sommos.db"
    }
  ],

  // Git
  "gitlens.codeLens.enabled": true,
  "gitlens.currentLine.enabled": true,

  // Terminal
  "terminal.integrated.defaultProfile.osx": "zsh",
  "terminal.integrated.cwd": "${workspaceFolder}/SommOS"
}
```

### Workspace-Specific Extensions File

Create `.vscode/extensions.json` in SommOS root:

```json
{
  "recommendations": [
    // Essential
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "alexcvzz.vscode-sqlite",
    "ms-azuretools.vscode-docker",
    "orta.vscode-jest",
    "ms-playwright.playwright",
    "redhat.vscode-yaml",
    
    // Highly Recommended
    "humao.rest-client",
    "mikestead.dotenv",
    "usernamehw.errorlens",
    "christian-kohler.path-intellisense",
    "snyk.snyk-vulnerability-scanner",
    "eamodio.gitlens",
    
    // Quality of Life
    "wayou.vscode-todo-highlight",
    "aaron-bond.better-comments",
    "streetsidesoftware.code-spell-checker",
    "yzhang.markdown-all-in-one"
  ],
  "unwantedRecommendations": [
    "ms-python.python",
    "angular.ng-template",
    "octref.vetur",
    "dsznajder.es7-react-js-snippets"
  ]
}
```

---

## 📋 Priority Installation Order

### Phase 1: Critical (Install Now)

1. `humao.rest-client` - API testing
2. `mikestead.dotenv` - Environment file support
3. `usernamehw.errorlens` - Code quality visibility

### Phase 2: Quality Improvements (Install This Week)

4. `christian-kohler.path-intellisense` - Faster development
5. `wayou.vscode-todo-highlight` - Task tracking
6. `aaron-bond.better-comments` - Documentation
7. `streetsidesoftware.code-spell-checker` - Quality

### Phase 3: Nice to Have (Optional)

8. `wix.vscode-import-cost` - Bundle optimization
9. `yzhang.markdown-all-in-one` - Documentation
10. `ritwickdey.liveserver` - Quick testing

---

## 🎨 Custom Configuration for Wine Domain

### Code Spell Checker - Custom Dictionary

Add to `.vscode/settings.json`:

```json
{
  "cSpell.words": [
    "sommos",
    "sommelier",
    "vintages",
    "pairing",
    "pairings",
    "grapes",
    "deepseek",
    "openai",
    "meteo",
    "cellar",
    "ledger",
    "procurement",
    "indexeddb",
    "vite",
    "playwright",
    "eslintrc",
    "prettierrc",
    "composefile"
  ]
}
```

---

## 🔍 Verification Checklist

After installing recommended extensions:

- [ ] ESLint shows errors inline with Error Lens
- [ ] Prettier formats on save
- [ ] REST Client can test `/api/health` endpoint
- [ ] SQLite extension connects to `data/sommos.db`
- [ ] Docker extension shows running containers
- [ ] Jest extension detects 600+ tests
- [ ] Playwright extension shows test suites
- [ ] Path autocomplete works in imports
- [ ] TODO highlights are visible in code
- [ ] Spell checker catches typos

---

## 📊 Summary

### Keep (10 extensions)

All currently installed extensions are relevant and should be kept.

### Add (10 extensions)

- **Critical (3)**: REST Client, DotEnv, Error Lens
- **Recommended (4)**: Path Intellisense, TODO Highlight, Better Comments, Spell Checker
- **Optional (3)**: Import Cost, Markdown All in One, Live Server

### Remove (0 extensions)

No extensions need removal. Current setup is lean and relevant.

### Total Recommended: 20 extensions

This maintains a lightweight IDE while providing essential tools for SommOS development.

---

## 🚀 Quick Install Commands

### Via VS Code/Windsurf Command Palette

```
Ctrl+P (Cmd+P on Mac)
ext install humao.rest-client
ext install mikestead.dotenv
ext install usernamehw.errorlens
ext install christian-kohler.path-intellisense
ext install wayou.vscode-todo-highlight
ext install aaron-bond.better-comments
ext install streetsidesoftware.code-spell-checker
ext install wix.vscode-import-cost
ext install yzhang.markdown-all-in-one
```

### Via CLI (if using VS Code)

```bash
code --install-extension humao.rest-client
code --install-extension mikestead.dotenv
code --install-extension usernamehw.errorlens
code --install-extension christian-kohler.path-intellisense
code --install-extension wayou.vscode-todo-highlight
code --install-extension aaron-bond.better-comments
code --install-extension streetsidesoftware.code-spell-checker
```

---

## 📖 Additional Resources

- [VS Code Extension Marketplace](https://marketplace.visualstudio.com/)
- [SommOS MCD](./docs/guides/SOMMOS_MCD.md) - Project architecture reference
- [Windsurf Documentation](https://docs.windsurf.com) - IDE-specific features

---

**Next Steps**:

1. Review and approve recommended extensions
2. Install Phase 1 (Critical) extensions
3. Update `.vscode/extensions.json` with recommendations
4. Configure custom settings as suggested
5. Verify all extensions work correctly with SommOS project

**Estimated Setup Time**: 15-20 minutes for full installation and configuration
