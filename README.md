# KARVION API MANAGER — ENTERPRISE API HOSTING & SECURITY PLATFORM

**Canonical Domain:** [https://api.karviontechnologies.in](https://api.karviontechnologies.in)  
**Brand Identity:** Karvion Technologies (Arjun Kahar)  
**Role:** Commercial Production-Grade API Gateway, Management SaaS, Micro-App Host, and Security Firewall  

[![Build & Test](https://img.shields.io/badge/tests-41%20passed-brightgreen.svg)]()
[![Node.js](https://img.shields.io/badge/node.js-v22%20LTS-blue.svg)]()
[![Ubuntu](https://img.shields.io/badge/Ubuntu-24.04%20LTS-orange.svg)]()
[![License](https://img.shields.io/badge/license-Proprietary-purple.svg)]()

---

## 1. ONE-COMMAND PRODUCTION DEPLOYMENT (Ubuntu 24.04 LTS)

You can host and deploy this entire platform on a clean Ubuntu VPS in **one command**:

```bash
# 1. Clone repository
git clone https://github.com/arjunkahar02111-alt/api-manager.git /var/www/arjun-api-manager
cd /var/www/arjun-api-manager

# 2. Run Master Installer (Automates all 7 phases: system hardening, dependencies, build, Nginx, SSL, PM2)
chmod +x install.sh
sudo ./install.sh
```

The master installer automatically sets up:
- Node.js 22 LTS, pnpm, and PM2 with `pm2-logrotate` (14 days rolling).
- Redis 7 (secured loopback binding, in-memory counter engine).
- MongoDB 7.0 (secured loopback binding with automated indexes).
- Nginx TLS 1.3 reverse proxy with Let's Encrypt automated SSL.
- UFW firewall policies (22, 80, 443 open; internal ports blocked).
- Fail2ban intrusion defense filters.
- Micro-application runtime supervisors for Node.js, Python 3, and PHP 8.
- Discord Webhook alerting for incident and backup notifications.

---

## 2. DAY-2 OPERATIONAL SCRIPTS

All system operations can be managed via dedicated single-command scripts in the root directory:

| Task | Command | Description |
| :--- | :--- | :--- |
| **Live Health Probe** | `sudo ./healthcheck.sh` | Comprehensive multi-tier test of CPU, RAM, ports, Mongo, Redis, and HTTP endpoints |
| **Zero-Downtime Update** | `sudo ./update.sh` | Pulls latest git code, installs dependencies, compiles packages, reloads PM2 gracefully |
| **Instant Backup** | `sudo ./backup.sh` | Creates MongoDB gzip dump, Redis RDB snapshot, micro-app tarball & alerts Discord |
| **Disaster Restore** | `sudo ./restore.sh <file.tar.gz>` | Overwrites DB and micro-apps from snapshot archive with safety confirmation |
| **Diagnostics Bundle** | `sudo ./diagnostics.sh` | Generates a compressed diagnostic tarball with system specs, PM2 logs, and Nginx logs |
| **Clean Teardown** | `sudo ./uninstall.sh` | Safely unregisters PM2 processes and Nginx sites while preserving backup archives |

---

## 3. ARCHITECTURE & SERVICE PORTS

- **Frontend SPA:** React 18 + TypeScript + Vite + Tailwind CSS (Vite build served statically by Nginx; dev port `8080`)
- **Backend Management API:** Node.js + TypeScript + Express (Port: `3000` internal, path: `/api/v1/*`)
- **API Gateway Proxy Engine:** Express + Undici + Redis Lua (Port: `3001` internal, path: `/v1/*`)
- **Background Worker:** BullMQ/timer background jobs for account expiration, log retention (90 days), and webhook retries
- **Database:** MongoDB 7.0 (25 Mongoose collections with compound and TTL auto-cleanup indexes)
- **In-Memory Cache & Counters:** Redis 7.0 (Atomic Lua scripts, sub-millisecond anti-sharing checks)
- **Edge Reverse Proxy:** Nginx with Let's Encrypt TLS 1.3 on port `80` and `443`
- **Telemetry & Metrics:** Socket.IO, Server-Sent Events (SSE), and Prometheus (`/metrics`)

---

## 4. SECURITY & ANTI-KEY-SHARING FEATURES

1. **One-User-One-Key Binding:** Each customer receives a cryptographically unique 256-bit API key tied strictly to their account.
2. **One-Way Cryptographic Storage:** Keys are stored as SHA-256 hashes and displayed only once upon generation.
3. **Dynamic IP Lock:** The first verified IP making a request using a key is permanently bound to that key.
4. **Anti-Key-Sharing Guard:** If an authorized key is accessed from a foreign or unauthorized IP, the platform immediately:
   - Suspends the customer account.
   - Revokes active sessions.
   - Adds the foreign IP to the high-speed Redis blacklist set (`arjun:ip_blacklist`).
   - Dispatches a rich embed alert to the administrator Discord webhook.
5. **Anti-SSRF Protection:** Strict hostname DNS resolution and blocking of loopback (`127.0.0.1`), private RFC 1918 subnets (`10.0.0.0/8`, `192.168.0.0/16`), and cloud metadata (`169.254.169.254`).
6. **Device Fingerprinting & Session Security:** Registered device fingerprints, OS/browser recognition, and MongoDB TTL auto-expiring sessions.
7. **Two-Factor Authentication (TOTP):** RFC 6238 TOTP with encrypted secrets and 12-character backup codes.
8. **Sensitive Data Redaction:** Universal sanitization preventing passwords, tokens, cookies, and keys from ever leaking into logs or errors.

---

## 5. LOCAL DEVELOPMENT & VERIFICATION

```bash
# 1. Install monorepo dependencies
pnpm install

# 2. Build all packages
pnpm run build

# 3. Run all 41 automated tests
pnpm test
```

### Test Suite Matrix (41 / 41 Tests Passing)
- `tests/unit/crypto.test.ts` (5 tests): AES-256-GCM, SHA-256 key hashing, TOTP verification, backup codes.
- `tests/unit/ip.test.ts` (4 tests): CIDR parsing, IPv4/IPv6 validation, IP allowlisting.
- `tests/security/ssrf.test.ts` (5 tests): Localhost, RFC 1918, and AWS metadata IP blocking.
- `tests/security/redaction.test.ts` (2 tests): Secret masking across headers and payloads.
- `tests/security/anti-sharing.test.ts` (4 tests): IP lock binding, foreign IP auto-ban, blacklist fast-path.
- `tests/security/enterprise-acceptance.test.ts` (8 tests): 1-user-1-key binding, TOTP, device trust, suspension.
- `tests/integration/e2e.test.ts` (13 tests): Complete end-to-end admin, customer, API catalog, and gateway proxy lifecycle.

---

## 6. CREDENTIALS & INITIAL ACCESS

- **Canonical URL:** `https://api.karviontechnologies.in`
- **Admin Control Center:** `https://api.karviontechnologies.in/admin`
- **Default Super Admin Username:** `admin`
- **Default Super Admin Password:** `AdminStrongSecurePassword2026!`

*(Change credentials upon initial login or customize via `.env` before installation)*

---
**Organization:** Karvion Technologies  
**Author:** Arjun Kahar  
**Date:** November 2026
