# CLAUDE.md — apps/web (Next.js Web Client)

> Read root CLAUDE.md first. This file adds web-specific context.

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript strict |
| UI | shadcn/ui + Tailwind CSS |
| State | Zustand (auth/UI) + TanStack Query v5 (server state) |
| HTTP | axios with interceptors (mirror Flutter DioClient pattern) |
| WebSocket | @stomp/stompjs (same protocol as Flutter client) |
| Forms | react-hook-form + zod |
| Package manager | pnpm (workspace member `@platform/web`) |

## Production URLs

```
AUTH_SERVICE=https://auth-service-942942821810.asia-southeast1.run.app
CHAT_SERVICE=https://chat-service-942942821810.asia-southeast1.run.app
AI_SERVICE=https://ai-service-942942821810.asia-southeast1.run.app
WS_URL=wss://chat-service-942942821810.asia-southeast1.run.app/ws
```

Local dev: auth=3001, chat=8080, ai=3002 (same as root CLAUDE.md ports).

## Project Structure

```
apps/web/
  app/                    # Next.js App Router
    (auth)/               # route group — unauthenticated
      login/page.tsx
      register/page.tsx
      verify-otp/page.tsx
    (main)/               # route group — requires auth
      layout.tsx          # sidebar + chat layout
      page.tsx            # redirect → /conversations
      conversations/
        page.tsx          # conversation list
        [id]/page.tsx     # message thread
    api/                  # Next.js route handlers (proxy if needed)
  components/
    ui/                   # shadcn/ui generated components (DO NOT hand-edit)
    chat/                 # domain components: MessageBubble, ConversationItem…
    layout/               # Sidebar, Header, etc.
  lib/
    api/
      auth.ts             # auth-service API calls
      chat.ts             # chat-service API calls
      axios.ts            # axios instance + JWT interceptor
    store/
      auth.store.ts       # Zustand — currentUser, tokens
    stomp/
      client.ts           # STOMP singleton, connect/disconnect/subscribe
    hooks/
      use-messages.ts     # TanStack Query hooks
      use-conversations.ts
  middleware.ts           # Next.js middleware — redirect unauth to /login
```

## Auth Flow

Tokens stored in **memory (Zustand) + httpOnly cookie** (set via Next.js route handler).

```
POST /auth/login → { accessToken, refreshToken, sid, user }
  → store accessToken in Zustand (memory only, short-lived)
  → store refreshToken + sid in httpOnly cookie via /api/auth/set-cookie

On 401: POST /auth/refresh { sid, refreshToken } → new tokens
On refresh fail: clear cookies → redirect /login
```

Axios interceptor mirrors Flutter _TokenRefreshInterceptor. See `lib/api/axios.ts`.

JWT payload contains: `{ sub: userId, email, displayName, iat, exp }`.

## WebSocket (STOMP)

```typescript
// Raw WebSocket — NO SockJS (same as Flutter)
const client = new Client({
  brokerURL: process.env.NEXT_PUBLIC_WS_URL,
  connectHeaders: { Authorization: `Bearer ${token}` },
  reconnectDelay: 5000,
});

// Subscribe after connect:
client.subscribe(`/topic/conversation/${id}`, (frame) => { /* new message */ });
client.subscribe(`/topic/conversation/${id}/typing`, handler);
client.subscribe('/user/queue/notifications', handler);

// Send:
client.publish({ destination: '/app/chat.send', body: JSON.stringify({ conversationId, content, type: 'text' }) });
client.publish({ destination: '/app/chat.typing', body: JSON.stringify({ conversationId, typing: true }) });
```

STOMP client is a **singleton** — one connection for the whole session. See `lib/stomp/client.ts`.

## API Quick Reference

Full spec: `docs/api-spec.md`. Key endpoints:

```
# auth-service (3001 / AUTH_SERVICE)
POST /auth/register        { email, password, displayName }
POST /auth/login           { email, password }
POST /auth/refresh         { sid, refreshToken }
POST /auth/verify-otp      { email, otp }
GET  /api/users/me
GET  /api/users/search?q=

# chat-service (8080 / CHAT_SERVICE)
GET  /api/conversations
POST /api/conversations    { participantId }
GET  /api/conversations/:id/messages?page=0&size=20
PUT  /api/messages/:id/read
GET  /api/users/:id/status
```

## Env Files

```bash
# apps/web/.env.local (gitignored)
NEXT_PUBLIC_AUTH_URL=http://localhost:3001
NEXT_PUBLIC_CHAT_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws

# apps/web/.env.production (committed, no secrets)
NEXT_PUBLIC_AUTH_URL=https://auth-service-942942821810.asia-southeast1.run.app
NEXT_PUBLIC_CHAT_URL=https://chat-service-942942821810.asia-southeast1.run.app
NEXT_PUBLIC_WS_URL=wss://chat-service-942942821810.asia-southeast1.run.app/ws
```

## Rules

- `NEXT_PUBLIC_*` only for non-secret config. No secrets in client bundle.
- All API calls go through `lib/api/axios.ts` instances — never raw fetch.
- STOMP client must be singleton — use `lib/stomp/client.ts` exported instance.
- Route protection via `middleware.ts` — check accessToken cookie, redirect /login.
- shadcn components go in `components/ui/` — run `npx shadcn add <name>`, never hand-write.
- Max 400 lines per file (same as root clean-code rule).
- Run `pnpm build` before committing to catch TypeScript errors.
