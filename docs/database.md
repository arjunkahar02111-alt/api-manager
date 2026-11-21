# ARJUN API MANAGER — DATABASE & SCHEMA DOCUMENTATION

## 1. Storage Strategy
- **MongoDB**: Used for persistent business entities, billing, catalogs, tickets, and aggregated statistics.
- **Redis**: Used for microsecond rate limiting, atomic quota counters, and concurrency locks.

## 2. Collections & Index Structure

### `administrators`
- `_id`: ObjectId
- `username`: String (Unique)
- `passwordHash`: String (Scrypt/Argon2id format)
- `role`: 'super_admin' | 'admin'
- `isActive`: Boolean
- `failedLoginAttempts`: Number
- `lockoutUntil`: Date

### `customers`
- `_id`: ObjectId
- `username`: String (Unique index)
- `fullName`: String
- `email`: String (Index)
- `status`: 'active' | 'suspended' | 'expired' | 'deleted' (Index)
- `dailyRequestLimit`: Number
- `monthlyRequestLimit`: Number
- `lifetimeRequestLimit`: Number
- `maxConcurrentRequests`: Number
- `maxBandwidthBytes`: Number
- `allowedApis`: [String]
- `allowedIps`: [String]
- `expiresAt`: Date (Compound index with status)

### `api_keys`
- `_id`: ObjectId
- `customerId`: ObjectId (Unique constraint — exactly one active key per user)
- `keyHash`: String (Unique index, SHA-256 hash)
- `keyPrefix`: String
- `status`: 'active' | 'revoked' | 'expired'

### `api_catalog`
- `_id`: ObjectId
- `name`: String
- `slug`: String (Unique index)
- `gatewayPath`: String (Unique index, e.g. `/user/info`)
- `upstreamBaseUrl`: String
- `upstreamPath`: String
- `allowedMethods`: [String]
- `status`: 'active' | 'disabled' | 'maintenance'

### `usage_daily` & `usage_monthly`
- Compound Unique Index: `customerId + apiId + date` / `customerId + apiId + month`
- Tracks requests, successfulRequests, failedRequests, bandwidthBytes.

### `request_logs`
- Indexed by: `customerId + timestamp`, `apiId + timestamp`, `statusCode + timestamp`
- Retention: Automatically pruned after 90 days.
