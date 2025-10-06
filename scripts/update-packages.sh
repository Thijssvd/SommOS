#!/bin/bash
################################################################################
# SommOS Package Update Deployment Script
# 
# Automated CLI deployment script for executing Priority 1 and Priority 2
# package updates with comprehensive error handling, rollback capability,
# and detailed reporting.
#
# Author: SommOS Team
# Date: 2025-10-06
# Version: 1.0.0
#
# Usage:
#   ./scripts/update-packages.sh [OPTIONS]
#
# Options:
#   --priority-1-only        Execute only Priority 1 updates (default)
#   --include-priority-2     Include Priority 2 updates (web-vitals)
#   --skip-tests             Skip test suite execution
#   --dry-run                Simulate updates without making changes
#   --verbose                Enable verbose output
#   --help                   Display this help message
#
# Priority 1 Updates (Safe, Recommended):
#   - @playwright/test: 1.55.1 → 1.56.0
#   - @types/node: 24.6.2 → 24.7.0
#   - openai: 6.0.1 → 6.1.0
#   - zod: 4.1.11 → 4.1.12
#
# Priority 2 Updates (Requires Evaluation):
#   - web-vitals: 3.5.2 → 5.1.0 (Major version, breaking changes)
#
################################################################################

set -e  # Exit on any error
set -o pipefail  # Exit on pipe failures

################################################################################
# Configuration and Global Variables
################################################################################

# Project paths
PROJECT_ROOT="/Users/thijs/Documents/SommOS"
FRONTEND_DIR="${PROJECT_ROOT}/frontend"
SCRIPTS_DIR="${PROJECT_ROOT}/scripts"
LOGS_DIR="${PROJECT_ROOT}/logs"
BACKUP_DIR="${LOGS_DIR}/backups"

# Timestamp for this deployment
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
DEPLOYMENT_START=$(date +%s)

# Log files
LOG_FILE="${LOGS_DIR}/package-update-${TIMESTAMP}.log"
REPORT_FILE="${LOGS_DIR}/package-update-report-${TIMESTAMP}.md"

# Backup files
BACKUP_TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
BACKUP_ROOT_PKG="${BACKUP_DIR}/package.json.${BACKUP_TIMESTAMP}"
BACKUP_ROOT_LOCK="${BACKUP_DIR}/package-lock.json.${BACKUP_TIMESTAMP}"
BACKUP_FRONTEND_PKG="${BACKUP_DIR}/frontend-package.json.${BACKUP_TIMESTAMP}"
BACKUP_FRONTEND_LOCK="${BACKUP_DIR}/frontend-package-lock.json.${BACKUP_TIMESTAMP}"

# Command-line options
INCLUDE_PRIORITY_2=false
SKIP_TESTS=false
DRY_RUN=false
VERBOSE=false
PRIORITY_1_ONLY=true

# Package versions (bash 3.2 compatible - indexed arrays)
PRIORITY_1_PACKAGES=(
    "@playwright/test:1.56.0:dev"
    "@types/node:24.7.0:dev"
    "openai:6.1.0:prod"
    "zod:4.1.12:prod"
)

PRIORITY_2_PACKAGES=(
    "web-vitals:5.1.0:prod:frontend"
)

# Status tracking
UPDATE_STATUS=()
ROLLBACK_REQUIRED=false
EXIT_CODE=0

################################################################################
# Color Codes for Output
################################################################################

if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    MAGENTA='\033[0;35m'
    CYAN='\033[0;36m'
    BOLD='\033[1m'
    NC='\033[0m' # No Color
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    MAGENTA=''
    CYAN=''
    BOLD=''
    NC=''
fi

################################################################################
# Logging Functions
################################################################################

log() {
    local message="$1"
    local timestamp=$(date +'%Y-%m-%d %H:%M:%S')
    echo -e "${BLUE}[${timestamp}]${NC} ${message}" | tee -a "${LOG_FILE}"
}

success() {
    local message="$1"
    echo -e "${GREEN}✅ ${message}${NC}" | tee -a "${LOG_FILE}"
}

