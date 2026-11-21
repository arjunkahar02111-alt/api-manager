# ARJUN API MANAGER — API REFERENCE

## Canonical Domain: `https://api.karviontechnologies.in`

### 1. Public API Gateway (`/v1/*`)
All managed API endpoints are accessed through `/v1/`.

#### Header Requirement:
```http
X-API-Key: arjun_live_<your_key_here>
```

#### Example Request:
```bash
curl -X GET "https://api.karviontechnologies.in/v1/user/info" \
  -H "X-API-Key: arjun_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

#### Quota Headers in Response:
- `X-RateLimit-Limit`: Daily request limit configured for your account.
- `X-RateLimit-Remaining`: Remaining daily requests available.
- `x-request-id`: Cryptographic tracing ID.

#### Standard Error Response (HTTP 429 Quota Exceeded):
```json
{
  "success": false,
  "error": {
    "code": "DAILY_QUOTA_EXCEEDED",
    "message": "Your daily API request quota has been exceeded."
  },
  "usage": {
    "dailyUsed": 1000,
    "dailyLimit": 1000,
    "remaining": 0
  }
}
```

---

### 2. Super Admin Management Endpoints (`/api/v1/admin/*`)
Requires `Authorization: Bearer <ADMIN_JWT>`

- `POST /api/v1/admin/auth/login`
- `GET  /api/v1/admin/customers`
- `POST /api/v1/admin/customers`
- `POST /api/v1/admin/customers/:id/suspend`
- `POST /api/v1/admin/customers/:id/activate`
- `POST /api/v1/admin/customers/:id/renew`
- `POST /api/v1/admin/customers/:id/regenerate-key`
- `POST /api/v1/admin/customers/:id/reset-usage`
- `GET  /api/v1/admin/apis`
- `POST /api/v1/admin/apis`
- `POST /api/v1/admin/apis/:id/test`
- `GET  /api/v1/admin/analytics`
- `GET  /api/v1/admin/logs`
- `GET  /api/v1/admin/system/metrics`
- `GET  /api/v1/admin/backups`
- `POST /api/v1/admin/backups`

---

### 3. Customer Developer Portal Endpoints (`/api/v1/customer/*`)
Requires `Authorization: Bearer <CUSTOMER_SESSION_JWT>`

- `POST /api/v1/customer/auth/login` (Body: `{ "apiKey": "arjun_live_..." }`)
- `GET  /api/v1/customer/dashboard`
- `GET  /api/v1/customer/apis`
- `GET  /api/v1/customer/usage`
- `GET  /api/v1/customer/logs`
- `GET  /api/v1/customer/ip-allowlist`
- `POST /api/v1/customer/ip-allowlist`
- `GET  /api/v1/customer/webhooks`
- `POST /api/v1/customer/webhooks`
- `GET  /api/v1/customer/tickets`
- `POST /api/v1/customer/tickets`
