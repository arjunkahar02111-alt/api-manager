#!/usr/bin/env bash
# ==============================================================================
# KARVION API MANAGER — ENTERPRISE DATABASE & ASSET BACKUP SCRIPT
# Retention: 14 Days Rolling
# Target Host: api.karviontechnologies.in
# Author: Karvion Technologies (Arjun Kahar)
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

BACKUP_ROOT="/var/backups/arjun"
DATE_STR=$(date +%Y%m%d_%H%M%S)
BACKUP_TMP="${BACKUP_ROOT}/snapshot_${DATE_STR}"
APP_DIR="/var/www/arjun-api-manager"
MONGO_URI="${MONGODB_URI:-mongodb://127.0.0.1:27017/arjun_api_manager}"
DISCORD_WEBHOOK="https://discord.com/api/webhooks/1471007980484034562/I858won4YW6XqwnhXmGpXu0V3e2R6k5epKbwSCvj4Q72ElLltA51PEaiuJZNBbPIAPWn"

log_info() { echo -e "${CYAN}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

echo "=========================================================================="
echo ">>> KARVION API MANAGER: Starting Production Backup (${DATE_STR}) <<<"
echo "=========================================================================="

mkdir -p "${BACKUP_TMP}"

# 1. MongoDB Backup
log_info "[1/4] Dumping MongoDB collections and indexes..."
if command -v mongodump &>/dev/null; then
    mongodump --uri="${MONGO_URI}" --gzip --archive="${BACKUP_TMP}/mongodb_dump.gz"
    log_success "MongoDB dump created."
else
    log_warn "mongodump binary not found. Skipping direct MongoDB snapshot."
fi

# 2. Redis State Backup
log_info "[2/4] Saving Redis snapshot..."
if command -v redis-cli &>/dev/null; then
    redis-cli bgsave >/dev/null 2>&1 || true
    sleep 2
    if [[ -f /var/lib/redis/dump.rdb ]]; then
        cp /var/lib/redis/dump.rdb "${BACKUP_TMP}/redis_dump.rdb"
        log_success "Redis dump.rdb copied."
    fi
fi

# 3. Micro-Applications & Deployment Archives
log_info "[3/4] Archiving customer micro-app deployments and secure configuration..."
if [[ -d "${APP_DIR}/deployments" ]]; then
    tar -czf "${BACKUP_TMP}/deployments.tar.gz" -C "${APP_DIR}" deployments 2>/dev/null || true
fi
if [[ -f "${APP_DIR}/.env" ]]; then
    cp "${APP_DIR}/.env" "${BACKUP_TMP}/config.env"
fi

# Package Master Tarball
FINAL_ARCHIVE="${BACKUP_ROOT}/karvion_backup_${DATE_STR}.tar.gz"
tar -czf "${FINAL_ARCHIVE}" -C "${BACKUP_ROOT}" "snapshot_${DATE_STR}"
rm -rf "${BACKUP_TMP}"

# 4. Prune Backups Older Than 14 Days
log_info "[4/4] Pruning backup snapshots older than 14 days..."
PRUNED_COUNT=$(find "${BACKUP_ROOT}" -name "karvion_backup_*.tar.gz" -type f -mtime +14 | wc -l)
find "${BACKUP_ROOT}" -name "karvion_backup_*.tar.gz" -type f -mtime +14 -delete
log_info "Cleaned up ${PRUNED_COUNT} expired archive(s)."

ARCHIVE_SIZE=$(du -sh "${FINAL_ARCHIVE}" | cut -f1)
log_success "Master backup archive generated: ${FINAL_ARCHIVE} (${ARCHIVE_SIZE})"

# Send Discord Notification
if [[ -n "${DISCORD_WEBHOOK}" ]]; then
    curl -s -X POST -H "Content-Type: application/json" -d "{
        \"embeds\": [{
            \"title\": \"🛡️ KARVION API MANAGER — Backup Snapshot Created\",
            \"description\": \"Automated enterprise database, micro-apps, and configuration snapshot completed.\",
            \"color\": 1129344,
            \"fields\": [
                {\"name\": \"Archive File\", \"value\": \"karvion_backup_${DATE_STR}.tar.gz\", \"inline\": true},
                {\"name\": \"Size\", \"value\": \"${ARCHIVE_SIZE}\", \"inline\": true},
                {\"name\": \"Server\", \"value\": \"api.karviontechnologies.in\", \"inline\": true},
                {\"name\": \"Retention\", \"value\": \"14 Days Rolling\", \"inline\": true}
            ],
            \"footer\": {\"text\": \"Karvion Automated Disaster Recovery Agent\"},
            \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
        }]
    }" "${DISCORD_WEBHOOK}" > /dev/null 2>&1 || true
fi

echo "=========================================================================="
echo -e "${GREEN}>>> [SUCCESS] BACKUP COMPLETED: ${FINAL_ARCHIVE} <<<${NC}"
echo "=========================================================================="
