#!/usr/bin/env bash
# ==============================================================================
# KARVION API MANAGER — ENTERPRISE SYSTEM DIAGNOSTICS GENERATOR
# Target Domain: https://api.karviontechnologies.in
# Author: Karvion Technologies (Arjun Kahar)
# ==============================================================================

set -euo pipefail

DIAG_DIR="/var/log/arjun/diagnostics"
DATE_STR=$(date +%Y%m%d_%H%M%S)
BUNDLE_DIR="${DIAG_DIR}/diag_${DATE_STR}"
BUNDLE_ARCHIVE="${DIAG_DIR}/karvion_diagnostics_${DATE_STR}.tar.gz"

mkdir -p "${BUNDLE_DIR}"

echo "=========================================================================="
echo ">>> Collecting System Diagnostics for Karvion API Manager (${DATE_STR}) <<<"
echo "=========================================================================="

# 1. System Metadata
echo "Collecting system specifications and resource usage..."
{
    echo "=== OS RELEASE ==="
    cat /etc/os-release 2>/dev/null || true
    echo ""
    echo "=== KERNEL & UPTIME ==="
    uname -a
    uptime
    echo ""
    echo "=== MEMORY & SWAP ==="
    free -m
    echo ""
    echo "=== DISK UTILIZATION ==="
    df -h
    echo ""
    echo "=== OPEN FILE LIMITS ==="
    ulimit -a
    echo ""
    echo "=== NETWORK INTERFACES & IPS ==="
    ip -br a 2>/dev/null || ifconfig 2>/dev/null || true
    echo ""
    echo "=== LISTENING PORTS ==="
    ss -tulpn 2>/dev/null || netstat -tulpn 2>/dev/null || true
} > "${BUNDLE_DIR}/system_specs.txt"

# 2. PM2 Process Logs
echo "Collecting PM2 process logs..."
if command -v pm2 &>/dev/null; then
    pm2 status > "${BUNDLE_DIR}/pm2_status.txt" 2>&1 || true
    pm2 logs --lines 100 --nostream > "${BUNDLE_DIR}/pm2_recent_logs.txt" 2>&1 || true
fi

# 3. Nginx Configuration & Error Logs
echo "Collecting Nginx diagnostics..."
if command -v nginx &>/dev/null; then
    nginx -T > "${BUNDLE_DIR}/nginx_runtime_config.txt" 2>&1 || true
    if [[ -f /var/log/nginx/error.log ]]; then
        tail -n 200 /var/log/nginx/error.log > "${BUNDLE_DIR}/nginx_error_recent.log" 2>/dev/null || true
    fi
fi

# 4. Redis Diagnostics
echo "Collecting Redis stats..."
if command -v redis-cli &>/dev/null; then
    redis-cli info > "${BUNDLE_DIR}/redis_info.txt" 2>&1 || true
fi

# 5. Security & Firewall Status
echo "Collecting firewall & Fail2ban status..."
if command -v ufw &>/dev/null; then
    ufw status verbose > "${BUNDLE_DIR}/ufw_status.txt" 2>&1 || true
fi
if command -v fail2ban-client &>/dev/null; then
    fail2ban-client status > "${BUNDLE_DIR}/fail2ban_status.txt" 2>&1 || true
fi

# Compress bundle
tar -czf "${BUNDLE_ARCHIVE}" -C "${DIAG_DIR}" "diag_${DATE_STR}"
rm -rf "${BUNDLE_DIR}"

echo "=========================================================================="
echo ">>> [SUCCESS] Diagnostics bundle generated: ${BUNDLE_ARCHIVE}"
echo ">>> File Size: $(du -sh "${BUNDLE_ARCHIVE}" | cut -f1)"
echo "=========================================================================="
