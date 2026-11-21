#!/usr/bin/env bash
# ==============================================================================
# KARVION API MANAGER — ZERO-DOWNTIME UPDATE SCRIPT
# Domain: https://api.karviontechnologies.in
# Author: Karvion Technologies (Arjun Kahar)
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

APP_DIR="/var/www/arjun-api-manager"
DISCORD_WEBHOOK="https://discord.com/api/webhooks/1471007980484034562/I858won4YW6XqwnhXmGpXu0V3e2R6k5epKbwSCvj4Q72ElLltA51PEaiuJZNBbPIAPWn"

log_info() { echo -e "${CYAN}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

echo "=========================================================================="
echo ">>> KARVION API MANAGER: Starting Zero-Downtime Application Update <<<"
echo "=========================================================================="

if [[ -d "${APP_DIR}" ]]; then
    cd "${APP_DIR}"
fi

# 1. Pull Git Repository Updates if Git is present
if [[ -d .git ]]; then
    log_info "Fetching latest source code from git repository..."
    git fetch --all
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    git reset --hard "origin/${CURRENT_BRANCH}"
    log_success "Source code updated to latest commit on branch ${CURRENT_BRANCH}."
else
    log_info "No .git repository directory found. Recompiling existing codebase in place."
fi

# 2. Install Monorepo Dependencies
log_info "Updating Node.js monorepo dependencies..."
git config --global --add safe.directory '*' >/dev/null 2>&1 || true
pnpm config set strict-dep-builds false >/dev/null 2>&1 || true
pnpm config set ignore-scripts false >/dev/null 2>&1 || true
pnpm install --config.strict-dep-builds=false

# 3. Compile Packages & TypeScript
log_info "Compiling all monorepo packages, frontend, backend, gateway, and worker..."
pnpm run build
log_success "Monorepo build completed with 0 errors."

# 4. Zero-Downtime Reload with PM2
log_info "Reloading PM2 application processes gracefully with zero downtime..."
pm2 reload infrastructure/pm2/ecosystem.config.cjs --update-env
pm2 save
log_success "PM2 cluster processes reloaded."

# 5. Sync and Reload Nginx
if command -v nginx &>/dev/null; then
    log_info "Synchronizing and reloading Nginx configuration..."
    if [[ -d /etc/nginx/sites-available ]]; then
        cp infrastructure/nginx/api.karviontechnologies.in.conf /etc/nginx/sites-available/api.karviontechnologies.in.conf || true
        ln -sf /etc/nginx/sites-available/api.karviontechnologies.in.conf /etc/nginx/sites-enabled/ || true
    fi
    nginx -t && systemctl reload nginx
fi

# 6. Post-Update Health Probe
sleep 3
if [[ -f scripts/post-deploy-verify.sh ]]; then
    chmod +x scripts/post-deploy-verify.sh
    bash scripts/post-deploy-verify.sh || true
fi

BACKEND_OK=$(curl -s http://127.0.0.1:3000/health | grep -c '"status":"healthy"' || true)
GATEWAY_OK=$(curl -s http://127.0.0.1:3001/health | grep -c '"status":"healthy"' || true)

if [[ "${BACKEND_OK}" -eq 1 && "${GATEWAY_OK}" -eq 1 ]]; then
    log_success "All application services verified healthy after reload."
    UPDATE_STATUS="SUCCESS"
else
    log_warn "One or more services did not return healthy status immediately. Please check 'pm2 status'."
    UPDATE_STATUS="WARNING"
fi

# 7. Discord Webhook Notification
if [[ -n "${DISCORD_WEBHOOK}" ]]; then
    curl -s -X POST -H "Content-Type: application/json" -d "{
        \"embeds\": [{
            \"title\": \"🔄 KARVION API MANAGER — Application Updated\",
            \"description\": \"Zero-downtime production update completed on VPS.\",
            \"color\": 436400,
            \"fields\": [
                {\"name\": \"Status\", \"value\": \"${UPDATE_STATUS}\", \"inline\": true},
                {\"name\": \"Domain\", \"value\": \"https://api.karviontechnologies.in\", \"inline\": true},
                {\"name\": \"Timestamp\", \"value\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\", \"inline\": true}
            ],
            \"footer\": {\"text\": \"Karvion Continuous Deployment Supervisor\"}
        }]
    }" "${DISCORD_WEBHOOK}" > /dev/null 2>&1 || true
fi

echo "=========================================================================="
echo -e "${GREEN}>>> [COMPLETE] KARVION API MANAGER UPDATE FINISHED! <<<${NC}"
echo "=========================================================================="
