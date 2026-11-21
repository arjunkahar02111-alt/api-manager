# KARVION API MANAGER — CLIENT MANAGEMENT & DISPATCH MANUAL

**Platform Domain:** `https://api.karviontechnologies.in`  
**Classification:** Administrator Operations Manual  
**Author:** Karvion Technologies Engineering  

---

## 1. CLIENT ACCOUNT MODEL

Every client integration is tracked through a centralized `Customer` document in MongoDB.

### Data Attributes:
- **`customerId`**: Unique MongoDB ObjectID.
- **`username`**: Unique client handle (e.g. `client_enterprise_01`).
- **`fullName`**: Licensed company or individual name.
- **`apiKey` / `apiKeyHash`**: SHA-256 hashed secret key (`arjun_live_...`).
- **`allowedApis`**: Array of permitted API IDs/slugs or `['*']` for universal access.
- **`allowedIps`**: Permitted CIDR/IP list or `['*']` (protected by Anti-Key Sharing single-IP lock).
- **`dailyRequestLimit`**: Daily request quota.
- **`monthlyRequestLimit`**: Monthly request quota.
- **`maxConcurrentRequests`**: Simultaneous connections permitted.
- **`expiresAt`**: Hard license expiration timestamp.
- **`status`**: `active` | `suspended` | `expired` | `maintenance`.

---

## 2. API KEY LIFECYCLE & SECURITY

1. **Initial Provisioning:** Admin creates client via `/admin/customers` with name, username, and quota limits. The initial key is revealed once.
2. **Key Rotation:** Admin can trigger 1-click rotation (`POST /api/v1/admin/customers/:id/regenerate-key`). The old key is invalidated immediately across all cluster nodes.
3. **Suspension:** Admin can instantly freeze client access (`POST /api/v1/admin/customers/:id/suspend`). Future requests return `HTTP 403 ACCOUNT_SUSPENDED`.
4. **Reactivation:** Admin can restore access (`POST /api/v1/admin/customers/:id/activate`).
