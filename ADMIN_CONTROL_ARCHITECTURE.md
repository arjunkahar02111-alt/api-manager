# KARVION API MANAGER — ADMIN-ONLY CONTROL ARCHITECTURE

**Platform Domain:** `https://api.karviontechnologies.in`  
**Classification:** Enterprise SaaS Technical Architecture  
**Author:** Karvion Technologies Engineering  
**Version:** 2.0 (Admin-Only API-as-a-Service)

---

## 1. ARCHITECTURAL PARADIGM

Karvion API Manager operates on an **Admin-Only API-as-a-Service** model. All administrative, licensing, catalog, announcement, quota, security, and deployment operations are centralized in a single, high-security Administrator Control Center.

```
+-------------------------------------------------------------------------+
|                  KARVION ADMINISTRATOR CONTROL CENTER                  |
|     (Sole Platform Web Surface: Overview, Clients, APIs, Announcements)  |
+-------------------------------------------------------------------------+
                                    |
                    Authenticated REST & WebSockets
                                    v
+-------------------------------------------------------------------------+
|                MANAGEMENT BACKEND MICROSERVICE (PORT 3000)              |
|        - Client & API Licensing Engine                                  |
|        - Dynamic Announcement Lifecycle & Target Resolver               |
|        - Audit Trails & Multi-Tier Maintenance Orchestration            |
+-------------------------------------------------------------------------+
         |                                                       ^
   State Persistence                                       PubSub Events
         v                                                       |
+-------------------+                                   +-----------------+
|   MONGODB 7.0     |                                   |    REDIS 7.2    |
| (Source of Truth) |                                   | (Cache & PubSub)|
+-------------------+                                   +-----------------+
                                                                 ^
                                                           Fast-Path Sync
                                                                 v
+-------------------------------------------------------------------------+
|                 HIGH-SPEED API GATEWAY SERVICE (PORT 3001)              |
|        - SHA-256 Key Authentication & Strict Single-IP Locking          |
|        - Route Resolver & Resilient Aliasing (/vehicle2-n, /v2nn)       |
|        - Dynamic Announcement Injection into Response Envelopes         |
|        - Upstream Forwarding & Automatic Decompression (Zstd/Br/Gzip)   |
+-------------------------------------------------------------------------+
                                    ^
                             HTTPS / TLS 1.3
                                    |
+-------------------------------------------------------------------------+
|                     EXTERNAL CLIENT APPLICATIONS                        |
|       (Receive: Base URL, API Key, Documentation & API Responses)       |
+-------------------------------------------------------------------------+
```

---

## 2. KEY INVARIANTS & SECURITY CONTROLS

1. **No Client SaaS Website:** Clients never register on a public web page or access an internal dashboard. Client accounts and API keys are issued exclusively by the administrator.
2. **Preserved Backend Authentication:** The removal of client-facing web pages does not compromise API security. Client API keys (`arjun_live_...`) are validated via SHA-256 hashes against MongoDB and cached in Redis.
3. **Dynamic Response Envelopes:** Clients receive live announcements, quota consumption metrics, and developer metadata directly in the JSON response payload.
4. **Resilient Routing & Aliases:** Reverse proxy dynamically resolves vehicle intelligence aliases (`/vehicle2-n`, `/v2nn`, `/v2n-2`, `/osint/vehicle`) to eliminate 404 errors.