warning() {
    local message="$1"
    echo -e "${YELLOW}⚠️  ${message}${NC}" | tee -a "${LOG_FILE}"
}

error() {
    local message="$1"
    echo -e "${RED}❌ ${message}${NC}" | tee -a "${LOG_FILE}"
}

info() {
    local message="$1"
    echo -e "${CYAN}ℹ️  ${message}${NC}" | tee -a "${LOG_FILE}"
}

debug() {
    if [[ "${VERBOSE}" == "true" ]]; then
        local message="$1"
        echo -e "${MAGENTA}🔍 ${message}${NC}" | tee -a "${LOG_FILE}"
    fi
}

section() {
    local title="$1"
    echo "" | tee -a "${LOG_FILE}"
    echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════${NC}" | tee -a "${LOG_FILE}"
    echo -e "${BOLD}${CYAN} ${title}${NC}" | tee -a "${LOG_FILE}"
    echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════${NC}" | tee -a "${LOG_FILE}"
    echo "" | tee -a "${LOG_FILE}"
}

################################################################################
# Help Function
################################################################################

show_help() {
    cat << EOF
${BOLD}SommOS Package Update Deployment Script${NC}

${BOLD}USAGE:${NC}
    ./scripts/update-packages.sh [OPTIONS]

${BOLD}OPTIONS:${NC}
    --priority-1-only        Execute only Priority 1 updates (default)
    --include-priority-2     Include Priority 2 updates (web-vitals 5.1.0)
    --skip-tests             Skip test suite execution (faster, less safe)
    --dry-run                Simulate updates without making changes
    --verbose                Enable verbose output for debugging
    --help                   Display this help message

${BOLD}PRIORITY 1 UPDATES (Safe, Recommended):${NC}
    • @playwright/test: 1.55.1 → 1.56.0 (dev)
    • @types/node: 24.6.2 → 24.7.0 (dev)
    • openai: 6.0.1 → 6.1.0 (prod)
    • zod: 4.1.11 → 4.1.12 (prod)

${BOLD}PRIORITY 2 UPDATES (Requires Evaluation):${NC}
    • web-vitals: 3.5.2 → 5.1.0 (prod, breaking changes)
      - Major version update with API changes
      - getFID() deprecated, replaced by getINP()
      - Requires code review and testing

${BOLD}EXAMPLES:${NC}
    # Safe update (Priority 1 only)
    ./scripts/update-packages.sh --priority-1-only

    # Full update including Priority 2
    ./scripts/update-packages.sh --include-priority-2

    # Dry run to preview changes
    ./scripts/update-packages.sh --dry-run --verbose

    # Quick update without tests (not recommended for production)
    ./scripts/update-packages.sh --skip-tests

${BOLD}SAFETY FEATURES:${NC}
    • Automatic backups of package.json and package-lock.json
    • Rollback capability on failures
    • Comprehensive pre-flight checks
    • Test suite verification
    • Security vulnerability scanning
    • Detailed deployment reports

${BOLD}OUTPUT:${NC}
    • Console output with color-coded status
    • Detailed log: ${LOGS_DIR}/package-update-YYYYMMDD-HHMMSS.log
    • Markdown report: ${LOGS_DIR}/package-update-report-YYYYMMDD-HHMMSS.md
    • Backups: ${BACKUP_DIR}/

For more information, see: ${PROJECT_ROOT}/README.md

EOF
}

################################################################################
# Cleanup and Signal Handling
################################################################################

cleanup() {
    local exit_code=$?
    
    if [[ ${exit_code} -ne 0 ]] && [[ "${ROLLBACK_REQUIRED}" == "true" ]]; then
        warning "Deployment failed. Initiating automatic rollback..."
        rollback_updates
    fi
    
    # Calculate duration
    local duration=$(($(date +%s) - DEPLOYMENT_START))
    local minutes=$((duration / 60))
    local seconds=$((duration % 60))
    
    echo "" | tee -a "${LOG_FILE}"
    log "Deployment completed in ${minutes}m ${seconds}s"
    log "Log file: ${LOG_FILE}"
    log "Report file: ${REPORT_FILE}"
    
    exit ${exit_code}
}

