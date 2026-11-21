# KARVION API MANAGER — PRODUCTION VPS DEPLOYMENT REPORT

**Platform Domain:** `https://api.karviontechnologies.in`  
**Host Architecture:** Ubuntu 24.04 LTS (x86_64)  
**Process Supervisor:** PM2 Cluster  
**Reverse Proxy:** Nginx with Let's Encrypt TLS 1.3  

---

## 1. SERVICES INVENTORY

| Process Name | Port | Supervisor | Health Check URL |
|---|---|---|---|
| `arjun-backend` | 3000 | PM2 (Fork) | `http://127.0.0.1:3000/health` |
| `arjun-gateway` | 3001 | PM2 (Cluster Mode) | `http://127.0.0.1:3001/health` |
| `arjun-worker` | - | PM2 (Fork) | N/A (Queue Consumer) |
| `nginx` | 80, 443 | Systemd | `https://api.karviontechnologies.in/health` |
| `mongodb` | 27017 | Systemd | `127.0.0.1:27017` |
| `redis` | 6379 | Systemd | `127.0.0.1:6379` |

---

## 2. PRODUCTION ZERO-DOWNTIME UPDATE PROCEDURE

Run on the VPS terminal:

```bash
cd /var/www/arjun-api-manager
git pull origin main
pnpm install --config.strict-dep-builds=false
pnpm run build
pm2 reload infrastructure/pm2/ecosystem.config.cjs --update-env
pm2 save
bash scripts/post-deploy-verify.sh
```

---

## 3. POST-DEPLOYMENT VERIFICATION CHECKS

1. Local Backend responds `HTTP 200 OK` with `status: healthy`.
2. Local Gateway responds `HTTP 200 OK` with `status: healthy`.
3. PM2 processes `arjun-backend` and `arjun-gateway` report `online`.
4. Nginx configuration syntax tests `OK`.
5. Public domain `https://api.karviontechnologies.in/health` returns `HTTP 200 OK`.
6. Gateway recognizes vehicle intelligence alias `/v1/vehicle2-n`.
