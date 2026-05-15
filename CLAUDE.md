# CLAUDE.md

> Đọc file này trước khi làm bất cứ thứ gì.
> Sub-service context tự load khi cần: `apps/server/chat-service/CLAUDE.md`, `apps/client/CLAUDE.md`

---

## Project: Platform — Realtime Messaging App (FPT Aptech PRJ4)

**Owner:** Tran Phuc Khang | **Stack:** NestJS auth + Spring Boot chat + Flutter mobile

## CRITICAL RULES

- **KHÔNG sửa `apps/server/auth-service/`** — đã hoàn chỉnh, không đụng vào trừ khi được yêu cầu rõ ràng.
- **`apps/server/chat-service/`** — đang replace toàn bộ Go code bằng Spring Boot 3. Xóa Go khi bắt đầu.
- **`apps/client/`** — đang replace React Native bằng Flutter. React Native cũ giữ tham khảo logic.
- MongoDB database name: `platform` — dùng chung cả 2 services.
- JWT secret phải **giống nhau** giữa auth-service và chat-service.
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

## What's Being Built (PRJ4 — Java Enterprise)

1. **Spring Boot 3 chat-service**: WebSocket (STOMP) + REST API + Spring Data MongoDB + Spring Security JWT
2. **Flutter client**: Auth flow + Chat UI + Riverpod state management

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
