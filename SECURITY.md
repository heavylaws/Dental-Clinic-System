# Security Notes for Dental Clinic System

> **This document describes current security assumptions and known limitations. It does NOT claim HIPAA, GDPR, or production-ready compliance.**

## Assumptions

- This application is designed for **local-network or small-clinic deployments**.
- The default demo mode runs **in-memory** with pre-seeded data. No database is required.
- HTTPS is optional in development but **strongly recommended** for any network-exposed deployment.

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `SESSION_SECRET` | **Yes** | Cryptographic secret for session cookies. Must be a long random string in production. |
| `NODE_ENV` | No | Set to `"production"` to enable secure cookie flags and sanitized error responses. |
| `CORS_ORIGIN` | No | Allowed frontend origin(s). Leave empty in local dev; set explicitly in production. |
| `DATABASE_URL` | No | PostgreSQL connection string. Omit to use in-memory demo mode. |

## Deployment Cautions

1. **Change the session secret** before any production use. The demo ships with a hardcoded placeholder if `SESSION_SECRET` is missing.
2. **Set `CORS_ORIGIN`** in production. Leaving it open allows any website to make authenticated requests against your API.
3. **Enable HTTPS** for camera access from mobile devices and to protect credentials in transit.
4. **Do not expose the server to the public internet** without additional hardening (reverse proxy, firewall rules, etc.).
5. **Backup data regularly** if using PostgreSQL persistence. The in-memory demo store is lost on server restart.

## Known Limitations (as of this version)

- **No CSRF protection** — the frontend and API currently rely on same-origin + session cookie security.
- **No audit log persistence** — audit entries are stored in memory and lost on restart.
- **Demo passwords are bcrypt-hashed at runtime** but the hash rounds are intentionally low for demo performance.
- **File uploads** are validated by MIME type, but stored on local disk without encryption.
- **Rate limiting** is IP-based and uses an in-memory store; it resets on server restart and can be bypassed behind some proxies.
- **No role-based access control on all endpoints** — some routes may lack fine-grained permission checks.
- **Error responses** in development mode may include stack traces; in production they are sanitized.

## Responsible Disclosure

If you discover a security issue, please report it to the project maintainers before publicly disclosing it.
