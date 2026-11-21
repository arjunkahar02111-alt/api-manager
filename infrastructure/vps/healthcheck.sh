#!/usr/bin/env bash
# ==============================================================================
# KARVION API MANAGER — PRODUCTION HEALTH CHECK & DIAGNOSTIC AUDIT
# Domain: https://api.karviontechnologies.in
# Author: Karvion Technologies (Arjun Kahar)
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

pass() { echo -e "  [${GREEN}PASS${NC}] $1"; }
fail() { echo -e "  [${RED}FAIL${NC}] $1"; }
warn() { echo -e "  [${YELLOW}WARN${NC}] $1"; }

echo "=========================================================================="
echo ">>> KARVION API MANAGER — LIVE SYSTEM HEALTH AUDIT <<<"
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "=========================================================================="

# 1. System Resources
echo ""
echo "--- 1. SYSTEM HARDWARE & RESOURCE HEALTH ---"
CPU_LOAD=$(uptime | awk -F'load average:' '{ print $2 }' | cut -d, -f1 | tr -d ' ')
MEM_USED_MB=$(free -m | awk '/Mem:/ {print $3}')
MEM_TOTAL_MB=$(free -m | awk '/Mem:/ {print $2}')
MEM_PERCENT=$((MEM_USED_MB * 100 / MEM_TOTAL_MB))
DISK_USED_PCT=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')

if (( $(echo "${CPU_LOAD} < $(nproc)" | bc -l 2>/dev/null || echo 1) )); then
    pass "CPU Load Average: ${CPU_LOAD} (Capacity: $(nproc) cores)"
else
    warn "High CPU Load Average: ${CPU_LOAD} (Capacity: $(nproc) cores)"
fi

if [[ ${MEM_PERCENT} -lt 90 ]]; then
    pass "Memory Utilization: ${MEM_USED_MB}MB / ${MEM_TOTAL_MB}MB (${MEM_PERCENT}%)"
else
    warn "High Memory Utilization: ${MEM_USED_MB}MB / ${MEM_TOTAL_MB}MB (${MEM_PERCENT}%)"
fi

if [[ ${DISK_USED_PCT} -lt 85 ]]; then
    pass "Disk Utilization: ${DISK_USED_PCT}% used on root partition"
else
    warn "High Disk Utilization: ${DISK_USED_PCT}% used on root partition"
fi

# 2. Port Bindings
echo ""
echo "--- 2. NETWORK PORT BINDINGS ---"
for PORT in 80 443 3000 3001 6379 27017; do
    if nc -z 127.0.0.1 ${PORT} 2>/dev/null || ss -tulpn | grep -q ":${PORT} "; then
        pass "Port ${PORT} is open and listening."
    else
        fail "Port ${PORT} is NOT listening."
    fi
done

# 3. Database & Cache Services
echo ""
echo "--- 3. PERSISTENCE & IN-MEMORY ENGINES ---"
# Redis
if [[ $(redis-cli ping 2>/dev/null) == "PONG" ]]; then
    REDIS_KEYS=$(redis-cli dbsize 2>/dev/null | awk '{print $1}')
    pass "Redis Engine: Operational (PONG, ${REDIS_KEYS} active keys)"
else
    fail "Redis Engine: Offline or unreachable on 127.0.0.1:6379"
fi

# MongoDB
if mongosh --eval "db.adminCommand('ping')" --quiet &>/dev/null || mongo --eval "db.adminCommand('ping')" --quiet &>/dev/null; then
    pass "MongoDB Engine: Operational (ping response confirmed)"
elif nc -z 127.0.0.1 27017 2>/dev/null; then
    pass "MongoDB Engine: Port 27017 listening (CLI ping deferred)"
else
    fail "MongoDB Engine: Offline or unreachable on 127.0.0.1:27017"
fi

# 4. Application HTTP Endpoints
echo ""
echo "--- 4. APPLICATION MICROSERVICE HTTP ENDPOINTS ---"
# Backend Health
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/health || echo "000")
if [[ "${BACKEND_STATUS}" == "200" ]]; then
    pass "Management Backend HTTP /health: 200 OK"
else
    fail "Management Backend HTTP /health: Status ${BACKEND_STATUS}"
fi

# Gateway Health
GATEWAY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/health || echo "000")
if [[ "${GATEWAY_STATUS}" == "200" ]]; then
    pass "High-Speed API Gateway HTTP /health: 200 OK"
else
    fail "High-Speed API Gateway HTTP /health: Status ${GATEWAY_STATUS}"
fi

# Metrics Endpoints
BACKEND_METRICS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/metrics || echo "000")
if [[ "${BACKEND_METRICS}" == "200" ]]; then
    pass "Backend Prometheus Metrics /metrics: 200 OK"
else
    warn "Backend Prometheus Metrics /metrics: Status ${BACKEND_METRICS}"
fi

# 5. PM2 Cluster Status
echo ""
echo "--- 5. PM2 SUPERVISED PROCESSES ---"
if command -v pm2 &>/dev/null; then
    pm2 jlist 2>/dev/null | jq -r '.[] | "  Process: \(.name) | Status: \(.pm2_env.status) | Restarts: \(.pm2_env.restart_time) | Memory: \((.monit.memory / 1024 / 1024 | floor))MB"' || pm2 status
else
    warn "PM2 is not installed globally or not in PATH."
fi

# 6. Nginx Web Server & Static Bundle
echo ""
echo "--- 6. NGINX REVERSE PROXY & FRONTEND BUILD ---"
if systemctl is-active --quiet nginx; then
    pass "Nginx Systemd Service: Active (Running)"
else
    fail "Nginx Systemd Service: Inactive / Failed"
fi

if [[ -f "/var/www/arjun-api-manager/apps/frontend/dist/index.html" || -f "./apps/frontend/dist/index.html" ]]; then
    pass "React Frontend SPA: Production dist/index.html verified."
else
    fail "React Frontend SPA: dist/index.html is missing. Run 'pnpm run build'."
fi

echo ""
echo "=========================================================================="
echo ">>> HEALTH AUDIT COMPLETE <<<"
echo "=========================================================================="
