# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| `main` (latest) | ✅ |
| Older branches | ❌ |

Only the current `main` branch receives security fixes.

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.**

Report security issues privately by emailing:
**tranphuckhangvllvl@gmail.com**

Include in your report:
- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept (if available)
- Affected component(s): `auth-service`, `chat-service`, `ai-service`, `connector-service`, or `client`

**Response SLA:** We aim to acknowledge reports within 72 hours and provide a fix timeline within 7 days for critical issues.

## Security Architecture

This project applies the following controls:

- **Authentication:** JWT access tokens (15-minute expiry) + refresh token rotation. Tokens are signed with `JWT_ACCESS_SECRET` — the same secret must be shared across `auth-service`, `chat-service`, `ai-service`, and `connector-service`.
- **Password storage:** bcrypt (cost 10), applied directly in `auth-service`.
- **Connector token vault:** `connector-service` encrypts third-party OAuth/access tokens at rest with AES-256-GCM, and governs which connectors and capabilities each member may invoke.
- **WebSocket security:** Every STOMP connection is validated by `AuthChannelInterceptor` before any subscription or message is accepted.
- **API authorization:** `userId` is always extracted from the validated JWT (`SecurityContextHolder`) — never trusted from request parameters.
- **Rate limiting:** Redis-backed sliding-window throttle (10 messages / 5 seconds per user) guards the message send endpoints against spam.
- **Input validation:** Spring Boot `@Valid` annotations and explicit content-type allowlisting on file upload endpoints.

## Known Limitations

- Production traffic is served over TLS via Google Cloud Run (HTTPS/WSS). Local development uses plain HTTP/WS — terminate TLS at a reverse proxy (nginx/Caddy) if exposing locally.
- End-to-end encryption is on the roadmap but not yet implemented.
