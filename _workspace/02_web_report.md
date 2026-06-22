## Web Implementation Report

Scope: Web sections of `_workspace/01_plan.md` — issues 1-6 (avatar sync, conversation-info panel trim, nickname modal redesign, password autocomplete, group/user avatar 404 fix, shared per-conversation wallpaper).

### 변경된 파일

**Issue 1 — Avatar stale for other viewers**
- `lib/hooks/use-user.ts` — `staleTime` 5min → 30s. Avatar uploads produce a NEW unique URL per change (`POST /api/uploads` → `/api/uploads/<objectId>`), so a refetched profile carries a fresh image path that bypasses the HTTP cache without volatile cache-busting. No `?v=` needed.
- `app/(main)/conversations/[id]/page.tsx` — on `CONVERSATION_UPDATED`, also invalidate `['user', uid]` for every participant so peers pick up new avatars/displayNames. (No backend `USER_UPDATED` push added — plan marked it optional; cache invalidation + short staleTime cover it.)

**Issue 2 — Conversation Info panel: pinned-only**
- `components/chat/ConversationSettingsDrawer.tsx` — removed the entire "Chat Info" `AccordionItem` (bio/DOB for direct, member count for group). Pinned Messages accordion + `PinnedMessagesSection` retained. Dropped now-unused `Users, Info, Cake` icon imports.

**Issue 3 — Nickname editing redesign (centered modal, 1:1 + group)**
- `components/chat/group/NicknamesModal.tsx` — NEW. Centered `Dialog` listing each participant as a row: avatar (via `absoluteMediaUrl`) + real account displayName, with editable nickname below (pencil → inline `Input`, "No nickname" placeholder when empty). Self row labelled "(you)". Self nickname editable.
- `components/chat/group/CustomizeChatSection.tsx` — replaced the two inline `NicknameRow`s with a single "Edit nicknames" button opening the modal; works for BOTH direct and group. Removed obsolete `NicknameRow` helper + `Button`/`Input` imports.
- `components/chat/GroupSettingsDrawer.tsx` — added "Edit nicknames" button + `NicknamesModal` to the group Customize section (self + all members), reusing the same `system.nickname.changed:` broadcast transport.
- `components/chat/ConversationSettingsDrawer.tsx` — passes `participantIds` (AI bot excluded) + reactive `nicknameMap` into `CustomizeChatSection`.
- `lib/nicknames.ts` — added reactive `useNicknames(convId)` hook (whole map, re-reads on `NICKNAME_EVENT`). Storage/broadcast helpers unchanged.

**Issue 4 — Change Password: old field starts empty**
- `components/chat/ChangePasswordDialog.tsx` — added `autoComplete="new-password"` to current, new, and confirm password inputs to suppress browser autofill.

**Issue 5 — Group/user avatar raw src 404 → absoluteMediaUrl**
- `components/chat/ConversationItem.tsx` — `AvatarImage src` wrapped in `absoluteMediaUrl`.
- `components/chat/ConversationHeader.tsx` — same.
- `components/chat/GroupSettingsDrawer.tsx` — raw `<img src={conversation.avatarUrl}>` wrapped in `absoluteMediaUrl`.
- `components/chat/group/SettingsHeader.tsx` — wrapped.
- `components/chat/ActiveFriendsRow.tsx` — wrapped.
- `app/(main)/friends/page.tsx` — wrapped.
- `app/(main)/explore/page.tsx` — channel avatar wrapped.
  (ReactionsDetailModal, UserProfileDrawer, GroupReadDetailsModal, GroupMemberRow, ai-persona already used `absoluteMediaUrl` — no change.)

**Issue 6 — Shared per-conversation wallpaper (server-side)**
- `lib/api/types.ts` — `Conversation.wallpaper: string | null` added.
- `lib/api/chat.ts` — `setWallpaper(id, wallpaper)` → `PUT /api/conversations/{id}/wallpaper`.
- `lib/hooks/use-wallpaper.ts` — reads wallpaper from the `['conversation', id]` query (server-authoritative, shared) instead of `localStorage`; re-resolves on `CONVERSATION_UPDATED`. Optimistic `wallpaper-changed` CustomEvent (carries `{conversationId, value}`) applies instantly before the broadcast round-trips. Exported `WALLPAPER_EVENT` + `WallpaperEventDetail`.
- `components/chat/WallpaperPickerModal.tsx` — initial value read from `conversation.wallpaper`; confirm persists via `chatService.setWallpaper` (replacing `localStorage.setItem` + `system.theme.changed` send) with optimistic event + saving spinner + error toast.

### TypeScript 타입 체크 결과
- `pnpm build` (apps/web): **Compiled successfully, errors: 0**. (Only pre-existing pnpm/node deprecation warnings, unrelated.)

### i18n 추가 키 (chat namespace, all 7 locales)
- `editNicknames`: "Edit nicknames"
- `nicknameModalTitle`: "Nicknames"
- `nicknameNonePlaceholder`: "No nickname"
- `wallpaperSaveError`: "Failed to save wallpaper"
  (Translated into vi/zh/ja/ko/es/fr.)

### Flutter 미러 파일 동기화 확인
- `NicknamesModal.tsx` ↔ `conversation_customisation_dialogs.dart` (`showNicknamesDialog`): ✓ both redesigned to a single centered modal (self + members, pencil edit, placeholder); same `system.nickname.changed:` transport.
- `CustomizeChatSection.tsx`/`GroupSettingsDrawer.tsx` "Edit nicknames" ↔ `conversation_info_sidebar.dart` nicknames entry: ✓ both open the modal for direct AND group.
- `ChangePasswordDialog.tsx` (autoComplete) ↔ `change_password_dialog.dart`: ✓ both start empty / suppress autofill.
- Avatar `absoluteMediaUrl` ↔ `conversation_avatar.dart` `_absoluteUrl`: ✓ both resolve relative `/api/uploads/...` against the chat base.
- Wallpaper `setWallpaper` / `Conversation.wallpaper` ↔ `chat_repository.dart` `setWallpaper` + `chat_misc_providers.dart`: ✓ both consume `wallpaper` from the conversation model, re-resolve on `CONVERSATION_UPDATED`, share across members. (Verified mobile-dev added these — repository + provider present.)
- i18n keys `editNicknames` present in all 7 `app_*.arb`: ✓ (7/7).
- Conversation-info trim (issue 2) ↔ `conversation_info_sidebar.dart` "Chat Details" removal: mirror handled by mobile-dev per plan.

### 주의사항
- **No backend `USER_UPDATED` push** was added (plan marked optional/invasive). Issue 1 relies on: (a) unique-per-upload avatar URL paths, (b) 30s `useUser` staleTime, (c) `['user', uid]` invalidation on `CONVERSATION_UPDATED`. A peer who changes ONLY their avatar (no conversation event) will refresh within 30s on next access, or immediately if any `CONVERSATION_UPDATED` fires. If instant cross-peer refresh is required later, add the `USER_UPDATED` broadcast hook described in the plan + a `case 'USER_UPDATED'` in the STOMP switch.
- Backend wallpaper endpoint `PUT /api/conversations/{id}/wallpaper` + `Conversation.wallpaper` + `ConversationResponse.wallpaper` already implemented (verified) — any participant may set it (not admin-gated).
- Old `system.theme.changed:` messages still humanize in `lib/system-messages.ts` for history; web never applied them as a wallpaper setter, so the server value is now the single source of truth (strictly better than the prior per-device localStorage).
- `NicknamesModal` fetches each participant profile via `useUser` (letter fallback while loading) — group rows render progressively.