trap cleanup EXIT
trap 'error "Deployment interrupted"; exit 130' INT TERM

################################################################################
# Phase 1: Pre-flight Checks
################################################################################

check_prerequisites() {
    section "Phase 1: Pre-flight Checks"
    
    log "Checking system prerequisites..."
    
    # Check if we're in the correct directory
    if [[ ! -d "${PROJECT_ROOT}" ]]; then
        error "Project root not found: ${PROJECT_ROOT}"
        exit 1
    fi
    
    cd "${PROJECT_ROOT}" || exit 1
    success "Project root verified: ${PROJECT_ROOT}"
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
        exit 1
    fi
    
    local node_version=$(node --version)
    log "Node.js version: ${node_version}"
    
    if [[ ! "${node_version}" =~ ^v20\. ]]; then
        warning "Expected Node.js v20.x, found ${node_version}"
        warning "Proceeding anyway, but unexpected behavior may occur"
    else
        success "Node.js version check passed"
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        error "npm is not installed"
        exit 1
    fi
    
    local npm_version=$(npm --version)
    log "npm version: ${npm_version}"
    success "npm check passed"
    
    # Check git status
    if command -v git &> /dev/null && [[ -d .git ]]; then
        local git_status=$(git status --short)
        if [[ -n "${git_status}" ]]; then
            warning "Git working directory has uncommitted changes:"
            echo "${git_status}" | head -10 | tee -a "${LOG_FILE}"
            warning "Consider committing or stashing changes before updating"
            
            if [[ "${DRY_RUN}" == "false" ]]; then
                read -p "Continue anyway? (y/N): " -n 1 -r
                echo
                if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                    error "Deployment cancelled by user"
                    exit 1
                fi
            fi
        else
            success "Git working directory is clean"
        fi
    fi
    
    # Create necessary directories
    mkdir -p "${LOGS_DIR}" "${BACKUP_DIR}"
    success "Log directories created"
    
    # Initialize log file
    cat > "${LOG_FILE}" << EOF
SommOS Package Update Deployment
=================================
Date: $(date)
User: $(whoami)
Host: $(hostname)
Node: $(node --version)
npm: $(npm --version)
Options:
  - Priority 1 Only: ${PRIORITY_1_ONLY}
  - Include Priority 2: ${INCLUDE_PRIORITY_2}
  - Skip Tests: ${SKIP_TESTS}
  - Dry Run: ${DRY_RUN}
  - Verbose: ${VERBOSE}

EOF

    success "Pre-flight checks completed"
}

################################################################################
# Phase 2: Backup Current State
################################################################################

backup_current_state() {
    section "Phase 2: Backup Current State"
    
    log "Creating backups of package files..."
    
    # Backup root package files
    if [[ -f "${PROJECT_ROOT}/package.json" ]]; then
        cp "${PROJECT_ROOT}/package.json" "${BACKUP_ROOT_PKG}"
        success "Backed up: package.json → $(basename ${BACKUP_ROOT_PKG})"
    fi
    
    if [[ -f "${PROJECT_ROOT}/package-lock.json" ]]; then
        cp "${PROJECT_ROOT}/package-lock.json" "${BACKUP_ROOT_LOCK}"
        success "Backed up: package-lock.json → $(basename ${BACKUP_ROOT_LOCK})"
    fi
    
    # Backup frontend package files
    if [[ -f "${FRONTEND_DIR}/package.json" ]]; then
        cp "${FRONTEND_DIR}/package.json" "${BACKUP_FRONTEND_PKG}"
        success "Backed up: frontend/package.json → $(basename ${BACKUP_FRONTEND_PKG})"
    fi
    
    if [[ -f "${FRONTEND_DIR}/package-lock.json" ]]; then
        cp "${FRONTEND_DIR}/package-lock.json" "${BACKUP_FRONTEND_LOCK}"
        success "Backed up: frontend/package-lock.json → $(basename ${BACKUP_FRONTEND_LOCK})"
    fi
    
    success "All backups created successfully"
    info "Backup location: ${BACKUP_DIR}"
}

