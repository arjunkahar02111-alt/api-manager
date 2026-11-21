#!/usr/bin/env bash
# ==============================================================================
# ARJUN API MANAGER — ONE-CLICK AUTOMATED VPS DEPLOYMENT
# Canonical Domain: https://api.karviontechnologies.in
# Supported OS: Ubuntu 24.04 LTS, Ubuntu 22.04 LTS, Debian 12
# ==============================================================================

set -e

echo "========================================================================"
echo "    ARJUN API MANAGER — AUTOMATED VPS DEPLOYMENT ENGINE"
echo "========================================================================"

# 1. Verify root or sudo access
if [ "$EUID" -ne 0 ]; then
  echo "[!] Please run with sudo: sudo bash deploy.sh"
  exit 1
fi

# 2. Check and install Docker & Docker Compose if missing
if ! command -v docker &> /dev/null; then
  echo "[+] Docker not found. Installing Docker Engine..."
  curl -fsSL https://get.docker.com -o get-docker.sh
  sh get-docker.sh
  rm -f get-docker.sh
  systemctl enable --now docker
  echo "[+] Docker installed successfully."
fi

if ! docker compose version &> /dev/null; then
  echo "[+] Installing Docker Compose plugin..."
  apt-get update && apt-get install -y docker-compose-plugin
fi

# 3. Create .env if not exists
if [ ! -f .env ]; then
  echo "[+] Generating production cryptographic secrets..."
  ADMIN_SECRET=$(openssl rand -hex 32)
  CUSTOMER_SECRET=$(openssl rand -hex 32)
  DATA_KEY=$(openssl rand -hex 32)

  cat > .env <<EOF
NODE_ENV=production
DOMAIN=api.karviontechnologies.in
SUPER_ADMIN_USERNAME=admin
SUPER_ADMIN_PASSWORD=AdminStrongSecurePassword2026!
SUPER_ADMIN_EMAIL=admin@karviontechnologies.in
JWT_ADMIN_SECRET=${ADMIN_SECRET}
JWT_CUSTOMER_SECRET=${CUSTOMER_SECRET}
DATA_ENCRYPTION_KEY=${DATA_KEY}
MONGODB_URI=mongodb://mongodb:27017/arjun_api_manager
REDIS_HOST=redis
REDIS_PORT=6379
EOF
  echo "[+] Production .env file created."
fi

# 4. Stop any existing conflicting containers
echo "[+] Building and launching Arjun API Manager containers..."
docker compose down --remove-orphans 2>/dev/null || true
docker compose up -d --build

# 5. Wait for services to be ready
echo "[+] Waiting for database and services to initialize..."
sleep 8

for i in {1..30}; do
  if curl -sf http://localhost/health > /dev/null; then
    echo "[+] System services are healthy and running!"
    break
  fi
  sleep 2
done

SERVER_IP=$(curl -s https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo "========================================================================"
echo "    ARJUN API MANAGER IS LIVE & OPERATIONAL ON YOUR VPS!"
echo "========================================================================"
echo "    Super Admin Dashboard:  http://${SERVER_IP} or https://api.karviontechnologies.in"
echo "    Public API Gateway:     http://${SERVER_IP}/v1"
echo "    Backend Health Check:   http://${SERVER_IP}/health"
echo "------------------------------------------------------------------------"
echo "    Default Super Admin Credentials:"
echo "      Username: admin"
echo "      Password: AdminStrongSecurePassword2026!"
echo "========================================================================"
