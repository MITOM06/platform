# Performance Overhaul — Design Spec
**Date:** 2026-06-17  
**Scope:** Web (Next.js) + Mobile (Flutter) + Backend (RabbitMQ AI pipeline)  
**Target:** Fix slow initial load, conversation list jank, slow chat screen open

---

## 1. Root Cause Analysis

### Shared (both platforms)
| Issue | Location | Impact |
|---|---|---|
| N+1 API waterfall | ConversationList | 20 convs → 40+ HTTP calls on mount |
| Flutter: `autoDispose` on status/profile providers | `chat_misc_providers.dart` | Re-fetches on every scroll-back |

### Web-specific
| Issue | Location | Impact |
|---|---|---|
| All messages in DOM (no virtual scroll) | `MessageList.tsx` | Lag on long chat histories |
| `MessageBubble` not memoized | `MessageList.tsx` | Re-renders on typing/AI stream events |
| Raw `<img>` in image bubbles | `ImageContent.tsx` | No WebP, no blur placeholder |
| Conversations staleTime = 60s (refetches on focus) | `providers.tsx` | Unnecessary refetch |

### Flutter-specific
| Issue | Location | Impact |
|---|---|---|
| `userStatusProvider` is `autoDispose.family` | `chat_misc_providers.dart` | HTTP call per tile per scroll-back |
| `userProfileProvider` is `autoDispose.family` | `chat_misc_providers.dart` | Same issue |
| `ConversationTile` watches 5 providers | `conversation_tile.dart` | Wide rebuild surface |

### Backend
| Issue | Location | Impact |
|---|---|---|
| Redis pub/sub for AI requests (no retry, no durability) | chat-service + ai-service | AI request lost if ai-service down/restarts |

---

## 2. Solution Architecture

### Phase 1 — Frontend Data Layer (highest impact, no backend change)

**Web — Batch Prefetch in ConversationList**

When conversations load, immediately prefetch all participant user profiles in parallel before `ConversationItem` components mount. Items read from TanStack Query cache (cache hit, zero additional requests).

```
useConversations loads → extract unique otherUserIds
                        → queryClient.prefetchQuery(['user', id]) × N in parallel
                        → ConversationItems mount → all cache hits
```

Key files:
- `lib/hooks/use-conversations.ts` — add `staleTime: 2 * 60 * 1000` 
- `components/chat/ConversationList.tsx` — batch prefetch effect
- `lib/hooks/use-relationship.ts` — check if `staleTime` needs tuning

**Flutter — keepAlive on status/profile providers**

Replace `autoDispose` with `autoDispose` + `keepAlive()` timer (Riverpod pattern). Providers stay alive for 5 minutes even after tiles scroll off screen, preventing re-fetches.

```dart
// Before:
FutureProvider.autoDispose.family<UserStatus, String>((ref, userId) {
  return repo.getUserStatus(userId);
});

// After:
FutureProvider.autoDispose.family<UserStatus, String>((ref, userId) async {
  final link = ref.keepAlive();
  Timer(const Duration(minutes: 5), link.close);
  return repo.getUserStatus(userId);
});
```

Key files:
- `lib/features/chat/domain/chat_misc_providers.dart` — `userStatusProvider`, `userProfileProvider`

---

### Phase 2 — Frontend Render Layer

**Web — Virtual Scroll for MessageList**

Add `@tanstack/react-virtual` (same org as React Query, no conflict). Only visible messages render in the DOM. For a 500-message chat: from ~500 DOM nodes → ~15-20 visible nodes.

```
MessageList (outer scroll container)
  └── virtualizer (calculates visible range)
       └── only renders items in viewport + overscan of 5
```

Key files:
- `components/chat/MessageList.tsx` — add `useVirtualizer`
- `package.json` — add `@tanstack/react-virtual`

**Web — Memoize MessageBubble and ConversationItem**

