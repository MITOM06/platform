# Implementation Plan — Avatar/Conversation UX Bug Cluster (6 issues)

> Multi-platform bug-fix + UX redesign. User tests primarily on **Web**; Web (Next.js) and Mobile (Flutter) MUST stay in sync (`.claude/rules/sync.md`).
> All findings below were verified against actual files (line numbers cited). Backend = chat-service (Spring Boot 3, :8080) + auth-service (NestJS, :3001).

## Shared infrastructure already in place (reused by several issues)

- `PUT /api/conversations/{id}` → `ConversationService.updateGroup(...)` → `broadcastConversationUpdated(...)` → STOMP `/topic/conversation/{id}` with `{type:"CONVERSATION_UPDATED", conversation: ConversationResponse}` (`ConversationController.java:64-71,219-223`). **Real-time conversation sync path — reuse for wallpaper + group avatar.**
- Pin feature complete: `POST/DELETE /api/messages/{id}/pin` → `{pinnedMessages:[...]}` + STOMP `PINNED_MESSAGE` + system message (`MessageController.java:135-173`). `ConversationResponse.pinnedMessages: List<PinnedMessageDto{id,senderId,content,createdAt}>`. **No backend change needed for issue 2.**
- Web media resolver `absoluteMediaUrl()` (`apps/web/lib/media.ts:3-12`) — **no cache-busting**. Flutter `media_url.dart` `_absoluteUrl` (`apps/client/lib/core/utils/media_url.dart:8-11`) — **no cache-busting**.
- Upload endpoint `POST /api/uploads` returns **relative** url `/api/uploads/<objectId>` (`UploadController.java:63`). Consumers MUST resolve via `absoluteMediaUrl` (web) / `_absoluteUrl` (flutter).
- Nicknames + wallpaper are currently **client-local only** (web `localStorage`, flutter `shared_preferences`), synced via `system.nickname.changed:` / `system.theme.changed:` system messages (`apps/web/lib/nicknames.ts`, `chat_misc_providers.dart:42-103`).

---

## Issue 1 — Avatar change not reflected for OTHER viewers (stale avatar everywhere)

### Summary
When user A changes their avatar (auth-service `updateProfile`), other users keep seeing A's old avatar in every avatar circle. Three compounding causes: (a) avatar URL string is unchanged after re-upload → HTTP cache + Flutter `CachedNetworkImage` serve stale bytes; (b) no `USER_UPDATED` push so peers never invalidate; (c) web `useUser` has 5-min `staleTime`. Fix = make avatar URLs version-stamped at the source + invalidate user caches.

### Decision (architecture)
**Version the avatar URL at upload time** rather than appending volatile `?t=now` on every render (volatile cache-buster defeats all caching and re-downloads constantly). On avatar change, auth-service stores `avatarUrl` already including a stable version token (e.g. the new GridFS object id is already unique per upload — so the *path itself changes* per upload). **Verify**: profile avatar upload must go through `POST /api/uploads` (new object id each time) so the stored `avatarUrl` is a NEW path per change. If avatar upload reuses a fixed path, append `?v=<updatedAt-epoch>` once in the resolver based on the user's `updatedAt`.

### Backend
| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/server/auth-service/src/modules/users/users.service.ts` (`updateProfile` ~125-170) | 확인/수정 | Confirm avatar upload produces a NEW unique URL per change. If not, ensure `avatarUrl` carries a version suffix derived from `updatedAt`. |
| `apps/server/auth-service` users module | 신규(선택) | (Optional, recommended) Emit a lightweight `USER_UPDATED` signal so peers refresh. auth-service has no STOMP; simplest cross-service path = on profile update, POST an internal hook to chat-service which broadcasts `USER_UPDATED` to that user's conversations. **If too invasive, skip and rely on URL versioning + cache invalidation below.** |
| `apps/server/chat-service/.../controller/UserStatusController.java` (verify path) | 신규(선택) | If doing the push: endpoint `POST /internal/users/{id}/changed` (service-to-service) → broadcast `{type:"USER_UPDATED", userId, avatarUrl, displayName}` to each `/topic/conversation/{cid}` the user participates in. |

### Web
| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/web/components/chat/ConversationItem.tsx:160` | 수정 | `<AvatarImage src={avatarUrl}>` → `src={absoluteMediaUrl(avatarUrl)}` (currently RAW relative path — also feeds issue 5). |
| `apps/web/components/chat/ConversationHeader.tsx:117` | 수정 | Same: wrap `avatarUrl` in `absoluteMediaUrl`. |
| `apps/web/components/chat/MessageBubble.tsx` | 확인/수정 | Sender avatar in group bubbles — ensure `absoluteMediaUrl` + invalidation on `USER_UPDATED`. |
| `apps/web/lib/hooks/use-user.ts:9` | 수정 | Lower `staleTime` (e.g. 30s) OR invalidate `['user', userId]` on `USER_UPDATED`/`CONVERSATION_UPDATED`. |
| `apps/web/app/(main)/conversations/[id]/page.tsx` (STOMP switch ~291) | 수정 | Add `case 'USER_UPDATED'`: `queryClient.invalidateQueries(['user', userId])`. If no backend push, at minimum invalidate `['user', otherUserId]` after any avatar-related change. |
| `apps/web/lib/media.ts:3-12` | 수정(조건부) | If avatar path is NOT unique-per-upload, append `?v=<version>` for avatar URLs only. |

