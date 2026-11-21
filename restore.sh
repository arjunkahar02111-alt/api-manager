#!/usr/bin/env bash
# ==============================================================================
# KARVION API MANAGER — DISASTER RECOVERY & SYSTEM RESTORE SCRIPT
# Usage: sudo ./restore.sh <path_to_karvion_backup.tar.gz>
# Target Host: api.karviontechnologies.in
# Author: Karvion Technologies (Arjun Kahar)
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

if [[ $# -lt 1 ]]; then
    echo -e "${RED}[ERROR] Missing backup archive path.${NC}" >&2
    echo "Usage: $0 /var/backups/arjun/karvion_backup_YYYYMMDD_HHMMSS.tar.gz" >&2
    exit 1
fi

ARCHIVE_PATH="$1"
if [[ ! -f "${ARCHIVE_PATH}" ]]; then
    echo -e "${RED}[ERROR] Backup file not found: ${ARCHIVE_PATH}${NC}" >&2
    exit 1
fi

RESTORE_TMP="/tmp/karvion_restore_$(date +%s)"
APP_DIR="/var/www/arjun-api-manager"
MONGO_URI="${MONGODB_URI:-mongodb://127.0.0.1:27017/arjun_api_manager}"

echo "=========================================================================="
echo -e "${YELLOW}>>> WARNING: KARVION API MANAGER DISASTER RECOVERY RESTORE <<<${NC}"
echo "=========================================================================="
echo "This operation will OVERWRITE existing MongoDB collections and micro-applications"
echo "with data from: ${ARCHIVE_PATH}"
echo ""
read -p "Are you absolutely sure you want to proceed? Type 'RESTORE' to confirm: " CONFIRM

if [[ "${CONFIRM}" != "RESTORE" ]]; then
    echo "Restore aborted by user."
    exit 0
fi

mkdir -p "${RESTORE_TMP}"
echo ">>> [1/4] Extracting backup archive..."
tar -xzf "${ARCHIVE_PATH}" -C "${RESTORE_TMP}"

SNAPSHOT_DIR=$(find "${RESTORE_TMP}" -mindepth 1 -maxdepth 1 -type d | head -n 1)

# 1. Restore MongoDB
if [[ -f "${SNAPSHOT_DIR}/mongodb_dump.gz" ]]; then
    echo ">>> [2/4] Restoring MongoDB collections from snapshot..."
    mongorestore --uri="${MONGO_URI}" --gzip --archive="${SNAPSHOT_DIR}/mongodb_dump.gz" --drop
    echo ">>> MongoDB restored successfully."
fi

# 2. Restore Redis
if [[ -f "${SNAPSHOT_DIR}/redis_dump.rdb" ]]; then
    echo ">>> Restoring Redis dump..."
    systemctl stop redis-server || true
    cp "${SNAPSHOT_DIR}/redis_dump.rdb" /var/lib/redis/dump.rdb
    chown redis:redis /var/lib/redis/dump.rdb || true
    systemctl start redis-server || true
fi

# 3. Restore Micro-Applications
if [[ -f "${SNAPSHOT_DIR}/deployments.tar.gz" ]]; then
    echo ">>> [3/4] Restoring micro-applications and workspace..."
    mkdir -p "${APP_DIR}"
    tar -xzf "${SNAPSHOT_DIR}/deployments.tar.gz" -C "${APP_DIR}"
    echo ">>> Micro-application deployments restored."
fi

# Clean up
rm -rf "${RESTORE_TMP}"

# 4. Restart Services
echo ">>> [4/4] Restarting PM2 processes..."
pm2 restart all || pm2 start "${APP_DIR}/infrastructure/pm2/ecosystem.config.cjs"

echo "=========================================================================="
echo -e "${GREEN}>>> [SUCCESS] DISASTER RECOVERY RESTORE COMPLETED SUCCESSFULLY! <<<${NC}"
echo "=========================================================================="
