# KARVION API MANAGER — OFFICIAL API SPECIFICATION & CATALOG

**Base URL:** `https://api.karviontechnologies.in`  
**Transport:** HTTPS / TLS 1.3  
**Authentication Header:** `X-API-Key: arjun_live_...`  

---

## 1. VEHICLE INTELLIGENCE / RC OSINT ENDPOINT

Returns registration details, vehicle class, fuel type, fitness, and insurance status.

### Endpoint URLs:
- Primary: `GET https://api.karviontechnologies.in/v1/vehicle2-n`
- Aliases:
  - `GET https://api.karviontechnologies.in/v1/v2nn`
  - `GET https://api.karviontechnologies.in/v1/v2n-2`
  - `GET https://api.karviontechnologies.in/v1/osint/vehicle`

### Parameters:
| Name | Type | In | Description |
|---|---|---|---|
| `key` | string | query / header | API Authentication Key (`arjun_live_...`) |
| `query` | string | query | Vehicle Registration Number (e.g. `DL01AB1234`) |

### Example Request (cURL):
```bash
curl -X GET "https://api.karviontechnologies.in/v1/vehicle2-n?key=arjun_live_YOUR_KEY&query=DL01AB1234" \
  -H "Accept: application/json"
```

---

## 2. ANNOUNCEMENT ACKNOWLEDGMENT ENDPOINT

Allows client integrations to record receipt of high-priority announcements.

- **URL:** `POST https://api.karviontechnologies.in/api/v1/announcements/:id/acknowledge`
- **Headers:** `X-API-Key: arjun_live_...`

### Example Request (Node.js):
```javascript
const response = await fetch("https://api.karviontechnologies.in/api/v1/announcements/ANN-1001/acknowledge", {
  method: "POST",
  headers: {
    "X-API-Key": "arjun_live_YOUR_KEY",
    "Accept": "application/json"
  }
});
const data = await response.json();
console.log(data);
```