### Mobile
| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/client/lib/features/chat/ui/widgets/conversation_avatar.dart:35-44` | 수정 | `CachedNetworkImage` caches by URL → add `cacheKey: avatarUrl` derived to include version, OR if URL is unique-per-upload no change needed (just confirm). For the `?v=` approach, the version param naturally changes the cacheKey. |
| `apps/client/lib/core/utils/media_url.dart:8-11` | 수정(조건부) | Mirror web `?v=` logic if used. |
| `apps/client/lib/features/chat/data/stomp_service.dart` + chat notifier | 수정 | Handle `USER_UPDATED` (if backend push added): invalidate `userProfileProvider(userId)` (`chat_misc_providers.dart:21-26`, currently 5-min keepAlive). |
| `apps/client/lib/features/chat/ui/widgets/message_bubble_parts.dart` | 확인 | Sender avatar render — confirm uses `ConversationAvatar`/`_absoluteUrl`. |

### Edge cases
- Self view must update immediately after own change (invalidate own profile + `['conversations']`).
- Group avatar (issue 5) shares the `absoluteMediaUrl` fix — do both together.
- Letter-fallback must still show when avatar 404s (already handled via `errorWidget`).

---

## Issue 2 — Conversation Info panel: remove user-info section, keep ONLY pinned messages

### Summary
Pure client-side UI removal. Drop the "Chat Info"/"Chat Details" accordion (bio/DOB/member-count for the other user) and keep the existing Pinned Messages section. **No backend change.**

### Web
| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/web/components/chat/ConversationSettingsDrawer.tsx:256-292` | 수정 | Remove the entire "Chat Info" `AccordionItem` (user bio/DOB for direct, member count for group). Keep Pinned Messages accordion (`:294-308`) and `PinnedMessagesSection`. |

### Mobile
| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/client/lib/features/chat/ui/widgets/conversation_info_sidebar.dart:138-142` | 수정 | Remove "Chat Details" `ExpansionTile`. |
| `apps/client/lib/features/chat/ui/widgets/conversation_info_sidebar.dart` (`_buildChatDetailsContent` ~289-313) | 삭제 | Remove the now-unused helper (bio/DOB/member count). |
| `apps/client/lib/features/chat/ui/widgets/conversation_info_sidebar_parts.dart` | 확인 | Drop any helpers orphaned by the removal. |

### Sync checkpoint
- Both platforms must keep the Pinned Messages section identical; both must drop user-info. Member count (group) is also removed per spec ("only pinned messages").

---

## Issue 3 — Nickname editing redesign (1:1 AND group): single button → centered modal

### Summary
Replace the current inline two-field nickname UI (web `CustomizeChatSection`, flutter nickname dialog) with **one "Edit nicknames" button** opening a **centered modal** listing each relevant participant (self + the other person for 1:1; self + all members for group) as a row: **avatar + real account displayName**, below it the **nickname with a pencil edit icon**, placeholder "no nickname" when empty. Self nickname editable. Storage/transport unchanged (client-local + `system.nickname.changed:` system message) — **no new backend endpoint**.

### Decision (data model / transport)
Keep the existing transport: nicknames are NOT server-persisted. Save path stays `system.nickname.changed:<userId>:<nickname>` broadcast via STOMP, applied by both clients (`apps/web/lib/nicknames.ts:42-53`, flutter `NicknamesNotifier` + `chat_system_message_parser.dart`). This avoids a backend migration and matches the wallpaper pattern. (Rationale: spec only asks for UI redesign + self-nickname, both already supported by the local model.)

### Web
| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/web/components/chat/group/CustomizeChatSection.tsx:92-117` | 수정 | Replace the two inline `NicknameRow`s with a single button that opens the new modal. Make it work for BOTH `isDirect` and `isGroup` (currently nickname rows are gated to `isDirect` only). |
| `apps/web/components/chat/group/NicknamesModal.tsx` | 신규 | Centered `Dialog` (shadcn). Props: participants `[{userId, displayName, avatarUrl}]`, current nicknames map, `onSave(userId, value)`. Each row: `<Avatar src={absoluteMediaUrl(avatarUrl)}>` + real displayName + nickname line with pencil → inline `Input`; placeholder = `t('nicknameNonePlaceholder')`. |
| `apps/web/components/chat/ConversationSettingsDrawer.tsx:79-91` | 확인 | Reuse existing `saveNickname(targetId,value)` (already broadcasts system message). Pass participant profile list (fetch via `useUser`/conversation participants) into the modal. |
| `apps/web/lib/nicknames.ts` | 변경없음 | Storage/broadcast helpers reused as-is. |

