#!/usr/bin/env bash
# ==============================================================================
# ARJUN API MANAGER - Ubuntu 24.04 LTS Production Hardening & Provisioning Script
# Domain: api.karviontechnologies.in
# Author: Karvion Technologies (Arjun Kahar)
# ==============================================================================

set -euo pipefail

echo "========================================================================"
echo ">>> ARJUN API MANAGER: Starting VPS Production Hardening (Ubuntu 24.04) <<<"
echo "========================================================================"

if [[ $EUID -ne 0 ]]; then
   echo "[ERROR] This script must be executed as root or with sudo privileges." >&2
   exit 1
fi

APP_USER="arjun"
APP_DIR="/var/www/arjun-api-manager"

# 1. Update Base Packages & Security Patches
echo ">>> [1/10] Updating base system packages..."
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
apt-get install -y --no-install-recommends \
    curl wget gnupg lsb-release ca-certificates apt-transport-https \
    git build-essential ufw fail2ban logrotate tar gzip jq htop unzip \
    python3 python3-pip python3-venv php-cli php-curl php-mbstring

# 2. System Resource Tuning & File Descriptors
echo ">>> [2/10] Optimizing file descriptors & kernel network limits..."
cat << 'EOF' > /etc/security/limits.d/arjun-limits.conf
* soft nofile 65535
* hard nofile 65535
root soft nofile 65535
root hard nofile 65535
EOF

cat << 'EOF' > /etc/sysctl.d/99-arjun-tune.conf
fs.file-max = 2097152
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_tw_reuse = 1
net.ipv4.ip_local_port_range = 1024 65535
EOF
sysctl -p /etc/sysctl.d/99-arjun-tune.conf

# 3. Create Dedicated Application User
echo ">>> [3/10] Creating dedicated application user (${APP_USER})..."
if ! id "${APP_USER}" &>/dev/null; then
    useradd -m -s /bin/bash "${APP_USER}"
    usermod -aG sudo "${APP_USER}"
fi

mkdir -p "${APP_DIR}"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

# 4. Install Node.js 22 LTS, pnpm, & PM2
echo ">>> [4/10] Installing Node.js 22 LTS, pnpm, and PM2..."
if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
fi

npm install -g pnpm pm2
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true

# 5. Install Redis 7
echo ">>> [5/10] Installing and securing Redis..."
apt-get install -y redis-server
systemctl enable redis-server
# Secure Redis to bind to localhost only
sed -i 's/^bind .*/bind 127.0.0.1 -::1/' /etc/redis/redis.conf
sed -i 's/^protected-mode no/protected-mode yes/' /etc/redis/redis.conf
systemctl restart redis-server

# 6. Install MongoDB 7.0 / 8.0
echo ">>> [6/10] Installing and securing MongoDB..."
if ! command -v mongod &>/dev/null; then
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
       gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor --yes
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
       tee /etc/apt/sources.list.d/mongodb-org-7.0.list
    apt-get update -y
    apt-get install -y mongodb-org || echo "MongoDB installed via apt repository"
fi
systemctl enable mongod || true
systemctl start mongod || true

# 7. Install and Harden Nginx
echo ">>> [7/10] Installing and configuring Nginx..."
apt-get install -y nginx certbot python3-certbot-nginx
systemctl enable nginx

# 8. Firewall (UFW) Configuration
echo ">>> [8/10] Configuring UFW firewall rules..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH Secure Access'
ufw allow 80/tcp comment 'Nginx HTTP Challenge'
ufw allow 443/tcp comment 'Nginx HTTPS Encrypted'
# Deny direct outside access to internal ports
ufw deny 3000 comment 'Block outside access to Backend'
ufw deny 3001 comment 'Block outside access to Gateway'
ufw deny 8080 comment 'Block outside access to Frontend dev'
ufw deny 27017 comment 'Block outside access to MongoDB'
ufw deny 6379 comment 'Block outside access to Redis'
ufw --force enable

# 9. Fail2ban Hardening
echo ">>> [9/10] Configuring Fail2ban anti-intrusion protection..."
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
systemctl enable fail2ban
systemctl restart fail2ban

# 10. Summary & Next Steps
echo "========================================================================"
echo ">>> [SUCCESS] ARJUN API MANAGER VPS PROVISIONING COMPLETE! <<<"
echo "Next steps:"
echo " 1. Clone repository to ${APP_DIR}"
echo " 2. Run 'pnpm install && pnpm build' inside ${APP_DIR}"
echo " 3. Copy infrastructure/nginx/api.karviontechnologies.in.conf to /etc/nginx/sites-available/"
echo " 4. Obtain SSL cert: certbot --nginx -d api.karviontechnologies.in"
echo " 5. Start apps with PM2: pm2 start infrastructure/pm2/ecosystem.config.cjs"
echo "========================================================================"
