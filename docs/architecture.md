# ARJUN API MANAGER — ARCHITECTURAL SPECIFICATION

## 1. System Overview
**ARJUN API MANAGER** is an enterprise-grade commercial API management platform designed to control, meter, rate-limit, and secure access to REST APIs on the canonical domain `https://api.karviontechnologies.in`.

Built as a modular monolith with physically separated process boundaries for high throughput and fault tolerance:
1. **Frontend**: React + Vite + TypeScript + Tailwind CSS developer dashboard (Admin & Customer portals)
2. **Backend**: Express + TypeScript Node.js management API (`/api/v1/*`)
3. **Gateway**: Dedicated, low-latency API proxy and atomic quota enforcement engine (`/v1/*`)
4. **Worker**: Background scheduler for reconciliation, account expiration, HMAC webhooks, and health checks
5. **Redis**: High-speed distributed counter store, rate limiter, and cache
6. **MongoDB**: Source of record with ACID multi-document transactions and indexed audit logs
7. **Nginx**: Edge reverse proxy terminating TLS 1.3 with Let's Encrypt certificates

```
CUSTOMER / ADMIN CLIENT
        │
        ▼ HTTPS (Port 443)
┌───────────────────────────────────────────────┐
│              NGINX REVERSE PROXY              │
│        (api.karviontechnologies.in)           │
└───────┬──────────────┬──────────────┬─────────┘
        │ /            │ /api/v1/     │ /v1/
        ▼              ▼              ▼
┌──────────────┐┌──────────────┐┌──────────────┐
│   FRONTEND   ││   BACKEND    ││ API GATEWAY  │
│  Port: 8080  ││  Port: 3000  ││  Port: 3001  │
└──────────────┘└──────┬───────┘└──────┬───────┘
                       │               │
        ┌──────────────┴───────────────┴──────────────┐
        ▼                                             ▼
┌────────────────────────┐                   ┌────────────────────────┐
│     MONGODB 7.0        │                   │       REDIS 7.2        │
│  (ACID & Persistence)  │                   │  (Atomic Lua Counters) │
└────────────────────────┘                   └────────────────────────┘
```

## 2. Gateway Request Lifecycle
When a request arrives at `https://api.karviontechnologies.in/v1/*`:
1. **Route Resolution**: Checks `api_catalog` cache. If endpoint does not exist or is disabled, rejects immediately.
2. **Maintenance Check**: Evaluates if global or route maintenance is enabled. Returns 503 if active.
3. **Key Authentication**: Extracts `X-API-Key` or `Bearer` token. Hashes key with SHA-256 and validates in Redis/MongoDB.
4. **Status Enforcement**: Blocks suspended or expired customers automatically.
5. **IP Allowlist Evaluation**: Validates client IP against configured CIDR blocks.
6. **Atomic Redis Lua Execution**: Atomically verifies rate limits, concurrent slots, daily quota, monthly quota, and lifetime quota in a single Redis turn.
7. **Anti-SSRF Protection**: Validates upstream host DNS to guarantee destination is not loopback, private, or metadata address.
8. **Forwarding**: Dispatches request via Undici stream, stripping hop-by-hop and client credential headers.
9. **Accounting & Release**: Releases concurrency lock and records bandwidth consumed.