### Mobile
| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/client/lib/features/chat/ui/widgets/conversation_customisation_dialogs.dart:50-93` | 수정 | Redesign `showNicknamesDialog()` into one centered `Dialog`: a column of participant rows (self + others), each = `ConversationAvatar` + real displayName + nickname text/placeholder + pencil `IconButton` toggling an inline `TextField`. Single dialog; single dismiss. |
| `apps/client/lib/features/chat/ui/widgets/conversation_info_sidebar.dart:144-181` | 수정 | "Nicknames" entry now opens the redesigned modal (works for group too, not just direct). |
| `apps/client/lib/features/chat/domain/chat_misc_providers.dart:67-103` | 변경없음 | `NicknamesNotifier.setNickname` reused; broadcast unchanged. |

### i18n keys (add to all locales)
- Web `apps/web/messages/*.json` (`chat` namespace): `editNicknames`, `nicknameNonePlaceholder`, `nicknameModalTitle`. Reuse existing `nicknameYou` / `nicknameOther` if helpful.
- Flutter `apps/client/lib/l10n/app_*.arb` (all 7): `editNicknames`, `nicknameNonePlaceholder`, `nicknameModalTitle` → run `flutter gen-l10n`.

### Edge cases
- Group: list all members; fetching each member's profile (avatar+displayName) may need per-user `useUser` / `userProfileProvider` calls — render fallback letter while loading.
- Empty nickname clears it (existing `writeNickname` deletes on blank).
- Self row label should make clear it is "you".

---

## Issue 4 — Change Password: old-password field must start EMPTY

### Summary
Web change-password "current password" field is being auto-filled by the browser password manager (no `autoComplete` attribute set → browser fills saved creds). Mobile code already starts empty (OS-level autofill only). Backend correct. **No backend change.**

### Web
| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/web/components/chat/ChangePasswordDialog.tsx:123` (current-password `<Input>`) | 수정 | Add `autoComplete="new-password"` (most reliable to suppress autofill) or `autoComplete="off"` + `name`/`readOnly`-on-focus trick. New-password fields get `autoComplete="new-password"` too. |

### Mobile
| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/client/lib/features/settings/ui/widgets/change_password_dialog.dart:146` | 확인/수정 | Controller already empty. If OS autofill prefills, set `autofillHints: const []` / `enableSuggestions:false` / `autocorrect:false` on the current-password field (verify `PonTextField` exposes these; extend if needed in `apps/client/lib/core/widgets/pon_widgets.dart`). |

### Reference (no change)
- `apps/server/auth-service/src/modules/users/users.controller.ts:54-64` — `POST /api/users/me/change-password` `{currentPassword, newPassword}`.

### Sync checkpoint
- Both platforms: old-password field starts empty, no autofill.

---

## Issue 5 — Group avatar change "does not work"

### Summary
Backend persists the group avatar correctly (`ConversationService.updateGroup` saves `avatarUrl`, admin-gated, broadcasts `CONVERSATION_UPDATED`). **The real bug is on Web display**: `POST /api/uploads` returns a **relative** URL `/api/uploads/<id>`, but web renders group avatars with a RAW `src` (no `absoluteMediaUrl`), so the image resolves against the web origin (404) and appears unchanged. Flutter resolves via `_absoluteUrl` so it works there. Secondary: only admins may change (UI already gates with `isAdmin`); a non-admin attempt 403s silently.

### Root cause (verified)
- `UploadController.java:63` → `url = "/api/uploads/" + objectId` (relative).
- `GroupSettingsDrawer.tsx:176` → `<img src={conversation.avatarUrl}>` (raw relative).
- `ConversationItem.tsx:160`, `ConversationHeader.tsx:117` → `<AvatarImage src={avatarUrl}>` (raw relative).
- Flutter `conversation_avatar.dart:38` correctly wraps in `_absoluteUrl` → works on mobile.

### Backend
| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/server/.../service/ConversationService.java:132-143` | 변경없음(확인) | Logic correct. Optionally also broadcast a `system.group.avatar.changed` system message for history. |
| `apps/server/.../service/ConversationCacheService.java` | 확인 | Verify Redis cache is overwritten on `save()` so `getConversation` returns fresh avatar (agent flagged as unverified). |

### Web
| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/web/components/chat/GroupSettingsDrawer.tsx:176` | 수정 | `<img src={conversation.avatarUrl}>` → `src={absoluteMediaUrl(conversation.avatarUrl)}`. |
| `apps/web/components/chat/ConversationItem.tsx:160` | 수정 | Wrap in `absoluteMediaUrl` (shared with issue 1). |
| `apps/web/components/chat/ConversationHeader.tsx:117` | 수정 | Wrap in `absoluteMediaUrl` (shared with issue 1). |
| `apps/web/components/chat/GroupSettingsDrawer.tsx:133-147` | 확인 | Upload→update happy path correct; ensure error toast surfaces 403 (non-admin) distinctly. |

### Mobile
| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/client/lib/features/chat/ui/group_info_screen.dart:227-244` | 확인 | Upload+update+invalidate correct. Confirm it listens to `CONVERSATION_UPDATED` so the new avatar appears without manual refresh. |

### Edge cases
- Non-admin change → backend 403; show a clear "admins only" message instead of generic error.
- After change, `CONVERSATION_UPDATED` must refresh the conversation list tile + header on both platforms.

---

## Issue 6 — Chat wallpaper must be SHARED per-conversation (incl. groups), not per-device

### Summary
Wallpaper is stored only in `localStorage` (web) / `shared_preferences` (flutter) and "synced" via a transient `system.theme.changed:` message. Other members don't persist it; on app restart it's lost. Fix = **persist wallpaper on the Conversation document** and distribute via the existing `PUT /api/conversations/{id}` + `CONVERSATION_UPDATED` path so all members share it.

### Decision (data model)
Add a `wallpaper` String field to the `Conversation` model. Reuse `UpdateConversationRequest` (add `wallpaper`) and the existing `updateGroup`/`PUT /{id}` endpoint — but allow ANY participant (not just admins) to set wallpaper for direct chats; for groups, decide admin-only vs any-member. **Recommendation: any participant may set conversation wallpaper** (it's a shared cosmetic; matches "shared across the whole conversation"). This needs a separate service method from `updateGroup` (which is admin-gated).

### Backend
| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/server/.../model/Conversation.java` | 수정 | Add `private String wallpaper;` (null = default). |
| `apps/server/.../dto/UpdateConversationRequest.java` | 수정 | `record UpdateConversationRequest(String name, String avatarUrl, String wallpaper)` OR add a dedicated `WallpaperRequest(String wallpaper)`. |
| `apps/server/.../dto/ConversationResponse.java` | 수정 | Add `String wallpaper` to the record + backward-compat constructor. Populate in `toResponse(...)`. |
| `apps/server/.../service/ConversationService.java` | 신규 | `setWallpaper(userId, convId, wallpaper)` — require participant membership (NOT admin), persist via `conversationCacheService.save`, return `toResponse`. |
| `apps/server/.../controller/ConversationController.java` | 신규 | `PUT /api/conversations/{id}/wallpaper` body `{wallpaper}` → `setWallpaper` → `broadcastConversationUpdated(updated)`. |

### API Contract
**Endpoint:** `PUT /api/conversations/{id}/wallpaper`
- Request: `{ "wallpaper": string }`  (e.g. `"preset:midnight_glow"`, `"/api/uploads/<id>#fit=cover&scale=120"`, or `""` to reset)
- Response: `ConversationResponse` (now including `wallpaper`)
- Broadcast: STOMP `/topic/conversation/{id}` `{type:"CONVERSATION_UPDATED", conversation}` (existing).

### Web
| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/web/lib/api/chat.ts` | 신규 | `setWallpaper(id, wallpaper) => chatApi.put('/api/conversations/'+id+'/wallpaper', {wallpaper})`. |
| `apps/web/lib/api/types.ts` (`Conversation` ~line 116) | 수정 | Add `wallpaper: string | null`. |
| `apps/web/components/chat/WallpaperPickerModal.tsx:91-102` | 수정 | Replace `localStorage.setItem` + `system.theme.changed` send with `chatService.setWallpaper(conversationId, value)`. Keep optimistic local apply via `wallpaper-changed` event. |
| `apps/web/lib/hooks/use-wallpaper.ts:76-90` | 수정 | Read wallpaper from the conversation query (`conversation.wallpaper`) instead of `localStorage`. Re-resolve on `CONVERSATION_UPDATED`. Keep `resolveWallpaper` logic. |
| `apps/web/app/(main)/conversations/[id]/page.tsx` (STOMP ~291) | 확인 | `CONVERSATION_UPDATED` already updates `['conversation', id]` cache → wallpaper refreshes for all members. |

### Mobile
| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/client/lib/features/chat/data/chat_repository.dart` | 신규 | `setWallpaper(convId, wallpaper)` → `chatDio.put('/api/conversations/$convId/wallpaper', {wallpaper})`. |
| `apps/client/lib/features/chat/domain/chat_models.dart` (`ConversationModel`) | 수정 | Add `wallpaper` field + JSON parse. |
| `apps/client/lib/features/chat/domain/chat_misc_providers.dart:42-65` | 수정 | `ChatWallpaperNotifier` reads from the conversation model (server) rather than `shared_preferences`; updates on `CONVERSATION_UPDATED`. Keep optimistic local set. |
| `apps/client/lib/features/chat/ui/widgets/chat_wallpaper_dialog.dart:153-169` | 수정 | Call `chatRepository.setWallpaper(...)` instead of (or in addition to) `setWallpaper` local + `system.theme.changed` send. |
| `apps/client/lib/features/chat/domain/chat_system_message_parser.dart:30-35` | 수정 | Keep parsing `system.theme.changed:` for backward compat with old messages, but server value is now authoritative. |

### Data Model Changes
- `Conversation.wallpaper: String` (new MongoDB field, nullable). Existing docs default null → resolves to default wallpaper. No migration required.

### Edge cases
- Empty string / "default" resets to default for everyone.
- Uploaded-image wallpapers: value stores relative `/api/uploads/...#fit=&scale=` — resolver already wraps via `absoluteMediaUrl` (web) / `_absoluteUrl` (flutter).
- Backward compat: old `system.theme.changed:` messages still parse; new path is server-authoritative.
- Decide group permission: recommended any-member can set (shared cosmetic). If product wants admin-only, gate `setWallpaper` like `requireGroupAdmin` for groups only.

---

## Implementation Order

1. **Backend first**
   - Issue 6: `Conversation.wallpaper` field + `PUT /{id}/wallpaper` + `ConversationResponse.wallpaper` + service method.
   - Issue 1 (optional push): `USER_UPDATED` broadcast hook (only if pursuing real-time peer refresh).
   - Issue 5: verify `ConversationCacheService` invalidation (likely no change).
2. **Web + Mobile in parallel** (mirror each change per `sync.md`)
   - Issues 1 & 5 together (shared `absoluteMediaUrl`/`_absoluteUrl` avatar fix + cache invalidation).
   - Issue 2 (remove user-info section).
   - Issue 3 (nickname modal redesign) — keep client-local transport.
   - Issue 4 (autocomplete off on current-password).
   - Issue 6 client wiring (read wallpaper from conversation, save via new endpoint).
3. **Verify**: `mvn test` (chat-service), `pnpm build` (web), `flutter analyze` + `flutter gen-l10n` (mobile). Cross-platform sync check on each issue.

## Cross-Platform Sync Checklist (per `sync.md`)
- [ ] Avatar (issue 1/5): same `absoluteMediaUrl`/`_absoluteUrl` resolution + same invalidation on update; group + user avatars render on BOTH.
- [ ] Conversation Info (issue 2): user-info removed on BOTH; pinned-only on BOTH.
- [ ] Nickname modal (issue 3): same modal layout/behavior, self-nickname on BOTH, same `system.nickname.changed:` transport; i18n keys present in `messages/*.json` AND `app_*.arb`.
- [ ] Password (issue 4): old field empty on BOTH.
- [ ] Wallpaper (issue 6): `wallpaper` field consumed identically; `CONVERSATION_UPDATED` re-resolves wallpaper on BOTH; shared across all group members.
