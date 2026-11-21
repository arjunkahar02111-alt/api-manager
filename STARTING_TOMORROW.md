# 🚀 ARJUN API MANAGER — SESSION HANDOVER & STARTING GUIDE

**Date Saved:** November 20, 2026, 22:50 IST  
**Canonical Domain:** `https://api.karviontechnologies.in`  
**Current State:** 100% Operational, Fully Tested & Built  

---

## ⚡ Quick Start Command (To Resume Tomorrow)

To start the entire platform tomorrow (Embedded MongoDB, Management Backend, Gateway Proxy, Worker, and Web Dashboard), run from the workspace root:

```powershell
pnpm run run
```

Or run development mode individually:
```powershell
pnpm run dev
```

---

## 🌐 Live Service URLs & Port Assignments

| Service | Port | Local URL | Description |
| :--- | :--- | :--- | :--- |
| **Frontend Dashboard** | `8080` | `http://localhost:8080` | High-contrast VoiceBox Magazine UI (Super Admin & Customer Portal) |
| **API Gateway Proxy** | `3001` | `http://localhost:3001/v1` | High-speed universal proxy engine with metadata injection |
| **Management Backend** | `3000` | `http://localhost:3000/api/v1` | Admin APIs, customer management, authentication & rate limits |
| **MongoDB Database** | `27017` | `mongodb://127.0.0.1:27017/arjun_api_manager` | Primary database (standalone or embedded auto-start) |
| **Background Worker** | N/A | Process | Daily usage rollup, quota resets, and log aggregation |

---

## 🔑 Default Administrator Credentials

- **Username:** `admin`
- **Password:** `AdminStrongSecurePassword2026!`
- **Role:** `super_admin`

---

## 👤 Active Customer Accounts & API Keys

### Customer: `arjunkahar`
- **Username:** `arjunkahar`
- **Full API Key:** `arjun_live_5a976d8992c0f51e15fadac04b8fd55bd1e7761704c46c47ebea3a2ff4798192`
- **Key Prefix:** `arjun_live_5a976`
- **Daily Quota:** 5,000 requests/day
- **Expiry:** `20-11-2027` (1 Year Validity)
- **Developer Tag:** `arjunkahar`

### Customer: `1`
- **Username:** `1`
- **Key Prefix:** `arjun_live_cd0bd`
- **Developer Tag:** `arjunkahar`

---

## 🧪 Quick Test cURL Commands

### 1. Key in URL (Recommended by User):
```bash
curl "http://localhost:3001/v1/vehicle2-n?key=arjun_live_5a976d8992c0f51e15fadac04b8fd55bd1e7761704c46c47ebea3a2ff4798192&query=pb10hs2829"
```

### 2. Header Authentication:
```bash
curl -H "X-API-Key: arjun_live_5a976d8992c0f51e15fadac04b8fd55bd1e7761704c46c47ebea3a2ff4798192" "http://localhost:3001/v1/vehicle2-n?query=pb10hs2829"
```

### 3. Expected Verified Response:
```json
{
  "LITE_ULTRA_SPEED_CORE": {
    "vehicle_number": "PB10HS2829",
    "mobile_number": "9417189392",
    "response_time_seconds": 0.1
  },
  "LITE_ULTRA_SPEED_CORE_V2": {
    "vehicle_number": "PB10HS2829",
    "mobile_number": "9417189392"
  },
  "RC_TO_MOBILE": {
    "vehicle_number": "PB10HS2829",
    "mobile_number": "9417189392"
  },
  "response_time_seconds": 1.21,
  "req_left": 4999,
  "req_total": 5000,
  "expiry": "20-11-2027",
  "developer": "arjunkahar",
  "success": true,
  "cached": false,
  "response_time": "1206ms"
}
```

---

## 🛠️ Summary of All Completed Systems

1. **Universal API Hosting & All Form/Type Support:**
   - Methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`, `HEAD`.
   - Body types: `application/json`, `application/x-www-form-urlencoded`, `multipart/form-data` (file uploads), `text/plain`, binary streams (`image/png`, `application/pdf`).
   - Hop-by-hop filter includes `Expect: 100-continue` to prevent undici upstream crashes.
   - Hierarchical subpaths: `/v1/my-api/users/123/posts?sort=desc` automatically resolves `/my-api` and forwards `/users/123/posts`.

2. **Universal Decompression:**
   - Multi-algorithm support for **Zstandard (`zstd`)**, **Brotli (`br`)**, **Gzip (`gzip`)**, and **Deflate (`deflate`)**.
   - Solved browser mojibake / corrupted bytes (`(/X0%70^g...`).

3. **Customization & Metadata Engine:**
   - `developerTag`: Defaults to `arjunkahar`, customizable per customer in the dashboard.
   - `expiry`: Formatted strictly as `DD-MM-YYYY`.
   - `req_left`, `req_total`, `response_time`, and `response_time_seconds` dynamically calculated.
   - Non-JSON / Binary streaming responses receive tracking metadata via HTTP response headers (`X-Developer`, `X-RateLimit-Remaining`, `X-Expiry-Date`, etc.).

4. **Enterprise Anti-Key Sharing & Strict Single-Session Security Engine:**
   - **Anti-Key Sharing / Multi-IP Auto-Ban:** When a client key is used, it auto-locks to the client's single IP address (`boundIp`). If the key is shared with a friend or used from another IP address, the Gateway instantly revokes the API key, suspends the account, and adds the foreign IP to the permanent IP blacklist (`403 KEY_SHARING_PROHIBITED`).
   - **Strict Single-User Active Session:** Zero concurrent logins permitted per account. Logging in from a second browser, device, or tab immediately terminates the older active session via UUID token validation (`401 CONCURRENT_LOGIN_TERMINATED`).
   - **Real-Time Gateway Telemetry Stream (SSE):** Live Server-Sent Events stream at `/api/v1/admin/monitoring/live-stream` delivering sub-millisecond request logs, security alerts, and system telemetry to the Admin Security Monitor.
   - **Automated Brute-Force Defense:** Repeated failed key attempts from any IP (>10/min) trigger automatic 24-hour IP blacklisting and critical incident logging.
   - **Admin Security Control Center (`/admin/security`):** Live streaming traffic terminal, customer IP lock registry, 1-click IP unban, and manual IP blacklisting.

5. **Production Build & Verification Status:**
   - `pnpm run build` passes with **0 errors across all 7 workspace packages and apps**.
   - `pnpm test` passes with **100% passing across 6 test suites and 33 automated tests**.

---

## 📦 VPS Deployment Checklist (For When Ready to Host)

1. **Prerequisites on VPS (Ubuntu/Debian):**
   ```bash
   sudo apt update && sudo apt install -y nodejs npm mongodb redis-server nginx certbot python3-certbot-nginx
   sudo npm install -g pnpm pm2
   ```

2. **Deploy Code & Build:**
   ```bash
   pnpm install --frozen-lockfile
   pnpm run build
   ```

3. **Start PM2 Production Cluster:**
   ```bash
   pm2 start infrastructure/pm2/ecosystem.config.cjs
   pm2 save
   pm2 startup
   ```

4. **Nginx Reverse Proxy & SSL:**
   - Use the pre-configured Nginx config at `infrastructure/nginx/api.karviontechnologies.in.conf`.
   - Issue SSL certificates via `certbot --nginx -d api.karviontechnologies.in`.
