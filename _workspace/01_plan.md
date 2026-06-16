# Feature: SPRINT W-16/W-17 — Bug Fixes, UI/UX Refinement, Profile Overhaul, Auth & Media Persistence (12 tasks)

## Summary

12 tasks across SPRINT W-16 (Phase 2) and W-17 (Phase 3). 11 are **Web-only** (`apps/web/`);
only **W-16.4** also touches Mobile (`apps/client/`). Backend analysis confirms the auth-service
User schema (`packages/database/src/mongo/user.schema.ts`) already has `avatarUrl`, `bio`,
`coverPhoto`, `dateOfBirth`, and `users.service.updateProfile` + `PATCH /api/users/me` already
accept all of them — so **no backend changes are required for any task**. Several tasks are
bug-fixes on existing code (axios refresh interceptor already exists, privacy page already exists,
DOB schema already exists), so the work is precise wiring/UI fixes rather than new infrastructure.

> **Backend verdict for the whole sprint: NONE.** Verified by reading
> `packages/database/src/mongo/user.schema.ts` (has avatarUrl/bio/coverPhoto/dateOfBirth),
> `apps/server/auth-service/src/modules/users/users.service.ts` (updateProfile handles all 5 fields),
> and `users.controller.ts` (`@Patch('me')` + `@Get('me')` + `@Get(':id')` expose them).

---

## W-16.1 — Shared Media & Links Gallery Bug (Web)

**Root cause (read `components/chat/SharedMediaGallery.tsx`):**
- The "media" tab renders `<img src={msg.content}>` directly. `msg.content` is a raw upload path
  (e.g. `/api/uploads/...`), not an absolute URL → broken images on production. The codebase has
  `lib/media.ts` `absoluteMediaUrl()` (per sync.md) that must be applied.
- The "file" / "link" tabs render `msg.content` as plain text with no anchor, no filename parsing,
  no graceful handling of `undefined` content (possible crash on `.truncate` of null).
- No `<img>` `onError` fallback → a missing asset shows a broken-image icon instead of the
  `ImageIcon` placeholder.

| File | Change | Detail |
|------|--------|--------|
| `apps/web/components/chat/SharedMediaGallery.tsx` | 수정 | Wrap image/file/link URLs with `absoluteMediaUrl()`; add `onError` handler to swap broken `<img>` for the `ImageIcon` placeholder; render link/file rows as clickable `<a target="_blank" rel="noopener">`; null-guard `msg.content`; show filename (last path segment) for files. |
| `apps/web/lib/media.ts` | 참고 (read-only) | Reuse existing `absoluteMediaUrl()`. |

**Backend: 없음. Mobile: 없음** (Flutter equivalent `ExploreMediaScreen` already exists and is out of W-16 scope — Web-only task).

---

## W-16.2 — Call Log Indicators in Chat (Web)

**Analysis (read `lib/webrtc/call-manager.ts`, `lib/system-messages.ts`, `lib/api/types.ts`):**
- `MessageType` already includes `'call_log'`. There is currently **no client-side system message
  emitted** when a call ends — `endCall()` only publishes `/app/call.end` STOMP signal with
  `{ duration }`, nothing renders a "call ended" bubble.
- The established pattern is client-generated `system.*` codes humanized in `lib/system-messages.ts`
  (e.g. `system.theme.changed:`, `system.quick_reaction.changed:`) — mirror this. **No backend change.**
- Decision: emit a `system.call.ended:{video|voice}:{seconds}` content string into the conversation
  via the existing message-send path on call teardown, then humanize + icon it. This follows the
  existing `system.quick_reaction.changed:` precedent (client sends a `system.*` message).

| File | Change | Detail |
|------|--------|--------|
| `apps/web/lib/webrtc/call-manager.ts` | 수정 | On `teardown`/`endCall`, post a message `system.call.ended:<video\|voice>:<durationSeconds>` to the conversation (reuse `chatService.sendMessage` / existing send helper). |
| `apps/web/lib/system-messages.ts` | 수정 | Add `system.call.ended:` parsing → "Video call ended · 01:03" / "Voice call ended · 00:42" with `mm:ss` formatting; short variant for sidebar. |
| `apps/web/components/chat/MessageBubble.tsx` | 수정 | When content starts with `system.call.ended:`, render a centered system bubble with a `Phone`/`Video` lucide icon + humanized text. |
| `apps/web/messages/*.json` (en, vi, …) | 수정 | Add `systemVideoCallEnded`, `systemVoiceCallEnded` keys (with `{duration}` placeholder). |

