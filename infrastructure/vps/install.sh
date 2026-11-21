#!/usr/bin/env bash
# ==============================================================================
# KARVION API MANAGER — MASTER PRODUCTION INSTALLER (Ubuntu 24.04 LTS)
# Target Domain: https://api.karviontechnologies.in
# Author: Karvion Technologies (Arjun Kahar)
# Single-Command Idempotent Enterprise Deployment Script
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

APP_NAME="arjun-api-manager"
APP_USER="arjun"
INSTALL_DIR="/var/www/${APP_NAME}"
CANONICAL_DOMAIN="api.karviontechnologies.in"
BACKUP_DIR="/var/backups/arjun"
LOG_DIR="/var/log/arjun"
DISCORD_WEBHOOK="https://discord.com/api/webhooks/1471007980484034562/I858won4YW6XqwnhXmGpXu0V3e2R6k5epKbwSCvj4Q72ElLltA51PEaiuJZNBbPIAPWn"

banner() {
    echo -e "${PURPLE}"
    echo "=========================================================================="
    echo "   ██╗  ██╗ █████╗ ██████╗ ██╗   ██╗██╗ ██████╗ ███╗   ██╗"
    echo "   ██║ ██╔╝██╔══██╗██╔══██╗██║   ██║██║██╔═══██╗████╗  ██║"
    echo "   █████╔╝ ███████║██████╔╝██║   ██║██║██║   ██║██╔██╗ ██║"
    echo "   ██╔═██╗ ██╔══██║██╔══██╗╚██╗ ██╔╝██║██║   ██║██║╚██╗██║"
    echo "   ██║  ██╗██║  ██║██║  ██║ ╚████╔╝ ██║╚██████╔╝██║ ╚████║"
    echo "   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝"
    echo "              TECHNOLOGIES — API MANAGER PRODUCTION DEPLOYMENT           "
    echo "                   Canonical Host: ${CANONICAL_DOMAIN}                  "
    echo "=========================================================================="
    echo -e "${NC}"
}

