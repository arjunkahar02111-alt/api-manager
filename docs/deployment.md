# ARJUN API MANAGER — PRODUCTION DEPLOYMENT GUIDE

## VPS Specifications
- **Operating System:** Ubuntu 24.04 LTS
- **Hardware:** 4 CPU Cores, 8 GB RAM, 80+ GB SSD
- **Canonical Domain:** `api.karviontechnologies.in`

---

## 1. Initial VPS Setup & Port Inspection
Verify that ports 80 and 443 are free from conflicting web servers before starting:

```bash
sudo ss -tulpn | grep -E ':(80|443)'
```

---

## 2. Docker & Docker Compose Installation
Install Docker on Ubuntu 24.04:

```bash
sudo apt update && sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

---

## 3. Directory Layout on VPS
```bash
sudo mkdir -p /var/lib/arjun/mongodb
sudo mkdir -p /var/lib/arjun/redis
sudo mkdir -p /var/lib/arjun/prometheus
sudo mkdir -p /var/lib/arjun/grafana
sudo mkdir -p /var/www/certbot
sudo mkdir -p /var/log/nginx
```

---

## 4. Let's Encrypt SSL Certificate Generation
Run standalone Certbot to obtain valid SSL certificates for `api.karviontechnologies.in`:

```bash
sudo certbot certonly --standalone -d api.karviontechnologies.in --email admin@karviontechnologies.in --agree-tos --non-interactive
```

Verify certificates:
```bash
sudo ls -la /etc/letsencrypt/live/api.karviontechnologies.in/
# Expect: fullchain.pem and privkey.pem
```

---

## 5. Configure Production Environment (.env)
```bash
cp .env.example .env
nano .env
```
Ensure secrets are securely generated:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 6. Launch Services
Deploy the full stack using Docker Compose:

```bash
docker compose -f docker-compose.production.yml up -d --build
```

---

## 7. Verify Health & Running Containers
```bash
docker compose -f docker-compose.production.yml ps
curl -i https://api.karviontechnologies.in/health
```
