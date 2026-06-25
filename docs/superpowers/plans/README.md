# Implementation Plans — Status Index

> **Read this before opening any plan below.** Most are already implemented; only open a plan
> if you are actively building/extending that feature. Authoritative build state + remaining work:
> [`../PON-ENTERPRISE-HANDOFF.md`](../PON-ENTERPRISE-HANDOFF.md).

| Plan | Scope | Status |
|------|-------|--------|
| `2026-06-25-personal-assistant-client-ui.md` | Bot Factory assistant UI (web + Flutter) on top of the bridge | 🟡 **ACTIVE — next up** (not started) |
| `2026-06-24-botfactory-personal-assistant-bridge.md` | Phase 1 server-side bridge (chat-service) | ✅ Done — branch `feat/botfactory-bridge`, pending merge |
| `2026-06-22-p8-sso-oidc.md` | Enterprise SSO (OIDC) | ✅ Done (framework); live E2E needs an owner IdP |
| `2026-06-21-p7-self-host-deployment-kit.md` | One-command self-host (Caddy + compose.prod + bootstrap) | ✅ Done; full bring-up needs Docker + real `.env` |
| `2026-06-20-p6-department-group-bot.md` | Department-scoped group bot + chat-service RBAC | ✅ Done |
| `2026-06-19-p5-google-connectors.md` | Gmail + Google Calendar connectors | ✅ Done (per handoff summary) |
| `2026-06-19-p0-part2-enforcement.md` | Cross-service RBAC enforcement + connector governance | ✅ Done |
| `2026-06-19-p0-enterprise-foundation.md` | Workspace / Departments / Members / hybrid RBAC | ✅ Done |
| `2026-06-19-mcp-connector-core.md` | P1 MCP connector core (connector-service) | ✅ Done |
| `2026-06-17-web-mobile-responsive.md` | Web/mobile responsive + bottom tab bar | ✅ Done |
| `2026-06-17-platform-upgrade.md` | Public-repo hardening (CI, secret scan, `.env.example`) | ✅ Done |
| `2026-06-17-performance-overhaul.md` | N+1 fixes, virtual scroll, RabbitMQ AI queue | ✅ Done |

**Conventions:** plans are TDD, checkbox (`- [ ]`) steps, executed with `superpowers:subagent-driven-development`
or `superpowers:executing-plans`. Design specs live in `../specs/`. Done plans are kept (not deleted) as
the historical record of *why* things are built the way they are.