################################################################################
# Phase 3: Check Current Versions
################################################################################

check_current_versions() {
    section "Phase 3: Current Package Versions"
    
    log "Checking current package versions..."
    
    cd "${PROJECT_ROOT}"
    
    # Check Priority 1 packages
    info "Priority 1 Packages (Root):"
    for pkg_info in "${PRIORITY_1_PACKAGES[@]}"; do
        local package=$(echo "${pkg_info}" | cut -d: -f1)
        local target_version=$(echo "${pkg_info}" | cut -d: -f2)
        local current_version=$(npm list "${package}" --depth=0 2>/dev/null | grep "${package}" | awk -F@ '{print $NF}' || echo "not installed")
        log "  ${package}: ${current_version} → ${target_version}"
    done
    
    # Check Priority 2 packages
    if [[ "${INCLUDE_PRIORITY_2}" == "true" ]]; then
        info "Priority 2 Packages (Frontend):"
        cd "${FRONTEND_DIR}"
        for pkg_info in "${PRIORITY_2_PACKAGES[@]}"; do
            local package=$(echo "${pkg_info}" | cut -d: -f1)
            local target_version=$(echo "${pkg_info}" | cut -d: -f2)
            local current_version=$(npm list "${package}" --depth=0 2>/dev/null | grep "${package}" | awk -F@ '{print $NF}' || echo "not installed")
            log "  ${package}: ${current_version} → ${target_version}"
        done
    fi
    
    success "Version check completed"
}

################################################################################
# Phase 4: Priority 1 Updates
################################################################################

update_priority_1() {
    section "Phase 4: Priority 1 Updates (Safe)"
    
    ROLLBACK_REQUIRED=true
    
    cd "${PROJECT_ROOT}"
    log "Updating Priority 1 packages in: ${PROJECT_ROOT}"
    
    for pkg_info in "${PRIORITY_1_PACKAGES[@]}"; do
        local package=$(echo "${pkg_info}" | cut -d: -f1)
        local version=$(echo "${pkg_info}" | cut -d: -f2)
        local dep_type=$(echo "${pkg_info}" | cut -d: -f3)
        
        log "Updating ${package} to ${version} (${dep_type})..."
        
        if [[ "${DRY_RUN}" == "true" ]]; then
            info "[DRY RUN] Would execute: npm install ${package}@${version}"
            UPDATE_STATUS+=("${package}:dry-run")
            continue
        fi
        
        # Determine save flag
        local save_flag
        if [[ "${dep_type}" == "dev" ]]; then
            save_flag="--save-dev"
        else
            save_flag="--save"
        fi
        
        # Execute update with error handling
        if npm install "${package}@${version}" ${save_flag} >> "${LOG_FILE}" 2>&1; then
            success "✓ ${package}@${version} installed successfully"
            UPDATE_STATUS+=("${package}:success")
        else
            error "✗ Failed to install ${package}@${version}"
            UPDATE_STATUS+=("${package}:failed")
            EXIT_CODE=1
            return 1
        fi
        
        # Verify installation
        local installed_version=$(npm list "${package}" --depth=0 2>/dev/null | grep "${package}" | awk -F@ '{print $NF}')
        if [[ "${installed_version}" == "${version}" ]]; then
            success "Verified: ${package}@${installed_version}"
        else
            error "Version mismatch: Expected ${version}, got ${installed_version}"
            UPDATE_STATUS+=("${package}:version-mismatch")
            EXIT_CODE=1
            return 1
        fi
    done
    
    success "All Priority 1 updates completed successfully"
    ROLLBACK_REQUIRED=false
}

################################################################################
# Phase 5: Priority 2 Updates (Conditional)
################################################################################

