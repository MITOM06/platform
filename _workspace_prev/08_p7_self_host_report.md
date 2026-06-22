# P7 — Self-Host Deployment Kit — Completion Report

**Date:** 2026-06-22
**Branch:** `fix/chat-service-cloudrun-startup`
**Spec:** `docs/superpowers/specs/2026-06-21-p7-self-host-deployment-kit-design.md`
**Plan:** `docs/superpowers/plans/2026-06-21-p7-self-host-deployment-kit.md`
**Status:** ✅ COMPLETE (framework). Live E2E HARD-STOP on owner-provided secrets (§ Blocked).

---

## Goal

Package the whole PON platform so one company stands up the entire stack on a single host with one
command and a single filled-in `.env`, reachable over one domain with TLS via a Caddy reverse proxy.
Backward compatibility with the existing Google Cloud Run deployment was mandatory throughout.

## What was delivered (Tasks 1–8)

| # | Task | Key files | Commit |
|---|------|-----------|--------|
| 1 | Web same-origin relative API/WS URLs | `apps/web/lib/api/axios.ts`, `lib/stomp/client.ts`, `__tests__/base-urls.test.ts` | `70834918` |
| 2 | Web standalone Next.js output + Dockerfile | `apps/web/next.config.ts`, `Dockerfile`, `.dockerignore` | `193de510` |
| 3 | Caddy reverse-proxy config | `infra/docker-compose/Caddyfile` | `7a076e5f` |
| 4 | Consolidated deployment `.env.example` | `infra/docker-compose/.env.example` | `0d8c5587` |
| 5 | `bootstrap.sh` idempotent secret generation (+ test) | `infra/docker-compose/bootstrap.sh`, `bootstrap.test.sh` | `63e2f183`, `7bd484ea` |
| 6 | Turnkey `compose.prod.yml` (full stack + web + caddy) | `infra/docker-compose/compose.prod.yml` | `273c0438` |
| 7 | Mobile `PON_DOMAIN`-driven URLs (Cloud Run fallback) | `apps/client/lib/core/config/app_config.dart`, `dio_client.dart`, `stomp_service.dart` | `2056ca1d` |
| 8 | Self-host runbook + handoff update | `docs/superpowers/runbooks/self-host.md`, `PON-ENTERPRISE-HANDOFF.md` | this report's commit |

Design + plan docs committed earlier: `aa7dd332` (spec), `b42c30d5` (plan).

## Architecture summary

- **Caddy** is the only host-published container (`:80`/`:443`); everything else stays internal on
  `app-net`. `handle_path` prefix-strips `/api/auth` → auth-service:3001, `/api/chat` →
  chat-service:8080, `/api/connector` → connector-service:3003 (each keeps its current routes
  unchanged), `/ws` is preserved (no strip) for STOMP, and `/*` → web:3000. Auto-HTTPS via
  Let's Encrypt when `DOMAIN` is a real hostname; `localhost` uses Caddy's internal CA.
- **Web image is domain-agnostic**: relative URLs by default, WS broker URL derived at runtime from
  `window.location`. One image runs for any domain; `NEXT_PUBLIC_*` still overrides for Cloud Run/local.
- **Mobile** stays absolute-URL (native app): `AppConfig` derives all URLs from a single
  `--dart-define=PON_DOMAIN`, falling back to the Cloud Run hosts when unset.
- **One `.env`** is the single source of truth; `bootstrap.sh` generates JWT/refresh/vault/internal
  secrets idempotently (never clobbers) and validates the human-required vars before bring-up.

## Verification (all green)

- `infra/docker-compose/bootstrap.test.sh` → **PASS** (creates `.env`, generates secrets, vault key
  decodes to exactly 32 bytes, idempotent on re-run).
- `pnpm --filter @platform/web test base-urls axios-refresh` → **11 passed** (4 base-urls + axios-refresh
  regression intact).
- `cd apps/client && flutter analyze` → **No issues found**.
- All P7 task files present and correct on disk (AppConfig, Caddyfile, web Dockerfile, `output:'standalone'`).
- Backward compatibility: Cloud Run defaults preserved in web (env override), mobile (PON_DOMAIN unset →
  Cloud Run), and the existing `compose.yml` dev stack is untouched.

## Decisions / rationale

- **Prefix-strip at the edge over per-service global prefixes**: chat-service already owns the entire
  `/api/*` namespace, so a flat shared `/api` can't disambiguate three services. `handle_path` namespaces
  at `/api/<service>` while every backend keeps its routes untouched. The cosmetic double `/api` for chat
  (`/api/chat/api/messages`) is intentional and harmless.
- **Relative-by-default web URLs** sidestep the Next.js build-time `NEXT_PUBLIC_*` problem so the image is
  built once for any domain; the only absolute URL (WS) is computed at runtime.
- **ai-service not proxied** — it is an internal RabbitMQ/Redis worker with no public port.

## Blocked / loose ends (HARD STOP — code is complete)

Live end-to-end run requires owner-provided secrets/infra (handoff §4): a real `DOMAIN` (DNS A-record),
`ANTHROPIC_API_KEY`, and optional Notion/Google OAuth creds. The framework is complete and verified; only
the live bring-up (`docker compose -f compose.prod.yml up -d --build` on a host with real `.env`) remains
and is the operator's step.

**Risk flagged for bring-up:** chat-service `WebSocketConfig` uses `setAllowedOriginPatterns`; confirm the
configured origins permit `https://${DOMAIN}` during the first STOMP handshake through Caddy (may need the
domain added). Noted in the plan's "Notes / risks".

## Out of scope (deferred)

Helm/K8s chart, config-driven per-company branding + feature-flag UI (P7.2), multi-replica/HA, managed DB,
backup automation, and multi-company scale-out — per spec §8.
