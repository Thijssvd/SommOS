#!/bin/bash

# SommOS Guest Access Test Script
# This script helps test the guest access functionality

set -e

# Configuration
API_BASE="${SOMMOS_API_BASE:-http://localhost:3001/api}"
ADMIN_EMAIL="${SOMMOS_ADMIN_EMAIL:-admin@sommos.local}"
ADMIN_PASSWORD="${SOMMOS_ADMIN_PASSWORD:-admin123}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to login as admin and get cookie
admin_login() {
    log_info "Logging in as admin..."
    
    RESPONSE=$(curl -s -c /tmp/sommos_cookies.txt -X POST "${API_BASE}/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        log_success "Admin login successful"
        return 0
    else
        log_error "Admin login failed"
        echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
        return 1
    fi
}

# Function to create a guest invite
create_guest_invite() {
    local email="$1"
    local pin="$2"
    local hours="${3:-24}"
    
    log_info "Creating guest invite for: $email"
    
    local json_data="{\"email\":\"${email}\",\"role\":\"guest\",\"expires_in_hours\":${hours}"
    
    if [ -n "$pin" ]; then
        json_data="${json_data},\"pin\":\"${pin}\""
    fi
    
    json_data="${json_data}}"
    
    RESPONSE=$(curl -s -b /tmp/sommos_cookies.txt -X POST "${API_BASE}/auth/invite" \
        -H "Content-Type: application/json" \
        -d "$json_data")
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        log_success "Guest invite created successfully"
        
        # Extract and display the event code
        EVENT_CODE=$(echo "$RESPONSE" | jq -r '.data.token')
        EXPIRES_AT=$(echo "$RESPONSE" | jq -r '.data.expires_at')
        REQUIRES_PIN=$(echo "$RESPONSE" | jq -r '.data.requires_pin')
        
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo -e "${GREEN}Event Code:${NC} ${EVENT_CODE}"
        echo -e "${BLUE}Email:${NC} ${email}"
        echo -e "${BLUE}Expires:${NC} ${EXPIRES_AT}"
        echo -e "${BLUE}Requires PIN:${NC} ${REQUIRES_PIN}"
        if [ "$REQUIRES_PIN" = "true" ]; then
            echo -e "${YELLOW}PIN:${NC} ${pin}"
        fi
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        
        # Save for testing
        echo "$EVENT_CODE" > /tmp/sommos_guest_code.txt
        if [ -n "$pin" ]; then
            echo "$pin" > /tmp/sommos_guest_pin.txt
        fi
        
        return 0
    else
        log_error "Failed to create guest invite"
        echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
        return 1
    fi
}

# Function to test guest login
test_guest_login() {
    local event_code="$1"
    local pin="$2"
    
    log_info "Testing guest login with event code..."
    
    local json_data="{\"event_code\":\"${event_code}\""
    
    if [ -n "$pin" ]; then
        json_data="${json_data},\"pin\":\"${pin}\""
    fi
    
    json_data="${json_data}}"
    
    RESPONSE=$(curl -s -c /tmp/sommos_guest_cookies.txt -X POST "${API_BASE}/guest/session" \
        -H "Content-Type: application/json" \
        -d "$json_data")
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        log_success "Guest login successful"
        
        USER_EMAIL=$(echo "$RESPONSE" | jq -r '.data.email')
        USER_ROLE=$(echo "$RESPONSE" | jq -r '.data.role')
        
        echo ""
        echo -e "${GREEN}Logged in as:${NC} ${USER_EMAIL} (${USER_ROLE})"
        echo ""
        
        return 0
    else
        log_error "Guest login failed"
        echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
        return 1
    fi
}

# Function to test guest API access
test_guest_api_access() {
    log_info "Testing guest API access..."
    
    # Test read access (should work)
    log_info "  Testing read access to inventory..."
    RESPONSE=$(curl -s -b /tmp/sommos_guest_cookies.txt "${API_BASE}/inventory")
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        log_success "  Guest can read inventory"
    else
        log_warning "  Guest cannot read inventory (this might be expected)"
    fi
    
    # Test write access (should fail)
    log_info "  Testing write access (should be denied)..."
    RESPONSE=$(curl -s -b /tmp/sommos_guest_cookies.txt -X POST "${API_BASE}/inventory/consume" \
        -H "Content-Type: application/json" \
        -d '{"vintage_id":1,"location":"main-cellar","quantity":1}')
    
    if echo "$RESPONSE" | grep -q 'FORBIDDEN\|403'; then
        log_success "  Guest write access correctly denied"
    else
        log_error "  Guest should not have write access!"
    fi
}

# Main test flow
main() {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  SommOS Guest Access Test Script"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "API Base: ${API_BASE}"
    echo ""
    
    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
        log_warning "jq is not installed. JSON parsing will be limited."
        log_info "Install with: brew install jq (macOS) or apt-get install jq (Linux)"
    fi
    
    # Step 1: Admin login
    if ! admin_login; then
        log_error "Cannot proceed without admin access"
        exit 1
    fi
    
    # Step 2: Create guest invite without PIN
    echo ""
    log_info "═══ Test 1: Guest Invite without PIN ═══"
    if create_guest_invite "guest-test-$(date +%s)@event.local" "" 24; then
        EVENT_CODE=$(cat /tmp/sommos_guest_code.txt)
        
        # Test login
        if test_guest_login "$EVENT_CODE" ""; then
            test_guest_api_access
        fi
    fi
    
    # Step 3: Create guest invite with PIN
    echo ""
    log_info "═══ Test 2: Guest Invite with PIN ═══"
    if create_guest_invite "guest-pin-test-$(date +%s)@event.local" "1234" 24; then
        EVENT_CODE=$(cat /tmp/sommos_guest_code.txt)
        PIN=$(cat /tmp/sommos_guest_pin.txt)
        
        # Test login with wrong PIN (should fail)
        log_info "Testing with wrong PIN (should fail)..."
        if test_guest_login "$EVENT_CODE" "9999"; then
            log_error "Login should have failed with wrong PIN!"
        else
            log_success "Wrong PIN correctly rejected"
        fi
        
        # Test login with correct PIN
        log_info "Testing with correct PIN..."
        if test_guest_login "$EVENT_CODE" "$PIN"; then
            test_guest_api_access
        fi
    fi
    
    # Step 4: Test invalid code
    echo ""
    log_info "═══ Test 3: Invalid Event Code ═══"
    log_info "Testing with invalid event code (should fail)..."
    if test_guest_login "invalid_code_12345" ""; then
        log_error "Login should have failed with invalid code!"
    else
        log_success "Invalid event code correctly rejected"
    fi
    
    # Cleanup
    rm -f /tmp/sommos_cookies.txt /tmp/sommos_guest_cookies.txt
    rm -f /tmp/sommos_guest_code.txt /tmp/sommos_guest_pin.txt
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_success "Guest access testing completed!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Next steps:"
    echo "  1. Test the UI by visiting http://localhost:3000"
    echo "  2. Click the 'Guest Access' tab"
    echo "  3. Use one of the generated event codes above"
    echo ""
}

# Run main function
main