analyze_web_vitals_compatibility() {
    log "Analyzing web-vitals compatibility..."
    
    local performance_monitor="${FRONTEND_DIR}/js/performance-monitor.js"
    local performance_file="${FRONTEND_DIR}/js/performance.js"
    
    # Check if files exist
    if [[ ! -f "${performance_monitor}" ]]; then
        warning "performance-monitor.js not found, skipping compatibility check"
        return 0
    fi
    
    # Check for deprecated getFID usage
    if grep -q "getFID" "${performance_monitor}" || grep -q "getFID" "${performance_file}" 2>/dev/null; then
        warning "Found getFID() usage in performance monitoring code"
        warning "web-vitals v5 replaces getFID with getINP (Interaction to Next Paint)"
        info "Breaking changes detected:"
        info "  - getFID() → getINP() (metric name changed)"
        info "  - FID (First Input Delay) → INP (Interaction to Next Paint)"
        info "  - Code modifications required before upgrading"
        return 1
    fi
    
    success "No obvious compatibility issues detected"
    return 0
}

update_priority_2() {
    if [[ "${INCLUDE_PRIORITY_2}" != "true" ]]; then
        info "Skipping Priority 2 updates (use --include-priority-2 to enable)"
        return 0
    fi
    
    section "Phase 5: Priority 2 Updates (Requires Evaluation)"
    
    warning "Priority 2 includes breaking changes - use with caution!"
    
    if [[ "${DRY_RUN}" == "false" ]]; then
        read -p "Continue with Priority 2 updates? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            info "Priority 2 updates skipped by user"
            return 0
        fi
    fi
    
    # Analyze compatibility
    if ! analyze_web_vitals_compatibility; then
        error "Compatibility issues detected. Manual code review required."
        error "Please review and update getFID() usage before upgrading web-vitals"
        return 1
    fi
    
    cd "${FRONTEND_DIR}"
    log "Updating Priority 2 packages in: ${FRONTEND_DIR}"
    
    ROLLBACK_REQUIRED=true
    
    for pkg_info in "${PRIORITY_2_PACKAGES[@]}"; do
        local package=$(echo "${pkg_info}" | cut -d: -f1)
        local version=$(echo "${pkg_info}" | cut -d: -f2)
        
        log "Updating ${package} to ${version}..."
        
        if [[ "${DRY_RUN}" == "true" ]]; then
            info "[DRY RUN] Would execute: npm install ${package}@${version}"
            UPDATE_STATUS+=("${package}:dry-run")
            continue
        fi
        
        if npm install "${package}@${version}" --save >> "${LOG_FILE}" 2>&1; then
            success "✓ ${package}@${version} installed successfully"
            UPDATE_STATUS+=("${package}:success")
        else
            error "✗ Failed to install ${package}@${version}"
            UPDATE_STATUS+=("${package}:failed")
            EXIT_CODE=1
            return 1
        fi
    done
    
    success "Priority 2 updates completed"
    ROLLBACK_REQUIRED=false
}

################################################################################
# Phase 6: Security Audit
################################################################################

run_security_audit() {
    section "Phase 6: Security Audit"
    
    log "Running npm audit on root packages..."
    cd "${PROJECT_ROOT}"
    
    local root_audit_output=$(npm audit --json 2>&1)
    local root_vulnerabilities=$(echo "${root_audit_output}" | grep -o '"total":[0-9]*' | head -1 | awk -F: '{print $2}')
    
    if [[ "${root_vulnerabilities}" == "0" ]]; then
        success "✓ Root packages: 0 vulnerabilities"
    else
        warning "⚠ Root packages: ${root_vulnerabilities} vulnerabilities found"
        echo "${root_audit_output}" >> "${LOG_FILE}"
    fi
    
    log "Running npm audit on frontend packages..."
    cd "${FRONTEND_DIR}"
    
    local frontend_audit_output=$(npm audit --json 2>&1)
    local frontend_vulnerabilities=$(echo "${frontend_audit_output}" | grep -o '"total":[0-9]*' | head -1 | awk -F: '{print $2}')
    
    if [[ "${frontend_vulnerabilities}" == "0" ]]; then
        success "✓ Frontend packages: 0 vulnerabilities"
    else
        warning "⚠ Frontend packages: ${frontend_vulnerabilities} vulnerabilities found"
        echo "${frontend_audit_output}" >> "${LOG_FILE}"
    fi
    
    if [[ "${root_vulnerabilities}" == "0" ]] && [[ "${frontend_vulnerabilities}" == "0" ]]; then
        success "Security audit passed - no vulnerabilities detected"
    else
        warning "Security audit completed with warnings"
    fi
}