Wrap both in `React.memo` with custom equality check. Prevents re-renders when only typing state or AI stream changes (which don't affect individual message bubbles).

```tsx
export const MessageBubble = memo(function MessageBubble(props) { ... },
  (prev, next) => prev.message.id === next.message.id &&
                  prev.message.content === next.message.content &&
                  prev.isPinned === next.isPinned
)
```

Key files:
- `components/chat/MessageBubble.tsx`
- `components/chat/ConversationItem.tsx`

**Web — next/image for ImageContent**

Replace raw `<img>` in `ImageContent.tsx` tiles with Next.js `<Image>` component.
- Automatic WebP/AVIF conversion
- `loading="lazy"` + blur placeholder
- `priority` on first image in collage

Since images are served from an external GridFS URL (not Next.js static), add the chat-service domain to `next.config.ts` `images.remotePatterns`.

Key files:
- `components/chat/ImageContent.tsx`
- `next.config.ts`

**Flutter — ConversationTile rebuild reduction**

Current tile watches: `authNotifierProvider`, `selectedConversationIdProvider`, `userStatusProvider(id)`, `userProfileProvider(id)`, `nicknamesProvider(convId)`.

Fixes:
1. Use `select` to narrow auth watch: `ref.watch(authNotifierProvider.select((s) => s.valueOrNull))` — only rebuilds when auth state changes, not on every event
2. Pull `selectedConversationIdProvider` watch into a tiny `_SelectedBorder` sub-widget (isolate rebuilds)
3. Use `ref.watch(userProfileProvider(id).select((s) => s.valueOrNull?.displayName))` — only rebuilds when displayName changes, not on any AsyncValue wrapper change

Key files:
- `lib/features/chat/ui/widgets/conversation_tile.dart`

---

### Phase 3 — Backend: RabbitMQ AI Pipeline

**Why RabbitMQ, not Kafka:**
- RabbitMQ: message queues with retry + DLQ, 1-5ms latency, easy Spring Boot + NestJS integration
- Kafka: event streaming at millions msg/day scale, complex setup — overkill here
- Redis pub/sub (current): no durability, no retry — AI request is lost if ai-service restarts mid-processing

**Architecture:**

```
[User sends message]
        │
        ▼
chat-service (Spring Boot)
  POST /api/messages → save to MongoDB
  → Publish to RabbitMQ exchange: "ai.direct"
        │
        ▼
RabbitMQ
  Queue: ai.requests (durable, TTL 30s)
  DLQ:   ai.requests.dlq (failed after 3 retries)
        │
        ▼
ai-service (NestJS) — consumes from ai.requests
  → Processes with Anthropic Claude
  → Streams chunks via Redis pub/sub (keep Redis for this — low-latency streaming)
        │
        ▼
chat-service — subscribes Redis ai:response:{convId}
  → Broadcasts via STOMP to clients
```

**New infrastructure (docker-compose):**
```yaml
rabbitmq:
  image: rabbitmq:3.13-management-alpine
  ports:
    - "5672:5672"    # AMQP
    - "15672:15672"  # Management UI
  environment:
    RABBITMQ_DEFAULT_USER: platform
    RABBITMQ_DEFAULT_PASS: platform
  volumes:
    - rabbitmq_data:/var/lib/rabbitmq
```

**chat-service changes (Spring Boot):**
- Add `spring-boot-starter-amqp` to `pom.xml`
- Create `RabbitMqConfig` bean: declare exchange, queue, binding, DLQ
- Create `AiMessagePublisher` service: replaces `RedisAiPublisher`
- AI request payload unchanged: `{conversationId, userId, displayName, content, history[]}`

**ai-service changes (NestJS):**
- Add `@golevelup/nestjs-rabbitmq` package
- Create `RabbitmqModule` with consumer binding to `ai.requests`
- `@RabbitSubscribe` handler replaces Redis `SUBSCRIBE ai:request`
- On failure: NACK → RabbitMQ retries (max 3) → DLQ

**Redis pub/sub is KEPT for:**
- `ai:response:{conversationId}` — streaming chunks back to chat-service (latency-sensitive, no retry needed)
- User status / session cache
- Online presence

---

## 3. Files Changed Summary

### Web (Next.js)
| File | Change |
|---|---|
| `package.json` | Add `@tanstack/react-virtual` |
| `next.config.ts` | Add `images.remotePatterns` for chat-service domain |
| `components/providers.tsx` | Tune global staleTime |
| `lib/hooks/use-conversations.ts` | Add `staleTime: 2 * 60 * 1000` |
| `components/chat/ConversationList.tsx` | Batch prefetch effect |
| `components/chat/ConversationItem.tsx` | Wrap in `React.memo` |
| `components/chat/MessageList.tsx` | Add `useVirtualizer` |
| `components/chat/MessageBubble.tsx` | Wrap in `React.memo` with equality fn |
| `components/chat/ImageContent.tsx` | Replace `<img>` with `next/image` |

### Flutter
| File | Change |
|---|---|
| `lib/features/chat/domain/chat_misc_providers.dart` | Add `keepAlive` timer to status + profile providers |
| `lib/features/chat/ui/widgets/conversation_tile.dart` | `select` narrowing on providers |

### Backend
| File | Change |
|---|---|
| `infra/docker-compose/compose.yml` | Add RabbitMQ service |
| `apps/server/chat-service/pom.xml` | Add `spring-boot-starter-amqp` |
| `apps/server/chat-service/src/.../config/RabbitMqConfig.java` | Exchange + Queue + DLQ beans |
| `apps/server/chat-service/src/.../service/AiRedisPublisher.java` | Replace body: publish to RabbitMQ instead of Redis |
| `apps/server/ai-service/package.json` | Add `@golevelup/nestjs-rabbitmq` + `amqplib` |
| `apps/server/ai-service/src/rabbitmq/rabbitmq.module.ts` | New module |
| `apps/server/ai-service/src/ai/ai.consumer.ts` | RabbitMQ consumer (replaces `redis-subscriber.service.ts`) |
| `apps/server/ai-service/src/redis/redis-subscriber.service.ts` | Remove Redis `SUBSCRIBE ai:request` (keep ai:response publisher) |
| `apps/server/ai-service/src/app.module.ts` | Import RabbitmqModule, remove redis subscriber for ai:request |
| `apps/server/ai-service/.env` + chat-service `.env` / `application.properties` | Add `RABBITMQ_URL` |

---

## 4. Expected Impact

| Area | Before | After |
|---|---|---|
| Conversation list HTTP requests | ~41 on mount | ~3-5 (batch prefetch, cache hits) |
| Flutter scroll-back re-fetch | Every scroll | 0 (5min keepAlive) |
| Message DOM nodes (500-msg chat) | ~500 | ~20 (virtual) |
| MessageBubble re-renders on typing | All messages | 0 |
| AI request durability | Lost if ai-service down | Queued, retried up to 3× |
| Image loading | No optimization | WebP, lazy, blur placeholder |

---

## 5. Out of Scope
- Full Kafka event streaming (overkill at current scale)
- Push notification service (separate concern)
- Backend pagination cursor optimization (separate Sprint)
- CDN for media files (infrastructure decision)
