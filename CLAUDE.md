# CLAUDE.md

> Read this file before doing anything.
> Sub-service context auto-loads when needed: `apps/server/chat-service/CLAUDE.md`, `apps/client/CLAUDE.md`, `apps/web/CLAUDE.md`

---

## Project: Platform — Realtime Messaging App + AI Assistant

**Owner:** Tran Phuc Khang | **Stack:** NestJS auth + Spring Boot chat + NestJS AI + Flutter mobile + Next.js web

## CRITICAL RULES

- **DO NOT modify `apps/server/auth-service/`** unless explicitly requested — service is complete.
- **`apps/server/chat-service/`** — Spring Boot 3 (Go was deleted, migration complete).
- **`apps/server/ai-service/`** — NestJS/TypeScript (Phase 2 — AI layer).
- **`apps/client/`** — Flutter (React Native was replaced, migration complete).
- MongoDB database name: `platform` — shared across all services.
- JWT env var: `JWT_ACCESS_SECRET` — must be **identical** across all services.
- Always check existing files before creating new ones.
- Always run build/test after changes to verify.

## Ports & Infrastructure

| Service | Port | Tech |
|---------|------|------|
| auth-service | 3001 | NestJS |
| chat-service | 8080 | Spring Boot 3 |
| ai-service | 3002 | NestJS (TypeScript) |
| MongoDB | **27018** (non-standard!) | Docker |
| Redis | 6379 | Docker |

Start infra: `docker compose -f infra/docker-compose/compose.yml up -d`

## Package Managers

- JS/TS: **pnpm** (not npm, not yarn)
- Java: **Maven**
- Flutter: **flutter pub**

## Stack — Phase 2 AI ✅ COMPLETE (2026-06-07, Sprint AI-6 DONE)

- **Spring Boot 3 chat-service**: WebSocket (STOMP) + REST API + MongoDB + Redis + JWT validation ✅
- **Flutter client**: Neon UI + Auth flow + Chat UI + Riverpod + STOMP wire ✅
- **NestJS auth-service**: JWT, OTP, refresh token, user search API ✅
- **NestJS ai-service**: Anthropic Claude API + Redis pub/sub + Streaming STOMP + Memory + RAG + Tools + Persona ✅

## Redis Pub/Sub Channels (AI layer)

| Channel | Publisher | Subscriber | Payload |
|---------|-----------|------------|---------|
| `ai:request` | chat-service | ai-service | `{conversationId, userId, displayName, content, history[]}` |
| `ai:response:{conversationId}` | ai-service | chat-service | `{type: AI_STREAM_CHUNK\|AI_STREAM_DONE\|AI_STREAM_ERROR, chunk?, fullContent?}` |

## Key Paths

- Auth API: `apps/server/auth-service/src/modules/auth/`
- AI service: `apps/server/ai-service/src/`
- Shared DB schemas: `packages/database/src/`
- Docker infra: `infra/docker-compose/compose.yml`
- Auth service .env: `apps/server/auth-service/.env`
- AI service .env: `apps/server/ai-service/.env`

## Reference Docs (load on demand, not auto-loaded)

- Architecture decisions: `docs/decisions.md`
- Roadmap & milestones: `docs/roadmap.md`
- Chat service API spec: `docs/api-spec.md`
- AI service rules: `.claude/rules/ai-service.md`

## Compaction Instructions

When compacting, always preserve: current task, list of modified files, any pending TODOs, and Spring Boot/Flutter patterns established so far.
