# CLAUDE.md

> Read this file before doing anything.
> Sub-service context auto-loads when needed: `apps/server/chat-service/CLAUDE.md`, `apps/client/CLAUDE.md`, `apps/web/CLAUDE.md`

---

## Project: PON — Self-hosted Enterprise AI-Assistant Platform

**Owner:** Tran Phuc Khang | **Stack:** NestJS auth + Spring Boot chat + NestJS AI + NestJS connector + Flutter mobile + Next.js web

> **Direction (2026-06-19):** PON is pivoting from a chat app to a **self-hosted, single-tenant-per-deployment B2B AI-assistant platform** (one deployment = one company; Workspace → Departments → Members → Role). AI is central; users connect third-party tools via **governed MCP connectors** (`connector-service`, :3003) and the assistant acts for them from chat. Full state + roadmap: `docs/superpowers/PON-ENTERPRISE-HANDOFF.md`. Enterprise RBAC lives in auth-service + `packages/database/rbac` + `packages/database/auth`.

> **Active workstream (2026-06-24): Bot Factory ↔ PON bridge.** Federate a separate personal-assistant product (Bot Factory) into PON chat as an external bot member (the member's 1-1 "trợ lý riêng"), coexisting with native `@AI` (the company "bot tổng"). **Direction/handoff:** `docs/superpowers/BOTFACTORY-BRIDGE-DIRECTION.md`. **Plan:** `docs/superpowers/plans/2026-06-24-botfactory-personal-assistant-bridge.md`. ⛔ The `bot-factory` repo is READ-ONLY; all changes are in this repo (mostly `chat-service`).

## AUTONOMOUS MODE — DEFAULT BEHAVIOR

**Khi nhận task, Claude phải:**
1. Tự phân tích, lên plan, và thực thi hoàn toàn — không hỏi xác nhận giữa chừng.
2. Nếu có nhiều cách làm, tự chọn cách tốt nhất và ghi lại lý do trong báo cáo.
3. Tự chạy build/test sau khi thay đổi để verify.
4. Chạy liên tục cho đến khi hoàn thành, rồi mới báo cáo một lần duy nhất.
5. Khi xong, báo cáo ngắn gọn: những gì đã làm, file nào thay đổi, kết quả build/test.

**Không được hỏi:** "Bạn có muốn tôi tiếp tục không?", "Tôi có thể sửa file này không?", "Bạn có đồng ý không?"

## KHI NÀO PHẢI DỪNG VÀ HỎI

Chỉ dừng và hỏi khi gặp đúng các tình huống dưới đây — không hỏi bất kỳ điều gì khác:

**Bắt buộc hỏi (HARD STOP):**
- Task mơ hồ đến mức có thể hiểu theo 2+ hướng hoàn toàn khác nhau (ví dụ: "cải thiện performance" mà không rõ service nào, metric nào).
- Quyết định phá vỡ backward compatibility hoặc thay đổi API contract hiện tại.
- Thiếu secret/credential/env var cần thiết để chạy.
- Hành động không thể hoàn tác: xóa dữ liệu production, drop collection, force push lên `main`.
- Task yêu cầu chọn giữa 2 hướng kiến trúc đều hợp lệ và có trade-off rõ ràng khác nhau.

**Không được hỏi (tiếp tục tự chạy):**
- Cách implement cụ thể (chọn pattern, đặt tên biến, cấu trúc file).
- Quyết định nhỏ nằm trong phạm vi task đã giao.
- Refactor hoặc cleanup rõ ràng cần làm để hoàn thành task.
- Bất kỳ điều gì có thể tự suy luận từ codebase, CLAUDE.md, hoặc context hiện tại.

---

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
| connector-service | 3003 | NestJS (MCP connectors, OAuth, token vault) |
| MongoDB | **27018** (non-standard!) | Docker |
| Redis | 6379 | Docker |
| RabbitMQ AMQP | 5672 | Docker |
| RabbitMQ Management UI | 15672 | Docker (user: platform / platform) |

Start infra: `docker compose -f infra/docker-compose/compose.yml up -d`

## Package Managers

- JS/TS: **pnpm** (not npm, not yarn)
- Java: **Maven**
- Flutter: **flutter pub**

## Stack — Phase 2 AI ✅ COMPLETE (2026-06-07, Sprint AI-6 DONE)

- **Spring Boot 3 chat-service**: WebSocket (STOMP) + REST API + MongoDB + Redis + RabbitMQ + JWT validation ✅
- **Flutter client**: Neon UI + Auth flow + Chat UI + Riverpod + STOMP wire ✅
- **NestJS auth-service**: JWT, OTP, refresh token, user search API ✅
- **NestJS ai-service**: Anthropic Claude API + RabbitMQ consumer + Redis streaming + Memory + RAG + Tools + Persona ✅

## Message Bus Channels (AI layer)

### RabbitMQ — durable AI request queue

| Exchange | Queue | Publisher | Consumer | Payload |
|----------|-------|-----------|----------|---------|
| `ai.direct` (direct) | `ai.requests` | chat-service | ai-service | `{conversationId, userId, displayName, content, history[]}` |
| `ai.direct` (direct) | `ai.requests.dlq` | RabbitMQ (TTL/nack) | — | dead-lettered messages |

Queue settings: 30-second message TTL, dead-letter exchange `ai.direct.dlq`.

### Redis Pub/Sub — low-latency AI response streaming

| Channel | Publisher | Subscriber | Payload |
|---------|-----------|------------|---------|
| `ai:response:{conversationId}` | ai-service | chat-service | `{type: AI_STREAM_CHUNK\|AI_STREAM_DONE\|AI_STREAM_ERROR, chunk?, fullContent?}` |
| `kb:process` | chat-service | ai-service | `{documentId, conversationId, userId, fileUrl, mimeType, fileName}` |
| `kb:delete` | chat-service | ai-service | `{documentId}` |

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

## 하네스: Platform Feature Development

**목표:** 신규 기능을 Backend + Flutter + Next.js 3개 플랫폼에 동시에 구현하고 QA 검증한다.

**트리거:** 기능 구현/추가 요청 시 `orchestrate-feature` 스킬을 사용하라. 플랫폼 동기화 확인 시 `sync-check` 스킬을 사용하라. 단순 질문은 직접 응답 가능.

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-06-13 | 초기 구성 | 전체 | - |

---

## Compaction Instructions

When compacting, always preserve: current task, list of modified files, any pending TODOs, and Spring Boot/Flutter patterns established so far.
