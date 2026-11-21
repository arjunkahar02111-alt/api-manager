# ARJUN API MANAGER — SECURITY ARCHITECTURE

## 1. Zero Trust Customer Isolation
- Customers receive dashboard access strictly via their assigned API key.
- Customer identifiers are never trusted from query parameters or body inputs; they are strictly derived from the verified token.
- Customers can only query their own request logs and statistics.

## 2. API Key Security & One-Way Hashing
- API Keys are generated using `crypto.randomBytes(32)` providing 256 bits of entropy.
- Format: `arjun_live_<64-character-hex>`
- **Plaintext keys are never stored in the database.**
- Stored as SHA-256 hashes (`keyHash`) with a key prefix (`keyPrefix`) for identification.
- Raw keys are displayed only once upon account creation or key regeneration.

## 3. Anti-SSRF (Server-Side Request Forgery) Protection
- Arbitrary destination proxying is strictly forbidden.
- Proxies only to administrator-registered endpoints in the API catalog.
- Resolves upstream hostnames via DNS and rejects loopback (`127.0.0.0/8`), private (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and AWS/cloud metadata addresses (`169.254.169.254`).

## 4. Header Injection & Hop-by-Hop Stripping
- Strips hop-by-hop headers: `connection`, `keep-alive`, `proxy-authenticate`, `te`, `upgrade`, `x-api-key`.
- Client credentials (`X-API-Key`) are stripped before forwarding requests to upstream destinations.

## 5. Cryptographic Storage at Rest
- Sensitive secrets (webhook signing secrets, upstream credentials) are encrypted with AES-256-GCM using authenticated encryption.
- Master password hashes use Argon2id/scrypt with unique salts.
- Automatic account lockout after 5 consecutive failed login attempts.
