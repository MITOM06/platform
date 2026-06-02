# CLAUDE.md

> Đọc file này trước khi làm bất cứ thứ gì.
> Sub-service context tự load khi cần: `apps/server/chat-service/CLAUDE.md`, `apps/client/CLAUDE.md`

---

## Project: Platform — Realtime Messaging App (FPT Aptech PRJ4)

**Owner:** Tran Phuc Khang | **Stack:** NestJS auth + Spring Boot chat + Flutter mobile

## CRITICAL RULES

- **KHÔNG sửa `apps/server/auth-service/`** trừ khi được yêu cầu rõ ràng — service đã hoàn chỉnh.
- **`apps/server/chat-service/`** — Spring Boot 3 (Go đã bị xóa, migration hoàn thành).
- **`apps/client/`** — Flutter (React Native đã replace, migration hoàn thành).
- MongoDB database name: `platform` — dùng chung cả 2 services.
- JWT env var: `JWT_ACCESS_SECRET` — phải **giống nhau** giữa 2 services.
- Always check existing files before creating new ones.
- Always run build/test after changes to verify.

## Ports & Infrastructure

| Service | Port | Tech |
|---------|------|------|
| auth-service | 3001 | NestJS |
| chat-service | 8080 | Spring Boot 3 |
| MongoDB | **27018** (non-standard!) | Docker |
| Redis | 6379 | Docker |

Start infra: `docker compose -f infra/docker-compose/compose.yml up -d`

## Package Managers

- JS/TS: **pnpm** (not npm, not yarn)
- Java: **Maven**
- Flutter: **flutter pub**

## Stack (PRJ4 — Java Enterprise) — Sprint 17 hoàn thành

- **Spring Boot 3 chat-service**: WebSocket (STOMP) + REST API + MongoDB + Redis + JWT validation ✅
- **Flutter client**: Neon UI + Auth flow + Chat UI + Riverpod + STOMP wire ✅
- **NestJS auth-service**: JWT, OTP, refresh token, user search API ✅

## Key Paths

- Auth API: `apps/server/auth-service/src/modules/auth/`
- Shared DB schemas: `packages/database/src/`
- Docker infra: `infra/docker-compose/compose.yml`
- Auth service .env: `apps/server/auth-service/.env`

## Reference Docs (đọc khi cần, không auto-load)

- Architecture decisions: `docs/decisions.md`
- Roadmap & milestones: `docs/roadmap.md`
- Chat service API spec: `docs/api-spec.md`

## Compaction Instructions

When compacting, always preserve: current task, list of modified files, any pending TODOs, and Spring Boot/Flutter patterns established so far.