################################################################################
# Phase 7: Test Suite
################################################################################

run_test_suite() {
    if [[ "${SKIP_TESTS}" == "true" ]]; then
        warning "Skipping test suite (--skip-tests enabled)"
        return 0
    fi
    
    if [[ "${DRY_RUN}" == "true" ]]; then
        info "[DRY RUN] Would run test suite"
        return 0
    fi
    
    section "Phase 7: Test Suite Verification"
    
    cd "${PROJECT_ROOT}"
    
    # Run unit tests
    log "Running unit tests (npm test)..."
    if npm test >> "${LOG_FILE}" 2>&1; then
        success "✓ Unit tests passed"
    else
        error "✗ Unit tests failed"
        warning "Check log file for details: ${LOG_FILE}"
        EXIT_CODE=1
        return 1
    fi
    
    # Run E2E tests
    log "Running E2E tests (npm run test:e2e)..."
    if npm run test:e2e >> "${LOG_FILE}" 2>&1; then
        success "✓ E2E tests passed"
    else
        error "✗ E2E tests failed"
        warning "Check log file for details: ${LOG_FILE}"
        EXIT_CODE=1
        return 1
    fi
    
    success "All tests passed successfully"
}

################################################################################
# Phase 8: Rollback Mechanism
################################################################################

rollback_updates() {
    section "Phase 8: Rolling Back Updates"
    
    warning "Initiating rollback procedure..."
    
    # Restore root package files
    if [[ -f "${BACKUP_ROOT_PKG}" ]]; then
        cp "${BACKUP_ROOT_PKG}" "${PROJECT_ROOT}/package.json"
        success "Restored: package.json"
    fi
    
    if [[ -f "${BACKUP_ROOT_LOCK}" ]]; then
        cp "${BACKUP_ROOT_LOCK}" "${PROJECT_ROOT}/package-lock.json"
        success "Restored: package-lock.json"
    fi
    
    # Restore frontend package files
    if [[ -f "${BACKUP_FRONTEND_PKG}" ]]; then
        cp "${BACKUP_FRONTEND_PKG}" "${FRONTEND_DIR}/package.json"
        success "Restored: frontend/package.json"
    fi
    
    if [[ -f "${BACKUP_FRONTEND_LOCK}" ]]; then
        cp "${BACKUP_FRONTEND_LOCK}" "${FRONTEND_DIR}/package-lock.json"
        success "Restored: frontend/package-lock.json"
    fi
    
    # Reinstall original packages
    log "Reinstalling original packages..."
    
    cd "${PROJECT_ROOT}"
    if npm install >> "${LOG_FILE}" 2>&1; then
        success "Root packages restored"
    else
        error "Failed to restore root packages"
        error "Manual recovery required: npm install in ${PROJECT_ROOT}"
    fi
    
    cd "${FRONTEND_DIR}"
    if npm install >> "${LOG_FILE}" 2>&1; then
        success "Frontend packages restored"
    else
        error "Failed to restore frontend packages"
        error "Manual recovery required: npm install in ${FRONTEND_DIR}"
    fi
    
    success "Rollback completed"
    info "Original state restored from backups at: ${BACKUP_DIR}"
}

################################################################################
# Phase 9: Generate Report
################################################################################

