# Web Client Plan — Next.js

> Stack decision: Next.js 15 + shadcn/ui + Zustand + TanStack Query + STOMP  
> Full context: `apps/web/CLAUDE.md`

---

## Sprint W-1 — Scaffold & Foundation

**Goal:** running dev server, auth axios instance, STOMP client wired up.

- [x] Init Next.js 16 in `apps/web/` (upgraded from 15 → 16.2.7 by create-next-app)
- [x] Add to pnpm workspace: `apps/web/package.json` name = `@platform/web`
- [x] Install deps: `shadcn/ui` init (components.json + lib/utils.ts), `axios`, `zustand`, `@tanstack/react-query`, `@stomp/stompjs`, `react-hook-form`, `zod`
- [x] Create `apps/web/.env.local` (local) and `apps/web/.env.production` (prod URLs)
- [x] `lib/api/axios.ts` — two axios instances (authApi, chatApi) with JWT interceptor + refresh logic
- [x] `lib/store/auth.store.ts` — Zustand store: `{ user, accessToken, setAuth, clearAuth }`
- [x] `lib/stomp/client.ts` — STOMP singleton: `connect(token)`, `disconnect()`, `subscribe()`, `publish()`
- [x] `proxy.ts` — redirect `/login` if no token cookie (Next.js 16 renames middleware → proxy)
- [x] `app/(auth)/login/page.tsx` — basic login form (no styling yet)
- [x] Verify: `pnpm dev` runs clean, `/` → 307 → `/login` → 200 ✅

---

## Sprint W-2 — Auth UI

**Goal:** complete auth flow — register, login, OTP verify, logout.

- [x] `app/(auth)/login/page.tsx` — email + password form, shadcn Input/Button, zod validation
- [x] `app/(auth)/register/page.tsx` — email + password + displayName
- [x] `app/(auth)/verify-otp/page.tsx` — 6-digit OTP input, resend timer
- [x] `app/api/auth/set-cookie/route.ts` — Next.js route handler to set httpOnly cookie for refresh token + sid
- [x] `app/api/auth/clear-cookie/route.ts` — logout cookie clear
- [x] Logout button in layout → `clearAuth()` + clear cookie + redirect
- [x] Loading states, error toasts (sonner)
- [ ] Verify: full register → OTP → login → logout flow works end-to-end

---

## Sprint W-3 — Chat Core

**Goal:** conversation list + message thread with real-time updates.

- [x] `app/(main)/layout.tsx` — sidebar (conversation list) + main area (message thread)
- [x] `lib/hooks/use-conversations.ts` — TanStack Query: `GET /api/conversations`
- [x] `lib/hooks/use-messages.ts` — TanStack Query: `GET /api/conversations/:id/messages` (cursor paginated)
- [x] `components/chat/ConversationItem.tsx` — avatar, name, last message preview, unread badge
- [x] `components/chat/ConversationList.tsx` — list + search bar
- [x] `app/(main)/conversations/[id]/page.tsx` — message thread view
- [x] `components/chat/MessageBubble.tsx` — sent/received styling, timestamp
- [x] `components/chat/MessageInput.tsx` — textarea + send button
- [x] STOMP: on open conversation → subscribe `/topic/conversation/:id` → append new messages to TanStack Query cache
- [x] REST send via `POST /api/messages` + add to cache (deduplication by ID; STOMP `/app/chat.send` deferred to W-4 optimistic path)
- [x] Mark as read: `POST /api/conversations/:id/read` on conversation open
- [ ] Verify: two browser tabs, send message, real-time delivery works

---

## Sprint W-4 — Features

**Goal:** user search, new conversation, typing indicator, online status, AI chat.

- [x] `components/chat/NewConversationModal.tsx` — search users (`GET /api/users/search?q=`), click → `POST /api/conversations`
- [x] Typing indicator: publish `/app/chat.typing` on input, subscribe `/topic/conversation/:id/typing` → show "đang nhập..."
- [x] Online status: `GET /api/users/:id/status` on conversation open → green dot
- [x] STOMP `/user/queue/notifications` → browser Notification API (ask permission on login)
- [x] AI conversation detection: if `participants` includes `ai-bot-000000000000000000000001` → render AI badge, no typing needed from user side
- [x] `app/(main)/profile/page.tsx` — view/edit display name, avatar
- [x] Infinite scroll for messages (TanStack Query `fetchNextPage`)
- [ ] Verify: full feature parity with Flutter client for core flows

---

## Sprint W-5 — Polish & Deploy

**Goal:** production-ready, deployed to Vercel.

- [x] Responsive layout — mobile breakpoint: hide sidebar, show back button on message view
- [x] Dark mode toggle (shadcn + `next-themes`)
- [x] Empty states: no conversations, no messages
- [x] Error boundaries, 404 page
- [x] Loading skeletons (shadcn Skeleton)
- [x] `pnpm build` — TypeScript clean ✅ (2026-06-09)
- [ ] Deploy to Vercel: `apps/web/` as root, set env vars in Vercel dashboard
- [ ] Update CORS in chat-service `application.yml` to allow Vercel domain
- [ ] Add Vercel URL to Google OAuth allowed origins
- [ ] Smoke test production: login → send message → real-time → AI reply

---

## Deferred (post-MVP)

- File/image upload in messages
- Message reactions
- Group conversations
- Push notifications (FCM Web)
- E2E tests (Playwright)
