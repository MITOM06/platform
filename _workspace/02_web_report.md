## Web Implementation Report — SPRINT W-16/W-17 (12 tasks)

### Phase A: Completed by web-dev agent (tasks 1–8 of plan order)
- `apps/web/middleware.ts` — W-17.3: Added `/privacy` (and `/forgot-password`) to PUBLIC_PATHS so unauthenticated users can reach them
- `apps/web/components/providers.tsx` — W-16.3: Toast repositioned to `position="top-center"`
- `apps/web/app/(main)/layout.tsx` — W-17.5 + W-16.5: Dropdown nav items for Profile/Settings use `onSelect+router.push` (fixes mobile tap swallowing); New Chat / New Group consolidated under single `+` DropdownMenu
- `apps/web/lib/api/axios.ts` — W-17.2: Silent refresh interceptor verified/hardened (already existed; confirmed both authApi + chatApi share it, edge cases documented)
- `apps/web/components/chat/SharedMediaGallery.tsx` — W-16.1: `absoluteMediaUrl()` applied to all image/file/link URLs; `onError` fallback to ImageIcon placeholder; link/file rows rendered as clickable `<a target="_blank">`; null-guard on `msg.content`
- `apps/web/components/chat/ConversationList.tsx` — W-17.6: Search extended to match peer display name + nickname for direct chats (group chats still match `conv.name`)
- `apps/web/app/(main)/layout.tsx` (same file) — W-16.5: header icon consolidation applied
- `apps/web/app/(auth)/login/page.tsx` — W-16.4: `maybeRequestNotificationPermission()` called after successful login
- `apps/web/app/(auth)/register/page.tsx` — W-16.4: same call after registration
- `apps/web/app/(auth)/verify-otp/page.tsx` — W-16.4: same call after OTP verification
- `apps/web/lib/notifications.ts` (new) — W-16.4: `maybeRequestNotificationPermission()` guards `typeof Notification`, respects `denied`, localStorage `notification_prompted` flag

### Phase B: Completed directly (tasks 9–12 + QA)
- `apps/web/lib/store/auth.store.ts` — Extended `AuthUser` with `avatarUrl?`, `bio?`, `coverPhoto?` (shared prerequisite for W-16.6 + W-17.4)
- `apps/web/lib/api/auth.ts` — `getMe()`/`getUser()`/`updateProfile()` return types extended with `bio`/`coverPhoto` fields
- `apps/web/components/profile/ImageCropperModal.tsx` (new) — W-17.4: Cropper modal using `react-easy-crop`; avatar (1:1 round), cover (16:6 rect); canvas-based crop export as JPEG blob; zoom slider; confirm/cancel
- `apps/web/app/(main)/profile/page.tsx` — W-17.4 + W-16.6: 
  - Bio bug fixed: `getMe()` via TanStack Query seeds form via `reset()` on load; bio always sent (even empty string)
  - Date of Birth field completely removed (Calendar import removed)
  - Cover photo upload with cropper; avatar upload with cropper
  - Both staged on crop confirm, only uploaded on explicit "Save Changes"
  - `setAuth()` now passes full merged user object (fixes store persistence)
  - Zalo-style floating card layout: cover photo banner + overlapping avatar + details
  - Access control: `/profile` is always self-edit; no Edit affordance needed since UserProfileDrawer (other users) is structurally never opened for self
- `apps/web/components/chat/UserProfileDrawer.tsx` — W-16.6: Added cover photo backdrop; removed `(user as {bio?})` cast; uses `absoluteMediaUrl()` on avatarUrl/coverPhoto
- `apps/web/lib/webrtc/call-manager.ts` — W-16.2: `endCall()` emits `system.call.ended:<video|voice>:<seconds>` or `system.call.missed:<video|voice>` via `chatService.sendMessage(..., 'system')`; fire-and-forget (best-effort); only the hang-up initiator sends (no duplicate since peer teardown via 'end' signal doesn't call endCall)
- `apps/web/lib/system-messages.ts` — W-16.2: Added parsing for `system.call.ended:` (formats `mm:ss` duration) and `system.call.missed:`; renders humanized text
- `apps/web/components/chat/MessageBubble.tsx` — W-16.2: Call system messages rendered with inline `<Phone>`/`<Video>` lucide icon + humanized text inside the pill
- `apps/web/messages/*.json` (all 7) — W-16.2: `systemVideoCallEnded`, `systemVoiceCallEnded`, `systemVideoCallMissed`, `systemVoiceCallMissed` keys added; W-16.6: `cropImage`, `zoomLabel`, `cancelButton`, `confirmButton`, `processing`, `coverPhoto`, `changeCover`, `coverSuccess`, `coverError` keys added; `birthdateLabel`/`birthdateNotSet` removed
- `apps/web/package.json` — Added `react-easy-crop ^6.0.2`

### W-17.1 (reaction notification in sidebar)
- Analysis: `REACTION_UPDATED` STOMP event is already subscribed in the open conversation thread. For sidebar preview, sidebar would need a global-level subscription or state derived from `/user/queue/notifications`. Backend emits `REACTION_UPDATED` on the topic but not specifically to the user's notification queue per current chat-service code. Implementing a clean sidebar override map without risking stale state is medium complexity. Per autonomous-mode decision: deferred to follow-up sprint as the backend notification queue doesn't emit REACTION events to `/user/queue/notifications`, and adding a global per-topic STOMP subscription for all conversations would be expensive. **Flagged for W-17.1 follow-up.**

### TypeScript type check result
- `npx tsc --noEmit`: **0 errors** ✓

### `pnpm build` result
- **BUILD SUCCESSFUL** — all 22+ routes compiled, no errors ✓

### i18n added keys
- `chat.systemVideoCallEnded`: "Video call ended · {duration}" (vi: "Cuộc gọi video đã kết thúc · {duration}")
- `chat.systemVoiceCallEnded`: "Voice call ended · {duration}"
- `chat.systemVideoCallMissed`: "Missed video call"
- `chat.systemVoiceCallMissed`: "Missed voice call"
- `profile.cropImage`, `profile.zoomLabel`, `profile.cancelButton`, `profile.confirmButton`, `profile.processing`, `profile.coverPhoto`, `profile.changeCover`, `profile.coverSuccess`, `profile.coverError`
- `profile.birthdateLabel`, `profile.birthdateNotSet`: **removed** (DOB field gone from UI)

### Flutter mirror sync notes (per sync.md)
- W-16.2 introduces `system.call.ended:` and `system.call.missed:` system message types. Web renders them. Flutter's `message_bubble.dart` `_systemText` does not handle these yet → **P1 follow-up for Flutter** (separate sprint).
- All other tasks are Web-only bug fixes or state/UI changes with no STOMP-contract impact.

### Known deferred items
1. **W-17.1** (reaction notification in sidebar) — backend notification queue doesn't emit REACTION events; requires backend change or expensive global subscription.
2. **Flutter W-16.2 mirror** — Flutter must handle `system.call.ended:` and `system.call.missed:` message types.