generate_report() {
    section "Phase 9: Generating Deployment Report"
    
    log "Creating deployment report..."
    
    local duration=$(($(date +%s) - DEPLOYMENT_START))
    local minutes=$((duration / 60))
    local seconds=$((duration % 60))
    
    cat > "${REPORT_FILE}" << EOF
# SommOS Package Update Deployment Report

**Date:** $(date)  
**Duration:** ${minutes}m ${seconds}s  
**User:** $(whoami)  
**Host:** $(hostname)  
**Status:** $(if [[ ${EXIT_CODE} -eq 0 ]]; then echo "✅ SUCCESS"; else echo "❌ FAILED"; fi)

---

## Configuration

| Setting | Value |
|---------|-------|
| Priority 1 Only | ${PRIORITY_1_ONLY} |
| Include Priority 2 | ${INCLUDE_PRIORITY_2} |
| Skip Tests | ${SKIP_TESTS} |
| Dry Run | ${DRY_RUN} |
| Verbose | ${VERBOSE} |

---

## Priority 1 Updates

| Package | Target Version | Status |
|---------|---------------|--------|
EOF

    for pkg_info in "${PRIORITY_1_PACKAGES[@]}"; do
        local package=$(echo "${pkg_info}" | cut -d: -f1)
        local version=$(echo "${pkg_info}" | cut -d: -f2)
        local status="pending"
        
        # Find status in UPDATE_STATUS array
        for status_info in "${UPDATE_STATUS[@]}"; do
            local status_pkg=$(echo "${status_info}" | cut -d: -f1)
            if [[ "${status_pkg}" == "${package}" ]]; then
                status=$(echo "${status_info}" | cut -d: -f2)
                break
            fi
        done
        
        local status_icon
        case "${status}" in
            success) status_icon="✅" ;;
            failed) status_icon="❌" ;;
            dry-run) status_icon="🔍" ;;
            *) status_icon="⏳" ;;
        esac
        
        echo "| \`${package}\` | ${version} | ${status_icon} ${status} |" >> "${REPORT_FILE}"
    done
    
    if [[ "${INCLUDE_PRIORITY_2}" == "true" ]]; then
        cat >> "${REPORT_FILE}" << EOF

---

## Priority 2 Updates

| Package | Target Version | Status |
|---------|---------------|--------|
EOF

        for pkg_info in "${PRIORITY_2_PACKAGES[@]}"; do
            local package=$(echo "${pkg_info}" | cut -d: -f1)
            local version=$(echo "${pkg_info}" | cut -d: -f2)
            local status="pending"
            
            # Find status in UPDATE_STATUS array
            for status_info in "${UPDATE_STATUS[@]}"; do
                local status_pkg=$(echo "${status_info}" | cut -d: -f1)
                if [[ "${status_pkg}" == "${package}" ]]; then
                    status=$(echo "${status_info}" | cut -d: -f2)
                    break
                fi
            done
            
            local status_icon
            case "${status}" in
                success) status_icon="✅" ;;
                failed) status_icon="❌" ;;
                dry-run) status_icon="🔍" ;;
                *) status_icon="⏳" ;;
            esac
            
            echo "| \`${package}\` | ${version} | ${status_icon} ${status} |" >> "${REPORT_FILE}"
        done
    fi
    
    cat >> "${REPORT_FILE}" << EOF

---

## System Information

| Component | Version |
|-----------|---------|
| Node.js | $(node --version) |
| npm | $(npm --version) |
| Operating System | $(uname -s) $(uname -r) |

---

## Test Results

$(if [[ "${SKIP_TESTS}" == "true" ]]; then
    echo "⚠️ Tests skipped (--skip-tests enabled)"
elif [[ "${DRY_RUN}" == "true" ]]; then
    echo "🔍 Tests not run (dry run mode)"
elif [[ ${EXIT_CODE} -eq 0 ]]; then
    echo "✅ All tests passed"
else
    echo "❌ Some tests failed - see log file for details"
fi)

---

## Recommendations

EOF

    if [[ ${EXIT_CODE} -eq 0 ]]; then
        cat >> "${REPORT_FILE}" << EOF
