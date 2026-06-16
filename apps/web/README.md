<div align="center">

# web — Next.js Web Client

**PON realtime messaging platform — browser client**

[![Next.js](https://img.shields.io/badge/Next.js_15-000000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white)](https://vercel.com)

</div>

---

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 — App Router, Server Components by default |
| Language | TypeScript (strict) |
| UI | shadcn/ui + Tailwind CSS |
| State | Zustand (auth/UI) + TanStack Query v5 (server data) |
| HTTP | axios with JWT refresh interceptor |
| WebSocket | @stomp/stompjs (raw WS — same protocol as Flutter client) |
| Forms | react-hook-form + zod |
| i18n | next-intl (7 locales: en, vi, zh, ja, ko, es, fr) |
| Package manager | pnpm |

---

## Project Structure

```
apps/web/
  app/
    (auth)/             # Public routes — login, register, verify-otp, oauth-callback
    (main)/             # Protected routes — conversations, profile, settings, …
    api/                # Next.js route handlers (cookie proxies, auth helpers)
  components/
    ui/                 # shadcn/ui generated components (do not hand-edit)
    chat/               # Domain components — MessageBubble, ConversationItem, …
    call/               # WebRTC call overlay modals
    profile/            # Profile card and image cropper
  lib/
    api/
      auth.ts           # auth-service API calls
      chat.ts           # chat-service API calls
      axios.ts          # axios instances + silent-refresh interceptor
    store/
      auth.store.ts     # Zustand — currentUser, tokens
      ui.store.ts       # Zustand — modal open states
      call.store.ts     # Zustand — WebRTC call state
    stomp/
      client.ts         # STOMP singleton (connect/disconnect/subscribe)
    webrtc/
      call-manager.ts   # RTCPeerConnection + STOMP signaling
    hooks/              # TanStack Query hooks (use-conversations, use-messages, …)
  messages/             # i18n translation files (en.json, vi.json, …)
  middleware.ts         # Route protection — unauthenticated → /login
```

---

## Running Locally

```bash
# From repo root — start MongoDB + Redis
docker compose -f infra/docker-compose/compose.yml up -d

# Install dependencies
pnpm install

# Start the dev server (http://localhost:3000)
pnpm --filter @platform/web dev
```

Create `apps/web/.env.local`:

```env
NEXT_PUBLIC_AUTH_URL=http://localhost:3001
NEXT_PUBLIC_CHAT_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
```

---

## Auth Flow

Tokens are stored in **Zustand memory** (access token) and **httpOnly cookies** (refresh token + session ID, set by Next.js route handlers). The axios interceptor silently refreshes on 401 without logging the user out.

```
POST /auth/login → { accessToken, refreshToken, sid, user }
  → accessToken  → Zustand (memory only)
  → refreshToken + sid → httpOnly cookie via /api/auth/set-cookie

On 401 → POST /auth/refresh → new tokens → retry original request
On refresh failure → clearAuth() + redirect /login
```

---

## WebSocket (STOMP)

One singleton connection per session. Connect on login, disconnect on logout.

```typescript
stompService.connect(accessToken)

// Subscribe to messages in a conversation
stompService.subscribe(`/topic/conversation/${id}`, handler)

// Subscribe to global notifications
stompService.subscribe('/user/queue/notifications', handler)

// Send a message
stompService.publish('/app/chat.send', { conversationId, content, type: 'text' })
```

---

## Key Rules

- **App Router only** — no `pages/` directory.
- **Auth state** → Zustand `auth.store.ts`. Never store tokens in `localStorage`.
- **Server data** → TanStack Query. No Zustand for server data.
- **API calls** → always through `lib/api/axios.ts` instances (`authApi` / `chatApi`).
- **STOMP** → singleton `lib/stomp/client.ts`. Never create a new connection per component.
- **i18n** → `useTranslations()` everywhere. No hardcoded UI strings.
- Max 400 lines per file (per clean-code rule).

---

## Production

Deployed on **Vercel** with environment variables set in the project dashboard.

```
AUTH_SERVICE   https://auth-service-942942821810.asia-southeast1.run.app
CHAT_SERVICE   https://chat-service-942942821810.asia-southeast1.run.app
WS_URL         wss://chat-service-942942821810.asia-southeast1.run.app/ws
```

Full API reference → [`docs/api-spec.md`](../../docs/api-spec.md)