**Backend: 없음** (client emits `system.*` exactly like theme/nickname/quick-reaction). **Mobile: 없음** (Web-only task; sync.md note: Flutter must render the same `system.call.ended:` later, but out of this sprint's scope — flag in QA).

---

## W-16.3 — Toast Notification Repositioning (Web)

**Analysis (read `components/providers.tsx`):** Single `<Toaster richColors closeButton />` (sonner).
Sonner default position is `bottom-right`. Change to `top-center`.

| File | Change | Detail |
|------|--------|--------|
| `apps/web/components/providers.tsx` | 수정 | `<Toaster position="top-center" richColors closeButton />`. Sonner ships slide-in/out + z-index by default; verify z-index over Dialog/Sheet (`components/ui/sonner.tsx` style override if needed). |
| `apps/web/components/ui/sonner.tsx` | 수정 (조건부) | Only if z-index/animation needs adjustment for top-center over modals. |

**Backend: 없음. Mobile: 없음.**

---

## W-16.4 — Notification Permission Logic Flow (Web & Mobile) ★ only cross-platform task

**Web root cause (read `app/(main)/layout.tsx:76-78`):** `Notification.requestPermission()` is called
inside the STOMP connect callback in the `(main)` layout. That is gated behind auth, but it fires on
**every** authenticated session load, not specifically "after first successful login/register". The
spec wants the prompt **only after a successful register/login**, never on public pages. Public pages
(`(auth)` group) don't call it today, so the "never on landing/login" half already holds; the fix is
to move the trigger to the explicit post-login/post-register success path and guard with a
"already prompted" flag.

**Mobile root cause (read `apps/client/lib/main.dart:31`):** `FirebaseMessaging.instance.requestPermission()`
is called at **app startup in `main()`** — i.e. before the user logs in, on the splash/landing.
This directly violates the spec. Must move to post-login/post-register success.

| Platform | File | Change | Detail |
|----------|------|--------|--------|
| Web | `apps/web/app/(main)/layout.tsx` | 수정 | Remove the unconditional `requestPermission()` in the connect callback. |
| Web | `apps/web/app/(auth)/login/page.tsx` | 수정 | After successful login (and OTP verify if applicable), call a shared `maybeRequestNotificationPermission()` once. |
| Web | `apps/web/app/(auth)/register/page.tsx` / `verify-otp/page.tsx` | 수정 | Same call after successful registration/verification. |
| Web | `apps/web/lib/notifications.ts` | 신규 | `maybeRequestNotificationPermission()` — guards `typeof Notification`, only requests when `permission === 'default'`, sets a `localStorage` flag so it isn't re-prompted each login. |
| Mobile | `apps/client/lib/main.dart` | 수정 | **Remove** `FirebaseMessaging.instance.requestPermission(...)` from `main()`. Keep background handler + `onMessageOpenedApp` + `getInitialMessage`. |
| Mobile | `apps/client/lib/features/auth/domain/auth_provider.dart` | 수정 | In `_registerFcmToken()` (called from `login`, `loginWithCode`, register success, and `build()` for restored session), call `FirebaseMessaging.instance.requestPermission(alert,badge,sound)` **before** `getToken()`. This ties the prompt to authenticated state only. |

**Backend: 없음.**

---

## W-16.5 — Sidebar Header UI Consolidation (Web)

**Analysis (read `app/(main)/layout.tsx:193-232`):** Header currently has 4 separate icon buttons —
Compass (Explore/`openPublicChannels`), MessageSquarePlus (`openNewChat('direct')`),
Users (`openNewChat('group')`), Contact (`/friends` Link) — plus the profile avatar dropdown.
Spec: consolidate the **new chat / new group** actions into one "+" button with a dropdown
("Create New Chat" / "Create New Group").

| File | Change | Detail |
|------|--------|--------|
| `apps/web/app/(main)/layout.tsx` | 수정 | Replace the MessageSquarePlus + Users buttons with a single `Plus` icon `DropdownMenu` → items "Trò chuyện mới" (`openNewChat('direct')`) and "Tạo nhóm" (`openNewChat('group')`). Keep Compass (Explore) and Contact (Friends) as-is, or fold into the same menu per "clean layout" — decision: keep Explore + Friends as standalone icons, fold only New-Chat/New-Group into "+" (matches spec wording "Create New Chat / Create New Group"). Uses existing shadcn `DropdownMenu`. |
| `apps/web/messages/*.json` | 수정 (조건부) | Reuse existing `openNewChat` labels; add `createNew` tooltip key if header is i18n'd. |

**Backend: 없음. Mobile: 없음.**

---

## W-16.6 — Profile Modal Overhaul & Bio State Bug (Web)

**Root causes (read `app/(main)/profile/page.tsx`):**
1. **Bio disappears bug:** `useForm` `defaultValues.bio` is hardcoded `''` (line 64). The page never
   fetches the persisted profile (`authService.getMe()` returns `bio`/`avatarUrl`), so on reopen the
   field is always empty. Also `onSubmit` only sends `bio` when truthy (`...(values.bio ? {bio} : {})`)
   → clearing a bio can't persist an empty string.
2. **DOB field present:** lines 257-268 render a Date-of-birth display field + `Calendar` import — must be removed (display + edit). Keep schema field untouched.
3. **No cover photo, no access-control / others'-view, not a floating Zalo-style card.**
4. `AuthUser` store type (`lib/store/auth.store.ts`) lacks `avatarUrl`/`bio`/`coverPhoto`, so even
   after save the in-memory user never carries them.

| File | Change | Detail |
|------|--------|--------|
| `apps/web/lib/store/auth.store.ts` | 수정 | Extend `AuthUser` with optional `avatarUrl?`, `bio?`, `coverPhoto?`. |
| `apps/web/app/(main)/profile/page.tsx` | 수정 | Fetch profile via `authService.getMe()` (TanStack Query) and seed form `defaultValues` with persisted `bio`/`displayName`; `reset()` on data load. Always send `bio` (even empty string) in `updateProfile`. Remove DOB field + `Calendar` import. Redesign as Zalo-style floating card (cover photo banner + overlapping avatar + name/bio/details card). Add cover-photo upload (W-17.4). File may exceed 400 lines → split per clean-code rule (see below). |
| `apps/web/components/chat/UserProfileDrawer.tsx` | 수정 | Make it the **view-only** profile for *other* users (no Edit button); for self show Edit → route `/profile`. It already shows bio (lines 140-144) and avatar; add cover photo + access-control: if `userId === currentUser.id` show "Edit" CTA, else view-only. |
| `apps/web/components/chat/ProfileCard.tsx` (or `components/profile/`) | 신규 (조건부) | Extract the shared Zalo-style card so profile page (self/edit) and UserProfileDrawer (other/view) reuse one layout and stay under 400 lines. |
| `apps/web/messages/*.json` | 수정 | Remove DOB-related keys usage; add `editProfile`, `coverPhoto` labels. Drop `birthdateLabel`/`birthdateNotSet` usage. |

**Backend: 없음** (schema/API already support bio + coverPhoto; DOB removal is frontend-display-only — schema field intentionally left in place for backward compatibility). **Mobile: 없음.**

---

## W-17.1 — Reaction Notification in Chat Sidebar (Web)

**Analysis (read `conversations/[id]/page.tsx:308`, `lib/api/types.ts`, `components/chat/ConversationItem.tsx`):**
- `REACTION_UPDATED` STOMP event (`{ messageId, reactions }`) is already handled in the open
  conversation thread (`patchMessage`). It is **not** reflected in the sidebar preview.
- `Conversation.lastMessage` has no reaction field; sidebar subtitle comes from `humanizeSystemMessage`.
- Decision: subscribe to reaction events at the conversation-list / layout level (where
  `/user/queue/notifications` is already subscribed) and, when *another user* reacts to *your* last
  message, set a transient per-conversation preview override "[User] reacted to your message".
  **No backend change** — reuse existing `REACTION_UPDATED` (and/or the notification queue payload).

| File | Change | Detail |
|------|--------|--------|
| `apps/web/lib/api/types.ts` | 수정 (조건부) | Confirm/extend the notification queue payload type to include a `REACTION` notification variant if the backend already emits one to `/user/queue/notifications`; otherwise derive from `REACTION_UPDATED` on subscribed topics. (Verify which channel carries cross-conversation reactions before coding.) |
| `apps/web/lib/hooks/use-conversations.ts` | 수정 | Add a reaction-preview override map (conversationId → "{name} reacted…"), updated from the STOMP reaction handler via `queryClient.setQueryData`. |
| `apps/web/components/chat/ConversationItem.tsx` | 수정 | Prefer the reaction-preview override (if present + newer than `lastMessageAt`) over the humanized last message. |
| `apps/web/app/(main)/layout.tsx` | 수정 (조건부) | If reactions must update sidebar globally (not only in open thread), subscribe to the reaction signal here and feed the override map. |
| `apps/web/messages/*.json` | 수정 | Add `reactedToYourMessage` ("{name} reacted to your message"). |

**Backend: 없음** (reuse existing REACTION_UPDATED / notifications queue — verify channel during impl, no new endpoint). **Mobile: 없음.**

---

## W-17.2 — Critical Auth Fix: Sudden Logout (Token Expiry) (Web)

**Analysis (read `lib/api/axios.ts`):** A silent-refresh response interceptor **already exists** and is
correct in shape: on 401 it calls `POST /api/auth/refresh`, updates the Zustand token, replays the
queued/original request, and only clears auth + redirects on refresh failure. `isRefreshing` +
`failedQueue` already serialize concurrent 401s.

**Remaining work = verify + harden, not build from scratch:**

| File | Change | Detail |
|------|--------|--------|
| `apps/web/lib/api/axios.ts` | 수정 (검증/보강) | Confirm both `authApi` and `chatApi` use the interceptor (they do). Ensure the `Authorization` header is re-applied for queued requests (it is). Edge cases to harden: (a) requests that 401 *before* a token exists (initial load) shouldn't loop; (b) ensure non-401 errors pass through; (c) ensure `/api/auth/refresh` itself excluded from retry (already guarded). Add a request-config flag to skip refresh for explicitly public calls if needed. |
| `apps/web/app/api/auth/refresh/route.ts` | 참고 (read-only) | Verify the Next route handler reads `refreshToken`+`sid` from httpOnly cookies and proxies to auth-service `POST /auth/refresh`, returning a fresh `accessToken`. Fix only if mismatched. |

**Backend: 없음** (auth-service `POST /auth/refresh` already exists per web/CLAUDE.md). **Mobile: 없음.**

---

## W-17.3 — Privacy Policy Link Routing (Web)

**Root cause (read `middleware.ts:6`, `app/(auth)/privacy/page.tsx` exists, `register/page.tsx:196`):**
The privacy page **exists** at `/privacy` and register/login link to it. But `middleware.ts`
`PUBLIC_PATHS = ['/login','/register','/verify-otp','/oauth-callback']` does **not** include
`/privacy`. An unauthenticated user clicking "Privacy Policy" hits middleware → redirected to
`/login`. That is the routing bug.

| File | Change | Detail |
|------|--------|--------|
| `apps/web/middleware.ts` | 수정 | Add `'/privacy'` (and `'/forgot-password'` if similarly affected) to `PUBLIC_PATHS`. |
| `apps/web/app/(auth)/register/page.tsx` / `login/page.tsx` | 수정 (조건부) | Confirm both link to `/privacy`; register already does. Add the link to login if missing. |

**Backend: 없음. Mobile: 없음.**

---

## W-17.4 — Avatar & Cover Photo Persistence + Cropper (Web)

**Root causes (read `app/(main)/profile/page.tsx:67-90`):**
- Avatar upload calls `chatService.uploadFile` then `authService.updateProfile({avatarUrl})`, but then
  calls `setAuth(user, accessToken)` with the **old** `user` — the new `avatarUrl` is never written to
  the Zustand store (and `AuthUser` has no `avatarUrl` field). So the change doesn't persist in UI
  state and disappears on navigation/reload (the DB row *is* updated; the bug is client state binding).
- No cover-photo upload at all.
- No cropper/preview modal; the image is applied immediately (avatar) instead of confirm-then-save.

| File | Change | Detail |
|------|--------|--------|
| `apps/web/lib/store/auth.store.ts` | 수정 | Add `avatarUrl?`/`coverPhoto?` to `AuthUser` (shared with W-16.6). |
| `apps/web/app/(main)/profile/page.tsx` | 수정 | On avatar/cover save, write the returned URL into the store: `setAuth({...user, avatarUrl}, token)`. Defer applying the image until the cropper modal "Confirm" → then the profile-form "Save Changes" actually uploads + `updateProfile`. Add cover-photo input + preview. Seed initial avatar/cover from `getMe()`. |
| `apps/web/components/profile/ImageCropperModal.tsx` | 신규 | Reusable cropper/preview modal (avatar = square/round crop, cover = wide aspect). Use `react-easy-crop` (add dep) or a canvas-based crop; emit a cropped `Blob`/`File`. "Confirm" closes modal with the cropped file; caller stages it until "Save Changes". |
| `apps/web/lib/api/chat.ts` | 참고 (read-only) | Reuse `chatService.uploadFile` for both avatar + cover. |
| `apps/web/lib/api/auth.ts` | 참고 (read-only) | `updateProfile` already supports `avatarUrl` + `coverPhoto`. |
| `apps/web/package.json` | 수정 (조건부) | Add `react-easy-crop` if chosen for cropping. |
| `apps/web/messages/*.json` | 수정 | `cropImage`, `confirm`, `coverPhoto`, `changeCover`. |

**Backend: 없음** (avatarUrl + coverPhoto already persisted by `PATCH /api/users/me`). **Mobile: 없음.**

---

## W-17.5 — Mobile-Web Navigation Bug (Web)

**Analysis (read `app/(main)/layout.tsx:254-265`):** "Hồ sơ cá nhân" (`/profile`) and "Cài đặt"
(`/settings`) are `DropdownMenuItem asChild > Link`. On touch/responsive, the known shadcn issue is
the `DropdownMenuItem` `onSelect` closing the menu and **swallowing the navigation** before the
`<Link>` resolves (pointer events on touch). Result: tapping does nothing on responsive web.

| File | Change | Detail |
|------|--------|--------|
| `apps/web/app/(main)/layout.tsx` | 수정 | Replace `asChild`+`Link` pattern with `onSelect={() => router.push('/profile')}` (and `/settings`), or add `onClick` + `e.preventDefault()` handling so the touch tap reliably routes. Apply the same fix to any other responsive nav entry (Friends/Explore) that uses the same pattern. |

**Backend: 없음. Mobile: 없음.**

---

## W-17.6 — Global Chat Search Scope (Web)

**Root cause (read `components/chat/ConversationList.tsx:72-76`):** `filtered` only matches
`conv.name` (group name). For 1:1 (`type === 'direct'`), `conv.name` is often null/empty — the
display name comes from the resolved peer user. So searching a friend's name/nickname returns nothing.

| File | Change | Detail |
|------|--------|--------|
| `apps/web/components/chat/ConversationList.tsx` | 수정 | Extend the filter: for `type === 'group'` match `conv.name`; for `type === 'direct'` resolve the peer's display name + nickname (via the same source `ConversationItem` uses — `lib/nicknames.ts` + the peer user lookup) and match against it. Keep results rendering through existing `ConversationItem`. |
| `apps/web/lib/nicknames.ts` | 참고 (read-only) | Reuse nickname resolution so search matches the *displayed* name. |
| `apps/web/components/chat/ConversationItem.tsx` | 참고 (read-only) | Mirror exactly how the visible name is derived so search ↔ display stay consistent. |

**Backend: 없음** (existing conversation/user data is sufficient; if peer names aren't already in the conversation payload, reuse the user-lookup hooks already used by `ConversationItem`). **Mobile: 없음.**

---

## API Contract

**No new endpoints, no changed contracts.** All tasks reuse existing APIs:
- `PATCH /api/users/me` (auth-service) — already accepts `{ displayName, avatarUrl, bio, coverPhoto, dateOfBirth }`.
- `GET /api/users/me`, `GET /api/users/:id` — already return `avatarUrl`, `bio`, `coverPhoto`, `dateOfBirth`.
- `POST /auth/refresh` (auth-service) via Next route `/api/auth/refresh` — already used by axios interceptor.
- `chatService.uploadFile` — reused for avatar + cover.
- STOMP `REACTION_UPDATED` + `/user/queue/notifications` — reused for W-17.1.
- Client-emitted `system.call.ended:<video|voice>:<seconds>` message — same mechanism as existing `system.*` codes.

## Data Model Changes

**Backend: 없음.** User schema already has all needed fields.
**Web client type only:** extend `AuthUser` (`lib/store/auth.store.ts`) with `avatarUrl?`, `bio?`, `coverPhoto?` (in-memory state shape, not a DB change).

## Implementation Order

Bug-fixes that are low-risk + unblock UI work first; large UI redesigns last.

1. **W-17.3** Privacy route — 1-line `middleware.ts` fix (smallest, verifiable immediately).
2. **W-16.3** Toast → `top-center` — one prop change.
3. **W-17.5** Dropdown nav tap fix — `onSelect`/router.push swap.
4. **W-17.2** Verify/harden axios refresh interceptor (already exists) — confirm edge cases.
5. **W-16.1** Shared Media gallery — absoluteMediaUrl + onError + link/file anchors.
6. **W-17.6** Search scope — extend `ConversationList` filter to peer name/nickname.
7. **W-16.5** Sidebar header "+" dropdown consolidation.
8. **W-16.4** Notification permission flow — **Web + Mobile together** (only cross-platform task; move trigger to post-auth on both).
9. **lib/store/auth.store.ts** type extension (shared prerequisite for W-16.6 + W-17.4).
10. **W-17.4** Avatar + Cover persistence + ImageCropperModal (store binding + cropper).
11. **W-16.6** Profile modal overhaul (Zalo card, bio fetch/seed fix, DOB removal, access control) — builds on #9/#10, may require file split for 400-line rule.
12. **W-16.2** Call-log system message + icons — emit `system.call.ended:`, humanize, MessageBubble icon.

## Edge Cases

- **W-16.1:** `msg.content` null/empty; non-image media (video) in the media grid; absolute vs relative upload URLs; broken-asset `onError` fallback.
- **W-16.2:** duration 0 / never-connected call (rejected) → "Missed call" vs "ended"; both peers must emit only once (avoid double system message — emit from the caller/owner only, or dedupe).
- **W-16.4 (Web):** `Notification` undefined (SSR / unsupported browser); user previously denied → don't nag (respect `denied`); only prompt when `default`; persist "prompted" flag.
- **W-16.4 (Mobile):** iOS permission denial; ensure `getToken()` still guarded if permission denied; restored session (`build()`) should request once.
- **W-16.6:** empty bio must persist (send `bio: ''`, not omit); viewing another user must hide Edit; DOB removed from view AND edit but schema field retained.
- **W-17.1:** only show "reacted" for reactions by *others* to *your* message; reaction preview must not permanently overwrite a newer real message; clear override when a newer message arrives.
- **W-17.2:** burst of concurrent 401s must trigger exactly one refresh (queue); refresh-endpoint 401 must NOT loop → hard logout.
- **W-17.3:** also confirm `/forgot-password` and `/privacy` reachable while unauthenticated.
- **W-17.4:** large image upload size; cropper output format (jpeg/png); revoke `URL.createObjectURL` to avoid leaks; cover aspect ratio vs avatar square.
- **W-17.6:** direct conversations whose peer name isn't yet loaded; case-insensitive; match nickname AND real name.

## Cross-Platform Sync Notes (per .claude/rules/sync.md)

- **W-16.4** is the only task requiring both platforms in this sprint — implement Web + Flutter together.
- **W-16.2** introduces a new `system.call.ended:` message type. Web renders it now; Flutter's
  `message_bubble_parts.dart` `_systemText` will need the same mapping to stay in sync — **flag for a
  follow-up Flutter task / QA**, since the spec scopes W-16.2 to Web only but sync.md treats a
  message type rendering on one platform but not the other as a P1 bug.
- All other tasks are Web UI/state fixes with no message-type or STOMP-contract changes, so no Flutter mirror is required.
