# KARVION API MANAGER — API RESPONSE SCHEMA & SPECIFICATION

**Canonical Base URL:** `https://api.karviontechnologies.in`  
**Protocol:** HTTPS with TLS 1.3 / HTTP2  
**Format:** JSON (`application/json; charset=utf-8`)  

---

## 1. STANDARD SUCCESS ENVELOPE (HTTP 200 OK)

```json
{
  "success": true,
  "developer": "arjunkahar",
  "req_left": 4980,
  "req_total": 5000,
  "expiry": "31-12-2099",
  "response_time": "14ms",
  "response_time_seconds": 0.01,
  "announcement": {
    "id": "ANN-1001",
    "active": true,
    "type": "general",
    "severity": "information",
    "title": "Service Optimization",
    "message": "Sub-millisecond route resolution active.",
    "acknowledgment_required": false
  },
  "data": {
    "example_field": "upstream_response_data"
  }
}
```

---

## 2. MAINTENANCE RESPONSE ENVELOPE (HTTP 503 SERVICE UNAVAILABLE)

```json
{
  "success": false,
  "status": "maintenance",
  "error": {
    "code": "API_MAINTENANCE",
    "message": "This API is temporarily unavailable due to scheduled platform maintenance."
  },
  "announcement": {
    "active": true,
    "type": "maintenance",
    "severity": "warning",
    "title": "Scheduled Platform Maintenance",
    "message": "System is undergoing upgrades. Service will restore shortly."
  },
  "meta": {
    "retry_after": 900
  }
}
```

---

## 3. RATE LIMIT EXCEEDED ENVELOPE (HTTP 429 TOO MANY REQUESTS)

```json
{
  "success": false,
  "error": {
    "code": "DAILY_LIMIT_EXCEEDED",
    "message": "Daily API quota exhausted. Contact administrator for license renewal."
  },
  "usage": {
    "daily_used": 5000,
    "daily_limit": 5000,
    "remaining": 0
  }
}
```

---

## 4. AUTHENTICATION FAILURE ENVELOPES

### Missing API Key (HTTP 401 Unauthorized):
```json
{
  "success": false,
  "error": {
    "code": "MISSING_API_KEY",
    "message": "API Key missing. Provide your key via header X-API-Key: arjun_live_... or Authorization: Bearer arjun_live_..."
  }
}
```

### Invalid Key (HTTP 401 Unauthorized):
```json
{
  "success": false,
  "error": {
    "code": "INVALID_API_KEY",
    "message": "API Key provided is invalid, revoked or unrecognized."
  }
}
```

### Account Suspended (HTTP 403 Forbidden):
```json
{
  "success": false,
  "error": {
    "code": "ACCOUNT_SUSPENDED",
    "message": "Your client account has been suspended by the administrator."
  }
}
```
