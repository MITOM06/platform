---
paths:
  - "apps/client/**"
---

# Flutter Client Rules

You are working on the Flutter client. Follow these rules:

**Structure**: Feature-based layout — `lib/features/<name>/{data,domain,ui}/`. Never put business logic in widgets.

**State**: Riverpod only. Every screen extends `ConsumerWidget`. Async state always via `AsyncValue` with `.when(data:, loading:, error:)`.

**HTTP**: Dio with interceptor that auto-attaches `Authorization: Bearer <token>` from flutter_secure_storage.

**Auth API base**: `http://localhost:3001` — NestJS auth-service.
**Chat API base**: `http://localhost:8080` — Spring Boot chat-service.
**WebSocket**: `ws://localhost:8080/ws` — STOMP via stomp_dart_client.

**Error handling**: Every async operation must handle error state visibly. Never silently swallow exceptions.

**Null safety**: Dart 3 — full null safety. No `!` force-unwrap without a comment explaining why it's safe.

**Navigation**: go_router only. No direct Navigator.push calls.