✅ **Deployment Successful**

All packages have been updated successfully. Consider the following next steps:

1. **Monitor System Performance**
   - Check application logs for any unexpected behavior
   - Monitor Core Web Vitals if web-vitals was updated
   - Verify all API endpoints are functioning correctly

2. **Deploy to Production**
   - Commit updated package files: \`git add package*.json\`
   - Create deployment commit: \`git commit -m "chore: update dependencies"\`
   - Deploy using: \`./deployment/deploy.sh\`

3. **Documentation**
   - Update CHANGELOG.md with package version changes
   - Document any breaking changes or required migrations

EOF
    else
        cat >> "${REPORT_FILE}" << EOF
❌ **Deployment Failed**

The deployment encountered errors. Please review the following:

1. **Check Log File**
   - Review detailed logs: \`${LOG_FILE}\`
   - Look for error messages and stack traces

2. **Verify Rollback**
   - Confirm packages were restored: \`npm list --depth=0\`
   - Check for any remaining inconsistencies

3. **Manual Recovery (if needed)**
   - Root packages: \`cd ${PROJECT_ROOT} && npm install\`
   - Frontend packages: \`cd ${FRONTEND_DIR} && npm install\`

4. **Retry After Fixing Issues**
   - Address root cause of failures
   - Run deployment again with verbose mode: \`--verbose\`

EOF
    fi
    
    cat >> "${REPORT_FILE}" << EOF
---

## Backup Information

All original package files have been backed up:

- Root package.json: \`$(basename ${BACKUP_ROOT_PKG})\`
- Root package-lock.json: \`$(basename ${BACKUP_ROOT_LOCK})\`
- Frontend package.json: \`$(basename ${BACKUP_FRONTEND_PKG})\`
- Frontend package-lock.json: \`$(basename ${BACKUP_FRONTEND_LOCK})\`

Backup location: \`${BACKUP_DIR}\`

---

## Files Generated

- **Log File:** \`${LOG_FILE}\`
- **Report File:** \`${REPORT_FILE}\`
- **Backup Directory:** \`${BACKUP_DIR}\`

---

**Generated by:** SommOS Package Update Script v1.0.0  
**Timestamp:** $(date)

EOF

    success "Deployment report generated: ${REPORT_FILE}"
}

################################################################################
# Main Execution Flow
################################################################################

main() {
    # Parse command-line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --priority-1-only)
                PRIORITY_1_ONLY=true
                INCLUDE_PRIORITY_2=false
                shift
                ;;
            --include-priority-2)
                INCLUDE_PRIORITY_2=true
                PRIORITY_1_ONLY=false
                shift
                ;;
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Display header
    echo ""
    echo -e "${BOLD}${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${CYAN}║                                                            ║${NC}"
    echo -e "${BOLD}${CYAN}║        SommOS Package Update Deployment Script             ║${NC}"
    echo -e "${BOLD}${CYAN}║                    Version 1.0.0                           ║${NC}"
    echo -e "${BOLD}${CYAN}║                                                            ║${NC}"
    echo -e "${BOLD}${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    if [[ "${DRY_RUN}" == "true" ]]; then
        warning "🔍 DRY RUN MODE - No changes will be made"
        echo ""
    fi
    
    # Execute deployment phases
    check_prerequisites
    backup_current_state
    check_current_versions
    
    if update_priority_1; then
        update_priority_2
    fi
    
    run_security_audit
    run_test_suite
    generate_report
    
    # Final status
    echo ""
    section "Deployment Summary"
    
    if [[ ${EXIT_CODE} -eq 0 ]]; then
        success "🎉 Deployment completed successfully!"
        info "All packages updated and tests passed"
    else
        error "❌ Deployment failed"
        warning "Check logs for details: ${LOG_FILE}"
    fi
    
    info "Report available at: ${REPORT_FILE}"
    info "Backups stored in: ${BACKUP_DIR}"
    
    echo ""
    
    exit ${EXIT_CODE}
}

# Execute main function
main "$@"
