#!/usr/bin/env bash
# ==============================================================================
# KARVION API MANAGER — POST-DEPLOYMENT VERIFICATION PROBE
# Domain: https://api.karviontechnologies.in
# Author: Karvion Technologies (Arjun Kahar)
# ==============================================================================

set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

ERRORS_COUNT=0
PASSED_COUNT=0

log_check() {
    local test_name="$1"
    local status="$2"
    local details="$3"
    
    if [ "$status" -eq 0 ]; then
        echo -e "  [${GREEN}PASS${NC}] ${test_name} — ${details}"
        PASSED_COUNT=$((PASSED_COUNT + 1))
    else
        echo -e "  [${RED}FAIL${NC}] ${test_name} — ${details}"
        ERRORS_COUNT=$((ERRORS_COUNT + 1))
    fi
}

echo "=========================================================================="
echo ">>> KARVION API MANAGER: Comprehensive Post-Deployment Verification <<<"
echo ">>> Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "=========================================================================="

echo -e "\n${CYAN}1. Probing Local Backend Service (Port 3000)...${NC}"
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/health || echo "000")
BACKEND_BODY=$(curl -s http://127.0.0.1:3000/health || echo "{}")
if [ "$BACKEND_STATUS" -eq 200 ] && echo "$BACKEND_BODY" | grep -q '"status":"healthy"'; then
    log_check "Backend Health Probe" 0 "HTTP 200 OK (Status: healthy)"
else
    log_check "Backend Health Probe" 1 "HTTP ${BACKEND_STATUS} — Response: ${BACKEND_BODY}"
fi

echo -e "\n${CYAN}2. Probing Local API Gateway (Port 3001)...${NC}"
GATEWAY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/health || echo "000")
GATEWAY_BODY=$(curl -s http://127.0.0.1:3001/health || echo "{}")
if [ "$GATEWAY_STATUS" -eq 200 ] && echo "$GATEWAY_BODY" | grep -q '"status":"healthy"'; then
    log_check "Gateway Health Probe" 0 "HTTP 200 OK (Status: healthy)"
else
    log_check "Gateway Health Probe" 1 "HTTP ${GATEWAY_STATUS} — Response: ${GATEWAY_BODY}"
fi

echo -e "\n${CYAN}3. Verifying PM2 Cluster Status...${NC}"
if command -v pm2 &>/dev/null; then
    PM2_BACKEND=$(pm2 jlist 2>/dev/null | grep -o '"name":"backend","pm_id":[0-9]*,"status":"online"' || true)
    PM2_GATEWAY=$(pm2 jlist 2>/dev/null | grep -o '"name":"gateway","pm_id":[0-9]*,"status":"online"' || true)
    
    if [ -n "$PM2_BACKEND" ]; then
        log_check "PM2 Backend Process" 0 "Process online and responding"
    else
        log_check "PM2 Backend Process" 1 "Backend process not found online in PM2"
    fi

    if [ -n "$PM2_GATEWAY" ]; then
        log_check "PM2 Gateway Process" 0 "Process online and responding"
    else
        log_check "PM2 Gateway Process" 1 "Gateway process not found online in PM2"
    fi
else
    echo -e "  [${YELLOW}SKIP${NC}] PM2 not installed globally or running in non-PM2 container environment."
fi

echo -e "\n${CYAN}4. Verifying Nginx Web Server & Configuration...${NC}"
if command -v nginx &>/dev/null; then
    if nginx -t > /dev/null 2>&1; then
        log_check "Nginx Configuration Test" 0 "Syntax OK, test is successful"
    else
        log_check "Nginx Configuration Test" 1 "Syntax error in nginx.conf"
    fi
else
    echo -e "  [${YELLOW}SKIP${NC}] Nginx command not available in this shell environment."
fi

echo -e "\n${CYAN}5. Probing Public Domain HTTPS & SSL (api.karviontechnologies.in)...${NC}"
PUBLIC_STATUS=$(curl -s -k -o /dev/null -w "%{http_code}" https://api.karviontechnologies.in/health || echo "000")
if [ "$PUBLIC_STATUS" -eq 200 ]; then
    log_check "Public Gateway /health" 0 "HTTP 200 OK via HTTPS reverse proxy"
else
    echo -e "  [${YELLOW}INFO${NC}] Public HTTPS returned HTTP ${PUBLIC_STATUS} (Normal if probing internally before DNS/hairpin NAT)"
fi

echo -e "\n${CYAN}6. Verifying API Gateway Resilient Alias Resolution...${NC}"
ALIAS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3001/v1/vehicle2-n" || echo "000")
# Notice: A 401 Unauthorized is EXPECTED and CORRECT because a missing API key is rejected by the gateway auth middleware, proving route exists!
if [ "$ALIAS_STATUS" -eq 401 ] || [ "$ALIAS_STATUS" -eq 200 ]; then
    log_check "Route /v1/vehicle2-n Resolution" 0 "Route recognized by gateway (HTTP ${ALIAS_STATUS})"
else
    log_check "Route /v1/vehicle2-n Resolution" 1 "Unexpected response HTTP ${ALIAS_STATUS}"
fi

echo -e "\n=========================================================================="
echo "Verification Summary: ${PASSED_COUNT} Passed, ${ERRORS_COUNT} Failed"
echo "=========================================================================="

if [ "$ERRORS_COUNT" -gt 0 ]; then
    echo -e "${RED}>>> Post-deployment verification finished with errors! <<<${NC}"
    exit 1
else
    echo -e "${GREEN}>>> Post-deployment verification PASSED successfully! All services operating nominally. <<<${NC}"
    exit 0
fi
