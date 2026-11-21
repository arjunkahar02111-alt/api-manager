#!/usr/bin/env bash
# ==============================================================================
# KARVION API MANAGER — SAFE UNINSTALLATION & TEARDOWN SCRIPT
# Target Host: api.karviontechnologies.in
# Author: Karvion Technologies (Arjun Kahar)
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "=========================================================================="
echo -e "${RED}>>> DANGER: KARVION API MANAGER UNINSTALLATION & TEARDOWN <<<${NC}"
echo "=========================================================================="
echo "This script will:"
echo " 1. Stop and remove all Karvion PM2 processes."
echo " 2. Disable and remove Nginx site configuration."
echo " 3. Remove application files from /var/www/arjun-api-manager."
echo ""
echo -e "${YELLOW}[NOTE] Database records (MongoDB) and backups in /var/backups/arjun will BE PRESERVED.${NC}"
echo "=========================================================================="
echo ""
read -p "To confirm uninstallation, type 'KARVION-UNINSTALL': " CONFIRM

if [[ "${CONFIRM}" != "KARVION-UNINSTALL" ]]; then
    echo "Uninstallation cancelled."
    exit 0
fi

# 1. Create one last safety backup
echo ">>> [1/4] Generating final pre-uninstallation backup..."
if [[ -f ./backup.sh ]]; then
    bash ./backup.sh || true
fi

# 2. Stop PM2 processes
echo ">>> [2/4] Stopping and removing PM2 application processes..."
if command -v pm2 &>/dev/null; then
    pm2 delete arjun-backend arjun-gateway arjun-worker 2>/dev/null || true
    pm2 save 2>/dev/null || true
fi

# 3. Disable Nginx site
echo ">>> [3/4] Removing Nginx reverse proxy configuration..."
rm -f /etc/nginx/sites-enabled/api.karviontechnologies.in.conf
rm -f /etc/nginx/sites-available/api.karviontechnologies.in.conf
nginx -t 2>/dev/null && systemctl reload nginx || true

# 4. Remove installation directory
echo ">>> [4/4] Removing application directory..."
if [[ -d "/var/www/arjun-api-manager" ]]; then
    echo "Removing /var/www/arjun-api-manager..."
    rm -rf /var/www/arjun-api-manager
fi

echo "=========================================================================="
echo -e "${GREEN}>>> KARVION API MANAGER UNINSTALLATION COMPLETED <<<${NC}"
echo "Database and rolling backups remain intact in /var/backups/arjun/."
echo "=========================================================================="