log_info() { echo -e "${CYAN}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

# ==============================================================================
# PHASE 1: PRE-FLIGHT SYSTEM VERIFICATION
# ==============================================================================
phase1_preflight() {
    log_info "==> Phase 1/7: Running Pre-Flight Environment Checks..."

    # Check EUID
    if [[ $EUID -ne 0 ]]; then
        log_error "This installer must be run with root privileges (sudo bash install.sh)."
        exit 1
    fi

    # Check OS distribution
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        log_info "Detected Operating System: ${NAME} ${VERSION_ID}"
        if [[ "${ID}" != "ubuntu" && "${ID_LIKE:-}" != *"debian"* ]]; then
            log_warn "This installer is optimized for Ubuntu 24.04 LTS. Proceeding with caution on ${NAME}."
        fi
    else
        log_warn "Unable to detect OS distribution from /etc/os-release."
    fi

    # Hardware resource checks
    TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    TOTAL_RAM_MB=$((TOTAL_RAM_KB / 1024))
    CPU_CORES=$(nproc)
    DISK_AVAIL_KB=$(df -P / | tail -1 | awk '{print $4}')
    DISK_AVAIL_GB=$((DISK_AVAIL_KB / 1024 / 1024))

    log_info "Hardware Profile: ${TOTAL_RAM_MB}MB RAM, ${CPU_CORES} CPU Core(s), ${DISK_AVAIL_GB}GB Free Disk Space."

    # Minimum checks
    if [[ ${DISK_AVAIL_GB} -lt 10 ]]; then
        log_error "Insufficient disk space: at least 10GB free required, found ${DISK_AVAIL_GB}GB."
        exit 1
    fi

    # Swap setup if < 2GB
    SWAP_TOTAL_KB=$(grep SwapTotal /proc/meminfo | awk '{print $2}')
    if [[ ${SWAP_TOTAL_KB} -lt 2000000 ]]; then
        log_info "Configuring 2GB swap space for peak compilation and cache stability..."
        if [[ ! -f /swapfile ]]; then
            fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
            chmod 600 /swapfile
            mkswap /swapfile
            swapon /swapfile
            if ! grep -q '/swapfile' /etc/fstab; then
                echo '/swapfile none swap sw 0 0' >> /etc/fstab
            fi
            log_success "2GB swap file created and mounted successfully."
        else
            swapon /swapfile || true
        fi
    fi

    mkdir -p "${BACKUP_DIR}" "${LOG_DIR}"
    log_success "Phase 1 Pre-Flight validation passed."
}

# ==============================================================================
# PHASE 2: SYSTEM HARDENING & DEPENDENCIES
# ==============================================================================
phase2_system_hardening() {
    log_info "==> Phase 2/7: Installing System Packages & Enterprise OS Hardening..."

    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y --no-install-recommends \
        curl wget gnupg lsb-release ca-certificates apt-transport-https \
        git build-essential ufw fail2ban logrotate tar gzip jq htop unzip \
        python3 python3-pip python3-venv php-cli php-curl php-mbstring

    # 1. Kernel Network Tuning
    log_info "Applying Linux kernel network throughput optimizations..."
    cat << 'EOF' > /etc/security/limits.d/arjun-limits.conf
* soft nofile 65535
* hard nofile 65535
root soft nofile 65535
root hard nofile 65535
arjun soft nofile 65535
arjun hard nofile 65535
EOF

    cat << 'EOF' > /etc/sysctl.d/99-arjun-tune.conf
fs.file-max = 2097152
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_tw_reuse = 1
net.ipv4.ip_local_port_range = 1024 65535
vm.swappiness = 10
vm.vfs_cache_pressure = 50
EOF
    sysctl -p /etc/sysctl.d/99-arjun-tune.conf >/dev/null 2>&1 || true

    # 2. UFW Firewall Configuration
    log_info "Configuring enterprise UFW firewall policies..."
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow 22/tcp comment 'SSH Remote Access'
    ufw allow 80/tcp comment 'Nginx HTTP Challenge'
    ufw allow 443/tcp comment 'Nginx HTTPS Encrypted'
    # Explicitly deny outside access to internal microservices
    ufw deny 3000 comment 'Internal Backend Port'
    ufw deny 3001 comment 'Internal Gateway Port'
    ufw deny 8080 comment 'Internal Dev Port'
    ufw deny 6379 comment 'Internal Redis Port'
    ufw deny 27017 comment 'Internal MongoDB Port'
    ufw --force enable

    # 3. Fail2ban Intrusion Defense
    log_info "Configuring Fail2ban SSH and web intrusion filters..."
    cat << 'EOF' > /etc/fail2ban/jail.local
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port = ssh
maxretry = 3

[nginx-http-auth]
enabled = true
port = http,https
EOF
    systemctl enable fail2ban >/dev/null 2>&1 || true
    systemctl restart fail2ban >/dev/null 2>&1 || true

    log_success "Phase 2 System Hardening completed."
}

# ==============================================================================
# PHASE 3: RUNTIME ENGINES INSTALLATION (Node 22, Redis 7, Mongo 7, Nginx)
# ==============================================================================
phase3_runtime_engines() {
    log_info "==> Phase 3/7: Installing and Securing Runtime Engines..."

    # 1. Node.js 22 LTS & pnpm
    if ! command -v node &>/dev/null || [[ $(node -v | cut -d'.' -f1) != "v22" ]]; then
        log_info "Installing Node.js 22.x LTS..."
        apt-mark unhold nodejs 2>/dev/null || true
        curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
        apt-get install -y --allow-change-held-packages nodejs || apt-get install -y nodejs
    fi
    npm install -g pnpm pm2
    log_success "Node.js $(node -v), npm $(npm -v), pnpm $(pnpm -v) installed."

    # Configure PM2 logrotate
    pm2 install pm2-logrotate >/dev/null 2>&1 || true
    pm2 set pm2-logrotate:max_size 50M >/dev/null 2>&1 || true
    pm2 set pm2-logrotate:retain 14 >/dev/null 2>&1 || true
    pm2 set pm2-logrotate:compress true >/dev/null 2>&1 || true

    # 2. Redis 7
    log_info "Configuring Redis cache and real-time state engine..."
    apt-get install -y redis-server
    # Harden Redis to loopback interface only
    sed -i 's/^bind .*/bind 127.0.0.1 -::1/' /etc/redis/redis.conf
    sed -i 's/^protected-mode no/protected-mode yes/' /etc/redis/redis.conf
    systemctl enable redis-server >/dev/null 2>&1 || true
    systemctl restart redis-server

    # 3. MongoDB 8.0 / 7.0 Community Edition
    log_info "Configuring MongoDB database engine..."
    if ! command -v mongod &>/dev/null; then
        UBUNTU_CODENAME=$(lsb_release -cs)
        if [[ "${UBUNTU_CODENAME}" == "noble" ]]; then
            curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | \
                gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor --yes
            echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" | \
                tee /etc/apt/sources.list.d/mongodb-org-8.0.list
            apt-get update -y
            apt-get install -y mongodb-org || {
                log_warn "Standard mongodb-org 8.0 installation warning. Trying 7.0 fallback..."
                curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
                    gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor --yes
                echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
                    tee /etc/apt/sources.list.d/mongodb-org-7.0.list
                apt-get update -y
                apt-get install -y mongodb-org || true
            }
        else
            curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
                gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor --yes
            echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu ${UBUNTU_CODENAME}/mongodb-org/7.0 multiverse" | \
                tee /etc/apt/sources.list.d/mongodb-org-7.0.list
            apt-get update -y
            apt-get install -y mongodb-org || true
        fi
    fi
    systemctl daemon-reload >/dev/null 2>&1 || true
    systemctl enable mongod >/dev/null 2>&1 || true
    systemctl start mongod || true

    # 4. Nginx and Certbot
    log_info "Installing Nginx web server and Certbot..."
    apt-get install -y nginx certbot python3-certbot-nginx
    systemctl enable nginx >/dev/null 2>&1 || true

    log_success "Phase 3 Runtime Engines configured."
}

# ==============================================================================
# PHASE 4: APPLICATION PROVISIONING & MONOREPO COMPILATION
# ==============================================================================
phase4_app_setup() {
    log_info "==> Phase 4/7: Setting Up Karvion Application & Building Packages..."

    # Create dedicated user
    if ! id "${APP_USER}" &>/dev/null; then
        log_info "Creating dedicated application user '${APP_USER}'..."
        useradd -m -s /bin/bash "${APP_USER}"
        usermod -aG sudo "${APP_USER}"
    fi

    # Determine execution source directory
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    
    mkdir -p "${INSTALL_DIR}"

    # If executing from a distinct location, copy code to target directory
    if [[ "${SCRIPT_DIR}" != "${INSTALL_DIR}" ]]; then
        log_info "Syncing repository from ${SCRIPT_DIR} to ${INSTALL_DIR}..."
        rsync -a --delete --exclude 'node_modules' --exclude '.git' --exclude 'dist' "${SCRIPT_DIR}/" "${INSTALL_DIR}/"
    fi

    cd "${INSTALL_DIR}"

    # Generate secure production .env if not exists
    if [[ ! -f .env ]]; then
        log_info "Generating production .env configuration with cryptographically secure keys..."
        cp .env.example .env
        
        # Generate random secrets
        ADMIN_SECRET=$(openssl rand -hex 32)
        CUSTOMER_SECRET=$(openssl rand -hex 32)
        ENCRYPTION_KEY=$(openssl rand -hex 32)
        COOKIE_SECRET=$(openssl rand -hex 32)

        sed -i "s|replace_with_64_char_crypto_random_secret_for_admin_jwt|${ADMIN_SECRET}|g" .env
        sed -i "s|replace_with_64_char_crypto_random_secret_for_customer_jwt|${CUSTOMER_SECRET}|g" .env
        sed -i "s|replace_with_32_byte_hex_key_for_aes_256_gcm_secret_storage|${ENCRYPTION_KEY}|g" .env
        sed -i "s|replace_with_crypto_random_cookie_signing_secret|${COOKIE_SECRET}|g" .env
        sed -i "s|mongodb://mongodb:27017/arjun_api_manager|mongodb://127.0.0.1:27017/arjun_api_manager|g" .env
        sed -i "s|REDIS_HOST=redis|REDIS_HOST=127.0.0.1|g" .env
        log_success "Production secrets generated and saved to .env."
    fi

    # Install dependencies & build
    log_info "Installing monorepo dependencies via pnpm..."
    chown -R "${APP_USER}:${APP_USER}" "${INSTALL_DIR}"
    sudo -u "${APP_USER}" env "PATH=$PATH" pnpm install

    log_info "Compiling all TypeScript packages, frontend, backend, gateway, and worker..."
    sudo -u "${APP_USER}" env "PATH=$PATH" pnpm run build

    # Create micro-app hosting directory
    mkdir -p "${INSTALL_DIR}/deployments"
    chown -R "${APP_USER}:${APP_USER}" "${INSTALL_DIR}/deployments"

    log_success "Phase 4 Application setup and build complete."
}

# ==============================================================================
# PHASE 5: NGINX REVERSE PROXY & SSL AUTOMATION
# ==============================================================================
phase5_nginx_ssl() {
    log_info "==> Phase 5/7: Configuring Nginx Reverse Proxy & SSL Certificates..."

    mkdir -p /var/www/certbot
    mkdir -p /etc/letsencrypt/live/${CANONICAL_DOMAIN}

    # Generate temporary self-signed certificate if Let's Encrypt certificate not yet active
    # This prevents Nginx startup failure on fresh installations before DNS propagation
    if [[ ! -f /etc/letsencrypt/live/${CANONICAL_DOMAIN}/fullchain.pem ]]; then
        log_info "Generating temporary self-signed SSL certificate for initial Nginx binding..."
        openssl req -x509 -nodes -days 30 -newkey rsa:2048 \
            -keyout /etc/letsencrypt/live/${CANONICAL_DOMAIN}/privkey.pem \
            -out /etc/letsencrypt/live/${CANONICAL_DOMAIN}/fullchain.pem \
            -subj "/C=IN/ST=Maharashtra/L=Mumbai/O=Karvion Technologies/CN=${CANONICAL_DOMAIN}" >/dev/null 2>&1 || true
    fi

    # Deploy canonical Nginx configuration
    cp "${INSTALL_DIR}/infrastructure/nginx/api.karviontechnologies.in.conf" /etc/nginx/sites-available/api.karviontechnologies.in.conf
    ln -sf /etc/nginx/sites-available/api.karviontechnologies.in.conf /etc/nginx/sites-enabled/api.karviontechnologies.in.conf
    rm -f /etc/nginx/sites-enabled/default

    # Test configuration
    if nginx -t; then
        systemctl reload nginx
        log_success "Nginx configuration deployed and validated successfully."
    else
        log_error "Nginx configuration syntax check failed."
        exit 1
    fi

    # Attempt Certbot automatic acquisition if DNS points to this server
    log_info "Checking domain DNS resolution for ${CANONICAL_DOMAIN}..."
    SERVER_IP=$(curl -s https://api.ipify.org || hostname -I | awk '{print $1}')
    DOMAIN_IP=$(dig +short ${CANONICAL_DOMAIN} | tail -n1 || echo "")

    if [[ "${SERVER_IP}" == "${DOMAIN_IP}" && -n "${DOMAIN_IP}" ]]; then
        log_info "DNS matches VPS IP (${SERVER_IP}). Requesting trusted Let's Encrypt SSL certificate..."
        certbot --nginx -d "${CANONICAL_DOMAIN}" --non-interactive --agree-tos -m admin@karviontechnologies.in --redirect || {
            log_warn "Certbot automated request failed. Temporary self-signed certificate remains active."
        }
    else
        log_warn "DNS (${DOMAIN_IP:-unresolved}) does not yet match VPS public IP (${SERVER_IP})."
        log_warn "Temporary self-signed SSL active. Run 'certbot --nginx -d ${CANONICAL_DOMAIN}' once DNS propagates."
    fi

    log_success "Phase 5 Nginx & SSL setup complete."
}

# ==============================================================================
# PHASE 6: PM2 PROCESS SUPERVISION & AUTOSTART
# ==============================================================================
phase6_pm2_processes() {
    log_info "==> Phase 6/7: Starting Backend Services with PM2 Process Manager..."

    cd "${INSTALL_DIR}"
    
    # Stop existing if running
    pm2 delete all >/dev/null 2>&1 || true

    # Start using production ecosystem configuration
    pm2 start infrastructure/pm2/ecosystem.config.cjs

    # Save process list and register systemd service
    pm2 save
    pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

    log_success "Phase 6 PM2 process management configured."
}

# ==============================================================================
# PHASE 7: AUTOMATED HEALTH VERIFICATION & NOTIFICATION
# ==============================================================================
phase7_health_verification() {
    log_info "==> Phase 7/7: Executing Automated End-to-End System Health Probes..."

    sleep 5 # Allow services to warm up

    # 1. MongoDB Check
    MONGO_STATUS="FAIL"
    if mongosh --eval "db.adminCommand('ping')" --quiet &>/dev/null || mongo --eval "db.adminCommand('ping')" --quiet &>/dev/null; then
        MONGO_STATUS="OK"
        log_success "MongoDB service is responsive on 127.0.0.1:27017."
    else
        log_warn "MongoDB ping probe could not be confirmed via CLI. Checking port..."
        if nc -z 127.0.0.1 27017 &>/dev/null; then
            MONGO_STATUS="OK (Port open)"
        fi
    fi

    # 2. Redis Check
    REDIS_STATUS="FAIL"
    if [[ $(redis-cli ping 2>/dev/null) == "PONG" ]]; then
        REDIS_STATUS="OK"
        log_success "Redis cache is responsive (PONG) on 127.0.0.1:6379."
    else
        log_error "Redis ping failed."
    fi

    # 3. Backend HTTP Check
    BACKEND_STATUS="FAIL"
    BACKEND_RESP=$(curl -s http://127.0.0.1:3000/health || echo "{}")
    if echo "${BACKEND_RESP}" | grep -q '"status":"healthy"'; then
        BACKEND_STATUS="OK"
        log_success "Management Backend HTTP /health is healthy on port 3000."
    else
        log_warn "Backend returned: ${BACKEND_RESP}"
    fi

    # 4. Gateway HTTP Check
    GATEWAY_STATUS="FAIL"
    GATEWAY_RESP=$(curl -s http://127.0.0.1:3001/health || echo "{}")
    if echo "${GATEWAY_RESP}" | grep -q '"status":"healthy"'; then
        GATEWAY_STATUS="OK"
        log_success "API Gateway HTTP /health is healthy on port 3001."
    else
        log_warn "Gateway returned: ${GATEWAY_RESP}"
    fi

    # 5. Frontend Build Check
    FRONTEND_STATUS="FAIL"
    if [[ -f "${INSTALL_DIR}/apps/frontend/dist/index.html" ]]; then
        FRONTEND_STATUS="OK"
        log_success "Frontend production bundle verified in apps/frontend/dist/."
    else
        log_error "Frontend dist/index.html missing!"
    fi

    # Discord Webhook Notification
    if [[ -n "${DISCORD_WEBHOOK}" ]]; then
        curl -s -X POST -H "Content-Type: application/json" -d "{
            \"embeds\": [{
                \"title\": \"🚀 KARVION API MANAGER — VPS Deployment Successful\",
                \"description\": \"One-command production deployment completed successfully on Ubuntu 24.04 LTS.\",
                \"color\": 10494192,
                \"fields\": [
                    {\"name\": \"Domain\", \"value\": \"https://${CANONICAL_DOMAIN}\", \"inline\": true},
                    {\"name\": \"Backend (3000)\", \"value\": \"${BACKEND_STATUS}\", \"inline\": true},
                    {\"name\": \"Gateway (3001)\", \"value\": \"${GATEWAY_STATUS}\", \"inline\": true},
                    {\"name\": \"MongoDB (27017)\", \"value\": \"${MONGO_STATUS}\", \"inline\": true},
                    {\"name\": \"Redis (6379)\", \"value\": \"${REDIS_STATUS}\", \"inline\": true},
                    {\"name\": \"Frontend SPA\", \"value\": \"${FRONTEND_STATUS}\", \"inline\": true}
                ],
                \"footer\": {\"text\": \"Karvion Technologies Production Infrastructure\"},
                \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
            }]
        }" "${DISCORD_WEBHOOK}" > /dev/null 2>&1 || true
    fi

    echo ""
    echo -e "${GREEN}==========================================================================${NC}"
    echo -e "${GREEN}>>> KARVION API MANAGER — PRODUCTION DEPLOYMENT COMPLETE! <<<${NC}"
    echo -e "${GREEN}==========================================================================${NC}"
    echo -e "Canonical Domain:       ${CYAN}https://${CANONICAL_DOMAIN}${NC}"
    echo -e "Admin Dashboard:        ${CYAN}https://${CANONICAL_DOMAIN}/admin${NC}"
    echo -e "Default Super Admin:    ${YELLOW}admin${NC} / ${YELLOW}AdminStrongSecurePassword2026!${NC}"
    echo -e "Application Directory:  ${CYAN}${INSTALL_DIR}${NC}"
    echo -e "Service Status Summary: Backend: ${BACKEND_STATUS} | Gateway: ${GATEWAY_STATUS} | Redis: ${REDIS_STATUS} | Mongo: ${MONGO_STATUS}"
    echo ""
    echo -e "Operational Commands:"
    echo -e "  pm2 status                       - View running application processes"
    echo -e "  ./healthcheck.sh                 - Run comprehensive live diagnostics"
    echo -e "  ./backup.sh                      - Create instant database & micro-app snapshot"
    echo -e "  ./update.sh                      - Pull latest code and zero-downtime reload"
    echo -e "  ./diagnostics.sh                 - Export diagnostic logs bundle"
    echo -e "${GREEN}==========================================================================${NC}"
}

# Execution Entry Point
banner
phase1_preflight
phase2_system_hardening
phase3_runtime_engines
phase4_app_setup
phase5_nginx_ssl
phase6_pm2_processes
phase7_health_verification
